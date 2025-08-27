'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('donations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      campaign_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'campaigns',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'INR'
      },
      donor_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      donor_email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      donor_phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_anonymous: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'refunded', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed', 'refunded'),
        allowNull: false,
        defaultValue: 'pending'
      },
      payment_method: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      payment_gateway: {
        type: Sequelize.STRING(50),
        allowNull: false,
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
      receipt_number: {
        type: Sequelize.STRING(100),
        allowNull: true,
        unique: true
      },
      failure_reason: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      refund_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      refund_reason: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      tax_benefit_claimed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      failed_at: {
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
    await queryInterface.addIndex('donations', ['campaign_id'], {
      name: 'donations_campaign_id_idx'
    });
    
    await queryInterface.addIndex('donations', ['user_id'], {
      name: 'donations_user_id_idx'
    });
    
    await queryInterface.addIndex('donations', ['status'], {
      name: 'donations_status_idx'
    });
    
    await queryInterface.addIndex('donations', ['payment_status'], {
      name: 'donations_payment_status_idx'
    });
    
    await queryInterface.addIndex('donations', ['payment_gateway_order_id'], {
      name: 'donations_payment_gateway_order_id_idx'
    });
    
    await queryInterface.addIndex('donations', ['payment_gateway_payment_id'], {
      name: 'donations_payment_gateway_payment_id_idx'
    });
    
    await queryInterface.addIndex('donations', ['receipt_number'], {
      unique: true,
      name: 'donations_receipt_number_unique'
    });
    
    await queryInterface.addIndex('donations', ['donor_email'], {
      name: 'donations_donor_email_idx'
    });
    
    await queryInterface.addIndex('donations', ['created_at'], {
      name: 'donations_created_at_idx'
    });
    
    await queryInterface.addIndex('donations', ['completed_at'], {
      name: 'donations_completed_at_idx'
    });
    
    await queryInterface.addIndex('donations', ['campaign_id', 'status'], {
      name: 'donations_campaign_id_status_idx'
    });
    
    await queryInterface.addIndex('donations', ['user_id', 'status'], {
      name: 'donations_user_id_status_idx'
    });
    
    await queryInterface.addIndex('donations', ['amount'], {
      name: 'donations_amount_idx'
    });
    
    await queryInterface.addIndex('donations', ['is_anonymous'], {
      name: 'donations_is_anonymous_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('donations');
  }
};