'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('orders', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      order_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      status: {
        type: Sequelize.ENUM(
          'pending', 
          'processing', 
          'confirmed', 
          'shipped', 
          'delivered', 
          'completed', 
          'cancelled', 
          'refunded'
        ),
        allowNull: false,
        defaultValue: 'pending'
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'processing', 'paid', 'failed', 'refunded', 'partial_refund'),
        allowNull: false,
        defaultValue: 'pending'
      },
      subtotal: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      tax_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 0.00
      },
      tax_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      discount_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      discount_code: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      shipping_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      total_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'INR'
      },
      payment_method: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      payment_gateway: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: 'razorpay'
      },
      payment_gateway_order_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      payment_gateway_payment_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      transaction_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      billing_address: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      shipping_address: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      shipping_method: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      shipping_service: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      tracking_number: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      estimated_delivery: {
        type: Sequelize.DATE,
        allowNull: true
      },
      customer_notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      admin_notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status_history: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      processing_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      confirmed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      shipped_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      delivered_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancelled_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      refunded_at: {
        type: Sequelize.DATE,
        allowNull: true
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
    await queryInterface.addIndex('orders', ['order_number'], {
      unique: true,
      name: 'orders_order_number_unique'
    });
    
    await queryInterface.addIndex('orders', ['user_id'], {
      name: 'orders_user_id_idx'
    });
    
    await queryInterface.addIndex('orders', ['status'], {
      name: 'orders_status_idx'
    });
    
    await queryInterface.addIndex('orders', ['payment_status'], {
      name: 'orders_payment_status_idx'
    });
    
    await queryInterface.addIndex('orders', ['payment_gateway_order_id'], {
      name: 'orders_payment_gateway_order_id_idx'
    });
    
    await queryInterface.addIndex('orders', ['payment_gateway_payment_id'], {
      name: 'orders_payment_gateway_payment_id_idx'
    });
    
    await queryInterface.addIndex('orders', ['tracking_number'], {
      name: 'orders_tracking_number_idx'
    });
    
    await queryInterface.addIndex('orders', ['created_at'], {
      name: 'orders_created_at_idx'
    });
    
    await queryInterface.addIndex('orders', ['total_amount'], {
      name: 'orders_total_amount_idx'
    });
    
    await queryInterface.addIndex('orders', ['user_id', 'status'], {
      name: 'orders_user_id_status_idx'
    });
    
    await queryInterface.addIndex('orders', ['user_id', 'created_at'], {
      name: 'orders_user_id_created_at_idx'
    });
    
    await queryInterface.addIndex('orders', ['status', 'created_at'], {
      name: 'orders_status_created_at_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('orders');
  }
};