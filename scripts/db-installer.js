#!/usr/bin/env node
/**
 * Interactive Database Installer CLI
 * 
 * This script provides an interactive command-line interface for all database operations:
 * - Guided setup for new installations
 * - Environment selection and validation
 * - Operation selection with explanations
 * - Safety confirmations for destructive operations
 * - Real-time progress indicators
 * 
 * Usage: node scripts/db-installer.js
 * Or: npm run db:install
 */

const readline = require('readline');
const DatabaseInstaller = require('./DatabaseInstaller');
const { DatabaseResetter } = require('./db-reset');
const { DatabaseSeeder } = require('./db-seed');
const { DatabaseStatusChecker } = require('./db-status');

class InteractiveDatabaseInstaller {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m'
    };

    this.selectedEnvironment = 'development';
    this.selectedOperation = null;
    this.operationOptions = {};
  }

  /**
   * Utility to ask questions with readline
   */
  async question(prompt) {
    return new Promise(resolve => {
      this.rl.question(prompt, resolve);
    });
  }

  /**
   * Display welcome screen
   */
  displayWelcome() {
    console.clear();
    console.log(`${this.colors.cyan}${this.colors.bright}╔══════════════════════════════════════════════════════════════════════════════════════╗${this.colors.reset}`);
    console.log(`${this.colors.cyan}${this.colors.bright}║                            SHIV DHAAM DATABASE INSTALLER                            ║${this.colors.reset}`);
    console.log(`${this.colors.cyan}${this.colors.bright}║                         Interactive Setup & Management Tool                         ║${this.colors.reset}`);
    console.log(`${this.colors.cyan}${this.colors.bright}╚══════════════════════════════════════════════════════════════════════════════════════╝${this.colors.reset}\n`);
    
    console.log(`${this.colors.green}Welcome to the Shiv Dhaam Database Installer!${this.colors.reset}`);
    console.log(`${this.colors.dim}This tool will help you set up, manage, and maintain your database.${this.colors.reset}\n`);
  }

  /**
   * Environment selection
   */
  async selectEnvironment() {
    console.log(`${this.colors.blue}${this.colors.bright}Step 1: Environment Selection${this.colors.reset}\n`);
    
    const environments = [
      { key: '1', value: 'development', desc: 'Development environment (local database)' },
      { key: '2', value: 'test', desc: 'Test environment (isolated test database)' },
      { key: '3', value: 'staging', desc: 'Staging environment (pre-production)' },
      { key: '4', value: 'production', desc: 'Production environment (live database)' }
    ];

    environments.forEach(env => {
      const selected = env.value === this.selectedEnvironment ? `${this.colors.green}✓${this.colors.reset}` : ' ';
      console.log(`  ${selected} ${env.key}. ${env.desc}`);
    });

    console.log(`\n${this.colors.yellow}Current selection: ${this.selectedEnvironment}${this.colors.reset}`);
    const answer = await this.question(`\nSelect environment (1-4, or Enter to keep current): `);
    
    if (answer.trim()) {
      const selected = environments.find(env => env.key === answer.trim());
      if (selected) {
        this.selectedEnvironment = selected.value;
        console.log(`${this.colors.green}✓ Environment set to: ${this.selectedEnvironment}${this.colors.reset}\n`);
      } else {
        console.log(`${this.colors.red}Invalid selection. Keeping: ${this.selectedEnvironment}${this.colors.reset}\n`);
      }
    }
  }

  /**
   * Operation selection
   */
  async selectOperation() {
    console.log(`${this.colors.blue}${this.colors.bright}Step 2: Operation Selection${this.colors.reset}\n`);
    
    const operations = [
      {
        key: '1',
        name: 'setup',
        title: 'Fresh Database Setup',
        desc: 'Complete new installation (database, tables, seed data)',
        destructive: false,
        icon: '🚀'
      },
      {
        key: '2',
        name: 'status',
        title: 'Database Status Check',
        desc: 'Check current database health and status',
        destructive: false,
        icon: '📊'
      },
      {
        key: '3',
        name: 'seed',
        title: 'Seed Database',
        desc: 'Add/refresh sample data without affecting structure',
        destructive: false,
        icon: '🌱'
      },
      {
        key: '4',
        name: 'reset',
        title: 'Reset Database',
        desc: 'Clear all data and reinstall (DESTRUCTIVE)',
        destructive: true,
        icon: '🔄'
      },
      {
        key: '5',
        name: 'migrate',
        title: 'Run Migrations Only',
        desc: 'Update database structure without seeding',
        destructive: false,
        icon: '⚡'
      }
    ];

    operations.forEach(op => {
      const warning = op.destructive ? `${this.colors.red}⚠️  DESTRUCTIVE${this.colors.reset}` : '';
      console.log(`  ${op.key}. ${op.icon} ${this.colors.bright}${op.title}${this.colors.reset}`);
      console.log(`     ${this.colors.dim}${op.desc}${this.colors.reset} ${warning}`);
      console.log();
    });

    const answer = await this.question('Select operation (1-5): ');
    const selected = operations.find(op => op.key === answer.trim());
    
    if (!selected) {
      console.log(`${this.colors.red}Invalid selection. Please try again.${this.colors.reset}\n`);
      return await this.selectOperation();
    }

    this.selectedOperation = selected;
    console.log(`${this.colors.green}✓ Selected: ${selected.title}${this.colors.reset}\n`);

    // Get operation-specific options
    await this.getOperationOptions();
  }

  /**
   * Get options for specific operations
   */
  async getOperationOptions() {
    switch (this.selectedOperation.name) {
      case 'setup':
        await this.getSetupOptions();
        break;
      case 'reset':
        await this.getResetOptions();
        break;
      case 'seed':
        await this.getSeedOptions();
        break;
      case 'status':
        await this.getStatusOptions();
        break;
      default:
        break;
    }
  }

  /**
   * Setup operation options
   */
  async getSetupOptions() {
    console.log(`${this.colors.blue}Setup Options:${this.colors.reset}\n`);
    
    const verbose = await this.question('Enable verbose logging? (y/N): ');
    this.operationOptions.verbose = verbose.toLowerCase().startsWith('y');
    
    if (this.selectedEnvironment === 'development') {
      const skipConfirm = await this.question('Skip safety confirmations? (y/N): ');
      this.operationOptions.skipConfirmation = skipConfirm.toLowerCase().startsWith('y');
    }
  }

  /**
   * Reset operation options
   */
  async getResetOptions() {
    console.log(`${this.colors.red}${this.colors.bright}⚠️  DESTRUCTIVE OPERATION WARNING ⚠️${this.colors.reset}`);
    console.log(`${this.colors.red}This will DELETE ALL DATA in your database!${this.colors.reset}\n`);
    
    const backup = await this.question('Create backup before reset? (Y/n): ');
    this.operationOptions.backup = !backup.toLowerCase().startsWith('n');
    
    const nuclear = await this.question('Use nuclear reset (drop entire database)? (y/N): ');
    this.operationOptions.nuclear = nuclear.toLowerCase().startsWith('y');
    
    const verbose = await this.question('Enable verbose logging? (y/N): ');
    this.operationOptions.verbose = verbose.toLowerCase().startsWith('y');
  }

  /**
   * Seed operation options
   */
  async getSeedOptions() {
    console.log(`${this.colors.blue}Seed Options:${this.colors.reset}\n`);
    
    const fresh = await this.question('Fresh seeding (clear existing data first)? (y/N): ');
    this.operationOptions.fresh = fresh.toLowerCase().startsWith('y');
    
    const force = await this.question('Force re-run already executed seeders? (y/N): ');
    this.operationOptions.force = force.toLowerCase().startsWith('y');
    
    const specific = await this.question('Run specific seeder (leave empty for all): ');
    if (specific.trim()) {
      this.operationOptions.specific = specific.trim();
    }
  }

  /**
   * Status operation options
   */
  async getStatusOptions() {
    console.log(`${this.colors.blue}Status Check Options:${this.colors.reset}\n`);
    
    const detailed = await this.question('Show detailed information? (Y/n): ');
    this.operationOptions.detailed = !detailed.toLowerCase().startsWith('n');
    
    const verbose = await this.question('Enable verbose logging? (y/N): ');
    this.operationOptions.verbose = verbose.toLowerCase().startsWith('y');
  }

  /**
   * Final confirmation
   */
  async confirmOperation() {
    console.log(`${this.colors.blue}${this.colors.bright}Step 3: Confirmation${this.colors.reset}\n`);
    
    console.log(`${this.colors.cyan}Environment:${this.colors.reset} ${this.colors.bright}${this.selectedEnvironment}${this.colors.reset}`);
    console.log(`${this.colors.cyan}Operation:${this.colors.reset} ${this.colors.bright}${this.selectedOperation.title}${this.colors.reset}`);
    console.log(`${this.colors.cyan}Description:${this.colors.reset} ${this.selectedOperation.desc}`);
    
    if (Object.keys(this.operationOptions).length > 0) {
      console.log(`${this.colors.cyan}Options:${this.colors.reset}`);
      Object.entries(this.operationOptions).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    
    if (this.selectedOperation.destructive) {
      console.log(`\n${this.colors.red}${this.colors.bright}⚠️  THIS IS A DESTRUCTIVE OPERATION ⚠️${this.colors.reset}`);
      console.log(`${this.colors.red}It will permanently delete data from your database.${this.colors.reset}`);
    }
    
    const confirm = await this.question(`\n${this.colors.yellow}Are you sure you want to proceed? (y/N): ${this.colors.reset}`);
    
    if (!confirm.toLowerCase().startsWith('y')) {
      console.log(`${this.colors.yellow}Operation cancelled.${this.colors.reset}`);
      return false;
    }
    
    return true;
  }

  /**
   * Execute the selected operation
   */
  async executeOperation() {
    console.log(`\n${this.colors.green}${this.colors.bright}Executing: ${this.selectedOperation.title}${this.colors.reset}\n`);
    
    const options = {
      environment: this.selectedEnvironment,
      ...this.operationOptions
    };

    try {
      switch (this.selectedOperation.name) {
        case 'setup':
          const installer = new DatabaseInstaller(options);
          await installer.install();
          break;
          
        case 'reset':
          const resetter = new DatabaseResetter(options);
          await resetter.reset();
          break;
          
        case 'seed':
          const seeder = new DatabaseSeeder({ ...options, all: !options.specific });
          await seeder.seed();
          break;
          
        case 'status':
          const checker = new DatabaseStatusChecker(options);
          await checker.checkStatus();
          break;
          
        case 'migrate':
          const migrator = new DatabaseInstaller(options);
          if (!migrator.sequelize) {
            const { Sequelize } = require('sequelize');
            migrator.sequelize = new Sequelize(migrator.config);
          }
          await migrator.runMigrations();
          await migrator.cleanup();
          break;
          
        default:
          throw new Error(`Unknown operation: ${this.selectedOperation.name}`);
      }
      
      console.log(`\n${this.colors.green}${this.colors.bright}✅ Operation completed successfully!${this.colors.reset}`);
      
    } catch (error) {
      console.log(`\n${this.colors.red}${this.colors.bright}❌ Operation failed:${this.colors.reset} ${error.message}`);
      
      if (options.verbose) {
        console.log(`\n${this.colors.dim}Stack trace:${this.colors.reset}`);
        console.log(error.stack);
      }
      
      throw error;
    }
  }

  /**
   * Ask if user wants to perform another operation
   */
  async askForAnotherOperation() {
    const answer = await this.question(`\n${this.colors.cyan}Would you like to perform another operation? (y/N): ${this.colors.reset}`);
    return answer.toLowerCase().startsWith('y');
  }

  /**
   * Display help information
   */
  displayHelp() {
    console.log(`\n${this.colors.blue}${this.colors.bright}Quick Commands (alternative to interactive mode):${this.colors.reset}\n`);
    console.log(`${this.colors.cyan}Fresh Setup:${this.colors.reset}     npm run db:setup:dev`);
    console.log(`${this.colors.cyan}Check Status:${this.colors.reset}    npm run db:status:dev`);
    console.log(`${this.colors.cyan}Reset Database:${this.colors.reset}  npm run db:reset:dev`);
    console.log(`${this.colors.cyan}Seed Data:${this.colors.reset}       npm run db:seed`);
    console.log(`${this.colors.cyan}Fresh Seeding:${this.colors.reset}   npm run db:seed:fresh`);
    console.log(`\n${this.colors.dim}For more options, see package.json scripts section.${this.colors.reset}`);
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.rl.close();
  }

  /**
   * Main interactive process
   */
  async run() {
    try {
      this.displayWelcome();
      
      do {
        await this.selectEnvironment();
        await this.selectOperation();
        
        const confirmed = await this.confirmOperation();
        if (!confirmed) {
          continue;
        }
        
        await this.executeOperation();
        
        if (!(await this.askForAnotherOperation())) {
          break;
        }
        
        console.clear();
        this.displayWelcome();
        
      } while (true);
      
      this.displayHelp();
      console.log(`\n${this.colors.green}Thank you for using Shiv Dhaam Database Installer! 🙏${this.colors.reset}\n`);
      
    } catch (error) {
      console.log(`\n${this.colors.red}${this.colors.bright}Fatal error:${this.colors.reset} ${error.message}`);
      process.exit(1);
    } finally {
      this.cleanup();
    }
  }
}

// Handle command line arguments
async function main() {
  const args = process.argv.slice(2);
  
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${colors.cyan}${colors.bright}Shiv Dhaam Database Installer${colors.reset}

${colors.blue}Interactive Mode:${colors.reset}
  node scripts/db-installer.js

${colors.blue}Quick Commands:${colors.reset}
  npm run db:setup:dev      - Fresh development setup
  npm run db:status:dev     - Check database status
  npm run db:reset:dev      - Reset with backup
  npm run db:seed:fresh     - Fresh seed data
  
${colors.blue}Options:${colors.reset}
  --help, -h               Show this help
  --version, -v            Show version information
    `);
    process.exit(0);
  }
  
  // Check for version flag
  if (args.includes('--version') || args.includes('-v')) {
    const pkg = require('../package.json');
    console.log(`Shiv Dhaam Database Installer v${pkg.version}`);
    process.exit(0);
  }
  
  // Run interactive installer
  const installer = new InteractiveDatabaseInstaller();
  await installer.run();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = InteractiveDatabaseInstaller;