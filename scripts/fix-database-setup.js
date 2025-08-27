#!/usr/bin/env node
/**
 * Fixed Database Setup Script for Shiv Dhaam Foundation
 * 
 * This script works with the existing shivdhaam user and database,
 * bypassing the postgres superuser authentication issue.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

class FixedDatabaseSetup {
  constructor(environment = 'development') {
    this.environment = environment;
    this.config = this.loadConfig();
    this.setupStartTime = new Date();
    
    // Console colors for better output
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m'
    };
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, '../src/config/database.js');
      const config = require(configPath);
      return config[this.environment];
    } catch (error) {
      this.log('ERROR', `Failed to load database configuration: ${error.message}`);
      process.exit(1);
    }
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const colors = {
      'INFO': this.colors.cyan,
      'SUCCESS': this.colors.green,
      'WARNING': this.colors.yellow,
      'ERROR': this.colors.red,
      'DEBUG': this.colors.magenta
    };
    
    const color = colors[level] || this.colors.reset;
    console.log(`${color}[${timestamp}] [${level}]${this.colors.reset} ${message}`);
    
    if (data && this.environment === 'development') {
      console.log(`${this.colors.blue}Data:${this.colors.reset}`, JSON.stringify(data, null, 2));
    }
  }

  async executeCommand(command, description, ignoreError = false) {
    try {
      this.log('INFO', `${description}...`);
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stderr.includes('NOTICE') && !ignoreError) {
        this.log('WARNING', `Command warning: ${stderr}`);
      }
      
      this.log('SUCCESS', `${description} completed`);
      return { success: true, stdout, stderr };
    } catch (error) {
      if (ignoreError) {
        this.log('WARNING', `${description} failed but continuing: ${error.message}`);
        return { success: false, error: error.message, ignored: true };
      } else {
        this.log('ERROR', `${description} failed: ${error.message}`);
        return { success: false, error: error.message };
      }
    }
  }

  async testConnection() {
    const testCommand = `PGPASSWORD=${this.config.password} psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d ${this.config.database} -c "SELECT version();"`;
    const result = await this.executeCommand(testCommand, 'Testing database connection');
    
    if (!result.success) {
      this.log('ERROR', 'Cannot connect to database with configured credentials.');
      this.log('INFO', 'Connection details:', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        username: this.config.username
      });
      return false;
    }
    
    return true;
  }

  async installExtensions() {
    const extensions = [
      'uuid-ossp',  // For UUID generation
      'pg_trgm',    // For full-text search
      'btree_gin'   // For GIN indexes on multiple columns
    ];

    this.log('INFO', 'Installing PostgreSQL extensions...');
    
    for (const extension of extensions) {
      const command = `PGPASSWORD=${this.config.password} psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d ${this.config.database} -c "CREATE EXTENSION IF NOT EXISTS \\"${extension}\\";";`;
      await this.executeCommand(command, `Installing PostgreSQL extension: ${extension}`, true);
    }
  }

  async runMigrations() {
    const migrationsDir = path.join(__dirname, '../src/migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      this.log('WARNING', 'No migrations directory found. Skipping migrations.');
      return true;
    }
    
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort(); // Ensure correct order

    this.log('INFO', `Found ${migrationFiles.length} migration files`);

    // Set environment variable for Sequelize
    process.env.NODE_ENV = this.environment;
    process.env.DB_USERNAME = this.config.username;
    process.env.DB_PASSWORD = this.config.password;
    process.env.DB_NAME = this.config.database;
    process.env.DB_HOST = this.config.host;
    process.env.DB_PORT = this.config.port;

    if (migrationFiles.length > 0) {
      const command = `npx sequelize-cli db:migrate --migrations-path src/migrations --config src/config/database.js --env ${this.environment}`;
      const result = await this.executeCommand(command, 'Running all migrations');
      
      if (!result.success) {
        this.log('ERROR', 'Migrations failed. Please check the error above.');
        return false;
      }
    }

    this.log('SUCCESS', 'All migrations completed successfully');
    return true;
  }

  async runSeeders() {
    const seedersDir = path.join(__dirname, '../src/seeders');
    
    if (!fs.existsSync(seedersDir)) {
      this.log('WARNING', 'No seeders directory found. Skipping seeders.');
      return true;
    }
    
    const seederFiles = fs.readdirSync(seedersDir)
      .filter(file => file.endsWith('.js'))
      .sort(); // Ensure correct order

    this.log('INFO', `Found ${seederFiles.length} seeder files`);

    if (seederFiles.length > 0) {
      const command = `npx sequelize-cli db:seed:all --seeders-path src/seeders --config src/config/database.js --env ${this.environment}`;
      const result = await this.executeCommand(command, 'Running all seeders');
      
      if (!result.success) {
        this.log('WARNING', 'Some seeders failed, but continuing...');
      }
    }

    this.log('SUCCESS', 'Seeders completed');
    return true;
  }

  async validateDatabaseSetup() {
    this.log('INFO', 'Validating database setup...');

    const validationQueries = [
      { name: 'Tables count', query: "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" },
      { name: 'Extensions', query: "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_trgm', 'btree_gin');" },
      { name: 'Database size', query: `SELECT pg_size_pretty(pg_database_size('${this.config.database}')) as size;` }
    ];

    const results = {};
    
    for (const validation of validationQueries) {
      const command = `PGPASSWORD=${this.config.password} psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d ${this.config.database} -t -c "${validation.query}"`;
      const result = await this.executeCommand(command, `Validating: ${validation.name}`, true);
      
      if (result.success) {
        results[validation.name] = result.stdout.trim();
      }
    }

    this.log('SUCCESS', 'Database validation completed');
    this.log('INFO', 'Validation Results:', results);
    
    return true;
  }

  async setupComplete() {
    const duration = (new Date() - this.setupStartTime) / 1000;
    
    this.log('SUCCESS', `${this.colors.bright}Database setup completed successfully!${this.colors.reset}`);
    this.log('INFO', `Total setup time: ${duration.toFixed(2)} seconds`);
    
    console.log(`\n${this.colors.green}${this.colors.bright}=== SETUP SUMMARY ===${this.colors.reset}`);
    console.log(`${this.colors.cyan}Environment:${this.colors.reset} ${this.environment}`);
    console.log(`${this.colors.cyan}Database:${this.colors.reset} ${this.config.database}`);
    console.log(`${this.colors.cyan}User:${this.colors.reset} ${this.config.username}`);
    console.log(`${this.colors.cyan}Host:${this.colors.reset} ${this.config.host}:${this.config.port}`);
    
    console.log(`\n${this.colors.blue}${this.colors.bright}=== NEXT STEPS ===${this.colors.reset}`);
    console.log(`1. Start your application server`);
    console.log(`2. Test the database connection in your application`);
    console.log(`3. Verify that tables have been created properly`);
    console.log(`4. Check that extensions are installed correctly`);
    
    console.log(`\n${this.colors.magenta}Database is ready for use!${this.colors.reset}\n`);
  }

  async run() {
    try {
      this.log('INFO', `${this.colors.bright}Starting fixed database setup for ${this.environment} environment${this.colors.reset}`);
      
      // Step 1: Test database connection
      const connected = await this.testConnection();
      if (!connected) return;

      // Step 2: Install PostgreSQL extensions
      await this.installExtensions();

      // Step 3: Run migrations
      const migrationsSuccess = await this.runMigrations();
      if (!migrationsSuccess) return;

      // Step 4: Run seeders
      await this.runSeeders();

      // Step 5: Validate setup
      await this.validateDatabaseSetup();

      // Step 6: Complete setup
      await this.setupComplete();

    } catch (error) {
      this.log('ERROR', `Database setup failed: ${error.message}`);
      this.log('DEBUG', 'Error stack trace:', error.stack);
      process.exit(1);
    }
  }
}

// Main execution
if (require.main === module) {
  const environment = process.argv[2] || 'development';
  const dbSetup = new FixedDatabaseSetup(environment);
  dbSetup.run();
}

module.exports = FixedDatabaseSetup;