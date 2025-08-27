'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('campaigns', 'howyoucanhelp', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of helping options with title and amount - [{title: "One hygiene kit", amount: 500}]'
    });

    // Add GIN index for JSONB field to enable efficient queries
    await queryInterface.addIndex('campaigns', ['howyoucanhelp'], {
      using: 'gin',
      name: 'campaigns_howyoucanhelp_gin_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove index first
    await queryInterface.removeIndex('campaigns', 'campaigns_howyoucanhelp_gin_idx');
    
    // Remove column
    await queryInterface.removeColumn('campaigns', 'howyoucanhelp');
  }
};