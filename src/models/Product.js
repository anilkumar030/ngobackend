const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { generateSlug } = require('../utils/helpers');

class Product extends Model {
  /**
   * Check if product is in stock
   */
  get isInStock() {
    return this.inventory_quantity > 0 && this.status === 'active';
  }

  /**
   * Check if product is low in stock (less than 10)
   */
  get isLowStock() {
    return this.inventory_quantity <= this.low_stock_threshold;
  }

  /**
   * Get discounted price if applicable
   */
  get effectivePrice() {
    if (this.sale_price && this.sale_price < this.regular_price) {
      return parseFloat(this.sale_price);
    }
    return parseFloat(this.regular_price);
  }

  /**
   * Calculate discount percentage
   */
  get discountPercentage() {
    if (!this.sale_price || this.sale_price >= this.regular_price) {
      return 0;
    }
    
    const discount = ((parseFloat(this.regular_price) - parseFloat(this.sale_price)) / parseFloat(this.regular_price)) * 100;
    return Math.round(discount * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Check if product is on sale
   */
  get isOnSale() {
    return this.sale_price && this.sale_price < this.regular_price;
  }

  /**
   * Get average rating (calculated from reviews)
   */
  get averageRating() {
    if (!this.total_reviews || this.total_reviews === 0) {
      return 0;
    }
    return Math.round((this.total_rating / this.total_reviews) * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Update inventory after purchase
   */
  async updateInventory(quantity, operation = 'subtract') {
    if (operation === 'subtract') {
      if (this.inventory_quantity < quantity) {
        throw new Error('Insufficient inventory');
      }
      this.inventory_quantity -= quantity;
    } else if (operation === 'add') {
      this.inventory_quantity += quantity;
    }
    
    return await this.save();
  }

  /**
   * Update product rating
   */
  async updateRating(rating) {
    this.total_rating = (this.total_rating || 0) + rating;
    this.total_reviews = (this.total_reviews || 0) + 1;
    return await this.save();
  }

  /**
   * Generate SEO-friendly slug from title
   */
  async generateSlug() {
    let baseSlug = generateSlug(this.name);
    let slug = baseSlug;
    let counter = 1;
    
    // Ensure slug is unique
    while (await Product.findOne({ where: { slug, id: { [Op.ne]: this.id || null } } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }

  /**
   * Get public product data
   */
  getPublicData() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      short_description: this.short_description,
      regular_price: this.regular_price,
      sale_price: this.sale_price,
      effective_price: this.effectivePrice,
      discount_percentage: this.discountPercentage,
      is_on_sale: this.isOnSale,
      category: this.category,
      subcategory: this.subcategory,
      tags: this.tags,
      images: this.images,
      features: this.features,
      specifications: this.specifications,
      is_in_stock: this.isInStock,
      inventory_quantity: this.show_quantity ? this.inventory_quantity : null,
      weight: this.weight,
      dimensions: this.dimensions,
      average_rating: this.averageRating,
      total_reviews: this.total_reviews,
      featured: this.featured,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

Product.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
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
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  short_description: {
    type: DataTypes.STRING(1000),
    allowNull: true,
    validate: {
      len: [0, 1000]
    }
  },
  regular_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0.01
    }
  },
  sale_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    validate: {
      min: 0.01
    }
  },
  cost_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    validate: {
      min: 0
    }
  },
  sku: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
    validate: {
      len: [0, 100]
    }
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [1, 100],
      notEmpty: true
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
    comment: 'Array of product tags for search and filtering'
  },
  images: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of product image URLs'
  },
  features: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of product features/highlights'
  },
  specifications: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Product specifications as key-value pairs'
  },
  inventory_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  low_stock_threshold: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    validate: {
      min: 0
    }
  },
  track_inventory: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether to track inventory for this product'
  },
  show_quantity: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether to show remaining quantity to customers'
  },
  weight: {
    type: DataTypes.DECIMAL(8, 3),
    allowNull: true,
    comment: 'Weight in kg for shipping calculation'
  },
  dimensions: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Product dimensions (length, width, height) in cm'
  },
  status: {
    type: DataTypes.ENUM('draft', 'active', 'inactive', 'discontinued'),
    allowNull: false,
    defaultValue: 'active'
  },
  featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Featured products for homepage display'
  },
  digital: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether product is digital (no shipping required)'
  },
  virtual: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether product is virtual (services, consultations)'
  },
  downloadable: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether product has downloadable files'
  },
  shipping_required: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether product requires shipping'
  },
  tax_class: {
    type: DataTypes.STRING(50),
    defaultValue: 'standard',
    comment: 'Tax class for tax calculation'
  },
  total_sales: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  total_rating: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  total_reviews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
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
    comment: 'Additional product metadata'
  },
  is_available: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Whether the product is available for purchase'
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
  modelName: 'Product',
  tableName: 'products',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (product) => {
      if (!product.slug) {
        product.slug = await product.generateSlug();
      }
    },
    beforeUpdate: async (product) => {
      if (product.changed('name') && !product.changed('slug')) {
        product.slug = await product.generateSlug();
      }
    }
  },
  indexes: [
    {
      unique: true,
      fields: ['slug']
    },
    {
      unique: true,
      fields: ['sku'],
      where: {
        sku: { [Op.ne]: null }
      }
    },
    {
      fields: ['status']
    },
    {
      fields: ['is_available']
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
      fields: ['regular_price']
    },
    {
      fields: ['sale_price']
    },
    {
      fields: ['inventory_quantity']
    },
    {
      fields: ['created_by']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['total_sales']
    },
    {
      fields: ['total_reviews']
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
      fields: ['status', 'is_available']
    },
    // Gin index for JSONB columns for better search performance
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
    inStock: {
      where: {
        status: 'active',
        inventory_quantity: {
          [Op.gt]: 0
        }
      }
    },
    onSale: {
      where: {
        status: 'active',
        sale_price: {
          [Op.ne]: null,
          [Op.lt]: sequelize.col('regular_price')
        }
      }
    },
    byCategory: (category) => ({
      where: {
        status: 'active',
        category: category
      }
    }),
    lowStock: {
      where: {
        status: 'active',
        inventory_quantity: {
          [Op.lte]: sequelize.col('low_stock_threshold')
        }
      }
    },
    public: {
      where: {
        status: 'active'
      }
    }
  }
});

module.exports = Product;