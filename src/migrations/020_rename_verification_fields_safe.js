'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('Starting safe verification fields migration...');
      
      // Helper function to check if column exists
      const columnExists = async (tableName, columnName) => {
        const [results] = await queryInterface.sequelize.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = '${tableName}' 
          AND column_name = '${columnName}';
        `, { transaction });
        return results.length > 0;
      };

      // Helper function to check if index exists
      const indexExists = async (indexName) => {
        const [results] = await queryInterface.sequelize.query(`
          SELECT indexname 
          FROM pg_indexes 
          WHERE indexname = '${indexName}';
        `, { transaction });
        return results.length > 0;
      };

      // Check current state
      const hasOldEmail = await columnExists('users', 'email_verified');
      const hasNewEmail = await columnExists('users', 'is_email_verified');
      const hasOldPhone = await columnExists('users', 'phone_verified');
      const hasNewPhone = await columnExists('users', 'is_phone_verified');

      console.log(`Current state - Old email: ${hasOldEmail}, New email: ${hasNewEmail}, Old phone: ${hasOldPhone}, New phone: ${hasNewPhone}`);

      // Handle email_verified → is_email_verified
      if (hasOldEmail && hasNewEmail) {
        console.log('Both email columns exist - consolidating data...');
        // Copy data from old to new if new is null
        await queryInterface.sequelize.query(`
          UPDATE users 
          SET is_email_verified = email_verified 
          WHERE is_email_verified IS NULL AND email_verified IS NOT NULL;
        `, { transaction });
        
        // Drop the old column
        await queryInterface.removeColumn('users', 'email_verified', { transaction });
        console.log('Consolidated email columns');
        
      } else if (hasOldEmail && !hasNewEmail) {
        console.log('Renaming email_verified to is_email_verified...');
        await queryInterface.renameColumn('users', 'email_verified', 'is_email_verified', { transaction });
        console.log('Email column renamed successfully');
        
      } else if (!hasOldEmail && hasNewEmail) {
        console.log('Email column already migrated');
        
      } else {
        console.log('Creating is_email_verified column...');
        await queryInterface.addColumn('users', 'is_email_verified', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false
        }, { transaction });
        console.log('Created is_email_verified column');
      }

      // Handle phone_verified → is_phone_verified
      if (hasOldPhone && hasNewPhone) {
        console.log('Both phone columns exist - consolidating data...');
        // Copy data from old to new if new is null
        await queryInterface.sequelize.query(`
          UPDATE users 
          SET is_phone_verified = phone_verified 
          WHERE is_phone_verified IS NULL AND phone_verified IS NOT NULL;
        `, { transaction });
        
        // Drop the old column
        await queryInterface.removeColumn('users', 'phone_verified', { transaction });
        console.log('Consolidated phone columns');
        
      } else if (hasOldPhone && !hasNewPhone) {
        console.log('Renaming phone_verified to is_phone_verified...');
        await queryInterface.renameColumn('users', 'phone_verified', 'is_phone_verified', { transaction });
        console.log('Phone column renamed successfully');
        
      } else if (!hasOldPhone && hasNewPhone) {
        console.log('Phone column already migrated');
        
      } else {
        console.log('Creating is_phone_verified column...');
        await queryInterface.addColumn('users', 'is_phone_verified', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false
        }, { transaction });
        console.log('Created is_phone_verified column');
      }

      // Handle indexes
      const hasOldIndex = await indexExists('users_email_verified_idx');
      const hasNewIndex = await indexExists('users_is_email_verified_idx');

      if (hasOldIndex && !hasNewIndex) {
        console.log('Updating index from email_verified to is_email_verified...');
        await queryInterface.removeIndex('users', 'users_email_verified_idx', { transaction });
        await queryInterface.addIndex('users', ['is_email_verified'], {
          name: 'users_is_email_verified_idx',
          transaction
        });
        console.log('Index updated successfully');
        
      } else if (hasOldIndex && hasNewIndex) {
        console.log('Both indexes exist - removing old one...');
        await queryInterface.removeIndex('users', 'users_email_verified_idx', { transaction });
        console.log('Old index removed');
        
      } else if (!hasOldIndex && !hasNewIndex) {
        console.log('Creating new index...');
        await queryInterface.addIndex('users', ['is_email_verified'], {
          name: 'users_is_email_verified_idx',
          transaction
        });
        console.log('New index created');
        
      } else {
        console.log('Index already migrated');
      }

      await transaction.commit();
      console.log('✅ Migration completed successfully');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed, rolling back:', error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('Reversing verification fields migration...');
      
      // Helper function to check if column exists
      const columnExists = async (tableName, columnName) => {
        const [results] = await queryInterface.sequelize.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = '${tableName}' 
          AND column_name = '${columnName}';
        `, { transaction });
        return results.length > 0;
      };

      // Helper function to check if index exists
      const indexExists = async (indexName) => {
        const [results] = await queryInterface.sequelize.query(`
          SELECT indexname 
          FROM pg_indexes 
          WHERE indexname = '${indexName}';
        `, { transaction });
        return results.length > 0;
      };

      // Check current state
      const hasOldEmail = await columnExists('users', 'email_verified');
      const hasNewEmail = await columnExists('users', 'is_email_verified');
      const hasOldPhone = await columnExists('users', 'phone_verified');
      const hasNewPhone = await columnExists('users', 'is_phone_verified');

      // Reverse index changes first
      const hasOldIndex = await indexExists('users_email_verified_idx');
      const hasNewIndex = await indexExists('users_is_email_verified_idx');

      if (!hasOldIndex && hasNewIndex) {
        console.log('Reversing index changes...');
        await queryInterface.removeIndex('users', 'users_is_email_verified_idx', { transaction });
        await queryInterface.addIndex('users', ['email_verified'], {
          name: 'users_email_verified_idx',
          transaction
        });
      }

      // Reverse column changes
      if (!hasOldPhone && hasNewPhone) {
        console.log('Reversing phone column rename...');
        await queryInterface.renameColumn('users', 'is_phone_verified', 'phone_verified', { transaction });
      }

      if (!hasOldEmail && hasNewEmail) {
        console.log('Reversing email column rename...');
        await queryInterface.renameColumn('users', 'is_email_verified', 'email_verified', { transaction });
      }

      await transaction.commit();
      console.log('✅ Migration rollback completed successfully');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration rollback failed:', error.message);
      throw error;
    }
  }
};