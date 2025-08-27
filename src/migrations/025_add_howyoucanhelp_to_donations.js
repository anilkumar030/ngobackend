'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('donations', 'howyoucanhelp', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Specific help option selected for this donation - {title: "One hygiene kit", amount: 500}'
    });

    // Add GIN index for JSONB field to enable efficient queries
    await queryInterface.addIndex('donations', ['howyoucanhelp'], {
      using: 'gin',
      name: 'donations_howyoucanhelp_gin_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove index first
    await queryInterface.removeIndex('donations', 'donations_howyoucanhelp_gin_idx');
    
    // Remove column
    await queryInterface.removeColumn('donations', 'howyoucanhelp');
  }
};