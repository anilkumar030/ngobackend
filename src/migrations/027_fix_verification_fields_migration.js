'use strict';

/**
 * Fix Migration 020: Handle verification field renaming safely
 * This migration handles the case where verification fields may already be renamed
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔧 Fixing verification field migration issues...');
    
    // Check current state of users table
    const tableInfo = await queryInterface.describeTable('users');
    
    // Check if old columns exist and need to be renamed
    const hasOldEmailField = tableInfo.hasOwnProperty('email_verified');
    const hasOldPhoneField = tableInfo.hasOwnProperty('phone_verified');
    const hasNewEmailField = tableInfo.hasOwnProperty('is_email_verified');
    const hasNewPhoneField = tableInfo.hasOwnProperty('is_phone_verified');
    
    console.log('📋 Current verification field state:');
    console.log(`  - email_verified exists: ${hasOldEmailField}`);
    console.log(`  - phone_verified exists: ${hasOldPhoneField}`);
    console.log(`  - is_email_verified exists: ${hasNewEmailField}`);
    console.log(`  - is_phone_verified exists: ${hasNewPhoneField}`);
    
    // Only rename if old fields exist and new fields don't
    if (hasOldEmailField && !hasNewEmailField) {
      console.log('  ➡️ Renaming email_verified to is_email_verified');
      await queryInterface.renameColumn('users', 'email_verified', 'is_email_verified');
    } else {
      console.log('  ⏭️ Email verification field already properly named');
    }
    
    if (hasOldPhoneField && !hasNewPhoneField) {
      console.log('  ➡️ Renaming phone_verified to is_phone_verified');
      await queryInterface.renameColumn('users', 'phone_verified', 'is_phone_verified');
    } else {
      console.log('  ⏭️ Phone verification field already properly named');
    }
    
    // Handle index updates only if needed
    try {
      // Check if old index exists and remove it
      const indexes = await queryInterface.showIndex('users');
      const hasOldIndex = indexes.some(index => index.name === 'users_email_verified_idx');
      const hasNewIndex = indexes.some(index => index.name === 'users_is_email_verified_idx');
      
      if (hasOldIndex && !hasNewIndex) {
        console.log('  📊 Updating email verification index');
        await queryInterface.removeIndex('users', 'users_email_verified_idx');
        await queryInterface.addIndex('users', ['is_email_verified'], {
          name: 'users_is_email_verified_idx'
        });
      } else if (!hasNewIndex && hasNewEmailField) {
        console.log('  📊 Creating missing email verification index');
        await queryInterface.addIndex('users', ['is_email_verified'], {
          name: 'users_is_email_verified_idx'
        });
      } else {
        console.log('  ⏭️ Email verification index already correct');
      }
    } catch (error) {
      console.warn('  ⚠️ Index update skipped:', error.message);
    }
    
    console.log('✅ Verification field migration fix completed');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Reverting verification field migration fix...');
    
    // Check current state
    const tableInfo = await queryInterface.describeTable('users');
    const hasNewEmailField = tableInfo.hasOwnProperty('is_email_verified');
    const hasNewPhoneField = tableInfo.hasOwnProperty('is_phone_verified');
    
    if (hasNewEmailField) {
      await queryInterface.renameColumn('users', 'is_email_verified', 'email_verified');
    }
    
    if (hasNewPhoneField) {
      await queryInterface.renameColumn('users', 'is_phone_verified', 'phone_verified');
    }
    
    // Handle index reversal
    try {
      const indexes = await queryInterface.showIndex('users');
      const hasNewIndex = indexes.some(index => index.name === 'users_is_email_verified_idx');
      
      if (hasNewIndex) {
        await queryInterface.removeIndex('users', 'users_is_email_verified_idx');
        await queryInterface.addIndex('users', ['email_verified'], {
          name: 'users_email_verified_idx'
        });
      }
    } catch (error) {
      console.warn('Index reversal skipped:', error.message);
    }
    
    console.log('✅ Verification field migration fix reverted');
  }
};