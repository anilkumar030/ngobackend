const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { generateSlug, extractTextFromHtml, truncateText } = require('../utils/helpers');

class ProjectUpdate extends Model {
  /**
   * Check if update is published and visible
   */
  get isPublished() {
    return this.status === 'published' && 
           (!this.published_at || new Date() >= this.published_at);
  }

  /**
   * Check if update is scheduled for future publication
   */
  get isScheduled() {
    return this.status === 'published' && 
           this.published_at && 
           new Date() < this.published_at;
  }

  /**
   * Get content summary/excerpt
   */
  get excerpt() {
    if (this.custom_excerpt) {
      return this.custom_excerpt;
    }
    
    const text = extractTextFromHtml(this.content || '');
    return truncateText(text, 200);
  }

  /**
   * Get reading time estimate (words per minute: 200)
   */
  get readingTime() {
    const text = extractTextFromHtml(this.content || '');
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / 200);
  }

  /**
   * Check if update has media attachments
   */
  get hasMedia() {
    return (this.images && this.images.length > 0) || 
           (this.videos && this.videos.length > 0) ||
           (this.documents && this.documents.length > 0);
  }

  /**
   * Generate SEO-friendly slug from title
   */
  async generateSlug() {
    let baseSlug = generateSlug(this.title);
    let slug = baseSlug;
    let counter = 1;
    
    // Ensure slug is unique within the project
    while (await ProjectUpdate.findOne({ 
      where: { 
        slug, 
        project_id: this.project_id,
        id: { [Op.ne]: this.id || null } 
      } 
    })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }

  /**
   * Get public update data
   */
  getPublicData() {
    if (!this.isPublished) return null;
    
    return {
      id: this.id,
      title: this.title,
      slug: this.slug,
      excerpt: this.excerpt,
      content: this.content,
      update_type: this.update_type,
      milestone_reached: this.milestone_reached,
      progress_update: this.progress_update,
      budget_update: this.budget_update,
      images: this.images || [],
      videos: this.videos || [],
      featured_image: this.featured_image,
      tags: this.tags || [],
      reading_time: this.readingTime,
      has_media: this.hasMedia,
      published_at: this.published_at || this.created_at,
      created_at: this.created_at,
      author_name: this.author_name
    };
  }

  /**
   * Get admin update data (includes all fields)
   */
  getAdminData() {
    return {
      id: this.id,
      project_id: this.project_id,
      title: this.title,
      slug: this.slug,
      content: this.content,
      custom_excerpt: this.custom_excerpt,
      excerpt: this.excerpt,
      status: this.status,
      update_type: this.update_type,
      milestone_reached: this.milestone_reached,
      progress_update: this.progress_update,
      budget_update: this.budget_update,
      priority: this.priority,
      featured_image: this.featured_image,
      images: this.images || [],
      videos: this.videos || [],
      documents: this.documents || [],
      tags: this.tags || [],
      is_featured: this.is_featured,
      author_name: this.author_name,
      reading_time: this.readingTime,
      has_media: this.hasMedia,
      metadata: this.metadata,
      published_at: this.published_at,
      created_by: this.created_by,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  /**
   * Publish the update
   */
  async publish(publishAt = null) {
    this.status = 'published';
    this.published_at = publishAt || new Date();
    return await this.save();
  }

  /**
   * Archive the update
   */
  async archive() {
    this.status = 'archived';
    return await this.save();
  }
}

ProjectUpdate.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  project_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'projects',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      len: [3, 500],
      notEmpty: true
    }
  },
  slug: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: [3, 255],
      is: /^[a-z0-9-]+$/ // Only lowercase letters, numbers, and hyphens
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [10, 50000],
      notEmpty: true
    },
    comment: 'Rich text content of the update'
  },
  custom_excerpt: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 500]
    }
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'archived', 'scheduled'),
    allowNull: false,
    defaultValue: 'draft'
  },
  update_type: {
    type: DataTypes.ENUM('progress', 'milestone', 'announcement', 'photos', 'budget', 'challenge', 'completion', 'other'),
    allowNull: false,
    defaultValue: 'progress',
    comment: 'Type of update for categorization'
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    allowNull: false,
    defaultValue: 'medium'
  },
  milestone_reached: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Specific milestone or achievement described in this update'
  },
  progress_update: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Structured progress data like percentage, phase completion, etc.'
  },
  budget_update: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Budget-related information if applicable'
  },
  impact_metrics: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Measurable impact data for this update'
  },
  featured_image: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  images: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of image URLs with metadata'
  },
  videos: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of video URLs with metadata'
  },
  documents: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of document URLs with metadata (reports, certificates, etc.)'
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Specific location for this update if different from main project'
  },
  coordinates: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'GPS coordinates for location-specific updates'
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this update should be featured prominently'
  },
  is_major_update: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this is a major update that should trigger notifications'
  },
  author_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      len: [0, 255]
    },
    comment: 'Name of the person who created this update'
  },
  tags: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Tags for categorization and search'
  },
  published_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the update was/will be published'
  },
  notification_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether notifications have been sent for this update'
  },
  view_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  like_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  comment_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  share_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional metadata for the update'
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'ProjectUpdate',
  tableName: 'project_updates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (update) => {
      if (!update.slug) {
        update.slug = await update.generateSlug();
      }
      
      // Set published_at if status is published and no date is set
      if (update.status === 'published' && !update.published_at) {
        update.published_at = new Date();
      }
    },
    beforeUpdate: async (update) => {
      if (update.changed('title') && !update.changed('slug')) {
        update.slug = await update.generateSlug();
      }
      
      // Set published_at when status changes to published
      if (update.changed('status') && update.status === 'published' && !update.published_at) {
        update.published_at = new Date();
      }
    }
  },
  indexes: [
    {
      fields: ['project_id', 'slug'],
      unique: true
    },
    {
      fields: ['project_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['update_type']
    },
    {
      fields: ['priority']
    },
    {
      fields: ['is_featured']
    },
    {
      fields: ['is_major_update']
    },
    {
      fields: ['created_by']
    },
    {
      fields: ['published_at']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['view_count']
    },
    {
      fields: ['notification_sent']
    },
    {
      fields: ['project_id', 'status']
    },
    {
      fields: ['project_id', 'published_at']
    },
    {
      fields: ['status', 'is_featured']
    },
    {
      fields: ['status', 'update_type']
    },
    {
      fields: ['status', 'is_major_update']
    },
    // GIN indexes for JSONB columns
    {
      fields: ['tags'],
      using: 'gin'
    },
    {
      fields: ['progress_update'],
      using: 'gin'
    },
    {
      fields: ['impact_metrics'],
      using: 'gin'
    }
  ],
  scopes: {
    published: {
      where: {
        status: 'published',
        published_at: {
          [Op.lte]: new Date()
        }
      }
    },
    draft: {
      where: {
        status: 'draft'
      }
    },
    scheduled: {
      where: {
        status: 'published',
        published_at: {
          [Op.gt]: new Date()
        }
      }
    },
    featured: {
      where: {
        status: 'published',
        is_featured: true,
        published_at: {
          [Op.lte]: new Date()
        }
      }
    },
    majorUpdates: {
      where: {
        status: 'published',
        is_major_update: true,
        published_at: {
          [Op.lte]: new Date()
        }
      }
    },
    byProject: (projectId) => ({
      where: {
        project_id: projectId
      }
    }),
    byUpdateType: (updateType) => ({
      where: {
        update_type: updateType,
        status: 'published',
        published_at: {
          [Op.lte]: new Date()
        }
      }
    }),
    recentPublished: {
      where: {
        status: 'published',
        published_at: {
          [Op.lte]: new Date()
        }
      },
      order: [['published_at', 'DESC']],
      limit: 10
    },
    needingNotification: {
      where: {
        status: 'published',
        is_major_update: true,
        notification_sent: false,
        published_at: {
          [Op.lte]: new Date()
        }
      }
    },
    public: {
      where: {
        status: 'published',
        published_at: {
          [Op.lte]: new Date()
        }
      }
    }
  }
});

module.exports = ProjectUpdate;