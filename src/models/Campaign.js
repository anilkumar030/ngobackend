const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { generateSlug } = require('../utils/helpers');

class Campaign extends Model {
  /**
   * Calculate campaign progress percentage
   */
  get progressPercentage() {
    if (!this.target_amount || this.target_amount === 0) return 0;
    const percentage = (parseFloat(this.raised_amount) / parseFloat(this.target_amount)) * 100;
    return Math.min(Math.round(percentage * 100) / 100, 100); // Round to 2 decimal places, max 100%
  }

  /**
   * Calculate remaining amount to reach target
   */
  get remainingAmount() {
    const remaining = parseFloat(this.target_amount) - parseFloat(this.raised_amount);
    return Math.max(remaining, 0);
  }

  /**
   * Check if campaign is active and accepting donations
   */
  get isActive() {
    if (this.status !== 'active') return false;
    
    const now = new Date();
    if (this.start_date && now < this.start_date) return false;
    if (this.end_date && now > this.end_date) return false;
    
    return true;
  }

  /**
   * Check if campaign has reached its target
   */
  get isCompleted() {
    return parseFloat(this.raised_amount) >= parseFloat(this.target_amount);
  }

  /**
   * Get campaign status based on conditions
   */
  get actualStatus() {
    if (this.status === 'draft' || this.status === 'paused') {
      return this.status;
    }
    
    if (this.isCompleted) return 'completed';
    if (!this.isActive) return 'inactive';
    
    return 'active';
  }

  /**
   * Update raised amount and donor count
   */
  async updateProgress(donationAmount, isNewDonor = false) {
    this.raised_amount = (parseFloat(this.raised_amount) || 0) + parseFloat(donationAmount);
    
    if (isNewDonor) {
      this.donor_count = (this.donor_count || 0) + 1;
    }
    
    // Auto-complete if target reached
    if (this.isCompleted && this.status === 'active') {
      this.status = 'completed';
    }
    
    return await this.save();
  }

  /**
   * Generate SEO-friendly slug from title
   */
  async generateSlug() {
    let baseSlug = generateSlug(this.title);
    let slug = baseSlug;
    let counter = 1;
    
    // Ensure slug is unique
    while (await Campaign.findOne({ where: { slug, id: { [Op.ne]: this.id || null } } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }

  /**
   * Get public campaign data
   */
  getPublicData() {
    return {
      id: this.id,
      title: this.title,
      slug: this.slug,
      description: this.description,
      short_description: this.short_description,
      location: this.location,
      target_amount: this.target_amount ? parseFloat(this.target_amount) : null,
      raised_amount: this.raised_amount ? parseFloat(this.raised_amount) : null,
      donor_count: this.donor_count,
      progress_percentage: this.progressPercentage,
      remaining_amount: this.remainingAmount,
      status: this.actualStatus,
      featured: this.featured,
      category: this.category,
      contact_phone: this.contact_phone,
      contact_email: this.contact_email,
      beneficiary_details: this.beneficiary_details,
      visibility: this.visibility,
      seo_title: this.seo_title,
      seo_description: this.seo_description,
      tags: this.tags,
      meta_keywords: this.meta_keywords,
      start_date: this.start_date,
      end_date: this.end_date,
      images: this.images,
      howyoucanhelp: this.howyoucanhelp,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

Campaign.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
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
    unique: true,
    validate: {
      len: [3, 255],
      is: /^[a-z0-9-]+$/ // Only lowercase letters, numbers, and hyphens
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  short_description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [10, 500]
    },
    comment: 'Brief summary of the campaign for preview cards and listings'
  },
  long_description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Rich text content for detailed campaign description'
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      len: [0, 255]
    }
  },
  target_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: 100, // Minimum ₹100
      max: 100000000 // Maximum ₹10 crores
    }
  },
  raised_amount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00,
    validate: {
      min: 0
    }
  },
  donor_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  status: {
    type: DataTypes.ENUM('draft', 'active', 'completed', 'paused', 'cancelled'),
    allowNull: false,
    defaultValue: 'draft'
  },
  featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      len: [0, 100]
    }
  },
  contact_phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      len: [10, 20],
      is: /^[\+]?[0-9\-\(\)\s]+$/
    },
    comment: 'Contact phone number for campaign inquiries'
  },
  contact_email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: true,
      len: [5, 255]
    },
    comment: 'Contact email address for campaign inquiries'
  },
  beneficiary_details: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Detailed information about campaign beneficiaries'
  },
  visibility: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'public',
    validate: {
      isIn: [['public', 'private']]
    },
    comment: 'Campaign visibility setting - public or private'
  },
  seo_title: {
    type: DataTypes.STRING(60),
    allowNull: true,
    validate: {
      len: [0, 60]
    },
    comment: 'SEO optimized title for search engines (max 60 chars)'
  },
  seo_description: {
    type: DataTypes.STRING(160),
    allowNull: true,
    validate: {
      len: [0, 160]
    },
    comment: 'SEO meta description for search engines (max 160 chars)'
  },
  tags: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of tags for campaign categorization and filtering'
  },
  meta_keywords: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of SEO keywords for search optimization'
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isAfterStartDate(value) {
        if (value && this.start_date && value <= this.start_date) {
          throw new Error('End date must be after start date');
        }
      }
    }
  },
  images: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of image URLs for campaign gallery'
  },
  howyoucanhelp: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of helping options with title and amount - [{title: "One hygiene kit", amount: 500}]'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional campaign metadata like beneficiary details, documents'
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
  modelName: 'Campaign',
  tableName: 'campaigns',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (campaign) => {
      if (!campaign.slug) {
        campaign.slug = await campaign.generateSlug();
      }
    },
    beforeUpdate: async (campaign) => {
      if (campaign.changed('title') && !campaign.changed('slug')) {
        campaign.slug = await campaign.generateSlug();
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
      fields: ['featured']
    },
    {
      fields: ['verified']
    },
    {
      fields: ['created_by']
    },
    {
      fields: ['start_date']
    },
    {
      fields: ['end_date']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['target_amount']
    },
    {
      fields: ['raised_amount']
    },
    {
      fields: ['status', 'featured']
    },
    {
      fields: ['category', 'status']
    },
    {
      fields: ['visibility']
    },
    {
      fields: ['contact_email']
    },
    {
      fields: ['visibility', 'status']
    },
    {
      fields: ['tags'],
      using: 'gin'
    },
    {
      fields: ['meta_keywords'],
      using: 'gin'
    },
    {
      fields: ['howyoucanhelp'],
      using: 'gin'
    }
  ],
  scopes: {
    active: {
      where: {
        status: 'active',
        verified: true
      }
    },
    featured: {
      where: {
        featured: true,
        status: 'active',
        verified: true
      }
    },
    byCategory: (category) => ({
      where: {
        category: category,
        status: 'active',
        verified: true
      }
    }),
    completed: {
      where: {
        status: 'completed'
      }
    },
    public: {
      where: {
        status: ['active', 'completed'],
        verified: true,
        visibility: 'public'
      }
    },
    publicVisible: {
      where: {
        visibility: 'public',
        status: 'active',
        verified: true
      }
    },
    withTags: (tags) => ({
      where: {
        tags: {
          [Op.overlap]: tags
        },
        status: 'active',
        verified: true,
        visibility: 'public'
      }
    })
  }
});

module.exports = Campaign;