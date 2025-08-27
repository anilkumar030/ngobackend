'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('blog_posts', {
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
      content: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      custom_excerpt: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      featured_image: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      gallery_images: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      status: {
        type: Sequelize.ENUM('draft', 'published', 'archived', 'scheduled'),
        allowNull: false,
        defaultValue: 'draft'
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      tags: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      author_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      is_featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      allow_comments: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
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
      published_at: {
        type: Sequelize.DATE,
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
      canonical_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      og_title: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      og_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      og_image: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      twitter_title: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      twitter_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      twitter_image: {
        type: Sequelize.STRING(500),
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
    await queryInterface.addIndex('blog_posts', ['slug'], {
      unique: true,
      name: 'blog_posts_slug_unique'
    });
    
    await queryInterface.addIndex('blog_posts', ['status'], {
      name: 'blog_posts_status_idx'
    });
    
    await queryInterface.addIndex('blog_posts', ['category'], {
      name: 'blog_posts_category_idx'
    });
    
    await queryInterface.addIndex('blog_posts', ['is_featured'], {
      name: 'blog_posts_is_featured_idx'
    });
    
    await queryInterface.addIndex('blog_posts', ['created_by'], {
      name: 'blog_posts_created_by_idx'
    });
    
    await queryInterface.addIndex('blog_posts', ['published_at'], {
      name: 'blog_posts_published_at_idx'
    });
    
    await queryInterface.addIndex('blog_posts', ['created_at'], {
      name: 'blog_posts_created_at_idx'
    });
    
    await queryInterface.addIndex('blog_posts', ['view_count'], {
      name: 'blog_posts_view_count_idx'
    });
    
    await queryInterface.addIndex('blog_posts', ['like_count'], {
      name: 'blog_posts_like_count_idx'
    });
    
    await queryInterface.addIndex('blog_posts', ['status', 'published_at'], {
      name: 'blog_posts_status_published_at_idx'
    });
    
    await queryInterface.addIndex('blog_posts', ['status', 'is_featured'], {
      name: 'blog_posts_status_is_featured_idx'
    });
    
    await queryInterface.addIndex('blog_posts', ['category', 'status'], {
      name: 'blog_posts_category_status_idx'
    });

    // Add GIN indexes for JSONB columns
    await queryInterface.addIndex('blog_posts', {
      fields: ['tags'],
      using: 'gin',
      name: 'blog_posts_tags_gin_idx'
    });
    
    await queryInterface.addIndex('blog_posts', {
      fields: ['seo_keywords'],
      using: 'gin',
      name: 'blog_posts_seo_keywords_gin_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('blog_posts');
  }
};