'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add the new columns to the campaigns table
    await queryInterface.addColumn('campaigns', 'short_description', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Brief summary of the campaign for preview cards and listings'
    });

    // Update existing campaigns with default short description based on their description
    await queryInterface.sequelize.query(`
      UPDATE campaigns 
      SET short_description = CASE 
        WHEN LENGTH(description) > 250 THEN LEFT(description, 247) || '...'
        ELSE description
      END
      WHERE short_description IS NULL AND description IS NOT NULL;
    `);
    
    // For campaigns without description, use title
    await queryInterface.sequelize.query(`
      UPDATE campaigns 
      SET short_description = 'Brief summary of ' || title
      WHERE short_description IS NULL;
    `);

    // Now make the column NOT NULL
    await queryInterface.changeColumn('campaigns', 'short_description', {
      type: Sequelize.TEXT,
      allowNull: false,
      comment: 'Brief summary of the campaign for preview cards and listings'
    });

    await queryInterface.addColumn('campaigns', 'contact_phone', {
      type: Sequelize.STRING(20),
      allowNull: true,
      validate: {
        len: [10, 20],
        is: /^[\+]?[0-9\-\(\)\s]+$/
      },
      comment: 'Contact phone number for campaign inquiries'
    });

    await queryInterface.addColumn('campaigns', 'contact_email', {
      type: Sequelize.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true,
        len: [5, 255]
      },
      comment: 'Contact email address for campaign inquiries'
    });

    await queryInterface.addColumn('campaigns', 'beneficiary_details', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Detailed information about campaign beneficiaries'
    });

    await queryInterface.addColumn('campaigns', 'visibility', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'public',
      validate: {
        isIn: [['public', 'private']]
      },
      comment: 'Campaign visibility setting - public or private'
    });

    await queryInterface.addColumn('campaigns', 'seo_title', {
      type: Sequelize.STRING(60),
      allowNull: true,
      validate: {
        len: [0, 60]
      },
      comment: 'SEO optimized title for search engines (max 60 chars)'
    });

    await queryInterface.addColumn('campaigns', 'seo_description', {
      type: Sequelize.STRING(160),
      allowNull: true,
      validate: {
        len: [0, 160]
      },
      comment: 'SEO meta description for search engines (max 160 chars)'
    });

    await queryInterface.addColumn('campaigns', 'tags', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of tags for campaign categorization and filtering'
    });

    await queryInterface.addColumn('campaigns', 'meta_keywords', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of SEO keywords for search optimization'
    });

    // Add indexes for performance optimization
    await queryInterface.addIndex('campaigns', ['visibility'], {
      name: 'campaigns_visibility_idx'
    });

    await queryInterface.addIndex('campaigns', ['contact_email'], {
      name: 'campaigns_contact_email_idx'
    });

    // Add GIN index for JSONB fields for efficient searching
    await queryInterface.addIndex('campaigns', ['tags'], {
      name: 'campaigns_tags_gin_idx',
      using: 'gin'
    });

    await queryInterface.addIndex('campaigns', ['meta_keywords'], {
      name: 'campaigns_meta_keywords_gin_idx', 
      using: 'gin'
    });

    // Add composite index for visibility and status for efficient public campaign queries
    await queryInterface.addIndex('campaigns', ['visibility', 'status'], {
      name: 'campaigns_visibility_status_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes first
    await queryInterface.removeIndex('campaigns', 'campaigns_visibility_idx');
    await queryInterface.removeIndex('campaigns', 'campaigns_contact_email_idx');
    await queryInterface.removeIndex('campaigns', 'campaigns_tags_gin_idx');
    await queryInterface.removeIndex('campaigns', 'campaigns_meta_keywords_gin_idx');
    await queryInterface.removeIndex('campaigns', 'campaigns_visibility_status_idx');

    // Remove columns in reverse order
    await queryInterface.removeColumn('campaigns', 'meta_keywords');
    await queryInterface.removeColumn('campaigns', 'tags');
    await queryInterface.removeColumn('campaigns', 'seo_description');
    await queryInterface.removeColumn('campaigns', 'seo_title');
    await queryInterface.removeColumn('campaigns', 'visibility');
    await queryInterface.removeColumn('campaigns', 'beneficiary_details');
    await queryInterface.removeColumn('campaigns', 'contact_email');
    await queryInterface.removeColumn('campaigns', 'contact_phone');
    await queryInterface.removeColumn('campaigns', 'short_description');
  }
};