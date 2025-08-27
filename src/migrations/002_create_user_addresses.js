'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_addresses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      type: {
        type: Sequelize.ENUM('home', 'work', 'billing', 'shipping', 'other'),
        allowNull: false,
        defaultValue: 'home'
      },
      first_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      last_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      company: {
        type: Sequelize.STRING(150),
        allowNull: true
      },
      address_line_1: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      address_line_2: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      state: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      postal_code: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      country: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'India'
      },
      phone_number: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
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
    await queryInterface.addIndex('user_addresses', ['user_id'], {
      name: 'user_addresses_user_id_idx'
    });
    
    await queryInterface.addIndex('user_addresses', ['user_id', 'type'], {
      name: 'user_addresses_user_id_type_idx'
    });
    
    await queryInterface.addIndex('user_addresses', ['user_id', 'is_default'], {
      name: 'user_addresses_user_id_is_default_idx'
    });
    
    await queryInterface.addIndex('user_addresses', ['postal_code'], {
      name: 'user_addresses_postal_code_idx'
    });
    
    await queryInterface.addIndex('user_addresses', ['city', 'state'], {
      name: 'user_addresses_city_state_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('user_addresses');
  }
};