'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('gallery', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      slug: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      image_url: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      thumbnail_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      medium_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      original_filename: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      alt_text: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      caption: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'general'
      },
      subcategory: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      tags: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      photographer: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      taken_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      file_size: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      file_type: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      dimensions: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      exif_data: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      color_palette: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'archived'),
        allowNull: false,
        defaultValue: 'active'
      },
      featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      sort_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      view_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      like_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      download_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      allow_download: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      copyright_info: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      license: {
        type: Sequelize.STRING(100),
        allowNull: true
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
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      uploaded_by: {
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
    await queryInterface.addIndex('gallery', ['slug'], {
      unique: true,
      name: 'gallery_slug_unique',
      where: {
        slug: { [Sequelize.Op.ne]: null }
      }
    });
    
    await queryInterface.addIndex('gallery', ['status'], {
      name: 'gallery_status_idx'
    });
    
    await queryInterface.addIndex('gallery', ['category'], {
      name: 'gallery_category_idx'
    });
    
    await queryInterface.addIndex('gallery', ['subcategory'], {
      name: 'gallery_subcategory_idx'
    });
    
    await queryInterface.addIndex('gallery', ['featured'], {
      name: 'gallery_featured_idx'
    });
    
    await queryInterface.addIndex('gallery', ['uploaded_by'], {
      name: 'gallery_uploaded_by_idx'
    });
    
    await queryInterface.addIndex('gallery', ['created_at'], {
      name: 'gallery_created_at_idx'
    });
    
    await queryInterface.addIndex('gallery', ['taken_at'], {
      name: 'gallery_taken_at_idx'
    });
    
    await queryInterface.addIndex('gallery', ['view_count'], {
      name: 'gallery_view_count_idx'
    });
    
    await queryInterface.addIndex('gallery', ['like_count'], {
      name: 'gallery_like_count_idx'
    });
    
    await queryInterface.addIndex('gallery', ['sort_order'], {
      name: 'gallery_sort_order_idx'
    });
    
    await queryInterface.addIndex('gallery', ['status', 'category'], {
      name: 'gallery_status_category_idx'
    });
    
    await queryInterface.addIndex('gallery', ['status', 'featured'], {
      name: 'gallery_status_featured_idx'
    });
    
    await queryInterface.addIndex('gallery', ['category', 'featured'], {
      name: 'gallery_category_featured_idx'
    });
    
    await queryInterface.addIndex('gallery', ['status', 'sort_order'], {
      name: 'gallery_status_sort_order_idx'
    });

    // Add GIN indexes for JSONB columns
    await queryInterface.addIndex('gallery', {
      fields: ['tags'],
      using: 'gin',
      name: 'gallery_tags_gin_idx'
    });
    
    await queryInterface.addIndex('gallery', {
      fields: ['seo_keywords'],
      using: 'gin',
      name: 'gallery_seo_keywords_gin_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('gallery');
  }
};