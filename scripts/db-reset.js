#!/usr/bin/env node
/**
 * Database Reset Script - Complete Reset with Backup
 * 
 * This script safely resets the database by:
 * - Creating a backup (if requested)
 * - Dropping all tables and data
 * - Running fresh installation
 * 
 * Usage: node scripts/db-reset.js [environment] [options]
 * Example: node scripts/db-reset.js development --backup --verbose
 */

const DatabaseInstaller = require('./DatabaseInstaller');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class DatabaseResetter extends DatabaseInstaller {
  constructor(options = {}) {
    super(options);
    this.backupPath = null;
  }

  /**
   * Create a backup before reset
   */
  async createBackup() {
    if (!this.options.backup) {
      this.logInfo('Backup skipped (--no-backup flag)');
      return null;
    }

    this.logStep('Creating database backup before reset');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.resolve(__dirname, '../backups');
    const backupFile = `backup_${this.config.database}_${timestamp}.sql`;
    this.backupPath = path.join(backupDir, backupFile);

    try {
      // Ensure backup directory exists
      await fs.mkdir(backupDir, { recursive: true });
      
      // Create backup using pg_dump
      const command = `PGPASSWORD=${this.config.password} pg_dump -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d ${this.config.database} -f "${this.backupPath}" --clean --if-exists`;
      
      const result = await this.executeCommand(command, 'Creating database backup');
      
      if (result.success) {
        const stats = await fs.stat(this.backupPath);
        this.logSuccess(`Backup created: ${this.backupPath} (${(stats.size / 1024).toFixed(2)} KB)`);
        return this.backupPath;
      } else {
        this.logWarning('Backup failed, but continuing with reset');
        return null;
      }
    } catch (error) {
      this.logError('Backup creation failed', error);
      this.logWarning('Continuing without backup...');
      return null;
    }
  }

  /**
   * Drop all tables in the correct order (respecting foreign keys)
   */
  async dropAllTables() {
    this.logStep('Dropping all database tables');
    
    if (!this.sequelize) {
      const { Sequelize } = require('sequelize');
      this.sequelize = new Sequelize(this.config);
    }

    try {
      // Get all table names
      const [tables] = await this.sequelize.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN ('SequelizeMeta', 'SequelizeData')
        ORDER BY tablename;
      `);

      if (tables.length === 0) {
        this.logInfo('No tables to drop');
        return true;
      }

      this.logInfo(`Found ${tables.length} tables to drop`);

      // Drop tables with CASCADE to handle foreign key constraints
      for (const table of tables) {
        try {
          await this.sequelize.query(`DROP TABLE IF EXISTS "${table.tablename}" CASCADE;`);
          this.logDebug(`Dropped table: ${table.tablename}`);
        } catch (error) {
          this.logWarning(`Failed to drop table ${table.tablename}: ${error.message}`);
        }
      }

      // Drop meta tables
      await this.sequelize.query('DROP TABLE IF EXISTS "SequelizeMeta" CASCADE;');
      await this.sequelize.query('DROP TABLE IF EXISTS "SequelizeData" CASCADE;');
      
      this.logSuccess('All tables dropped successfully');
      return true;
    } catch (error) {
      this.logError('Failed to drop tables', error);
      throw error;
    }
  }

  /**
   * Drop and recreate database (nuclear option)
   */
  async recreateDatabase() {
    this.logStep('Recreating database (nuclear reset)');
    
    try {
      // Close any existing connections
      if (this.sequelize) {
        await this.sequelize.close();
        this.sequelize = null;
      }

      // Drop database
      const dropCommand = `psql -h ${this.config.host} -p ${this.config.port} -U postgres -c "DROP DATABASE IF EXISTS \\"${this.config.database}\\";"`;
      await this.executeCommand(dropCommand, `Dropping database '${this.config.database}'`);

      // Recreate database
      await this.createDatabase();
      
      this.logSuccess('Database recreated successfully');
      return true;
    } catch (error) {
      this.logError('Failed to recreate database', error);
      throw error;
    }
  }

  /**
   * Clean reset (drop tables only)
   */
  async cleanReset() {
    this.logStep('Performing clean reset (tables only)');
    await this.dropAllTables();
    return true;
  }

  /**
   * Nuclear reset (drop and recreate database)
   */
  async nuclearReset() {
    this.logStep('Performing nuclear reset (entire database)');
    await this.recreateDatabase();
    await this.createDatabaseUser(); // Recreate user after database recreation
    return true;
  }

  /**
   * Main reset process
   */
  async reset() {
    try {
      this.logStep('Starting database reset');
      this.logInfo(`Environment: ${this.environment}`);
      this.logInfo(`Reset type: ${this.options.nuclear ? 'nuclear' : 'clean'}`);

      // Create backup if requested
      await this.createBackup();

      // Perform reset based on type
      if (this.options.nuclear) {
        await this.nuclearReset();
      } else {
        await this.cleanReset();
      }

      // Run fresh installation
      this.logStep('Running fresh installation after reset');
      await this.installExtensions();
      await this.runMigrations();
      await this.runSeeders();
      await this.validateInstallation();

      // Display summary
      this.displayResetSummary();
      
      return this.generateReport();

    } catch (error) {
      this.logError('Reset failed', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Display reset summary
   */
  displayResetSummary() {
    const report = this.generateReport();
    
    console.log(`\n${this.colors.green}${this.colors.bright}═══════════════════════════════════════════════════════════════════════════════════════${this.colors.reset}`);
    console.log(`${this.colors.green}${this.colors.bright}                               DATABASE RESET COMPLETE                                ${this.colors.reset}`);
    console.log(`${this.colors.green}${this.colors.bright}═══════════════════════════════════════════════════════════════════════════════════════${this.colors.reset}\n`);
    
    console.log(`${this.colors.cyan}Environment:${this.colors.reset} ${this.colors.bright}${this.environment}${this.colors.reset}`);
    console.log(`${this.colors.cyan}Reset Type:${this.colors.reset} ${this.colors.bright}${this.options.nuclear ? 'Nuclear' : 'Clean'}${this.colors.reset}`);
    console.log(`${this.colors.cyan}Duration:${this.colors.reset} ${this.colors.bright}${report.duration}${this.colors.reset}`);
    
    if (this.backupPath) {
      console.log(`${this.colors.cyan}Backup:${this.colors.reset} ${this.colors.bright}${this.backupPath}${this.colors.reset}`);
    }

    console.log(`\n${this.colors.green}Database has been reset and freshly installed! 🔄${this.colors.reset}\n`);
  }
}

async function resetDatabase() {
  const args = process.argv.slice(2);
  const environment = args.find(arg => !arg.startsWith('--')) || 'development';
  
  const options = {
    environment,
    verbose: args.includes('--verbose') || args.includes('-v'),
    skipConfirmation: args.includes('--yes') || args.includes('-y'),
    backup: !args.includes('--no-backup'),
    nuclear: args.includes('--nuclear'),
    dryRun: args.includes('--dry-run'),
  };

  console.log(`\n🔄 Resetting database for ${environment} environment...`);
  console.log(`Reset type: ${options.nuclear ? 'Nuclear (drop database)' : 'Clean (drop tables)'}`);
  console.log(`Backup: ${options.backup ? 'Yes' : 'No'}\n`);
  
  if (!options.skipConfirmation && !options.dryRun) {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      readline.question('⚠️  This will DESTROY all data in the database. Are you absolutely sure? (y/N): ', resolve);
    });
    
    readline.close();
    
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('Reset cancelled.');
      process.exit(0);
    }
  }

  try {
    const resetter = new DatabaseResetter(options);
    const report = await resetter.reset();
    
    if (options.verbose) {
      console.log('\n📊 Reset Report:', JSON.stringify(report, null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Reset failed: ${error.message}`);
    if (options.verbose) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  resetDatabase().catch(console.error);
}

module.exports = { DatabaseResetter, resetDatabase };