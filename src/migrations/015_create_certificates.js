'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('certificates', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      certificate_number: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      type: {
        type: Sequelize.ENUM('80g', 'annual_summary', 'project_specific', 'consolidated'),
        allowNull: false,
        defaultValue: '80g'
      },
      financial_year: {
        type: Sequelize.STRING(10),
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      total_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      eligible_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      donation_ids: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      donations_included: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      status: {
        type: Sequelize.ENUM('draft', 'processing', 'issued', 'cancelled', 'expired'),
        allowNull: false,
        defaultValue: 'draft'
      },
      issue_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      file_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      file_size: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      download_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      last_downloaded: {
        type: Sequelize.DATE,
        allowNull: true
      },
      template_version: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      generation_metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      pan_number: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      donor_address: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      organization_details: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      issued_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      verification_code: {
        type: Sequelize.STRING(50),
        allowNull: true,
        unique: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
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
    await queryInterface.addIndex('certificates', ['certificate_number'], {
      unique: true,
      name: 'certificates_certificate_number_unique'
    });
    
    await queryInterface.addIndex('certificates', ['verification_code'], {
      unique: true,
      name: 'certificates_verification_code_unique'
    });
    
    await queryInterface.addIndex('certificates', ['user_id'], {
      name: 'certificates_user_id_idx'
    });
    
    await queryInterface.addIndex('certificates', ['type'], {
      name: 'certificates_type_idx'
    });
    
    await queryInterface.addIndex('certificates', ['financial_year'], {
      name: 'certificates_financial_year_idx'
    });
    
    await queryInterface.addIndex('certificates', ['status'], {
      name: 'certificates_status_idx'
    });
    
    await queryInterface.addIndex('certificates', ['issued_by'], {
      name: 'certificates_issued_by_idx'
    });
    
    await queryInterface.addIndex('certificates', ['issue_date'], {
      name: 'certificates_issue_date_idx'
    });
    
    await queryInterface.addIndex('certificates', ['expires_at'], {
      name: 'certificates_expires_at_idx'
    });
    
    await queryInterface.addIndex('certificates', ['created_at'], {
      name: 'certificates_created_at_idx'
    });
    
    await queryInterface.addIndex('certificates', ['user_id', 'financial_year'], {
      name: 'certificates_user_financial_year_idx'
    });
    
    await queryInterface.addIndex('certificates', ['user_id', 'status'], {
      name: 'certificates_user_status_idx'
    });
    
    await queryInterface.addIndex('certificates', ['financial_year', 'status'], {
      name: 'certificates_financial_year_status_idx'
    });
    
    await queryInterface.addIndex('certificates', ['status', 'type'], {
      name: 'certificates_status_type_idx'
    });
    
    // GIN indexes for JSONB columns
    await queryInterface.addIndex('certificates', ['donation_ids'], {
      using: 'gin',
      name: 'certificates_donation_ids_gin_idx'
    });
    
    await queryInterface.addIndex('certificates', ['donations_included'], {
      using: 'gin',
      name: 'certificates_donations_included_gin_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('certificates');
  }
};