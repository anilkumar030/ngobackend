'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check current table structure
      const tableDescription = await queryInterface.describeTable('users');
      
      // Handle email_verified -> is_email_verified
      if (tableDescription.email_verified && !tableDescription.is_email_verified) {
        // Rename if old column exists and new doesn't
        await queryInterface.renameColumn('users', 'email_verified', 'is_email_verified', { transaction });
      } else if (tableDescription.email_verified && tableDescription.is_email_verified) {
        // Both exist - copy data and remove old column
        await queryInterface.sequelize.query(
          'UPDATE users SET is_email_verified = email_verified WHERE is_email_verified IS NULL',
          { transaction }
        );
        await queryInterface.removeColumn('users', 'email_verified', { transaction });
      }
      
      // Handle phone_verified -> is_phone_verified  
      if (tableDescription.phone_verified && !tableDescription.is_phone_verified) {
        // Rename if old column exists and new doesn't
        await queryInterface.renameColumn('users', 'phone_verified', 'is_phone_verified', { transaction });
      } else if (tableDescription.phone_verified && tableDescription.is_phone_verified) {
        // Both exist - copy data and remove old column
        await queryInterface.sequelize.query(
          'UPDATE users SET is_phone_verified = phone_verified WHERE is_phone_verified IS NULL',
          { transaction }
        );
        await queryInterface.removeColumn('users', 'phone_verified', { transaction });
      }
      
      // Handle index updates
      try {
        const indexes = await queryInterface.showIndex('users');
        const hasOldIndex = indexes.some(index => index.name === 'users_email_verified_idx');
        const hasNewIndex = indexes.some(index => index.name === 'users_is_email_verified_idx');
        
        if (hasOldIndex && !hasNewIndex) {
          await queryInterface.removeIndex('users', 'users_email_verified_idx', { transaction });
          await queryInterface.addIndex('users', ['is_email_verified'], {
            name: 'users_is_email_verified_idx',
            transaction
          });
        } else if (hasOldIndex && hasNewIndex) {
          // Remove old index if both exist
          await queryInterface.removeIndex('users', 'users_email_verified_idx', { transaction });
        }
      } catch (indexError) {
        console.warn('Index update failed, continuing...', indexError.message);
      }
      
      await transaction.commit();
      console.log('✅ Verification fields migration completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Reverse the changes
      const tableDescription = await queryInterface.describeTable('users');
      
      if (tableDescription.is_email_verified) {
        await queryInterface.renameColumn('users', 'is_email_verified', 'email_verified', { transaction });
      }
      
      if (tableDescription.is_phone_verified) {
        await queryInterface.renameColumn('users', 'is_phone_verified', 'phone_verified', { transaction });
      }
      
      // Restore old index
      try {
        await queryInterface.removeIndex('users', 'users_is_email_verified_idx', { transaction });
        await queryInterface.addIndex('users', ['email_verified'], {
          name: 'users_email_verified_idx',
          transaction
        });
      } catch (indexError) {
        console.warn('Index rollback failed, continuing...', indexError.message);
      }
      
      await transaction.commit();
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};