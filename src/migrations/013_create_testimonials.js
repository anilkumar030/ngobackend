'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('testimonials', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      author_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      author_email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      author_phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      role: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      category: {
        type: Sequelize.ENUM('beneficiary', 'volunteer', 'donor', 'partner', 'staff', 'other'),
        allowNull: false,
        defaultValue: 'beneficiary'
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      rating: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      image_url: {
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
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected', 'archived'),
        allowNull: false,
        defaultValue: 'pending'
      },
      is_featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_anonymous: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: true
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
      project_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'projects',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      campaign_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'campaigns',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      event_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'events',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      related_project: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      related_campaign: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      related_event: {
        type: Sequelize.JSONB,
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
      approved_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      approved_by: {
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
    await queryInterface.addIndex('testimonials', ['status'], {
      name: 'testimonials_status_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['category'], {
      name: 'testimonials_category_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['is_featured'], {
      name: 'testimonials_is_featured_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['is_verified'], {
      name: 'testimonials_is_verified_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['rating'], {
      name: 'testimonials_rating_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['user_id'], {
      name: 'testimonials_user_id_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['project_id'], {
      name: 'testimonials_project_id_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['campaign_id'], {
      name: 'testimonials_campaign_id_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['event_id'], {
      name: 'testimonials_event_id_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['approved_by'], {
      name: 'testimonials_approved_by_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['created_at'], {
      name: 'testimonials_created_at_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['approved_at'], {
      name: 'testimonials_approved_at_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['display_order'], {
      name: 'testimonials_display_order_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['status', 'is_featured'], {
      name: 'testimonials_status_featured_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['category', 'status'], {
      name: 'testimonials_category_status_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['status', 'rating'], {
      name: 'testimonials_status_rating_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['project_id', 'status'], {
      name: 'testimonials_project_status_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['campaign_id', 'status'], {
      name: 'testimonials_campaign_status_idx'
    });
    
    await queryInterface.addIndex('testimonials', ['event_id', 'status'], {
      name: 'testimonials_event_status_idx'
    });
    
    // GIN indexes for JSONB columns
    await queryInterface.addIndex('testimonials', ['tags'], {
      using: 'gin',
      name: 'testimonials_tags_gin_idx'
    });
    
    // Full-text search on content
    await queryInterface.addIndex('testimonials', ['content'], {
      using: 'gin',
      name: 'testimonials_content_search_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('testimonials');
  }
};