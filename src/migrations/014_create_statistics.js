'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('statistics', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      label: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      value: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: '0'
      },
      category: {
        type: Sequelize.ENUM(
          'impact',
          'reach',
          'financial',
          'projects',
          'events',
          'volunteers',
          'donations',
          'beneficiaries',
          'infrastructure',
          'environment',
          'healthcare',
          'education',
          'other'
        ),
        allowNull: false,
        defaultValue: 'impact'
      },
      icon: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      display_format: {
        type: Sequelize.ENUM('number', 'currency', 'percentage', 'compact', 'suffix', 'text'),
        allowNull: false,
        defaultValue: 'number'
      },
      value_suffix: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      is_featured: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      is_real_time: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      update_frequency: {
        type: Sequelize.ENUM('real-time', 'hourly', 'daily', 'weekly', 'monthly', 'manual'),
        allowNull: false,
        defaultValue: 'manual'
      },
      data_source: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      calculation_method: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      valid_from: {
        type: Sequelize.DATE,
        allowNull: true
      },
      valid_until: {
        type: Sequelize.DATE,
        allowNull: true
      },
      last_updated: {
        type: Sequelize.DATE,
        allowNull: true
      },
      target_value: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      baseline_value: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      color_scheme: {
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
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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
    await queryInterface.addIndex('statistics', ['key'], {
      unique: true,
      name: 'statistics_key_unique'
    });
    
    await queryInterface.addIndex('statistics', ['category'], {
      name: 'statistics_category_idx'
    });
    
    await queryInterface.addIndex('statistics', ['is_active'], {
      name: 'statistics_is_active_idx'
    });
    
    await queryInterface.addIndex('statistics', ['is_featured'], {
      name: 'statistics_is_featured_idx'
    });
    
    await queryInterface.addIndex('statistics', ['display_order'], {
      name: 'statistics_display_order_idx'
    });
    
    await queryInterface.addIndex('statistics', ['update_frequency'], {
      name: 'statistics_update_frequency_idx'
    });
    
    await queryInterface.addIndex('statistics', ['created_by'], {
      name: 'statistics_created_by_idx'
    });
    
    await queryInterface.addIndex('statistics', ['updated_by'], {
      name: 'statistics_updated_by_idx'
    });
    
    await queryInterface.addIndex('statistics', ['valid_from'], {
      name: 'statistics_valid_from_idx'
    });
    
    await queryInterface.addIndex('statistics', ['valid_until'], {
      name: 'statistics_valid_until_idx'
    });
    
    await queryInterface.addIndex('statistics', ['last_updated'], {
      name: 'statistics_last_updated_idx'
    });
    
    await queryInterface.addIndex('statistics', ['created_at'], {
      name: 'statistics_created_at_idx'
    });
    
    await queryInterface.addIndex('statistics', ['category', 'is_active'], {
      name: 'statistics_category_active_idx'
    });
    
    await queryInterface.addIndex('statistics', ['is_active', 'display_order'], {
      name: 'statistics_active_order_idx'
    });
    
    await queryInterface.addIndex('statistics', ['is_featured', 'is_active'], {
      name: 'statistics_featured_active_idx'
    });
    
    // GIN indexes for JSONB columns
    await queryInterface.addIndex('statistics', ['tags'], {
      using: 'gin',
      name: 'statistics_tags_gin_idx'
    });
    
    await queryInterface.addIndex('statistics', ['metadata'], {
      using: 'gin',
      name: 'statistics_metadata_gin_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('statistics');
  }
};