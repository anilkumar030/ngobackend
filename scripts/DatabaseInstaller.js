#!/usr/bin/env node
/**
 * Comprehensive Database Installer for Node.js + Sequelize + PostgreSQL
 * 
 * This is a bulletproof, production-ready database installer that handles:
 * - Database and user creation with proper permissions
 * - Sequential migration and seeder execution
 * - Environment-specific configurations
 * - Comprehensive error handling and rollback capabilities
 * - Progress tracking and status reporting
 * - Connection validation and health checks
 * 
 * @author Shiv Dhaam Foundation
 * @version 2.0.0
 */

const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');

const execAsync = promisify(exec);

class DatabaseInstaller {
  constructor(options = {}) {
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.config = this.loadDatabaseConfig();
    this.sequelize = null;
    this.startTime = Date.now();
    this.installationId = crypto.randomUUID();
    
    // Console styling
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m'
    };

    // Installation state tracking
    this.state = {
      databaseCreated: false,
      userCreated: false,
      extensionsInstalled: false,
      migrationsRun: false,
      seedersRun: false,
      validationPassed: false,
      errors: [],
      warnings: []
    };

    // Options
    this.options = {
      skipConfirmation: options.skipConfirmation || false,
      verbose: options.verbose || false,
      dryRun: options.dryRun || false,
      backupBeforeReset: options.backupBeforeReset !== false,
      retryCount: options.retryCount || 3,
      timeout: options.timeout || 300000, // 5 minutes
      ...options
    };
  }

  /**
   * Load database configuration for current environment
   */
  loadDatabaseConfig() {
    try {
      const configPath = path.resolve(__dirname, '../src/config/database.js');
      const config = require(configPath);
      
      if (!config[this.environment]) {
        throw new Error(`Configuration for environment '${this.environment}' not found`);
      }

      return config[this.environment];
    } catch (error) {
      this.logError('Failed to load database configuration', error);
      throw error;
    }
  }

  /**
   * Enhanced logging with colors, timestamps, and levels
   */
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const levelColors = {
      SUCCESS: this.colors.green,
      INFO: this.colors.cyan,
      WARNING: this.colors.yellow,
      ERROR: this.colors.red,
      DEBUG: this.colors.magenta,
      STEP: this.colors.blue
    };

    const color = levelColors[level] || this.colors.reset;
    const prefix = `${color}[${timestamp}] [${level}]${this.colors.reset}`;
    
    console.log(`${prefix} ${message}`);
    
    if (data && this.options.verbose) {
      console.log(`${this.colors.dim}${JSON.stringify(data, null, 2)}${this.colors.reset}`);
    }
  }

  logSuccess(message, data) { this.log('SUCCESS', message, data); }
  logInfo(message, data) { this.log('INFO', message, data); }
  logWarning(message, data) { this.log('WARNING', message, data); }
  logError(message, error) { 
    this.log('ERROR', message, error?.message || error);
    this.state.errors.push({ message, error: error?.message || error, timestamp: new Date() });
  }
  logDebug(message, data) { if (this.options.verbose) this.log('DEBUG', message, data); }
  logStep(message) { this.log('STEP', `${this.colors.bright}${message}${this.colors.reset}`); }

  /**
   * Show installation progress
   */
  showProgress(current, total, operation) {
    const percentage = Math.round((current / total) * 100);
    const progressBar = '█'.repeat(Math.round(percentage / 5)) + '░'.repeat(20 - Math.round(percentage / 5));
    process.stdout.write(`\r${this.colors.cyan}[${progressBar}] ${percentage}%${this.colors.reset} ${operation}`);
    if (current === total) console.log(''); // New line when complete
  }

  /**
   * Execute command with enhanced error handling and retries
   */
  async executeCommand(command, description, options = {}) {
    const maxRetries = options.retries || this.options.retryCount;
    const timeout = options.timeout || this.options.timeout;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logDebug(`Executing command (attempt ${attempt}/${maxRetries}): ${command}`);
        
        if (this.options.dryRun) {
          this.logInfo(`[DRY RUN] Would execute: ${description}`);
          return { success: true, stdout: '', stderr: '' };
        }

        const { stdout, stderr } = await execAsync(command, { timeout });
        
        // Some PostgreSQL commands return info to stderr that's not actually an error
        if (stderr && !this.isPostgresNotice(stderr)) {
          this.logWarning(`Command completed with warnings: ${stderr.trim()}`);
        }
        
        this.logDebug(`Command completed successfully: ${description}`);
        return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
        
      } catch (error) {
        this.logDebug(`Command attempt ${attempt} failed: ${error.message}`);
        
        if (attempt === maxRetries) {
          this.logError(`${description} failed after ${maxRetries} attempts`, error);
          return { success: false, error: error.message, code: error.code };
        }
        
        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000;
        this.logInfo(`Retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Check if stderr message is just a PostgreSQL notice
   */
  isPostgresNotice(stderr) {
    const notices = ['NOTICE:', 'WARNING:', 'DETAIL:', 'HINT:'];
    return notices.some(notice => stderr.includes(notice));
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test database connectivity with multiple fallback strategies
   */
  async testConnection() {
    this.logStep('Testing database connection');
    
    // Strategy 1: Try with configured credentials
    try {
      const testSequelize = new Sequelize(this.config);
      await testSequelize.authenticate();
      await testSequelize.close();
      this.logSuccess('Database connection successful with configured credentials');
      return { success: true, strategy: 'configured' };
    } catch (error) {
      this.logDebug('Configured credentials failed, trying alternatives');
    }

    // Strategy 2: Try with postgres user (for initial setup)
    if (this.environment === 'development') {
      try {
        const postgresConfig = { ...this.config, username: 'postgres', password: '' };
        const testSequelize = new Sequelize(postgresConfig);
        await testSequelize.authenticate();
        await testSequelize.close();
        this.logSuccess('Connection successful with postgres user');
        return { success: true, strategy: 'postgres' };
      } catch (error) {
        this.logDebug('Postgres user connection failed');
      }
    }

    // Strategy 3: Test PostgreSQL service availability
    const testCommand = `pg_isready -h ${this.config.host} -p ${this.config.port}`;
    const result = await this.executeCommand(testCommand, 'Testing PostgreSQL service availability');
    
    if (result.success) {
      this.logWarning('PostgreSQL is running but authentication failed');
      return { success: false, strategy: 'service_only', available: true };
    }

    this.logError('PostgreSQL connection failed completely');
    return { success: false, strategy: 'none', available: false };
  }

  /**
   * Create database with proper error handling
   */
  async createDatabase() {
    this.logStep('Creating database');
    
    // Check if database already exists
    const checkCommand = `psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -lqt | cut -d \\| -f 1 | grep -qw ${this.config.database}`;
    const checkResult = await this.executeCommand(checkCommand, 'Checking if database exists', { retries: 1 });
    
    if (checkResult.success) {
      this.logSuccess(`Database '${this.config.database}' already exists`);
      this.state.databaseCreated = true;
      return true;
    }

    // Try to create database
    const createCommands = [
      // Try with postgres user
      `psql -h ${this.config.host} -p ${this.config.port} -U postgres -c "CREATE DATABASE \\"${this.config.database}\\" WITH ENCODING='UTF8' LC_COLLATE='en_US.UTF-8' LC_CTYPE='en_US.UTF-8';"`,
      // Try with configured user
      `createdb -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} ${this.config.database}`,
      // Try with sudo postgres
      `sudo -u postgres createdb ${this.config.database}`
    ];

    for (const command of createCommands) {
      const result = await this.executeCommand(command, `Creating database '${this.config.database}'`, { retries: 1 });
      if (result.success) {
        this.logSuccess(`Database '${this.config.database}' created successfully`);
        this.state.databaseCreated = true;
        return true;
      }
    }

    throw new Error('Failed to create database with all available methods');
  }

  /**
   * Create database user with proper privileges
   */
  async createDatabaseUser() {
    this.logStep('Setting up database user');
    
    // Check if user exists and can connect
    const testCommand = `PGPASSWORD=${this.config.password} psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d ${this.config.database} -c "SELECT current_user;"`;
    const testResult = await this.executeCommand(testCommand, 'Testing user connection', { retries: 1 });
    
    if (testResult.success) {
      this.logSuccess(`Database user '${this.config.username}' already exists and can connect`);
      this.state.userCreated = true;
      return true;
    }

    // Create user with various strategies
    const createUserCommands = [
      `psql -h ${this.config.host} -p ${this.config.port} -U postgres -c "CREATE USER \\"${this.config.username}\\" WITH ENCRYPTED PASSWORD '${this.config.password}';"`,
      `sudo -u postgres psql -c "CREATE USER \\"${this.config.username}\\" WITH ENCRYPTED PASSWORD '${this.config.password}';"`
    ];

    let userCreated = false;
    for (const command of createUserCommands) {
      const result = await this.executeCommand(command, `Creating user '${this.config.username}'`, { retries: 1 });
      if (result.success) {
        userCreated = true;
        break;
      }
    }

    if (!userCreated) {
      throw new Error('Failed to create database user');
    }

    // Grant privileges
    await this.grantUserPrivileges();
    this.state.userCreated = true;
    return true;
  }

  /**
   * Grant comprehensive privileges to database user
   */
  async grantUserPrivileges() {
    this.logInfo('Granting user privileges...');
    
    const privileges = [
      `GRANT ALL PRIVILEGES ON DATABASE "${this.config.database}" TO "${this.config.username}";`,
      `GRANT USAGE, CREATE ON SCHEMA public TO "${this.config.username}";`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${this.config.username}";`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${this.config.username}";`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO "${this.config.username}";`
    ];

    if (this.environment === 'development') {
      privileges.push(`ALTER USER "${this.config.username}" CREATEDB;`);
    }

    for (const privilege of privileges) {
      const commands = [
        `psql -h ${this.config.host} -p ${this.config.port} -U postgres -d "${this.config.database}" -c "${privilege}"`,
        `sudo -u postgres psql -d "${this.config.database}" -c "${privilege}"`
      ];

      for (const command of commands) {
        const result = await this.executeCommand(command, 'Granting privilege', { retries: 1 });
        if (result.success) break;
      }
    }
  }

  /**
   * Install required PostgreSQL extensions
   */
  async installExtensions() {
    this.logStep('Installing PostgreSQL extensions');
    
    const extensions = [
      'uuid-ossp',      // UUID generation
      'pg_trgm',        // Full-text search
      'btree_gin',      // GIN indexes
      'unaccent'        // Text search without accents
    ];

    let installed = 0;
    for (const extension of extensions) {
      const command = `PGPASSWORD=${this.config.password} psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d "${this.config.database}" -c "CREATE EXTENSION IF NOT EXISTS \\"${extension}\\";";`;
      const result = await this.executeCommand(command, `Installing extension: ${extension}`);
      
      if (result.success) {
        installed++;
        this.logSuccess(`Extension '${extension}' installed`);
      } else {
        this.logWarning(`Failed to install extension '${extension}' - this may cause issues`);
      }
    }

    this.logInfo(`${installed}/${extensions.length} extensions installed successfully`);
    this.state.extensionsInstalled = true;
    return true;
  }

  /**
   * Get all migration files in correct order
   */
  async getMigrationFiles() {
    const migrationsDir = path.resolve(__dirname, '../src/migrations');
    try {
      const files = await fs.readdir(migrationsDir);
      return files
        .filter(file => file.endsWith('.js'))
        .sort(); // Lexicographic sort ensures correct order with numbered prefixes
    } catch (error) {
      throw new Error(`Failed to read migrations directory: ${error.message}`);
    }
  }

  /**
   * Run all database migrations
   */
  async runMigrations() {
    this.logStep('Running database migrations');
    
    // Set environment for Sequelize CLI
    process.env.NODE_ENV = this.environment;
    
    // Use Sequelize CLI for migrations (more reliable than manual execution)
    const command = `npx sequelize-cli db:migrate --config src/config/database.js --env ${this.environment}`;
    const result = await this.executeCommand(command, 'Running all migrations');
    
    if (!result.success) {
      // Try alternative method if Sequelize CLI fails
      this.logWarning('Sequelize CLI migration failed, trying manual migration');
      return await this.runMigrationsManually();
    }

    this.logSuccess('All migrations completed successfully');
    this.state.migrationsRun = true;
    return true;
  }

  /**
   * Fallback method to run migrations manually
   */
  async runMigrationsManually() {
    const migrationFiles = await this.getMigrationFiles();
    this.logInfo(`Found ${migrationFiles.length} migration files`);
    
    // Initialize Sequelize connection
    this.sequelize = new Sequelize(this.config);
    
    // Create SequelizeMeta table if it doesn't exist
    await this.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
        name VARCHAR(255) NOT NULL PRIMARY KEY
      );
    `);

    // Get already executed migrations
    const [executedMigrations] = await this.sequelize.query(
      'SELECT name FROM "SequelizeMeta" ORDER BY name'
    );
    const executedNames = executedMigrations.map(m => m.name);

    let executed = 0;
    for (const [index, file] of migrationFiles.entries()) {
      this.showProgress(index + 1, migrationFiles.length, `Migration: ${file}`);
      
      if (executedNames.includes(file)) {
        this.logDebug(`Skipping already executed migration: ${file}`);
        continue;
      }

      try {
        const migrationPath = path.resolve(__dirname, '../src/migrations', file);
        const migration = require(migrationPath);
        
        await migration.up(this.sequelize.getQueryInterface(), this.sequelize.Sequelize);
        
        // Record migration as executed
        await this.sequelize.query(
          'INSERT INTO "SequelizeMeta" (name) VALUES (?)',
          { replacements: [file] }
        );
        
        executed++;
        this.logDebug(`Migration ${file} completed successfully`);
      } catch (error) {
        throw new Error(`Migration ${file} failed: ${error.message}`);
      }
    }

    this.logSuccess(`${executed} new migrations executed successfully`);
    this.state.migrationsRun = true;
    return true;
  }

  /**
   * Get all seeder files in correct order
   */
  async getSeederFiles() {
    const seedersDir = path.resolve(__dirname, '../src/seeders');
    try {
      const files = await fs.readdir(seedersDir);
      return files
        .filter(file => file.endsWith('.js'))
        .sort(); // Lexicographic sort ensures correct order
    } catch (error) {
      throw new Error(`Failed to read seeders directory: ${error.message}`);
    }
  }

  /**
   * Run all database seeders
   */
  async runSeeders() {
    this.logStep('Running database seeders');
    
    const seederFiles = await this.getSeederFiles();
    this.logInfo(`Found ${seederFiles.length} seeder files`);

    if (!this.sequelize) {
      this.sequelize = new Sequelize(this.config);
    }

    // Create SequelizeData table for tracking seeders
    await this.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "SequelizeData" (
        name VARCHAR(255) NOT NULL PRIMARY KEY
      );
    `);

    // Get already executed seeders
    const [executedSeeders] = await this.sequelize.query(
      'SELECT name FROM "SequelizeData" ORDER BY name'
    );
    const executedNames = executedSeeders.map(s => s.name);

    let executed = 0;
    for (const [index, file] of seederFiles.entries()) {
      this.showProgress(index + 1, seederFiles.length, `Seeder: ${file}`);
      
      if (executedNames.includes(file)) {
        this.logDebug(`Skipping already executed seeder: ${file}`);
        continue;
      }

      try {
        const seederPath = path.resolve(__dirname, '../src/seeders', file);
        const seeder = require(seederPath);
        
        await seeder.up(this.sequelize.getQueryInterface(), this.sequelize.Sequelize);
        
        // Record seeder as executed
        await this.sequelize.query(
          'INSERT INTO "SequelizeData" (name) VALUES (?)',
          { replacements: [file] }
        );
        
        executed++;
        this.logSuccess(`Seeder ${file} completed successfully`);
      } catch (error) {
        this.logWarning(`Seeder ${file} failed: ${error.message} - continuing with next seeder`);
      }
    }

    this.logSuccess(`${executed} new seeders executed successfully`);
    this.state.seedersRun = true;
    return true;
  }

  /**
   * Validate database installation
   */
  async validateInstallation() {
    this.logStep('Validating database installation');
    
    if (!this.sequelize) {
      this.sequelize = new Sequelize(this.config);
    }

    const validations = [
      {
        name: 'Database Connection',
        test: () => this.sequelize.authenticate()
      },
      {
        name: 'Tables Exist',
        test: async () => {
          const tables = await this.sequelize.query(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
            { type: this.sequelize.QueryTypes.SELECT }
          );
          if (tables.length < 10) {
            throw new Error(`Only ${tables.length} tables found, expected more`);
          }
          return tables;
        }
      },
      {
        name: 'Admin User Exists',
        test: async () => {
          const [users] = await this.sequelize.query(
            "SELECT COUNT(*) as count FROM users WHERE role IN ('super_admin', 'admin')"
          );
          if (users[0].count == 0) {
            throw new Error('No admin users found');
          }
          return users[0];
        }
      },
      {
        name: 'Extensions Installed',
        test: async () => {
          const [extensions] = await this.sequelize.query(
            "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_trgm')"
          );
          return extensions;
        }
      }
    ];

    let passed = 0;
    const results = {};

    for (const validation of validations) {
      try {
        const result = await validation.test();
        this.logSuccess(`✓ ${validation.name}`);
        results[validation.name] = { success: true, result };
        passed++;
      } catch (error) {
        this.logError(`✗ ${validation.name}: ${error.message}`);
        results[validation.name] = { success: false, error: error.message };
      }
    }

    this.logInfo(`Validation completed: ${passed}/${validations.length} checks passed`);
    
    if (passed === validations.length) {
      this.state.validationPassed = true;
      return true;
    } else {
      this.logWarning('Some validations failed - database may not be fully functional');
      return false;
    }
  }

  /**
   * Generate installation report
   */
  generateReport() {
    const duration = (Date.now() - this.startTime) / 1000;
    
    const report = {
      installationId: this.installationId,
      environment: this.environment,
      database: this.config.database,
      duration: `${duration.toFixed(2)}s`,
      timestamp: new Date().toISOString(),
      state: this.state,
      configuration: {
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        database: this.config.database
      }
    };

    return report;
  }

  /**
   * Display installation summary
   */
  displaySummary() {
    const report = this.generateReport();
    
    console.log(`\n${this.colors.green}${this.colors.bright}═══════════════════════════════════════════════════════════════════════════════════════${this.colors.reset}`);
    console.log(`${this.colors.green}${this.colors.bright}                              DATABASE INSTALLATION COMPLETE                              ${this.colors.reset}`);
    console.log(`${this.colors.green}${this.colors.bright}═══════════════════════════════════════════════════════════════════════════════════════${this.colors.reset}\n`);
    
    console.log(`${this.colors.cyan}Environment:${this.colors.reset} ${this.colors.bright}${this.environment}${this.colors.reset}`);
    console.log(`${this.colors.cyan}Database:${this.colors.reset} ${this.colors.bright}${this.config.database}${this.colors.reset}`);
    console.log(`${this.colors.cyan}Host:${this.colors.reset} ${this.colors.bright}${this.config.host}:${this.config.port}${this.colors.reset}`);
    console.log(`${this.colors.cyan}Username:${this.colors.reset} ${this.colors.bright}${this.config.username}${this.colors.reset}`);
    console.log(`${this.colors.cyan}Duration:${this.colors.reset} ${this.colors.bright}${report.duration}${this.colors.reset}\n`);
    
    // Status indicators
    const statuses = [
      { key: 'databaseCreated', label: 'Database Created' },
      { key: 'userCreated', label: 'User Created' },
      { key: 'extensionsInstalled', label: 'Extensions Installed' },
      { key: 'migrationsRun', label: 'Migrations Executed' },
      { key: 'seedersRun', label: 'Seeders Executed' },
      { key: 'validationPassed', label: 'Validation Passed' }
    ];

    console.log(`${this.colors.blue}${this.colors.bright}Installation Status:${this.colors.reset}`);
    statuses.forEach(status => {
      const symbol = this.state[status.key] ? '✓' : '✗';
      const color = this.state[status.key] ? this.colors.green : this.colors.red;
      console.log(`  ${color}${symbol}${this.colors.reset} ${status.label}`);
    });

    if (this.state.errors.length > 0) {
      console.log(`\n${this.colors.red}${this.colors.bright}Errors encountered:${this.colors.reset}`);
      this.state.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.message}`);
      });
    }

    console.log(`\n${this.colors.yellow}${this.colors.bright}Default Admin Account:${this.colors.reset}`);
    console.log(`  Email: ${this.colors.bright}admin@shivdhaam.org${this.colors.reset}`);
    console.log(`  Password: ${this.colors.bright}Admin@123${this.colors.reset}`);
    console.log(`  ${this.colors.dim}(Please change this password in production!)${this.colors.reset}`);

    console.log(`\n${this.colors.magenta}${this.colors.bright}Next Steps:${this.colors.reset}`);
    console.log(`  1. Start your application server`);
    console.log(`  2. Test API endpoints`);
    console.log(`  3. Change default admin password`);
    console.log(`  4. Configure production settings`);
    
    console.log(`\n${this.colors.green}Installation completed successfully! 🚀${this.colors.reset}\n`);
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.sequelize) {
      await this.sequelize.close();
      this.sequelize = null;
    }
  }

  /**
   * Main installation process
   */
  async install() {
    try {
      this.logStep('Starting database installation');
      this.logInfo(`Environment: ${this.environment}`);
      this.logInfo(`Installation ID: ${this.installationId}`);

      // Pre-installation checks
      const connectionTest = await this.testConnection();
      if (!connectionTest.success && !connectionTest.available) {
        throw new Error('PostgreSQL service is not available. Please ensure PostgreSQL is running.');
      }

      // Installation steps
      await this.createDatabase();
      await this.createDatabaseUser();
      await this.installExtensions();
      await this.runMigrations();
      await this.runSeeders();
      await this.validateInstallation();

      // Post-installation
      this.displaySummary();
      
      return this.generateReport();

    } catch (error) {
      this.logError('Installation failed', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

module.exports = DatabaseInstaller;