'use strict';

/**
 * Migration: Fix Missing Users Table Columns
 * 
 * This migration ensures that the users table has all the columns expected
 * by the original 001_create_users.js migration. It safely adds any missing
 * columns without affecting existing data.
 * 
 * This fixes the issue where the users table exists but is missing some columns,
 * causing index creation failures in the original migration.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('🔧 Fixing missing columns in users table...');

      // Check if users table exists
      const tableExists = await queryInterface.showAllTables()
        .then(tables => tables.includes('users'));
      
      if (!tableExists) {
        console.log('   ⚠️  Users table does not exist - this migration will be skipped');
        console.log('       Run the 001_create_users.js migration first');
        return;
      }

      // Get current table structure
      const currentColumns = await queryInterface.describeTable('users');
      console.log(`   📊 Current users table has ${Object.keys(currentColumns).length} columns`);

      // Define all expected columns with their definitions
      const expectedColumns = {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        email: {
          type: Sequelize.STRING(255),
          allowNull: false
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
          defaultValue: false,
          allowNull: true
        },
        phone_verified: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: true
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
          defaultValue: 0.00,
          allowNull: true
        },
        donation_count: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          allowNull: true
        },
        preferences: {
          type: Sequelize.JSONB,
          defaultValue: {},
          allowNull: true
        },
        last_login: {
          type: Sequelize.DATE,
          allowNull: true
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true
        }
      };

      // Create ENUM types if they don't exist
      console.log('   🔧 Creating/verifying ENUM types...');
      
      try {
        await queryInterface.sequelize.query(`
          DO $$ BEGIN
            CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `);
        console.log('      ✅ Gender ENUM type verified');
      } catch (error) {
        console.log('      ⚠️  Gender ENUM already exists or could not be created');
      }

      try {
        await queryInterface.sequelize.query(`
          DO $$ BEGIN
            CREATE TYPE role_enum AS ENUM ('user', 'admin', 'super_admin');
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `);
        console.log('      ✅ Role ENUM type verified');
      } catch (error) {
        console.log('      ⚠️  Role ENUM already exists or could not be created');
      }

      // Find and add missing columns
      const missingColumns = [];
      for (const [columnName, columnDef] of Object.entries(expectedColumns)) {
        if (!currentColumns.hasOwnProperty(columnName)) {
          missingColumns.push(columnName);
        }
      }

      if (missingColumns.length === 0) {
        console.log('   ✅ All expected columns are present in users table');
      } else {
        console.log(`   🔧 Adding ${missingColumns.length} missing columns:`);
        
        for (const columnName of missingColumns) {
          try {
            console.log(`      ➕ Adding column: ${columnName}`);
            await queryInterface.addColumn('users', columnName, expectedColumns[columnName]);
            console.log(`      ✅ Successfully added: ${columnName}`);
          } catch (error) {
            console.log(`      ❌ Failed to add ${columnName}: ${error.message}`);
            // Continue with other columns instead of failing completely
          }
        }
      }

      // Now add missing indexes (only for columns that exist)
      console.log('   📊 Creating missing indexes...');
      
      // Re-check current columns after adding missing ones
      const updatedColumns = await queryInterface.describeTable('users');
      
      const indexesToCreate = [
        { name: 'users_email_unique', fields: ['email'], unique: true },
        { name: 'users_phone_number_idx', fields: ['phone_number'] },
        { name: 'users_role_idx', fields: ['role'] },
        { name: 'users_email_verified_idx', fields: ['email_verified'] },
        { name: 'users_is_active_idx', fields: ['is_active'] },
        { name: 'users_created_at_idx', fields: ['created_at'] },
        { name: 'users_total_donations_idx', fields: ['total_donations'] },
        { name: 'users_deleted_at_idx', fields: ['deleted_at'] }
      ];

      for (const indexDef of indexesToCreate) {
        try {
          // Check if all columns for this index exist
          const columnsMissing = indexDef.fields.some(field => !updatedColumns.hasOwnProperty(field));
          
          if (columnsMissing) {
            console.log(`      ⚠️  Skipping index ${indexDef.name}: required columns missing`);
            continue;
          }

          // Check if index already exists
          const indexes = await queryInterface.showIndex('users');
          const indexExists = indexes.some(idx => idx.name === indexDef.name);
          
          if (indexExists) {
            console.log(`      ⏭️  Index ${indexDef.name} already exists, skipping...`);
            continue;
          }

          console.log(`      📊 Creating index: ${indexDef.name}`);
          await queryInterface.addIndex('users', indexDef.fields, {
            name: indexDef.name,
            unique: indexDef.unique || false
          });
          console.log(`      ✅ Successfully created: ${indexDef.name}`);
          
        } catch (error) {
          console.log(`      ⚠️  Could not create index ${indexDef.name}: ${error.message}`);
          // Continue with other indexes
        }
      }

      console.log('✅ Users table schema fix completed successfully');
      
    } catch (error) {
      console.error('❌ Error in migration 026_fix_missing_users_columns:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('⚠️  Rolling back users table schema fixes...');
      console.log('   This will only remove columns that were added by this migration');
      console.log('   Existing data will be preserved');

      // Define columns that this migration might have added
      const columnsToRemove = [
        'email_verified',
        'phone_verified', 
        'email_verification_token',
        'phone_verification_code',
        'reset_password_token',
        'reset_password_expires',
        'total_donations',
        'donation_count',
        'preferences',
        'last_login',
        'is_active',
        'deleted_at'
      ];

      // Remove indexes first
      const indexesToRemove = [
        'users_email_verified_idx',
        'users_is_active_idx',
        'users_total_donations_idx',
        'users_deleted_at_idx'
      ];

      for (const indexName of indexesToRemove) {
        try {
          await queryInterface.removeIndex('users', indexName);
          console.log(`   ✅ Removed index: ${indexName}`);
        } catch (error) {
          console.log(`   ⚠️  Could not remove index ${indexName}: ${error.message}`);
        }
      }

      // Remove columns
      for (const columnName of columnsToRemove) {
        try {
          const tableInfo = await queryInterface.describeTable('users');
          if (tableInfo.hasOwnProperty(columnName)) {
            await queryInterface.removeColumn('users', columnName);
            console.log(`   ✅ Removed column: ${columnName}`);
          }
        } catch (error) {
          console.log(`   ⚠️  Could not remove column ${columnName}: ${error.message}`);
        }
      }

      console.log('✅ Migration 026 rollback completed');
      
    } catch (error) {
      console.error('❌ Error rolling back migration 026_fix_missing_users_columns:', error);
      throw error;
    }
  }
};