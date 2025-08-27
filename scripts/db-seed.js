#!/usr/bin/env node
/**
 * Database Seeder Script - Seed-Only Operations
 * 
 * This script provides flexible seeding operations:
 * - Run all seeders
 * - Run specific seeders
 * - Reset and re-run seeders
 * - Fresh seeding (clear data first)
 * 
 * Usage: node scripts/db-seed.js [environment] [options]
 * Examples:
 *   node scripts/db-seed.js development --all
 *   node scripts/db-seed.js development --specific 001_create_admin_user.js
 *   node scripts/db-seed.js development --fresh
 */

const DatabaseInstaller = require('./DatabaseInstaller');
const { Sequelize } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');

class DatabaseSeeder extends DatabaseInstaller {
  constructor(options = {}) {
    super(options);
    this.seedingReport = {
      attempted: [],
      successful: [],
      failed: [],
      skipped: []
    };
  }

  /**
   * Get specific seeder files or all seeder files
   */
  async getTargetSeeders() {
    const seedersDir = path.resolve(__dirname, '../src/seeders');
    const allSeeders = (await fs.readdir(seedersDir))
      .filter(file => file.endsWith('.js'))
      .sort();

    if (this.options.specific) {
      // Handle specific seeder(s)
      const specificSeeders = Array.isArray(this.options.specific) 
        ? this.options.specific 
        : [this.options.specific];
      
      const validSeeders = specificSeeders.filter(seeder => 
        allSeeders.includes(seeder)
      );
      
      if (validSeeders.length !== specificSeeders.length) {
        const invalid = specificSeeders.filter(seeder => !allSeeders.includes(seeder));
        throw new Error(`Invalid seeder files: ${invalid.join(', ')}`);
      }
      
      return validSeeders;
    }

    return allSeeders;
  }

  /**
   * Clear existing seed data (for fresh seeding)
   */
  async clearSeedData() {
    this.logStep('Clearing existing seed data');
    
    if (!this.sequelize) {
      this.sequelize = new Sequelize(this.config);
    }

    // Tables to clear in reverse dependency order
    const tablesToClear = [
      'donations',
      'order_items', 
      'orders',
      'event_registrations',
      'project_updates',
      'saved_campaigns',
      'certificates',
      'testimonials',
      'statistics',
      'events',
      'projects',
      'content_sections',
      'gallery',
      'blog_posts',
      'products',
      'campaigns',
      'user_addresses',
      'users'
    ];

    let clearedTables = 0;
    for (const table of tablesToClear) {
      try {
        const [result] = await this.sequelize.query(`DELETE FROM ${table}`);
        this.logDebug(`Cleared table: ${table}`);
        clearedTables++;
      } catch (error) {
        this.logDebug(`Failed to clear table ${table}: ${error.message}`);
      }
    }

    // Clear seeder tracking
    try {
      await this.sequelize.query('DELETE FROM "SequelizeData"');
      this.logDebug('Cleared seeder tracking');
    } catch (error) {
      this.logDebug('Seeder tracking table does not exist or failed to clear');
    }

    this.logSuccess(`Cleared ${clearedTables} tables for fresh seeding`);
  }

  /**
   * Run specific seeders with enhanced tracking
   */
  async runSpecificSeeders(seederFiles) {
    this.logStep(`Running ${seederFiles.length} seeder(s)`);
    
    if (!this.sequelize) {
      this.sequelize = new Sequelize(this.config);
    }

    // Create SequelizeData table if it doesn't exist
    await this.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "SequelizeData" (
        name VARCHAR(255) NOT NULL PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get already executed seeders (unless forcing)
    let executedSeeders = [];
    if (!this.options.force && !this.options.fresh) {
      try {
        const [seeders] = await this.sequelize.query(
          'SELECT name FROM "SequelizeData" ORDER BY name'
        );
        executedSeeders = seeders.map(s => s.name);
      } catch (error) {
        this.logDebug('Could not fetch executed seeders, assuming none executed');
      }
    }

    for (const [index, seederFile] of seederFiles.entries()) {
      this.showProgress(index + 1, seederFiles.length, `Seeder: ${seederFile}`);
      this.seedingReport.attempted.push(seederFile);

      // Skip if already executed and not forcing
      if (executedSeeders.includes(seederFile) && !this.options.force) {
        this.logInfo(`Skipping already executed seeder: ${seederFile}`);
        this.seedingReport.skipped.push(seederFile);
        continue;
      }

      try {
        const seederPath = path.resolve(__dirname, '../src/seeders', seederFile);
        
        // Check if seeder file exists
        try {
          await fs.access(seederPath);
        } catch (error) {
          throw new Error(`Seeder file not found: ${seederPath}`);
        }

        // Load and execute seeder
        const seeder = require(seederPath);
        
        if (typeof seeder.up !== 'function') {
          throw new Error(`Seeder ${seederFile} does not export an 'up' function`);
        }

        this.logDebug(`Executing seeder: ${seederFile}`);
        await seeder.up(this.sequelize.getQueryInterface(), this.sequelize.Sequelize);
        
        // Record seeder as executed
        await this.sequelize.query(
          'INSERT INTO "SequelizeData" (name) VALUES (?) ON CONFLICT (name) DO UPDATE SET executed_at = CURRENT_TIMESTAMP',
          { replacements: [seederFile] }
        );
        
        this.seedingReport.successful.push(seederFile);
        this.logSuccess(`Seeder ${seederFile} completed successfully`);
        
      } catch (error) {
        this.seedingReport.failed.push({ file: seederFile, error: error.message });
        
        if (this.options.stopOnError) {
          this.logError(`Seeder ${seederFile} failed - stopping due to --stop-on-error flag`, error);
          throw error;
        } else {
          this.logWarning(`Seeder ${seederFile} failed: ${error.message} - continuing...`);
        }
      }
    }

    return this.seedingReport;
  }

  /**
   * Undo seeders (if they support it)
   */
  async undoSeeders(seederFiles) {
    this.logStep(`Undoing ${seederFiles.length} seeder(s)`);
    
    if (!this.sequelize) {
      this.sequelize = new Sequelize(this.config);
    }

    // Reverse order for undoing
    const reversedSeeders = [...seederFiles].reverse();

    for (const [index, seederFile] of reversedSeeders.entries()) {
      this.showProgress(index + 1, reversedSeeders.length, `Undoing: ${seederFile}`);
      
      try {
        const seederPath = path.resolve(__dirname, '../src/seeders', seederFile);
        const seeder = require(seederPath);
        
        if (typeof seeder.down === 'function') {
          await seeder.down(this.sequelize.getQueryInterface(), this.sequelize.Sequelize);
          
          // Remove from tracking
          await this.sequelize.query(
            'DELETE FROM "SequelizeData" WHERE name = ?',
            { replacements: [seederFile] }
          );
          
          this.logSuccess(`Seeder ${seederFile} undone successfully`);
        } else {
          this.logWarning(`Seeder ${seederFile} does not support undo operation`);
        }
        
      } catch (error) {
        this.logError(`Failed to undo seeder ${seederFile}`, error);
        if (this.options.stopOnError) {
          throw error;
        }
      }
    }
  }

  /**
   * Display seeding summary
   */
  displaySeedingSummary() {
    const report = this.seedingReport;
    const duration = (Date.now() - this.startTime) / 1000;
    
    console.log(`\n${this.colors.green}${this.colors.bright}═══════════════════════════════════════════════════════════════════════════════════════${this.colors.reset}`);
    console.log(`${this.colors.green}${this.colors.bright}                                 SEEDING COMPLETE                                   ${this.colors.reset}`);
    console.log(`${this.colors.green}${this.colors.bright}═══════════════════════════════════════════════════════════════════════════════════════${this.colors.reset}\n`);
    
    console.log(`${this.colors.cyan}Environment:${this.colors.reset} ${this.colors.bright}${this.environment}${this.colors.reset}`);
    console.log(`${this.colors.cyan}Duration:${this.colors.reset} ${this.colors.bright}${duration.toFixed(2)}s${this.colors.reset}`);
    console.log(`${this.colors.cyan}Operation:${this.colors.reset} ${this.colors.bright}${this.options.undo ? 'Undo' : 'Seed'}${this.colors.reset}\n`);

    // Summary statistics
    console.log(`${this.colors.blue}${this.colors.bright}Summary:${this.colors.reset}`);
    console.log(`  ${this.colors.green}✓ Successful:${this.colors.reset} ${report.successful.length}`);
    console.log(`  ${this.colors.yellow}⚠ Skipped:${this.colors.reset} ${report.skipped.length}`);
    console.log(`  ${this.colors.red}✗ Failed:${this.colors.reset} ${report.failed.length}`);
    console.log(`  ${this.colors.cyan}Total Attempted:${this.colors.reset} ${report.attempted.length}\n`);

    // Successful seeders
    if (report.successful.length > 0) {
      console.log(`${this.colors.green}${this.colors.bright}Successful Seeders:${this.colors.reset}`);
      report.successful.forEach(seeder => {
        console.log(`  ✓ ${seeder}`);
      });
      console.log();
    }

    // Skipped seeders
    if (report.skipped.length > 0) {
      console.log(`${this.colors.yellow}${this.colors.bright}Skipped Seeders:${this.colors.reset}`);
      report.skipped.forEach(seeder => {
        console.log(`  ⚠ ${seeder} (already executed)`);
      });
      console.log();
    }

    // Failed seeders
    if (report.failed.length > 0) {
      console.log(`${this.colors.red}${this.colors.bright}Failed Seeders:${this.colors.reset}`);
      report.failed.forEach(failure => {
        console.log(`  ✗ ${failure.file}: ${failure.error}`);
      });
      console.log();
    }

    if (report.failed.length === 0) {
      console.log(`${this.colors.green}All seeders completed successfully! 🌱${this.colors.reset}\n`);
    } else {
      console.log(`${this.colors.yellow}Seeding completed with ${report.failed.length} failures. Check logs above. ⚠️${this.colors.reset}\n`);
    }
  }

  /**
   * Main seeding process
   */
  async seed() {
    try {
      this.logStep('Starting database seeding operation');
      this.logInfo(`Environment: ${this.environment}`);
      this.logInfo(`Operation: ${this.options.undo ? 'Undo seeders' : 'Run seeders'}`);

      // Get target seeders
      const targetSeeders = await this.getTargetSeeders();
      this.logInfo(`Target seeders: ${targetSeeders.length}`);

      if (targetSeeders.length === 0) {
        this.logWarning('No seeders to process');
        return;
      }

      // Fresh seeding - clear data first
      if (this.options.fresh && !this.options.undo) {
        await this.clearSeedData();
      }

      // Run or undo seeders
      if (this.options.undo) {
        await this.undoSeeders(targetSeeders);
      } else {
        await this.runSpecificSeeders(targetSeeders);
      }

      // Display summary
      this.displaySeedingSummary();
      
      return this.seedingReport;

    } catch (error) {
      this.logError('Seeding operation failed', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

async function seedDatabase() {
  const args = process.argv.slice(2);
  const environment = args.find(arg => !arg.startsWith('--')) || 'development';
  
  // Parse options
  const options = {
    environment,
    verbose: args.includes('--verbose') || args.includes('-v'),
    force: args.includes('--force'),
    fresh: args.includes('--fresh'),
    undo: args.includes('--undo'),
    stopOnError: args.includes('--stop-on-error'),
    specific: args.find(arg => arg.startsWith('--specific='))?.split('=')[1],
    all: args.includes('--all')
  };

  // Validation
  if (!options.all && !options.specific) {
    console.log('\n❌ Please specify either --all to run all seeders or --specific=filename.js for specific seeders');
    console.log('\nUsage examples:');
    console.log('  node scripts/db-seed.js development --all');
    console.log('  node scripts/db-seed.js development --specific=001_create_admin_user.js');
    console.log('  node scripts/db-seed.js development --all --fresh');
    console.log('  node scripts/db-seed.js development --all --undo');
    process.exit(1);
  }

  const operation = options.undo ? 'Undoing' : 'Running';
  const target = options.specific ? `specific seeders (${options.specific})` : 'all seeders';
  
  console.log(`\n🌱 ${operation} ${target} for ${environment} environment...`);
  
  if (options.fresh) {
    console.log('🧹 Fresh seeding - will clear existing data first');
  }
  
  if (options.force) {
    console.log('💪 Force mode - will re-run already executed seeders');
  }
  
  console.log();

  try {
    const seeder = new DatabaseSeeder(options);
    const report = await seeder.seed();
    
    // Exit with appropriate code
    const exitCode = report.failed.length === 0 ? 0 : 1;
    process.exit(exitCode);
    
  } catch (error) {
    console.error(`\n❌ Seeding failed: ${error.message}`);
    if (options.verbose) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase().catch(console.error);
}

module.exports = { DatabaseSeeder, seedDatabase };