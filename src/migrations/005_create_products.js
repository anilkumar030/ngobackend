'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('products', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      short_description: {
        type: Sequelize.STRING(1000),
        allowNull: true
      },
      regular_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      sale_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      cost_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      sku: {
        type: Sequelize.STRING(100),
        allowNull: true,
        unique: true
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      subcategory: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      tags: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      images: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      features: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      specifications: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      inventory_quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      low_stock_threshold: {
        type: Sequelize.INTEGER,
        defaultValue: 10
      },
      track_inventory: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      show_quantity: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      weight: {
        type: Sequelize.DECIMAL(8, 3),
        allowNull: true
      },
      dimensions: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      status: {
        type: Sequelize.ENUM('draft', 'active', 'inactive', 'discontinued'),
        allowNull: false,
        defaultValue: 'active'
      },
      featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      digital: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      virtual: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      downloadable: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      shipping_required: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      tax_class: {
        type: Sequelize.STRING(50),
        defaultValue: 'standard'
      },
      total_sales: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      total_rating: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      total_reviews: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      seo_title: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      seo_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      seo_keywords: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes
    await queryInterface.addIndex('products', ['slug'], {
      unique: true,
      name: 'products_slug_unique'
    });
    
    await queryInterface.addIndex('products', ['sku'], {
      unique: true,
      name: 'products_sku_unique',
      where: {
        sku: { [Sequelize.Op.ne]: null }
      }
    });
    
    await queryInterface.addIndex('products', ['status'], {
      name: 'products_status_idx'
    });
    
    await queryInterface.addIndex('products', ['category'], {
      name: 'products_category_idx'
    });
    
    await queryInterface.addIndex('products', ['subcategory'], {
      name: 'products_subcategory_idx'
    });
    
    await queryInterface.addIndex('products', ['featured'], {
      name: 'products_featured_idx'
    });
    
    await queryInterface.addIndex('products', ['regular_price'], {
      name: 'products_regular_price_idx'
    });
    
    await queryInterface.addIndex('products', ['sale_price'], {
      name: 'products_sale_price_idx'
    });
    
    await queryInterface.addIndex('products', ['inventory_quantity'], {
      name: 'products_inventory_quantity_idx'
    });
    
    await queryInterface.addIndex('products', ['created_by'], {
      name: 'products_created_by_idx'
    });
    
    await queryInterface.addIndex('products', ['created_at'], {
      name: 'products_created_at_idx'
    });
    
    await queryInterface.addIndex('products', ['total_sales'], {
      name: 'products_total_sales_idx'
    });
    
    await queryInterface.addIndex('products', ['total_reviews'], {
      name: 'products_total_reviews_idx'
    });
    
    await queryInterface.addIndex('products', ['status', 'category'], {
      name: 'products_status_category_idx'
    });
    
    await queryInterface.addIndex('products', ['status', 'featured'], {
      name: 'products_status_featured_idx'
    });
    
    await queryInterface.addIndex('products', ['category', 'featured'], {
      name: 'products_category_featured_idx'
    });

    // Add GIN indexes for JSONB columns
    await queryInterface.addIndex('products', {
      fields: ['tags'],
      using: 'gin',
      name: 'products_tags_gin_idx'
    });
    
    await queryInterface.addIndex('products', {
      fields: ['seo_keywords'],
      using: 'gin',
      name: 'products_seo_keywords_gin_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('products');
  }
};