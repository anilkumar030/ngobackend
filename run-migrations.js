#!/usr/bin/env node

/**
 * Robust Migration Runner for Shivdhaam Backend
 * 
 * This script safely executes all database migrations with idempotent checks.
 * It ensures migrations are applied in the correct order and only when needed.
 * 
 * Features:
 * - Idempotent execution (safe to run multiple times)
 * - Proper error handling and rollback
 * - Clear logging and progress tracking
 * - Table and column existence checks
 * - Migration tracking to prevent re-execution
 * 
 * Usage: node run-migrations.js [--force] [--env=development]
 */

'use strict';

const fs = require('fs').promises;
const path = require('path');
const { Sequelize } = require('sequelize');

// Import database configuration
const dbConfig = require('./src/config/database');

class MigrationRunner {
  constructor(options = {}) {
    this.sequelize = dbConfig.sequelize;
    this.queryInterface = this.sequelize.getQueryInterface();
    this.force = options.force || false;
    this.environment = options.env || process.env.NODE_ENV || 'development';
    this.migrationsDir = path.join(__dirname, 'src', 'migrations');
    this.executedMigrations = new Set();
    
    // Migration tracking table name
    this.migrationTableName = 'SequelizeMeta';
    
    console.log(`🚀 Migration Runner initialized for ${this.environment} environment`);
  }

  /**
   * Initialize migration tracking table
   */
  async initializeMigrationTable() {
    try {
      const tableExists = await this.queryInterface.showAllTables()
        .then(tables => tables.includes(this.migrationTableName));

      if (!tableExists) {
        console.log('📝 Creating migration tracking table...');
        await this.queryInterface.createTable(this.migrationTableName, {
          name: {
            type: Sequelize.STRING,
            allowNull: false,
            primaryKey: true
          }
        });
        console.log('✅ Migration tracking table created successfully');
      }
    } catch (error) {
      console.error('❌ Error initializing migration table:', error.message);
      throw error;
    }
  }

  /**
   * Load already executed migrations from tracking table
   */
  async loadExecutedMigrations() {
    try {
      const results = await this.queryInterface.sequelize.query(
        `SELECT name FROM "${this.migrationTableName}" ORDER BY name`,
        { type: Sequelize.QueryTypes.SELECT }
      );
      
      this.executedMigrations = new Set(results.map(row => row.name));
      console.log(`📋 Found ${this.executedMigrations.size} previously executed migrations`);
    } catch (error) {
      console.warn('⚠️  Could not load executed migrations (table might not exist yet)');
      this.executedMigrations = new Set();
    }
  }

  /**
   * Mark migration as executed in tracking table
   */
  async markMigrationExecuted(migrationName) {
    try {
      await this.queryInterface.sequelize.query(
        `INSERT INTO "${this.migrationTableName}" (name) VALUES (:name)`,
        {
          replacements: { name: migrationName },
          type: Sequelize.QueryTypes.INSERT
        }
      );
    } catch (error) {
      console.warn(`⚠️  Could not mark migration ${migrationName} as executed:`, error.message);
    }
  }

  /**
   * Check if a table exists in the database
   */
  async tableExists(tableName) {
    try {
      const tables = await this.queryInterface.showAllTables();
      return tables.includes(tableName);
    } catch (error) {
      console.warn(`⚠️  Error checking if table ${tableName} exists:`, error.message);
      return false;
    }
  }

  /**
   * Check if a column exists in a table
   */
  async columnExists(tableName, columnName) {
    try {
      const tableExists = await this.tableExists(tableName);
      if (!tableExists) return false;

      const tableInfo = await this.queryInterface.describeTable(tableName);
      return tableInfo.hasOwnProperty(columnName);
    } catch (error) {
      console.warn(`⚠️  Error checking if column ${tableName}.${columnName} exists:`, error.message);
      return false;
    }
  }

  /**
   * Check if an index exists in a table
   */
  async indexExists(tableName, indexName) {
    try {
      const indexes = await this.queryInterface.showIndex(tableName);
      return indexes.some(index => index.name === indexName);
    } catch (error) {
      console.warn(`⚠️  Error checking if index ${indexName} exists:`, error.message);
      return false;
    }
  }

  /**
   * Enhanced QueryInterface with existence checks
   */
  createSafeQueryInterface() {
    const safeQI = Object.create(this.queryInterface);
    
    // Safe createTable - skip if table exists
    safeQI.createTable = async (tableName, attributes, options = {}) => {
      const exists = await this.tableExists(tableName);
      if (exists && !this.force) {
        console.log(`  ⏭️  Table '${tableName}' already exists, skipping...`);
        return;
      }
      
      if (exists && this.force) {
        console.log(`  🔄 Table '${tableName}' exists but force=true, recreating...`);
        await this.queryInterface.dropTable(tableName);
      }
      
      console.log(`  ➕ Creating table '${tableName}'...`);
      return await this.queryInterface.createTable(tableName, attributes, options);
    };

    // Safe addColumn - skip if column exists
    safeQI.addColumn = async (tableName, columnName, attributes) => {
      const exists = await this.columnExists(tableName, columnName);
      if (exists && !this.force) {
        console.log(`  ⏭️  Column '${tableName}.${columnName}' already exists, skipping...`);
        return;
      }
      
      if (exists && this.force) {
        console.log(`  🔄 Column '${tableName}.${columnName}' exists but force=true, recreating...`);
        await this.queryInterface.removeColumn(tableName, columnName);
      }
      
      console.log(`  ➕ Adding column '${tableName}.${columnName}'...`);
      return await this.queryInterface.addColumn(tableName, columnName, attributes);
    };

    // Safe addIndex - skip if index exists or if columns don't exist
    safeQI.addIndex = async (tableName, attributes, options = {}) => {
      const indexName = options.name || `${tableName}_${Array.isArray(attributes) ? attributes.join('_') : attributes}_idx`;
      const exists = await this.indexExists(tableName, indexName);
      
      if (exists && !this.force) {
        console.log(`  ⏭️  Index '${indexName}' already exists, skipping...`);
        return;
      }
      
      // Check if all columns exist before creating index
      const columnsToCheck = Array.isArray(attributes) ? attributes : [attributes];
      const missingColumns = [];
      
      for (const column of columnsToCheck) {
        const columnExists = await this.columnExists(tableName, column);
        if (!columnExists) {
          missingColumns.push(column);
        }
      }
      
      if (missingColumns.length > 0) {
        console.log(`  ⚠️  Cannot create index '${indexName}': missing columns [${missingColumns.join(', ')}]`);
        console.log(`      Skipping index creation - fix schema first`);
        return;
      }
      
      if (exists && this.force) {
        console.log(`  🔄 Index '${indexName}' exists but force=true, recreating...`);
        try {
          await this.queryInterface.removeIndex(tableName, indexName);
        } catch (error) {
          console.warn(`    ⚠️  Could not remove existing index: ${error.message}`);
        }
      }
      
      console.log(`  📊 Creating index '${indexName}' on [${columnsToCheck.join(', ')}]...`);
      return await this.queryInterface.addIndex(tableName, attributes, options);
    };

    return safeQI;
  }

  /**
   * Get list of migration files sorted by name
   */
  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsDir);
      const migrationFiles = files
        .filter(file => file.endsWith('.js'))
        .sort(); // Sort by filename to ensure correct order

      console.log(`📁 Found ${migrationFiles.length} migration files`);
      return migrationFiles;
    } catch (error) {
      console.error('❌ Error reading migrations directory:', error.message);
      throw error;
    }
  }

  /**
   * Execute a single migration file
   */
  async executeMigration(filename) {
    const migrationPath = path.join(this.migrationsDir, filename);
    const migrationName = path.basename(filename, '.js');

    try {
      // Skip if already executed (unless force mode)
      if (this.executedMigrations.has(migrationName) && !this.force) {
        console.log(`⏭️  Migration '${migrationName}' already executed, skipping...`);
        return { success: true, skipped: true };
      }

      console.log(`🔄 Executing migration: ${migrationName}`);

      // Load migration module
      delete require.cache[require.resolve(migrationPath)];
      const migration = require(migrationPath);

      if (!migration.up || typeof migration.up !== 'function') {
        throw new Error(`Migration ${migrationName} must export an 'up' function`);
      }

      // Create transaction for migration
      const transaction = await this.sequelize.transaction();
      
      try {
        // Create safe QueryInterface with existence checks
        const safeQueryInterface = this.createSafeQueryInterface();
        
        // Execute migration with safe QueryInterface
        await migration.up(safeQueryInterface, Sequelize);
        
        // Mark as executed
        await this.markMigrationExecuted(migrationName);
        
        // Commit transaction
        await transaction.commit();
        
        console.log(`✅ Migration '${migrationName}' completed successfully`);
        return { success: true, skipped: false };

      } catch (migrationError) {
        // Rollback transaction on error
        await transaction.rollback();
        throw migrationError;
      }

    } catch (error) {
      console.error(`❌ Migration '${migrationName}' failed:`, error.message);
      
      // For debugging, show stack trace in development
      if (this.environment === 'development') {
        console.error(error.stack);
      }
      
      return { success: false, error: error.message, skipped: false };
    }
  }

  /**
   * Execute all migrations
   */
  async runMigrations() {
    console.log('🎯 Starting migration execution...\n');

    try {
      // Initialize migration tracking
      await this.initializeMigrationTable();
      await this.loadExecutedMigrations();

      // Get migration files
      const migrationFiles = await this.getMigrationFiles();
      
      if (migrationFiles.length === 0) {
        console.log('📭 No migration files found');
        return;
      }

      // Execute migrations in order
      let successCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const filename of migrationFiles) {
        const result = await this.executeMigration(filename);
        
        if (result.success) {
          if (result.skipped) {
            skippedCount++;
          } else {
            successCount++;
          }
        } else {
          errorCount++;
          
          // Stop on first error (unless force mode)
          if (!this.force) {
            console.error('\n❌ Migration execution stopped due to error');
            break;
          }
        }
      }

      // Summary
      console.log('\n📊 Migration Summary:');
      console.log(`  ✅ Successfully executed: ${successCount}`);
      console.log(`  ⏭️  Skipped (already done): ${skippedCount}`);
      console.log(`  ❌ Failed: ${errorCount}`);
      
      if (errorCount === 0) {
        console.log('\n🎉 All migrations completed successfully!');
      } else {
        console.log('\n⚠️  Some migrations failed. Check logs above for details.');
        process.exit(1);
      }

    } catch (error) {
      console.error('\n💥 Critical error during migration execution:', error.message);
      process.exit(1);
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      console.log('🔗 Testing database connection...');
      await this.sequelize.authenticate();
      console.log('✅ Database connection established successfully');
      return true;
    } catch (error) {
      console.error('❌ Unable to connect to database:', error.message);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      await this.sequelize.close();
      console.log('🔒 Database connection closed');
    } catch (error) {
      console.warn('⚠️  Error closing database connection:', error.message);
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    force: false,
    env: process.env.NODE_ENV || 'development'
  };

  for (const arg of args) {
    if (arg === '--force') {
      options.force = true;
    } else if (arg.startsWith('--env=')) {
      options.env = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Migration Runner for Shivdhaam Backend

Usage: node run-migrations.js [options]

Options:
  --force         Force re-execution of all migrations (destructive)
  --env=ENV       Set environment (development, test, staging, production)
  --help, -h      Show this help message

Examples:
  node run-migrations.js                    # Run pending migrations
  node run-migrations.js --env=production   # Run in production mode
  node run-migrations.js --force            # Force re-run all migrations
      `);
      process.exit(0);
    }
  }

  return options;
}

/**
 * Main execution function
 */
async function main() {
  const options = parseArgs();
  const runner = new MigrationRunner(options);

  console.log('🏗️  Shivdhaam Backend Migration Runner');
  console.log('=====================================\n');

  try {
    // Test database connection
    const connected = await runner.testConnection();
    if (!connected) {
      console.error('❌ Cannot proceed without database connection');
      process.exit(1);
    }

    // Run migrations
    await runner.runMigrations();

  } catch (error) {
    console.error('\n💥 Unexpected error:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    await runner.cleanup();
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  process.exit(1);
});

// Run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = { MigrationRunner };