'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('order_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'orders',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      product_name: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      product_sku: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      product_slug: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      original_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'INR'
      },
      product_image: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      product_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      product_attributes: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      weight: {
        type: Sequelize.DECIMAL(8, 3),
        allowNull: true
      },
      dimensions: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      tax_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 0.00
      },
      tax_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      is_digital: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_virtual: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      download_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      download_limit: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      download_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      download_expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      fulfillment_status: {
        type: Sequelize.ENUM('pending', 'processing', 'fulfilled', 'cancelled', 'refunded'),
        allowNull: false,
        defaultValue: 'pending'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
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
    await queryInterface.addIndex('order_items', ['order_id'], {
      name: 'order_items_order_id_idx'
    });
    
    await queryInterface.addIndex('order_items', ['product_id'], {
      name: 'order_items_product_id_idx'
    });
    
    await queryInterface.addIndex('order_items', ['product_sku'], {
      name: 'order_items_product_sku_idx'
    });
    
    await queryInterface.addIndex('order_items', ['fulfillment_status'], {
      name: 'order_items_fulfillment_status_idx'
    });
    
    await queryInterface.addIndex('order_items', ['is_digital'], {
      name: 'order_items_is_digital_idx'
    });
    
    await queryInterface.addIndex('order_items', ['is_virtual'], {
      name: 'order_items_is_virtual_idx'
    });
    
    await queryInterface.addIndex('order_items', ['created_at'], {
      name: 'order_items_created_at_idx'
    });
    
    await queryInterface.addIndex('order_items', ['order_id', 'product_id'], {
      name: 'order_items_order_id_product_id_idx'
    });
    
    await queryInterface.addIndex('order_items', ['order_id', 'fulfillment_status'], {
      name: 'order_items_order_id_fulfillment_status_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('order_items');
  }
};