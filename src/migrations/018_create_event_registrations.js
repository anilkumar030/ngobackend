'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('event_registrations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      registration_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      event_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'events',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
      participant_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      participant_details: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      contact_phone: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      contact_email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      emergency_contact: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      special_requirements: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      dietary_requirements: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      accessibility_needs: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      status: {
        type: Sequelize.ENUM('pending', 'confirmed', 'waitlisted', 'cancelled', 'no_show'),
        allowNull: false,
        defaultValue: 'pending'
      },
      registration_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
      },
      additional_fees: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'refunded', 'waived'),
        allowNull: false,
        defaultValue: 'pending'
      },
      payment_method: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      transaction_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      check_in_status: {
        type: Sequelize.ENUM('not_checked_in', 'checked_in', 'checked_out'),
        allowNull: false,
        defaultValue: 'not_checked_in'
      },
      check_in_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      check_out_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      attendance_marked: {
        type: Sequelize.BOOLEAN,
        allowNull: true
      },
      certificate_issued: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      certificate_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      feedback_submitted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      feedback_rating: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      feedback_comment: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      confirmation_email_sent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      reminder_sent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      follow_up_sent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      registration_source: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      referral_code: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      tags: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      confirmed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      confirmed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancelled_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      cancelled_at: {
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
    await queryInterface.addIndex('event_registrations', ['registration_number'], {
      unique: true,
      name: 'event_registrations_registration_number_unique'
    });
    
    await queryInterface.addIndex('event_registrations', ['event_id'], {
      name: 'event_registrations_event_id_idx'
    });
    
    await queryInterface.addIndex('event_registrations', ['user_id'], {
      name: 'event_registrations_user_id_idx'
    });
    
    await queryInterface.addIndex('event_registrations', ['status'], {
      name: 'event_registrations_status_idx'
    });
    
    await queryInterface.addIndex('event_registrations', ['payment_status'], {
      name: 'event_registrations_payment_status_idx'
    });
    
    await queryInterface.addIndex('event_registrations', ['check_in_status'], {
      name: 'event_registrations_check_in_status_idx'
    });
    
    await queryInterface.addIndex('event_registrations', ['attendance_marked'], {
      name: 'event_registrations_attendance_marked_idx'
    });
    
    await queryInterface.addIndex('event_registrations', ['contact_phone'], {
      name: 'event_registrations_contact_phone_idx'
    });
    
    await queryInterface.addIndex('event_registrations', ['contact_email'], {
      name: 'event_registrations_contact_email_idx'
    });
    
    await queryInterface.addIndex('event_registrations', ['confirmed_by'], {
      name: 'event_registrations_confirmed_by_idx'
    });
    
    await queryInterface.addIndex('event_registrations', ['cancelled_by'], {
      name: 'event_registrations_cancelled_by_idx'
    });
    
    await queryInterface.addIndex('event_registrations', ['created_at'], {
      name: 'event_registrations_created_at_idx'
    });
    
    await queryInterface.addIndex('event_registrations', ['confirmed_at'], {
      name: 'event_registrations_confirmed_at_idx'
    });
    
    await queryInterface.addIndex('event_registrations', ['cancelled_at'], {
      name: 'event_registrations_cancelled_at_idx'
    });
    
    await queryInterface.addIndex('event_registrations', ['event_id', 'status'], {
      name: 'event_registrations_event_status_idx'
    });
    
    await queryInterface.addIndex('event_registrations', ['event_id', 'payment_status'], {
      name: 'event_registrations_event_payment_idx'
    });
    
    await queryInterface.addIndex('event_registrations', ['user_id', 'status'], {
      name: 'event_registrations_user_status_idx'
    });
    
    await queryInterface.addIndex('event_registrations', ['status', 'check_in_status'], {
      name: 'event_registrations_status_checkin_idx'
    });
    
    // GIN indexes for JSONB columns
    await queryInterface.addIndex('event_registrations', ['tags'], {
      using: 'gin',
      name: 'event_registrations_tags_gin_idx'
    });
    
    await queryInterface.addIndex('event_registrations', ['participant_details'], {
      using: 'gin',
      name: 'event_registrations_participant_details_gin_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('event_registrations');
  }
};