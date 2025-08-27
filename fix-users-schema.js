#!/usr/bin/env node

/**
 * Users Table Schema Fix Script
 * 
 * This script fixes schema inconsistencies in the users table that are causing
 * migration failures. It safely adds missing columns and ensures the table
 * structure matches what the migrations expect.
 * 
 * Usage: node fix-users-schema.js [--dry-run] [--force]
 */

'use strict';

const { Sequelize } = require('sequelize');
const dbConfig = require('./src/config/database');

class UsersSchemaFixer {
  constructor(options = {}) {
    this.sequelize = dbConfig.sequelize;
    this.queryInterface = this.sequelize.getQueryInterface();
    this.dryRun = options.dryRun || false;
    this.force = options.force || false;
    
    console.log(`🔧 Users Schema Fixer initialized`);
    console.log(`   Mode: ${this.dryRun ? 'DRY RUN' : 'EXECUTE'}`);
    console.log(`   Force: ${this.force ? 'YES' : 'NO'}\n`);
  }

  /**
   * Get current table structure
   */
  async getCurrentTableStructure() {
    try {
      const tableExists = await this.queryInterface.showAllTables()
        .then(tables => tables.includes('users'));

      if (!tableExists) {
        throw new Error('Users table does not exist');
      }

      const columns = await this.queryInterface.describeTable('users');
      return columns;
    } catch (error) {
      throw new Error(`Failed to get current table structure: ${error.message}`);
    }
  }

  /**
   * Define the complete expected schema for users table
   */
  getExpectedSchema() {
    return {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
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
        defaultValue: Sequelize.NOW,
        allowNull: true
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: true
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    };
  }

  /**
   * Create ENUM types if they don't exist
   */
  async createEnumTypes() {
    const enumCommands = [];

    // Check and create gender enum
    try {
      await this.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      enumCommands.push('Gender ENUM type created/verified');
    } catch (error) {
      console.warn('⚠️  Could not create gender enum:', error.message);
    }

    // Check and create role enum
    try {
      await this.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE role_enum AS ENUM ('user', 'admin', 'super_admin');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      enumCommands.push('Role ENUM type created/verified');
    } catch (error) {
      console.warn('⚠️  Could not create role enum:', error.message);
    }

    return enumCommands;
  }

  /**
   * Add missing columns to the users table
   */
  async addMissingColumns(missingColumns) {
    const schema = this.getExpectedSchema();
    const results = [];

    for (const columnName of missingColumns) {
      const columnDef = schema[columnName];
      
      try {
        if (this.dryRun) {
          console.log(`   [DRY RUN] Would add column: ${columnName}`);
          results.push(`DRY RUN: ${columnName}`);
        } else {
          console.log(`   ➕ Adding column: ${columnName}`);
          await this.queryInterface.addColumn('users', columnName, columnDef);
          results.push(`✅ ${columnName}`);
        }
      } catch (error) {
        console.error(`   ❌ Failed to add column ${columnName}:`, error.message);
        results.push(`❌ ${columnName}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Find missing columns by comparing current vs expected schema
   */
  findMissingColumns(currentColumns, expectedSchema) {
    const missingColumns = [];
    
    for (const columnName of Object.keys(expectedSchema)) {
      if (!currentColumns.hasOwnProperty(columnName)) {
        missingColumns.push(columnName);
      }
    }

    return missingColumns;
  }

  /**
   * Main execution function
   */
  async fixSchema() {
    console.log('🔍 Analyzing current users table schema...\n');

    try {
      // Test database connection
      await this.sequelize.authenticate();
      console.log('✅ Database connection successful\n');

      // Get current schema
      const currentColumns = await this.getCurrentTableStructure();
      const expectedSchema = this.getExpectedSchema();

      console.log(`📊 Current table has ${Object.keys(currentColumns).length} columns`);
      console.log(`📊 Expected schema has ${Object.keys(expectedSchema).length} columns\n`);

      // Find missing columns
      const missingColumns = this.findMissingColumns(currentColumns, expectedSchema);

      if (missingColumns.length === 0) {
        console.log('✅ All expected columns are present in the users table');
        console.log('   The migration failure might be due to other issues.');
        return;
      }

      console.log(`❌ Found ${missingColumns.length} missing columns:`);
      missingColumns.forEach(col => console.log(`   - ${col}`));
      console.log();

      if (this.dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made\n');
      } else if (!this.force) {
        console.log('⚠️  Use --force flag to proceed with schema changes\n');
        return;
      }

      // Create ENUM types first
      console.log('🔧 Creating/verifying ENUM types...');
      const enumResults = await this.createEnumTypes();
      enumResults.forEach(result => console.log(`   ✅ ${result}`));
      console.log();

      // Add missing columns
      console.log('🔧 Adding missing columns...');
      const transaction = await this.sequelize.transaction();

      try {
        const addResults = await this.addMissingColumns(missingColumns);
        
        if (!this.dryRun) {
          await transaction.commit();
        }

        console.log('\n📊 Column Addition Results:');
        addResults.forEach(result => console.log(`   ${result}`));

        if (!this.dryRun) {
          console.log('\n✅ Schema fix completed successfully!');
          console.log('   You can now run migrations: node run-migrations.js');
        } else {
          console.log('\n✅ Dry run completed - no actual changes made');
          console.log('   Run with --force to apply changes');
        }

      } catch (error) {
        if (!this.dryRun) {
          await transaction.rollback();
        }
        throw error;
      }

    } catch (error) {
      console.error('❌ Schema fix failed:', error.message);
      
      if (process.env.NODE_ENV === 'development') {
        console.error('\n🔍 Stack trace:');
        console.error(error.stack);
      }
      
      process.exit(1);
    } finally {
      await this.sequelize.close();
    }
  }

  /**
   * Verify schema after fix
   */
  async verifySchema() {
    try {
      const currentColumns = await this.getCurrentTableStructure();
      const expectedSchema = this.getExpectedSchema();
      const missingColumns = this.findMissingColumns(currentColumns, expectedSchema);

      console.log('\n🔍 Post-fix verification:');
      if (missingColumns.length === 0) {
        console.log('✅ All expected columns are now present');
      } else {
        console.log(`❌ Still missing ${missingColumns.length} columns:`);
        missingColumns.forEach(col => console.log(`   - ${col}`));
      }
    } catch (error) {
      console.warn('⚠️  Could not verify schema:', error.message);
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    force: false
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Users Schema Fix Tool

Usage: node fix-users-schema.js [options]

Options:
  --dry-run       Show what would be changed without making changes
  --force         Actually execute the schema changes
  --help, -h      Show this help message

Examples:
  node fix-users-schema.js --dry-run     # Preview changes
  node fix-users-schema.js --force       # Apply changes
      `);
      process.exit(0);
    }
  }

  return options;
}

/**
 * Main execution
 */
async function main() {
  const options = parseArgs();
  const fixer = new UsersSchemaFixer(options);

  console.log('🔧 Users Table Schema Fix Tool');
  console.log('==============================\n');

  await fixer.fixSchema();
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  process.exit(1);
});

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { UsersSchemaFixer };