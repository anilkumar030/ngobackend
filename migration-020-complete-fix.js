#!/usr/bin/env node

/**
 * Complete Fix for Migration 020 Issue
 * 
 * This script provides a comprehensive solution for the migration 020 failure:
 * "column 'is_email_verified' of relation 'users' already exists"
 * 
 * It safely handles all possible states and makes the migration idempotent.
 */

const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database connection
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false // Set to console.log to see SQL queries
  }
);

class Migration020Fixer {
  constructor() {
    this.sequelize = sequelize;
  }

  async diagnose() {
    console.log('🔍 STEP 1: Diagnosing current state...\n');

    try {
      // Test connection
      await this.sequelize.authenticate();
      console.log('✅ Database connection successful');

      // Check if users table exists
      const [tables] = await this.sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users';
      `);

      if (tables.length === 0) {
        throw new Error('Users table does not exist! Run migration 001 first.');
      }

      // Get verification columns
      const [columns] = await this.sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users'
        AND column_name IN ('email_verified', 'is_email_verified', 'phone_verified', 'is_phone_verified')
        ORDER BY column_name;
      `);

      const existingColumns = columns.map(col => col.column_name);
      
      // Check indexes
      const [indexes] = await this.sequelize.query(`
        SELECT indexname
        FROM pg_indexes 
        WHERE tablename = 'users' 
        AND indexname IN ('users_email_verified_idx', 'users_is_email_verified_idx');
      `);

      const existingIndexes = indexes.map(idx => idx.indexname);

      // Check migration status
      const [migrationRecords] = await this.sequelize.query(`
        SELECT name FROM "SequelizeMeta" WHERE name = '020_rename_verification_fields.js';
      `);

      const isMigrationMarkedComplete = migrationRecords.length > 0;

      const state = {
        hasOldEmail: existingColumns.includes('email_verified'),
        hasNewEmail: existingColumns.includes('is_email_verified'),
        hasOldPhone: existingColumns.includes('phone_verified'),
        hasNewPhone: existingColumns.includes('is_phone_verified'),
        hasOldIndex: existingIndexes.includes('users_email_verified_idx'),
        hasNewIndex: existingIndexes.includes('users_is_email_verified_idx'),
        isMigrationMarkedComplete,
        existingColumns,
        existingIndexes
      };

      console.log('\n📊 Current State Analysis:');
      console.log('==========================');
      console.log(`email_verified column:      ${state.hasOldEmail ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`is_email_verified column:   ${state.hasNewEmail ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`phone_verified column:      ${state.hasOldPhone ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`is_phone_verified column:   ${state.hasNewPhone ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`Old index (email_verified): ${state.hasOldIndex ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`New index (is_email_verified): ${state.hasNewIndex ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`Migration 020 marked complete: ${state.isMigrationMarkedComplete ? '✅ YES' : '❌ NO'}`);

      return state;

    } catch (error) {
      console.error('❌ Diagnosis failed:', error.message);
      throw error;
    }
  }

  async fix(state) {
    console.log('\n🔧 STEP 2: Applying fixes...\n');

    const transaction = await this.sequelize.transaction();

    try {
      // Fix 1: Handle conflicting columns
      if (state.hasOldEmail && state.hasNewEmail) {
        console.log('📧 Fixing conflicting email columns...');
        
        // Copy data from old to new column where new is null
        await this.sequelize.query(`
          UPDATE users 
          SET is_email_verified = email_verified 
          WHERE is_email_verified IS NULL AND email_verified IS NOT NULL;
        `, { transaction });
        
        // Drop the old column
        await this.sequelize.query(`ALTER TABLE users DROP COLUMN email_verified;`, { transaction });
        console.log('✅ Consolidated email_verified → is_email_verified');
        
      } else if (state.hasOldEmail && !state.hasNewEmail) {
        console.log('📧 Renaming email column...');
        await this.sequelize.query(`ALTER TABLE users RENAME COLUMN email_verified TO is_email_verified;`, { transaction });
        console.log('✅ Renamed email_verified → is_email_verified');
        
      } else if (!state.hasOldEmail && !state.hasNewEmail) {
        console.log('📧 Creating missing email verification column...');
        await this.sequelize.query(`
          ALTER TABLE users ADD COLUMN is_email_verified BOOLEAN DEFAULT false NOT NULL;
        `, { transaction });
        console.log('✅ Created is_email_verified column');
      }

      if (state.hasOldPhone && state.hasNewPhone) {
        console.log('📱 Fixing conflicting phone columns...');
        
        // Copy data from old to new column where new is null
        await this.sequelize.query(`
          UPDATE users 
          SET is_phone_verified = phone_verified 
          WHERE is_phone_verified IS NULL AND phone_verified IS NOT NULL;
        `, { transaction });
        
        // Drop the old column
        await this.sequelize.query(`ALTER TABLE users DROP COLUMN phone_verified;`, { transaction });
        console.log('✅ Consolidated phone_verified → is_phone_verified');
        
      } else if (state.hasOldPhone && !state.hasNewPhone) {
        console.log('📱 Renaming phone column...');
        await this.sequelize.query(`ALTER TABLE users RENAME COLUMN phone_verified TO is_phone_verified;`, { transaction });
        console.log('✅ Renamed phone_verified → is_phone_verified');
        
      } else if (!state.hasOldPhone && !state.hasNewPhone) {
        console.log('📱 Creating missing phone verification column...');
        await this.sequelize.query(`
          ALTER TABLE users ADD COLUMN is_phone_verified BOOLEAN DEFAULT false NOT NULL;
        `, { transaction });
        console.log('✅ Created is_phone_verified column');
      }

      // Fix 2: Handle indexes
      if (state.hasOldIndex && state.hasNewIndex) {
        console.log('🗂️ Removing old index...');
        await this.sequelize.query(`DROP INDEX IF EXISTS users_email_verified_idx;`, { transaction });
        console.log('✅ Removed old index');
        
      } else if (state.hasOldIndex && !state.hasNewIndex) {
        console.log('🗂️ Updating index...');
        await this.sequelize.query(`DROP INDEX IF EXISTS users_email_verified_idx;`, { transaction });
        await this.sequelize.query(`CREATE INDEX users_is_email_verified_idx ON users (is_email_verified);`, { transaction });
        console.log('✅ Updated index');
        
      } else if (!state.hasOldIndex && !state.hasNewIndex) {
        console.log('🗂️ Creating new index...');
        await this.sequelize.query(`CREATE INDEX users_is_email_verified_idx ON users (is_email_verified);`, { transaction });
        console.log('✅ Created new index');
      }

      // Fix 3: Update migration tracking
      if (!state.isMigrationMarkedComplete) {
        console.log('📝 Marking migration as complete...');
        await this.sequelize.query(`
          INSERT INTO "SequelizeMeta" (name) 
          VALUES ('020_rename_verification_fields.js')
          ON CONFLICT (name) DO NOTHING;
        `, { transaction });
        console.log('✅ Migration marked as complete');
      }

      await transaction.commit();
      console.log('\n🎉 All fixes applied successfully!');

    } catch (error) {
      await transaction.rollback();
      console.error('\n💥 Fix failed! Rolling back changes...');
      throw error;
    }
  }

  async verify() {
    console.log('\n🔍 STEP 3: Verifying fixes...\n');

    try {
      // Check final state
      const [columns] = await this.sequelize.query(`
        SELECT column_name
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users'
        AND column_name IN ('email_verified', 'is_email_verified', 'phone_verified', 'is_phone_verified')
        ORDER BY column_name;
      `);

      const finalColumns = columns.map(col => col.column_name);

      const [indexes] = await this.sequelize.query(`
        SELECT indexname
        FROM pg_indexes 
        WHERE tablename = 'users' 
        AND indexname LIKE '%verified%'
        ORDER BY indexname;
      `);

      const finalIndexes = indexes.map(idx => idx.indexname);

      const [migrationRecord] = await this.sequelize.query(`
        SELECT name FROM "SequelizeMeta" WHERE name = '020_rename_verification_fields.js';
      `);

      console.log('📊 Final Verification:');
      console.log('======================');
      console.log(`✅ is_email_verified column:    ${finalColumns.includes('is_email_verified') ? 'EXISTS' : 'MISSING ❌'}`);
      console.log(`✅ is_phone_verified column:    ${finalColumns.includes('is_phone_verified') ? 'EXISTS' : 'MISSING ❌'}`);
      console.log(`❌ email_verified column:       ${finalColumns.includes('email_verified') ? 'STILL EXISTS (PROBLEM!)' : 'REMOVED'}`);
      console.log(`❌ phone_verified column:       ${finalColumns.includes('phone_verified') ? 'STILL EXISTS (PROBLEM!)' : 'REMOVED'}`);
      console.log(`✅ is_email_verified index:     ${finalIndexes.includes('users_is_email_verified_idx') ? 'EXISTS' : 'MISSING ❌'}`);
      console.log(`❌ old email_verified index:    ${finalIndexes.includes('users_email_verified_idx') ? 'STILL EXISTS (PROBLEM!)' : 'REMOVED'}`);
      console.log(`✅ Migration 020 tracking:      ${migrationRecord.length > 0 ? 'MARKED COMPLETE' : 'NOT MARKED ❌'}`);

      const isSuccess = 
        finalColumns.includes('is_email_verified') &&
        finalColumns.includes('is_phone_verified') &&
        !finalColumns.includes('email_verified') &&
        !finalColumns.includes('phone_verified') &&
        finalIndexes.includes('users_is_email_verified_idx') &&
        !finalIndexes.includes('users_email_verified_idx') &&
        migrationRecord.length > 0;

      if (isSuccess) {
        console.log('\n🎉 SUCCESS! Migration 020 is now properly fixed!');
        return true;
      } else {
        console.log('\n⚠️ Some issues remain. Please review the verification results above.');
        return false;
      }

    } catch (error) {
      console.error('❌ Verification failed:', error.message);
      throw error;
    }
  }

  async close() {
    await this.sequelize.close();
  }
}

async function main() {
  console.log('🚀 Migration 020 Complete Fix Tool');
  console.log('===================================\n');

  const fixer = new Migration020Fixer();

  try {
    // Step 1: Diagnose
    const state = await fixer.diagnose();

    // Step 2: Fix
    await fixer.fix(state);

    // Step 3: Verify
    const success = await fixer.verify();

    if (success) {
      console.log('\n📋 Next Steps:');
      console.log('==============');
      console.log('1. ✅ Migration 020 is now fixed');
      console.log('2. Run remaining migrations: npm run migrate');
      console.log('3. Test your application thoroughly');
      console.log('4. Verify user authentication works correctly');
      console.log('\n💡 The migration system should now work normally.');
    } else {
      console.log('\n⚠️ Manual intervention may be required.');
      console.log('Please review the verification results and contact support if needed.');
    }

  } catch (error) {
    console.error('\n💥 Fix process failed:', error.message);
    console.log('\n🔄 This script is idempotent - you can run it again safely.');
    console.log('If the problem persists, please check:');
    console.log('1. Database connection and permissions');
    console.log('2. Environment variables (.env file)');
    console.log('3. PostgreSQL server status');
    process.exit(1);
  } finally {
    await fixer.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { Migration020Fixer };