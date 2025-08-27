'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('projects', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      title: {
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
      long_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      category: {
        type: Sequelize.ENUM(
          'Water Projects',
          'Housing',
          'Emergency Relief', 
          'Healthcare',
          'Education',
          'Environment',
          'Infrastructure',
          'Community Development',
          'Disaster Relief',
          'Other'
        ),
        allowNull: false,
        defaultValue: 'Other'
      },
      status: {
        type: Sequelize.ENUM('upcoming', 'active', 'completed', 'on-hold', 'cancelled'),
        allowNull: false,
        defaultValue: 'active'
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: false,
        defaultValue: 'medium'
      },
      location: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      geographic_scope: {
        type: Sequelize.ENUM('local', 'district', 'state', 'national', 'international'),
        allowNull: false,
        defaultValue: 'local'
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      estimated_completion_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      actual_completion_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      total_budget: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      amount_spent: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0.00
      },
      funding_sources: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      beneficiaries_count: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      progress_percentage: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0.00
      },
      implementation_strategy: {
        type: Sequelize.JSONB,
        defaultValue: {
          phases: [],
          methodology: '',
          timeline: {},
          resources: []
        }
      },
      impact_metrics: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      stakeholders: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      risks_and_mitigation: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      sustainability_plan: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      featured_image: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      images: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      documents: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      is_featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_public: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
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
      managed_by: {
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
    await queryInterface.addIndex('projects', ['slug'], {
      unique: true,
      name: 'projects_slug_unique'
    });
    
    await queryInterface.addIndex('projects', ['status'], {
      name: 'projects_status_idx'
    });
    
    await queryInterface.addIndex('projects', ['category'], {
      name: 'projects_category_idx'
    });
    
    await queryInterface.addIndex('projects', ['priority'], {
      name: 'projects_priority_idx'
    });
    
    await queryInterface.addIndex('projects', ['geographic_scope'], {
      name: 'projects_geographic_scope_idx'
    });
    
    await queryInterface.addIndex('projects', ['is_featured'], {
      name: 'projects_is_featured_idx'
    });
    
    await queryInterface.addIndex('projects', ['is_public'], {
      name: 'projects_is_public_idx'
    });
    
    await queryInterface.addIndex('projects', ['created_by'], {
      name: 'projects_created_by_idx'
    });
    
    await queryInterface.addIndex('projects', ['managed_by'], {
      name: 'projects_managed_by_idx'
    });
    
    await queryInterface.addIndex('projects', ['start_date'], {
      name: 'projects_start_date_idx'
    });
    
    await queryInterface.addIndex('projects', ['estimated_completion_date'], {
      name: 'projects_estimated_completion_date_idx'
    });
    
    await queryInterface.addIndex('projects', ['actual_completion_date'], {
      name: 'projects_actual_completion_date_idx'
    });
    
    await queryInterface.addIndex('projects', ['location'], {
      name: 'projects_location_idx'
    });
    
    await queryInterface.addIndex('projects', ['created_at'], {
      name: 'projects_created_at_idx'
    });
    
    await queryInterface.addIndex('projects', ['progress_percentage'], {
      name: 'projects_progress_percentage_idx'
    });
    
    await queryInterface.addIndex('projects', ['total_budget'], {
      name: 'projects_total_budget_idx'
    });
    
    await queryInterface.addIndex('projects', ['status', 'is_featured'], {
      name: 'projects_status_featured_idx'
    });
    
    await queryInterface.addIndex('projects', ['category', 'status'], {
      name: 'projects_category_status_idx'
    });
    
    await queryInterface.addIndex('projects', ['status', 'priority'], {
      name: 'projects_status_priority_idx'
    });
    
    // GIN indexes for JSONB columns
    await queryInterface.addIndex('projects', ['tags'], {
      using: 'gin',
      name: 'projects_tags_gin_idx'
    });
    
    await queryInterface.addIndex('projects', ['implementation_strategy'], {
      using: 'gin',
      name: 'projects_implementation_strategy_gin_idx'
    });
    
    await queryInterface.addIndex('projects', ['impact_metrics'], {
      using: 'gin',
      name: 'projects_impact_metrics_gin_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('projects');
  }
};