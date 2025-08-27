const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { generateSlug } = require('../utils/helpers');

class ContentSection extends Model {
  /**
   * Check if content section is active
   */
  get isActive() {
    return this.status === 'active';
  }

  /**
   * Check if content section is scheduled
   */
  get isScheduled() {
    return this.status === 'scheduled' && this.scheduled_at && new Date() < new Date(this.scheduled_at);
  }

  /**
   * Check if content section should be displayed
   */
  get shouldDisplay() {
    if (this.status !== 'active') return false;
    
    const now = new Date();
    if (this.start_date && now < this.start_date) return false;
    if (this.end_date && now > this.end_date) return false;
    
    return true;
  }

  /**
   * Generate SEO-friendly slug from key
   */
  async generateSlug() {
    let baseSlug = generateSlug(this.key);
    let slug = baseSlug;
    let counter = 1;
    
    // Ensure slug is unique within the same page
    const whereClause = { 
      slug, 
      page: this.page,
      id: { [Op.ne]: this.id || null } 
    };
    
    while (await ContentSection.findOne({ where: whereClause })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }

  /**
   * Get localized content based on language
   */
  getLocalizedContent(language = 'en') {
    if (this.localized_content && this.localized_content[language]) {
      return {
        title: this.localized_content[language].title || this.title,
        content: this.localized_content[language].content || this.content,
        subtitle: this.localized_content[language].subtitle || this.subtitle,
        button_text: this.localized_content[language].button_text || this.button_text
      };
    }
    
    return {
      title: this.title,
      content: this.content,
      subtitle: this.subtitle,
      button_text: this.button_text
    };
  }

  /**
   * Get public content section data
   */
  getPublicData(language = 'en') {
    const localizedContent = this.getLocalizedContent(language);
    
    return {
      id: this.id,
      key: this.key,
      slug: this.slug,
      page: this.page,
      section_type: this.section_type,
      title: localizedContent.title,
      subtitle: localizedContent.subtitle,
      content: localizedContent.content,
      images: this.images,
      videos: this.videos,
      links: this.links,
      button_text: localizedContent.button_text,
      button_url: this.button_url,
      settings: this.settings,
      sort_order: this.sort_order,
      updated_at: this.updated_at
    };
  }
}

ContentSection.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [1, 100],
      notEmpty: true,
      is: /^[a-z0-9_-]+$/ // Only lowercase letters, numbers, underscore, and hyphens
    }
  },
  slug: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      len: [0, 255],
      is: /^[a-z0-9-]*$/ // Only lowercase letters, numbers, and hyphens
    }
  },
  page: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [1, 100],
      notEmpty: true
    },
    comment: 'Page identifier where this content appears (home, about, contact, etc.)'
  },
  section_type: {
    type: DataTypes.ENUM(
      'hero',
      'text',
      'image',
      'gallery',
      'video',
      'testimonial',
      'cta',
      'feature',
      'stats',
      'team',
      'faq',
      'contact',
      'footer',
      'header',
      'sidebar',
      'custom'
    ),
    allowNull: false,
    defaultValue: 'text'
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      len: [0, 500]
    }
  },
  subtitle: {
    type: DataTypes.STRING(1000),
    allowNull: true,
    validate: {
      len: [0, 1000]
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Main content - can be HTML or plain text'
  },
  images: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of image objects with URL, alt text, caption'
  },
  videos: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of video objects with URL, title, thumbnail'
  },
  links: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of link objects with URL, text, type'
  },
  button_text: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      len: [0, 100]
    }
  },
  button_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      len: [0, 500]
    }
  },
  button_style: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      isIn: [['primary', 'secondary', 'outline', 'ghost', 'link']]
    }
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Section-specific settings (colors, layout options, etc.)'
  },
  css_classes: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Custom CSS classes for styling'
  },
  inline_styles: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Custom inline CSS styles'
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Display order within the page'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'scheduled', 'archived'),
    allowNull: false,
    defaultValue: 'active'
  },
  visibility: {
    type: DataTypes.ENUM('public', 'private', 'members_only'),
    allowNull: false,
    defaultValue: 'public'
  },
  device_visibility: {
    type: DataTypes.JSONB,
    defaultValue: {
      desktop: true,
      tablet: true,
      mobile: true
    },
    comment: 'Device-specific visibility settings'
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When to start showing this content'
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When to stop showing this content'
  },
  scheduled_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Scheduled publish date for scheduled status'
  },
  // Localization support
  localized_content: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Localized versions of content for different languages'
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
    allowNull: true
  },
  seo_keywords: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of SEO keywords'
  },
  // Analytics and A/B testing
  view_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  click_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  conversion_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  ab_test_variant: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'A/B test variant identifier'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional metadata for the content section'
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
  updated_by: {
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
  modelName: 'ContentSection',
  tableName: 'content_sections',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (contentSection) => {
      if (!contentSection.slug) {
        contentSection.slug = await contentSection.generateSlug();
      }
    },
    beforeUpdate: async (contentSection) => {
      if (contentSection.changed('key') && !contentSection.changed('slug')) {
        contentSection.slug = await contentSection.generateSlug();
      }
      
      // Update updated_by if provided in context
      if (contentSection._updateContext && contentSection._updateContext.userId) {
        contentSection.updated_by = contentSection._updateContext.userId;
      }
    }
  },
  indexes: [
    {
      unique: true,
      fields: ['page', 'key']
    },
    {
      fields: ['page', 'slug'],
      unique: true,
      where: {
        slug: { [Op.ne]: null }
      }
    },
    {
      fields: ['status']
    },
    {
      fields: ['page']
    },
    {
      fields: ['section_type']
    },
    {
      fields: ['visibility']
    },
    {
      fields: ['sort_order']
    },
    {
      fields: ['created_by']
    },
    {
      fields: ['updated_by']
    },
    {
      fields: ['start_date']
    },
    {
      fields: ['end_date']
    },
    {
      fields: ['scheduled_at']
    },
    {
      fields: ['page', 'status']
    },
    {
      fields: ['page', 'sort_order']
    },
    {
      fields: ['status', 'visibility']
    },
    // GIN indexes for JSONB columns
    {
      fields: ['settings'],
      using: 'gin'
    },
    {
      fields: ['localized_content'],
      using: 'gin'
    },
    {
      fields: ['seo_keywords'],
      using: 'gin'
    }
  ],
  scopes: {
    active: {
      where: {
        status: 'active'
      }
    },
    public: {
      where: {
        status: 'active',
        visibility: 'public'
      }
    },
    byPage: (page) => ({
      where: {
        page: page,
        status: 'active',
        visibility: 'public'
      },
      order: [['sort_order', 'ASC']]
    }),
    byType: (sectionType) => ({
      where: {
        section_type: sectionType,
        status: 'active'
      }
    }),
    scheduled: {
      where: {
        status: 'scheduled'
      }
    },
    expired: {
      where: {
        end_date: {
          [Op.lt]: new Date()
        }
      }
    },
    current: {
      where: {
        status: 'active',
        [Op.or]: [
          { start_date: null },
          { start_date: { [Op.lte]: new Date() } }
        ],
        [Op.or]: [
          { end_date: null },
          { end_date: { [Op.gt]: new Date() } }
        ]
      }
    }
  }
});

module.exports = ContentSection;