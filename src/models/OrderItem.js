const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/database');

class OrderItem extends Model {
  /**
   * Calculate total price for this item
   */
  get totalPrice() {
    return parseFloat(this.price) * this.quantity;
  }

  /**
   * Calculate discount amount
   */
  get discountAmount() {
    if (!this.original_price || this.original_price <= this.price) {
      return 0;
    }
    return (parseFloat(this.original_price) - parseFloat(this.price)) * this.quantity;
  }

  /**
   * Check if item was discounted
   */
  get wasDiscounted() {
    return this.original_price && this.original_price > this.price;
  }

  /**
   * Get discount percentage
   */
  get discountPercentage() {
    if (!this.original_price || this.original_price <= this.price) {
      return 0;
    }
    
    const discount = ((parseFloat(this.original_price) - parseFloat(this.price)) / parseFloat(this.original_price)) * 100;
    return Math.round(discount * 100) / 100; // Round to 2 decimal places
  }
}

OrderItem.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  order_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'orders',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  product_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },
  product_name: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'Product name at the time of order (for historical record)'
  },
  product_sku: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Product SKU at the time of order'
  },
  product_slug: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Product slug at the time of order'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    },
    comment: 'Price per unit at the time of order'
  },
  original_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    validate: {
      min: 0
    },
    comment: 'Original price if item was on sale'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'INR'
  },
  product_image: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Primary product image at the time of order'
  },
  product_description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Product description at the time of order'
  },
  product_attributes: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Product attributes/variations selected (size, color, etc.)'
  },
  weight: {
    type: DataTypes.DECIMAL(8, 3),
    allowNull: true,
    comment: 'Weight per unit for shipping calculation'
  },
  dimensions: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Product dimensions for shipping calculation'
  },
  tax_rate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0.00,
    validate: {
      min: 0,
      max: 100
    }
  },
  tax_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      min: 0
    }
  },
  is_digital: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether item is digital (no shipping required)'
  },
  is_virtual: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether item is virtual (services, consultations)'
  },
  download_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Download URL for digital products'
  },
  download_limit: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Number of allowed downloads'
  },
  download_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  download_expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Download expiry date for digital products'
  },
  fulfillment_status: {
    type: DataTypes.ENUM('pending', 'processing', 'fulfilled', 'cancelled', 'refunded'),
    allowNull: false,
    defaultValue: 'pending'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Special notes for this item'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional item metadata'
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
  modelName: 'OrderItem',
  tableName: 'order_items',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['order_id']
    },
    {
      fields: ['product_id']
    },
    {
      fields: ['product_sku']
    },
    {
      fields: ['fulfillment_status']
    },
    {
      fields: ['is_digital']
    },
    {
      fields: ['is_virtual']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['order_id', 'product_id']
    },
    {
      fields: ['order_id', 'fulfillment_status']
    }
  ],
  scopes: {
    pending: {
      where: {
        fulfillment_status: 'pending'
      }
    },
    fulfilled: {
      where: {
        fulfillment_status: 'fulfilled'
      }
    },
    digital: {
      where: {
        is_digital: true
      }
    },
    physical: {
      where: {
        is_digital: false,
        is_virtual: false
      }
    },
    downloadable: {
      where: {
        download_url: {
          [Op.ne]: null
        }
      }
    }
  }
});

module.exports = OrderItem;