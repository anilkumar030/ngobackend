'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('campaigns', {
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
      location: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      target_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      raised_amount: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0.00
      },
      donor_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      status: {
        type: Sequelize.ENUM('draft', 'active', 'completed', 'paused', 'cancelled'),
        allowNull: false,
        defaultValue: 'active'
      },
      featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      images: {
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
    await queryInterface.addIndex('campaigns', ['slug'], {
      unique: true,
      name: 'campaigns_slug_unique'
    });
    
    await queryInterface.addIndex('campaigns', ['status'], {
      name: 'campaigns_status_idx'
    });
    
    await queryInterface.addIndex('campaigns', ['category'], {
      name: 'campaigns_category_idx'
    });
    
    await queryInterface.addIndex('campaigns', ['featured'], {
      name: 'campaigns_featured_idx'
    });
    
    await queryInterface.addIndex('campaigns', ['verified'], {
      name: 'campaigns_verified_idx'
    });
    
    await queryInterface.addIndex('campaigns', ['created_by'], {
      name: 'campaigns_created_by_idx'
    });
    
    await queryInterface.addIndex('campaigns', ['start_date'], {
      name: 'campaigns_start_date_idx'
    });
    
    await queryInterface.addIndex('campaigns', ['end_date'], {
      name: 'campaigns_end_date_idx'
    });
    
    await queryInterface.addIndex('campaigns', ['created_at'], {
      name: 'campaigns_created_at_idx'
    });
    
    await queryInterface.addIndex('campaigns', ['target_amount'], {
      name: 'campaigns_target_amount_idx'
    });
    
    await queryInterface.addIndex('campaigns', ['raised_amount'], {
      name: 'campaigns_raised_amount_idx'
    });
    
    await queryInterface.addIndex('campaigns', ['status', 'featured'], {
      name: 'campaigns_status_featured_idx'
    });
    
    await queryInterface.addIndex('campaigns', ['category', 'status'], {
      name: 'campaigns_category_status_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('campaigns');
  }
};