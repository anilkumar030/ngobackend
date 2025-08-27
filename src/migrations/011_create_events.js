'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('events', {
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
        type: Sequelize.ENUM('healthcare', 'education', 'workshop', 'awareness', 'fundraising', 'volunteer', 'other'),
        allowNull: false,
        defaultValue: 'other'
      },
      status: {
        type: Sequelize.ENUM('draft', 'active', 'cancelled', 'completed'),
        allowNull: false,
        defaultValue: 'active'
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      location: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      venue_details: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      max_participants: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      registered_participants: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      registration_fee: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
      },
      registration_start_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      registration_end_date: {
        type: Sequelize.DATE,
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
      is_featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      organizer: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      requirements: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      agenda: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      speakers: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      certificates: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
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
    await queryInterface.addIndex('events', ['slug'], {
      unique: true,
      name: 'events_slug_unique'
    });
    
    await queryInterface.addIndex('events', ['status'], {
      name: 'events_status_idx'
    });
    
    await queryInterface.addIndex('events', ['category'], {
      name: 'events_category_idx'
    });
    
    await queryInterface.addIndex('events', ['is_featured'], {
      name: 'events_is_featured_idx'
    });
    
    await queryInterface.addIndex('events', ['created_by'], {
      name: 'events_created_by_idx'
    });
    
    await queryInterface.addIndex('events', ['start_date'], {
      name: 'events_start_date_idx'
    });
    
    await queryInterface.addIndex('events', ['end_date'], {
      name: 'events_end_date_idx'
    });
    
    await queryInterface.addIndex('events', ['registration_start_date'], {
      name: 'events_registration_start_date_idx'
    });
    
    await queryInterface.addIndex('events', ['registration_end_date'], {
      name: 'events_registration_end_date_idx'
    });
    
    await queryInterface.addIndex('events', ['location'], {
      name: 'events_location_idx'
    });
    
    await queryInterface.addIndex('events', ['created_at'], {
      name: 'events_created_at_idx'
    });
    
    await queryInterface.addIndex('events', ['status', 'is_featured'], {
      name: 'events_status_featured_idx'
    });
    
    await queryInterface.addIndex('events', ['category', 'status'], {
      name: 'events_category_status_idx'
    });
    
    await queryInterface.addIndex('events', ['start_date', 'status'], {
      name: 'events_start_date_status_idx'
    });
    
    // GIN indexes for JSONB columns
    await queryInterface.addIndex('events', ['tags'], {
      using: 'gin',
      name: 'events_tags_gin_idx'
    });
    
    await queryInterface.addIndex('events', ['venue_details'], {
      using: 'gin',
      name: 'events_venue_details_gin_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('events');
  }
};