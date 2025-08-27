'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add email_verified_at column
    await queryInterface.addColumn('users', 'email_verified_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    
    // Add phone_verified_at column
    await queryInterface.addColumn('users', 'phone_verified_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'phone_verified_at');
    await queryInterface.removeColumn('users', 'email_verified_at');
  }
};