const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { generateSlug, extractTextFromHtml, truncateText } = require('../utils/helpers');

class BlogPost extends Model {
  /**
   * Check if post is published
   */
  get isPublished() {
    return this.status === 'published' && new Date() >= new Date(this.published_at || this.created_at);
  }

  /**
   * Check if post is scheduled
   */
  get isScheduled() {
    return this.status === 'published' && new Date() < new Date(this.published_at);
  }

  /**
   * Get reading time estimate (words per minute: 200)
   */
  get readingTime() {
    const text = extractTextFromHtml(this.content || '');
    const wordCount = text.split(/\s+/).length;
    const readingTimeMinutes = Math.ceil(wordCount / 200);
    return readingTimeMinutes;
  }

  /**
   * Get excerpt from content
   */
  get excerpt() {
    if (this.custom_excerpt) {
      return this.custom_excerpt;
    }
    
    const text = extractTextFromHtml(this.content || '');
    return truncateText(text, 300);
  }

  /**
   * Get word count
   */
  get wordCount() {
    const text = extractTextFromHtml(this.content || '');
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Generate SEO-friendly slug from title
   */
  async generateSlug() {
    let baseSlug = generateSlug(this.title);
    let slug = baseSlug;
    let counter = 1;
    
    // Ensure slug is unique
    while (await BlogPost.findOne({ where: { slug, id: { [Op.ne]: this.id || null } } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }

  /**
   * Increment view count
   */
  async incrementViewCount() {
    this.view_count = (this.view_count || 0) + 1;
    return await this.save({ fields: ['view_count', 'updated_at'] });
  }

  /**
   * Get public blog post data
   */
  getPublicData() {
    return {
      id: this.id,
      title: this.title,
      slug: this.slug,
      excerpt: this.excerpt,
      content: this.content,
      featured_image: this.featured_image,
      category: this.category,
      tags: this.tags,
      author_name: this.author_name,
      reading_time: this.readingTime,
      word_count: this.wordCount,
      view_count: this.view_count,
      like_count: this.like_count,
      comment_count: this.comment_count,
      published_at: this.published_at || this.created_at,
      updated_at: this.updated_at,
      seo_title: this.seo_title,
      seo_description: this.seo_description,
      is_featured: this.is_featured
    };
  }

  /**
   * Get admin blog post data (includes private fields)
   */
  getAdminData() {
    return {
      ...this.getPublicData(),
      status: this.status,
      custom_excerpt: this.custom_excerpt,
      seo_keywords: this.seo_keywords,
      allow_comments: this.allow_comments,
      created_by: this.created_by,
      created_at: this.created_at,
      metadata: this.metadata
    };
  }
}

BlogPost.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      len: [1, 500],
      notEmpty: true
    }
  },
  slug: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      len: [1, 255],
      is: /^[a-z0-9-]+$/ // Only lowercase letters, numbers, and hyphens
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Rich text content of the blog post'
  },
  custom_excerpt: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 1000]
    }
  },
  featured_image: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  gallery_images: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of additional image URLs for the post'
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'archived', 'scheduled'),
    allowNull: false,
    defaultValue: 'draft'
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      len: [0, 100]
    }
  },
  tags: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of tags for categorization and search'
  },
  author_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      len: [0, 255]
    }
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Featured posts for homepage display'
  },
  allow_comments: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether comments are allowed for this post'
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
  published_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Scheduled publish date/time'
  },
  // SEO fields
  seo_title: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      len: [0, 255]
    }
  },
  seo_description: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 320] // Recommended meta description length
    }
  },
  seo_keywords: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of SEO keywords'
  },
  canonical_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  // Open Graph fields for social sharing
  og_title: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      len: [0, 255]
    }
  },
  og_description: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 300]
    }
  },
  og_image: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  // Twitter Card fields
  twitter_title: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      len: [0, 255]
    }
  },
  twitter_description: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 200]
    }
  },
  twitter_image: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional post metadata'
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
  modelName: 'BlogPost',
  tableName: 'blog_posts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (post) => {
      if (!post.slug) {
        post.slug = await post.generateSlug();
      }
      
      // Set published_at if status is published and no date is set
      if (post.status === 'published' && !post.published_at) {
        post.published_at = new Date();
      }
    },
    beforeUpdate: async (post) => {
      if (post.changed('title') && !post.changed('slug')) {
        post.slug = await post.generateSlug();
      }
      
      // Set published_at when status changes to published
      if (post.changed('status') && post.status === 'published' && !post.published_at) {
        post.published_at = new Date();
      }
    }
  },
  indexes: [
    {
      unique: true,
      fields: ['slug']
    },
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
      fields: ['like_count']
    },
    {
      fields: ['status', 'published_at']
    },
    {
      fields: ['status', 'is_featured']
    },
    {
      fields: ['category', 'status']
    },
    // GIN indexes for JSONB columns for better search performance
    {
      fields: ['tags'],
      using: 'gin'
    },
    {
      fields: ['seo_keywords'],
      using: 'gin'
    },
    // Full-text search index on title and content
    {
      name: 'blog_posts_search_idx',
      fields: ['title', 'content'],
      using: 'gin',
      // This will be created with a custom SQL in migration
      // operator: 'gin_trgm_ops'
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
    featured: {
      where: {
        status: 'published',
        is_featured: true,
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
    byCategory: (category) => ({
      where: {
        status: 'published',
        category: category,
        published_at: {
          [Op.lte]: new Date()
        }
      }
    }),
    popular: {
      where: {
        status: 'published',
        published_at: {
          [Op.lte]: new Date()
        }
      },
      order: [['view_count', 'DESC']],
      limit: 10
    },
    recent: {
      where: {
        status: 'published',
        published_at: {
          [Op.lte]: new Date()
        }
      },
      order: [['published_at', 'DESC']],
      limit: 10
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

module.exports = BlogPost;