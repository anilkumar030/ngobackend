'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('content_sections', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      key: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      page: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      section_type: {
        type: Sequelize.ENUM(
          'hero',
          'text',
          'image',
          'gallery',
          'video',
          'testimonial',
          'cta',
          'feature',
          'stats',
          'team',
          'faq',
          'contact',
          'footer',
          'header',
          'sidebar',
          'custom'
        ),
        allowNull: false,
        defaultValue: 'text'
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      subtitle: {
        type: Sequelize.STRING(1000),
        allowNull: true
      },
      content: {
        type: Sequelize.TEXT,
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
      links: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      button_text: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      button_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      button_style: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      settings: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      css_classes: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      inline_styles: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      sort_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'scheduled', 'archived'),
        allowNull: false,
        defaultValue: 'active'
      },
      visibility: {
        type: Sequelize.ENUM('public', 'private', 'members_only'),
        allowNull: false,
        defaultValue: 'public'
      },
      device_visibility: {
        type: Sequelize.JSONB,
        defaultValue: {
          desktop: true,
          tablet: true,
          mobile: true
        }
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      localized_content: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      seo_title: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      seo_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      seo_keywords: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      view_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      click_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      conversion_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      ab_test_variant: {
        type: Sequelize.STRING(50),
        allowNull: true
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
    await queryInterface.addIndex('content_sections', ['page', 'key'], {
      unique: true,
      name: 'content_sections_page_key_unique'
    });
    
    await queryInterface.addIndex('content_sections', ['page', 'slug'], {
      unique: true,
      name: 'content_sections_page_slug_unique',
      where: {
        slug: { [Sequelize.Op.ne]: null }
      }
    });
    
    await queryInterface.addIndex('content_sections', ['status'], {
      name: 'content_sections_status_idx'
    });
    
    await queryInterface.addIndex('content_sections', ['page'], {
      name: 'content_sections_page_idx'
    });
    
    await queryInterface.addIndex('content_sections', ['section_type'], {
      name: 'content_sections_section_type_idx'
    });
    
    await queryInterface.addIndex('content_sections', ['visibility'], {
      name: 'content_sections_visibility_idx'
    });
    
    await queryInterface.addIndex('content_sections', ['sort_order'], {
      name: 'content_sections_sort_order_idx'
    });
    
    await queryInterface.addIndex('content_sections', ['created_by'], {
      name: 'content_sections_created_by_idx'
    });
    
    await queryInterface.addIndex('content_sections', ['updated_by'], {
      name: 'content_sections_updated_by_idx'
    });
    
    await queryInterface.addIndex('content_sections', ['start_date'], {
      name: 'content_sections_start_date_idx'
    });
    
    await queryInterface.addIndex('content_sections', ['end_date'], {
      name: 'content_sections_end_date_idx'
    });
    
    await queryInterface.addIndex('content_sections', ['scheduled_at'], {
      name: 'content_sections_scheduled_at_idx'
    });
    
    await queryInterface.addIndex('content_sections', ['page', 'status'], {
      name: 'content_sections_page_status_idx'
    });
    
    await queryInterface.addIndex('content_sections', ['page', 'sort_order'], {
      name: 'content_sections_page_sort_order_idx'
    });
    
    await queryInterface.addIndex('content_sections', ['status', 'visibility'], {
      name: 'content_sections_status_visibility_idx'
    });

    // Add GIN indexes for JSONB columns
    await queryInterface.addIndex('content_sections', {
      fields: ['settings'],
      using: 'gin',
      name: 'content_sections_settings_gin_idx'
    });
    
    await queryInterface.addIndex('content_sections', {
      fields: ['localized_content'],
      using: 'gin',
      name: 'content_sections_localized_content_gin_idx'
    });
    
    await queryInterface.addIndex('content_sections', {
      fields: ['seo_keywords'],
      using: 'gin',
      name: 'content_sections_seo_keywords_gin_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('content_sections');
  }
};