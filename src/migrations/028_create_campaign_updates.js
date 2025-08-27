'use strict';

/**
 * Migration: Create campaign_updates table
 * 
 * Creates the campaignupdates table to store updates for campaigns.
 * This table has a one-to-many relationship with campaigns.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('campaignupdates', {
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
        onDelete: 'CASCADE'
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      images: {
        type: Sequelize.JSONB,
        defaultValue: [],
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      }
    });

    // Add indexes for performance optimization
    
    // Index on campaign_id for quick lookup of updates by campaign
    await queryInterface.addIndex('campaignupdates', ['campaign_id'], {
      name: 'campaignupdates_campaign_id_idx'
    });
    
    // Index on created_at for chronological ordering
    await queryInterface.addIndex('campaignupdates', ['created_at'], {
      name: 'campaignupdates_created_at_idx'
    });
    
    // Composite index for campaign + created_at for efficient pagination
    await queryInterface.addIndex('campaignupdates', ['campaign_id', 'created_at'], {
      name: 'campaignupdates_campaign_created_idx'
    });
    
    // GIN index on images JSONB column for efficient queries on image data
    await queryInterface.addIndex('campaignupdates', ['images'], {
      using: 'gin',
      name: 'campaignupdates_images_gin_idx'
    });

    // Add foreign key constraint with proper naming
    await queryInterface.addConstraint('campaignupdates', {
      fields: ['campaign_id'],
      type: 'foreign key',
      name: 'fk_campaignupdates_campaign_id',
      references: {
        table: 'campaigns',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop foreign key constraint first
    await queryInterface.removeConstraint('campaignupdates', 'fk_campaignupdates_campaign_id');
    
    // Drop the table (indexes will be dropped automatically)
    await queryInterface.dropTable('campaignupdates');
  }
};