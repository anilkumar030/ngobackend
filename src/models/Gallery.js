const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { generateSlug } = require('../utils/helpers');

class Gallery extends Model {
  /**
   * Check if gallery item is active
   */
  get isActive() {
    return this.status === 'active';
  }

  /**
   * Get display order (sort order)
   */
  get displayOrder() {
    return this.sort_order || 0;
  }

  /**
   * Generate SEO-friendly slug from title
   */
  async generateSlug() {
    if (!this.title || this.title.trim() === '') {
      // If no title, generate slug from id and category
      return `${this.category || 'image'}-${this.id}`;
    }
    
    let baseSlug = generateSlug(this.title);
    let slug = baseSlug;
    let counter = 1;
    
    // Ensure slug is unique
    while (await Gallery.findOne({ where: { slug, id: { [Op.ne]: this.id || null } } })) {
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
   * Get public gallery data
   */
  getPublicData() {
    return {
      id: this.id,
      title: this.title,
      slug: this.slug,
      description: this.description,
      image_url: this.image_url,
      thumbnail_url: this.thumbnail_url,
      category: this.category,
      tags: this.tags,
      alt_text: this.alt_text,
      caption: this.caption,
      photographer: this.photographer,
      location: this.location,
      taken_at: this.taken_at,
      dimensions: this.dimensions,
      file_size: this.file_size,
      featured: this.featured,
      view_count: this.view_count,
      like_count: this.like_count,
      sort_order: this.sort_order,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

Gallery.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      len: [0, 500]
    }
  },
  slug: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
    validate: {
      len: [0, 255],
      is: /^[a-z0-9-]*$/ // Only lowercase letters, numbers, and hyphens (can be empty)
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  image_url: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  thumbnail_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  medium_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  original_filename: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  alt_text: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      len: [0, 255]
    }
  },
  caption: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Image caption for display'
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'general',
    validate: {
      len: [1, 100]
    }
  },
  subcategory: {
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
  photographer: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      len: [0, 255]
    }
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      len: [0, 255]
    }
  },
  taken_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date when photo was taken'
  },
  file_size: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0
    },
    comment: 'File size in bytes'
  },
  file_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      isIn: [['jpeg', 'jpg', 'png', 'gif', 'webp', 'svg']]
    }
  },
  dimensions: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Image dimensions {width, height}'
  },
  exif_data: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Camera EXIF data'
  },
  color_palette: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Dominant colors in the image'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'archived'),
    allowNull: false,
    defaultValue: 'active'
  },
  featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Featured images for homepage/gallery highlights'
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Custom sort order for gallery display'
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
  download_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  allow_download: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether image can be downloaded by visitors'
  },
  copyright_info: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Copyright information'
  },
  license: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Image license type'
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
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional image metadata'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Whether the gallery item is active and visible'
  },
  uploaded_by: {
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
  modelName: 'Gallery',
  tableName: 'gallery',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    afterCreate: async (galleryItem) => {
      if (!galleryItem.slug && galleryItem.title) {
        galleryItem.slug = await galleryItem.generateSlug();
        await galleryItem.save();
      }
    },
    beforeUpdate: async (galleryItem) => {
      if (galleryItem.changed('title') && !galleryItem.changed('slug')) {
        galleryItem.slug = await galleryItem.generateSlug();
      }
    }
  },
  indexes: [
    {
      unique: true,
      fields: ['slug'],
      where: {
        slug: { [Op.ne]: null }
      }
    },
    {
      fields: ['status']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['category']
    },
    {
      fields: ['subcategory']
    },
    {
      fields: ['featured']
    },
    {
      fields: ['uploaded_by']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['taken_at']
    },
    {
      fields: ['view_count']
    },
    {
      fields: ['like_count']
    },
    {
      fields: ['sort_order']
    },
    {
      fields: ['status', 'category']
    },
    {
      fields: ['status', 'featured']
    },
    {
      fields: ['category', 'featured']
    },
    {
      fields: ['status', 'sort_order']
    },
    {
      fields: ['status', 'is_active']
    },
    // GIN indexes for JSONB columns
    {
      fields: ['tags'],
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
    featured: {
      where: {
        status: 'active',
        featured: true
      }
    },
    byCategory: (category) => ({
      where: {
        status: 'active',
        category: category
      }
    }),
    recent: {
      where: {
        status: 'active'
      },
      order: [['created_at', 'DESC']],
      limit: 20
    },
    popular: {
      where: {
        status: 'active'
      },
      order: [['view_count', 'DESC']],
      limit: 20
    },
    sorted: {
      where: {
        status: 'active'
      },
      order: [['sort_order', 'ASC'], ['created_at', 'DESC']]
    },
    public: {
      where: {
        status: 'active'
      }
    }
  }
});

module.exports = Gallery;