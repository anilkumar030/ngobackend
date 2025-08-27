const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/database');

class Testimonial extends Model {
  /**
   * Check if testimonial is approved for public display
   */
  get isApproved() {
    return this.status === 'approved';
  }

  /**
   * Check if testimonial is featured
   */
  get isFeatured() {
    return this.is_featured && this.isApproved;
  }

  /**
   * Get display name for testimonial author
   */
  get displayName() {
    if (this.is_anonymous) {
      return 'Anonymous';
    }
    return this.author_name || 'Anonymous';
  }

  /**
   * Get testimonial summary (truncated content)
   */
  get summary() {
    if (!this.content) return '';
    return this.content.length > 150 
      ? this.content.substring(0, 150) + '...' 
      : this.content;
  }

  /**
   * Check if testimonial has media attachments
   */
  get hasMedia() {
    return (this.images && this.images.length > 0) || 
           (this.videos && this.videos.length > 0);
  }

  /**
   * Get rating display (stars)
   */
  get ratingStars() {
    return '★'.repeat(this.rating) + '☆'.repeat(5 - this.rating);
  }

  /**
   * Get public testimonial data
   */
  getPublicData() {
    if (!this.isApproved) return null;
    
    return {
      id: this.id,
      author_name: this.displayName,
      role: this.role,
      category: this.category,
      content: this.content,
      summary: this.summary,
      rating: this.rating,
      rating_stars: this.ratingStars,
      location: this.is_anonymous ? null : this.location,
      image_url: this.is_anonymous ? null : this.image_url,
      images: this.images || [],
      videos: this.videos || [],
      is_featured: this.is_featured,
      is_verified: this.is_verified,
      related_project: this.related_project,
      related_campaign: this.related_campaign,
      created_at: this.created_at
    };
  }

  /**
   * Get admin testimonial data (includes all fields)
   */
  getAdminData() {
    return {
      id: this.id,
      author_name: this.author_name,
      author_email: this.author_email,
      author_phone: this.author_phone,
      role: this.role,
      category: this.category,
      content: this.content,
      rating: this.rating,
      location: this.location,
      image_url: this.image_url,
      images: this.images || [],
      videos: this.videos || [],
      status: this.status,
      is_featured: this.is_featured,
      is_verified: this.is_verified,
      is_anonymous: this.is_anonymous,
      project_id: this.project_id,
      campaign_id: this.campaign_id,
      user_id: this.user_id,
      related_project: this.related_project,
      related_campaign: this.related_campaign,
      metadata: this.metadata,
      created_at: this.created_at,
      updated_at: this.updated_at,
      approved_at: this.approved_at,
      approved_by: this.approved_by
    };
  }

  /**
   * Approve testimonial for public display
   */
  async approve(approvedBy) {
    this.status = 'approved';
    this.approved_at = new Date();
    this.approved_by = approvedBy;
    return await this.save();
  }

  /**
   * Reject testimonial
   */
  async reject(rejectionReason = null) {
    this.status = 'rejected';
    if (rejectionReason) {
      this.metadata = { 
        ...this.metadata, 
        rejection_reason: rejectionReason 
      };
    }
    return await this.save();
  }
}

Testimonial.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  author_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: [1, 255],
      notEmpty: true
    }
  },
  author_email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: true,
      len: [0, 255]
    }
  },
  author_phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      is: /^[+]?[1-9][\d\s-()]+$/
    }
  },
  role: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      len: [0, 100]
    },
    comment: 'Author role/designation like "Village Sarpanch", "School Teacher", etc.'
  },
  category: {
    type: DataTypes.ENUM('beneficiary', 'volunteer', 'donor', 'partner', 'staff', 'other'),
    allowNull: false,
    defaultValue: 'beneficiary'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [10, 5000],
      notEmpty: true
    }
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    },
    comment: 'Rating from 1 to 5 stars'
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      len: [0, 255]
    }
  },
  image_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    },
    comment: 'Profile image of the testimonial author'
  },
  images: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of additional image URLs related to the testimonial'
  },
  videos: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of video URLs (video testimonials)'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'archived'),
    allowNull: false,
    defaultValue: 'pending'
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Featured testimonials for homepage/prominent display'
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether the testimonial source has been verified'
  },
  is_anonymous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether to display author information publicly'
  },
  display_order: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0
    },
    comment: 'Order for displaying featured testimonials'
  },
  // Foreign key relationships
  user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
    comment: 'Associated user account (if testimonial is from registered user)'
  },
  project_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'projects',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
    comment: 'Associated project'
  },
  campaign_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'campaigns',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
    comment: 'Associated campaign'
  },
  event_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'events',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
    comment: 'Associated event'
  },
  // Denormalized related data for performance
  related_project: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Cached project details for display'
  },
  related_campaign: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Cached campaign details for display'
  },
  related_event: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Cached event details for display'
  },
  tags: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Tags for categorization and filtering'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional metadata like submission source, IP, etc.'
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  approved_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
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
  modelName: 'Testimonial',
  tableName: 'testimonials',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (testimonial) => {
      // Set display order for featured testimonials
      if (testimonial.is_featured && !testimonial.display_order) {
        const maxOrder = await Testimonial.max('display_order', {
          where: { is_featured: true }
        });
        testimonial.display_order = (maxOrder || 0) + 1;
      }
    },
    afterUpdate: async (testimonial) => {
      // Update display order when featured status changes
      if (testimonial.changed('is_featured')) {
        if (testimonial.is_featured && !testimonial.display_order) {
          const maxOrder = await Testimonial.max('display_order', {
            where: { is_featured: true }
          });
          testimonial.display_order = (maxOrder || 0) + 1;
          await testimonial.save();
        } else if (!testimonial.is_featured) {
          testimonial.display_order = null;
          await testimonial.save();
        }
      }
    }
  },
  indexes: [
    {
      fields: ['status']
    },
    {
      fields: ['category']
    },
    {
      fields: ['is_featured']
    },
    {
      fields: ['is_verified']
    },
    {
      fields: ['rating']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['project_id']
    },
    {
      fields: ['campaign_id']
    },
    {
      fields: ['event_id']
    },
    {
      fields: ['approved_by']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['approved_at']
    },
    {
      fields: ['display_order']
    },
    {
      fields: ['status', 'is_featured']
    },
    {
      fields: ['category', 'status']
    },
    {
      fields: ['status', 'rating']
    },
    {
      fields: ['project_id', 'status']
    },
    {
      fields: ['campaign_id', 'status']
    },
    {
      fields: ['event_id', 'status']
    },
    // GIN indexes for JSONB columns
    {
      fields: ['tags'],
      using: 'gin'
    },
    // Full-text search on content
    {
      name: 'testimonials_content_search_idx',
      fields: ['content'],
      using: 'gin'
    }
  ],
  scopes: {
    approved: {
      where: {
        status: 'approved'
      }
    },
    pending: {
      where: {
        status: 'pending'
      }
    },
    featured: {
      where: {
        status: 'approved',
        is_featured: true
      },
      order: [['display_order', 'ASC']]
    },
    verified: {
      where: {
        status: 'approved',
        is_verified: true
      }
    },
    byCategory: (category) => ({
      where: {
        category: category,
        status: 'approved'
      }
    }),
    byRating: (rating) => ({
      where: {
        rating: rating,
        status: 'approved'
      }
    }),
    highRated: {
      where: {
        status: 'approved',
        rating: {
          [Op.gte]: 4
        }
      }
    },
    recent: {
      where: {
        status: 'approved'
      },
      order: [['approved_at', 'DESC']],
      limit: 10
    },
    public: {
      where: {
        status: 'approved'
      }
    }
  }
});

module.exports = Testimonial;