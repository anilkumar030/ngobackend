'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('saved_campaigns', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      campaign_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'campaigns',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_notification_enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      notification_preferences: {
        type: Sequelize.JSONB,
        defaultValue: {
          campaign_updates: true,
          milestone_reached: true,
          campaign_ending: true,
          campaign_completed: true
        }
      },
      last_notification_sent: {
        type: Sequelize.DATE,
        allowNull: true
      },
      saved_from: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      tags: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high'),
        allowNull: false,
        defaultValue: 'medium'
      },
      reminder_date: {
        type: Sequelize.DATE,
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
    await queryInterface.addIndex('saved_campaigns', ['user_id', 'campaign_id'], {
      unique: true,
      name: 'saved_campaigns_user_campaign_unique'
    });
    
    await queryInterface.addIndex('saved_campaigns', ['user_id'], {
      name: 'saved_campaigns_user_id_idx'
    });
    
    await queryInterface.addIndex('saved_campaigns', ['campaign_id'], {
      name: 'saved_campaigns_campaign_id_idx'
    });
    
    await queryInterface.addIndex('saved_campaigns', ['priority'], {
      name: 'saved_campaigns_priority_idx'
    });
    
    await queryInterface.addIndex('saved_campaigns', ['is_notification_enabled'], {
      name: 'saved_campaigns_notification_enabled_idx'
    });
    
    await queryInterface.addIndex('saved_campaigns', ['reminder_date'], {
      name: 'saved_campaigns_reminder_date_idx'
    });
    
    await queryInterface.addIndex('saved_campaigns', ['created_at'], {
      name: 'saved_campaigns_created_at_idx'
    });
    
    await queryInterface.addIndex('saved_campaigns', ['last_notification_sent'], {
      name: 'saved_campaigns_last_notification_sent_idx'
    });
    
    await queryInterface.addIndex('saved_campaigns', ['user_id', 'created_at'], {
      name: 'saved_campaigns_user_created_at_idx'
    });
    
    await queryInterface.addIndex('saved_campaigns', ['user_id', 'priority'], {
      name: 'saved_campaigns_user_priority_idx'
    });
    
    // GIN indexes for JSONB columns
    await queryInterface.addIndex('saved_campaigns', ['tags'], {
      using: 'gin',
      name: 'saved_campaigns_tags_gin_idx'
    });
    
    await queryInterface.addIndex('saved_campaigns', ['notification_preferences'], {
      using: 'gin',
      name: 'saved_campaigns_notification_preferences_gin_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('saved_campaigns');
  }
};