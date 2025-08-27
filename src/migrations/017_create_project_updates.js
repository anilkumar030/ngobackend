'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('project_updates', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'projects',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      custom_excerpt: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('draft', 'published', 'archived', 'scheduled'),
        allowNull: false,
        defaultValue: 'draft'
      },
      update_type: {
        type: Sequelize.ENUM('progress', 'milestone', 'announcement', 'photos', 'budget', 'challenge', 'completion', 'other'),
        allowNull: false,
        defaultValue: 'progress'
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium'
      },
      milestone_reached: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      progress_update: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      budget_update: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      impact_metrics: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      featured_image: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      images: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      videos: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      documents: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      coordinates: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      is_featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_major_update: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      author_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      tags: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      published_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      notification_sent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      view_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      like_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      comment_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      share_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
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
    await queryInterface.addIndex('project_updates', ['project_id', 'slug'], {
      unique: true,
      name: 'project_updates_project_slug_unique'
    });
    
    await queryInterface.addIndex('project_updates', ['project_id'], {
      name: 'project_updates_project_id_idx'
    });
    
    await queryInterface.addIndex('project_updates', ['status'], {
      name: 'project_updates_status_idx'
    });
    
    await queryInterface.addIndex('project_updates', ['update_type'], {
      name: 'project_updates_update_type_idx'
    });
    
    await queryInterface.addIndex('project_updates', ['priority'], {
      name: 'project_updates_priority_idx'
    });
    
    await queryInterface.addIndex('project_updates', ['is_featured'], {
      name: 'project_updates_is_featured_idx'
    });
    
    await queryInterface.addIndex('project_updates', ['is_major_update'], {
      name: 'project_updates_is_major_update_idx'
    });
    
    await queryInterface.addIndex('project_updates', ['created_by'], {
      name: 'project_updates_created_by_idx'
    });
    
    await queryInterface.addIndex('project_updates', ['published_at'], {
      name: 'project_updates_published_at_idx'
    });
    
    await queryInterface.addIndex('project_updates', ['created_at'], {
      name: 'project_updates_created_at_idx'
    });
    
    await queryInterface.addIndex('project_updates', ['view_count'], {
      name: 'project_updates_view_count_idx'
    });
    
    await queryInterface.addIndex('project_updates', ['notification_sent'], {
      name: 'project_updates_notification_sent_idx'
    });
    
    await queryInterface.addIndex('project_updates', ['project_id', 'status'], {
      name: 'project_updates_project_status_idx'
    });
    
    await queryInterface.addIndex('project_updates', ['project_id', 'published_at'], {
      name: 'project_updates_project_published_idx'
    });
    
    await queryInterface.addIndex('project_updates', ['status', 'is_featured'], {
      name: 'project_updates_status_featured_idx'
    });
    
    await queryInterface.addIndex('project_updates', ['status', 'update_type'], {
      name: 'project_updates_status_type_idx'
    });
    
    await queryInterface.addIndex('project_updates', ['status', 'is_major_update'], {
      name: 'project_updates_status_major_idx'
    });
    
    // GIN indexes for JSONB columns
    await queryInterface.addIndex('project_updates', ['tags'], {
      using: 'gin',
      name: 'project_updates_tags_gin_idx'
    });
    
    await queryInterface.addIndex('project_updates', ['progress_update'], {
      using: 'gin',
      name: 'project_updates_progress_update_gin_idx'
    });
    
    await queryInterface.addIndex('project_updates', ['impact_metrics'], {
      using: 'gin',
      name: 'project_updates_impact_metrics_gin_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('project_updates');
  }
};