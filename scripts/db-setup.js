#!/usr/bin/env node
/**
 * Database Setup Script - Fresh Installation
 * 
 * This script performs a complete database setup including:
 * - Database and user creation
 * - Running all migrations
 * - Running all seeders
 * - Creating test accounts
 * 
 * Usage: node scripts/db-setup.js [environment] [options]
 * Example: node scripts/db-setup.js development --verbose
 */

const DatabaseInstaller = require('./DatabaseInstaller');

async function setupDatabase() {
  const args = process.argv.slice(2);
  const environment = args.find(arg => !arg.startsWith('--')) || 'development';
  
  const options = {
    environment,
    verbose: args.includes('--verbose') || args.includes('-v'),
    skipConfirmation: args.includes('--yes') || args.includes('-y'),
    dryRun: args.includes('--dry-run'),
  };

  console.log(`\n🚀 Setting up database for ${environment} environment...\n`);
  
  if (!options.skipConfirmation && !options.dryRun) {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      readline.question('This will create/reset the database. Continue? (y/N): ', resolve);
    });
    
    readline.close();
    
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('Setup cancelled.');
      process.exit(0);
    }
  }

  try {
    const installer = new DatabaseInstaller(options);
    const report = await installer.install();
    
    if (options.verbose) {
      console.log('\n📊 Installation Report:', JSON.stringify(report, null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Setup failed: ${error.message}`);
    if (options.verbose) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupDatabase().catch(console.error);
}

module.exports = setupDatabase;