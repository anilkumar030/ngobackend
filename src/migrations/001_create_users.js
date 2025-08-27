'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      first_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      last_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      phone_number: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      date_of_birth: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      gender: {
        type: Sequelize.ENUM('male', 'female', 'other', 'prefer_not_to_say'),
        allowNull: true
      },
      profile_image: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      role: {
        type: Sequelize.ENUM('user', 'admin', 'super_admin'),
        allowNull: false,
        defaultValue: 'user'
      },
      email_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      phone_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      email_verification_token: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      phone_verification_code: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      reset_password_token: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      reset_password_expires: {
        type: Sequelize.DATE,
        allowNull: true
      },
      total_donations: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0.00
      },
      donation_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      preferences: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      last_login: {
        type: Sequelize.DATE,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Add indexes
    await queryInterface.addIndex('users', ['email'], {
      unique: true,
      name: 'users_email_unique'
    });
    
    await queryInterface.addIndex('users', ['phone_number'], {
      name: 'users_phone_number_idx'
    });
    
    await queryInterface.addIndex('users', ['role'], {
      name: 'users_role_idx'
    });
    
    await queryInterface.addIndex('users', ['email_verified'], {
      name: 'users_email_verified_idx'
    });
    
    await queryInterface.addIndex('users', ['is_active'], {
      name: 'users_is_active_idx'
    });
    
    await queryInterface.addIndex('users', ['created_at'], {
      name: 'users_created_at_idx'
    });
    
    await queryInterface.addIndex('users', ['total_donations'], {
      name: 'users_total_donations_idx'
    });
    
    await queryInterface.addIndex('users', ['deleted_at'], {
      name: 'users_deleted_at_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
  }
};