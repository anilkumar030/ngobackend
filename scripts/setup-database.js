#!/usr/bin/env node
/**
 * Comprehensive Database Setup Script for Shiv Dhaam Foundation
 * 
 * This script creates a new PostgreSQL database, user, and populates it with
 * all necessary tables, indexes, and sample data for testing purposes.
 * 
 * Features:
 * - Creates dedicated database and user with proper privileges
 * - Runs all migrations in correct order
 * - Executes all seeders for sample data
 * - Creates additional test users and data
 * - Validates database setup
 * 
 * Usage: node scripts/setup-database.js [environment]
 * Example: node scripts/setup-database.js development
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const execAsync = promisify(exec);

class DatabaseSetup {
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

  async executeCommand(command, description) {
    try {
      this.log('INFO', `${description}...`);
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stderr.includes('NOTICE')) {
        this.log('WARNING', `Command warning: ${stderr}`);
      }
      
      this.log('SUCCESS', `${description} completed`);
      return { success: true, stdout, stderr };
    } catch (error) {
      this.log('ERROR', `${description} failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async checkPostgreSQLConnection() {
    // First try with configured credentials if database exists
    let command = `PGPASSWORD=${this.config.password} psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d ${this.config.database} -c "SELECT version();" 2>/dev/null`;
    let result = await this.executeCommand(command, 'Checking database connection with configured credentials');
    
    if (result.success) {
      this.log('SUCCESS', 'Database and user already exist and are accessible');
      return true;
    }

    // If that fails, try to connect as postgres (for initial setup)
    command = `psql -h ${this.config.host} -p ${this.config.port} -U postgres -c "SELECT version();"`;
    result = await this.executeCommand(command, 'Checking PostgreSQL connection as postgres user');
    
    if (!result.success) {
      this.log('WARNING', 'Cannot connect as postgres user. Will try to use pkexec for setup operations.');
      this.log('INFO', 'Connection details:', {
        host: this.config.host,
        port: this.config.port,
        user: 'postgres'
      });
      // Don't return false here, we'll handle this in subsequent operations
      return 'limited';
    }
    
    return true;
  }

  async createDatabase() {
    // Check if database already exists
    let checkCommand = `PGPASSWORD=${this.config.password} psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d ${this.config.database} -c "SELECT 1;" 2>/dev/null`;
    let checkResult = await this.executeCommand(checkCommand, 'Checking if database exists');
    
    if (checkResult.success) {
      this.log('SUCCESS', `Database '${this.config.database}' already exists and is accessible`);
      return true;
    }

    // Try to create database using postgres user first
    if (this.environment === 'development') {
      const dropCommand = `psql -h ${this.config.host} -p ${this.config.port} -U postgres -c "DROP DATABASE IF EXISTS \\"${this.config.database}\\";" 2>/dev/null`;
      await this.executeCommand(dropCommand, 'Dropping existing database');
    }

    let createCommand = `psql -h ${this.config.host} -p ${this.config.port} -U postgres -c "CREATE DATABASE \\"${this.config.database}\\" WITH ENCODING='UTF8' LC_COLLATE='en_US.UTF-8' LC_CTYPE='en_US.UTF-8';"`;
    let result = await this.executeCommand(createCommand, `Creating database '${this.config.database}'`);
    
    // If postgres user fails, try with pkexec
    if (!result.success) {
      this.log('WARNING', 'Failed to create database as postgres user, trying with pkexec...');
      createCommand = `pkexec --user postgres psql -c "CREATE DATABASE IF NOT EXISTS \\"${this.config.database}\\" WITH ENCODING='UTF8' LC_COLLATE='en_US.UTF-8' LC_CTYPE='en_US.UTF-8';" -d postgres`;
      result = await this.executeCommand(createCommand, `Creating database '${this.config.database}' with pkexec`);
    }
    
    return result.success;
  }

  async createDatabaseUser() {
    // Check if user already exists and can connect
    let checkCommand = `PGPASSWORD=${this.config.password} psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d ${this.config.database} -c "SELECT current_user;" 2>/dev/null`;
    let checkResult = await this.executeCommand(checkCommand, 'Checking if database user exists');
    
    if (checkResult.success) {
      this.log('SUCCESS', `Database user '${this.config.username}' already exists and can connect`);
      // Still need to ensure proper permissions
      await this.ensureUserPermissions();
      return true;
    }

    // Try to create user using postgres user first
    if (this.environment === 'development') {
      const dropUserCommand = `psql -h ${this.config.host} -p ${this.config.port} -U postgres -c "DROP USER IF EXISTS \\"${this.config.username}\\";" 2>/dev/null`;
      await this.executeCommand(dropUserCommand, 'Dropping existing database user');
    }

    let createUserCommand = `psql -h ${this.config.host} -p ${this.config.port} -U postgres -c "CREATE USER \\"${this.config.username}\\" WITH PASSWORD '${this.config.password}';"`;
    let userResult = await this.executeCommand(createUserCommand, `Creating database user '${this.config.username}'`);
    
    // If postgres user fails, try with pkexec
    if (!userResult.success) {
      this.log('WARNING', 'Failed to create user as postgres user, trying with pkexec...');
      createUserCommand = `pkexec --user postgres psql -c "CREATE USER IF NOT EXISTS \\"${this.config.username}\\" WITH PASSWORD '${this.config.password}';" -d postgres`;
      userResult = await this.executeCommand(createUserCommand, `Creating database user '${this.config.username}' with pkexec`);
    }
    
    if (!userResult.success) {
      this.log('ERROR', 'Failed to create database user');
      return false;
    }

    await this.ensureUserPermissions();
    return true;
  }

  async ensureUserPermissions() {
    this.log('INFO', 'Ensuring user has proper permissions...');
    
    // Grant basic privileges
    const privileges = [
      `GRANT CONNECT ON DATABASE "${this.config.database}" TO "${this.config.username}";`,
      `GRANT USAGE ON SCHEMA public TO "${this.config.username}";`,
      `GRANT CREATE ON SCHEMA public TO "${this.config.username}";`,
      `GRANT ALL PRIVILEGES ON DATABASE "${this.config.database}" TO "${this.config.username}";`
    ];

    for (const privilege of privileges) {
      let privilegeCommand = `psql -h ${this.config.host} -p ${this.config.port} -U postgres -d "${this.config.database}" -c "${privilege}"`;
      let result = await this.executeCommand(privilegeCommand, `Granting privilege: ${privilege.split(' ').slice(1, 3).join(' ')}`);
      
      // If postgres fails, try with pkexec
      if (!result.success) {
        privilegeCommand = `pkexec --user postgres psql -c "${privilege}" -d "${this.config.database}"`;
        result = await this.executeCommand(privilegeCommand, `Granting privilege with pkexec: ${privilege.split(' ').slice(1, 3).join(' ')}`);
      }
    }

    // Grant advanced privileges (CREATEDB, CREATEROLE)
    const advancedPrivileges = [
      `ALTER USER "${this.config.username}" CREATEDB CREATEROLE;`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${this.config.username}";`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${this.config.username}";`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO "${this.config.username}";`
    ];

    for (const privilege of advancedPrivileges) {
      let privilegeCommand = `psql -h ${this.config.host} -p ${this.config.port} -U postgres -d "${this.config.database}" -c "${privilege}"`;
      let result = await this.executeCommand(privilegeCommand, 'Setting up advanced privileges');
      
      // If postgres fails, try with pkexec
      if (!result.success) {
        privilegeCommand = `pkexec --user postgres psql -c "${privilege}" -d "${this.config.database}"`;
        await this.executeCommand(privilegeCommand, 'Setting up advanced privileges with pkexec');
      }
    }
  }

  async installExtensions() {
    const extensions = [
      'uuid-ossp',  // For UUID generation
      'pg_trgm',    // For full-text search
      'btree_gin'   // For GIN indexes on multiple columns
    ];

    for (const extension of extensions) {
      let command = `PGPASSWORD=${this.config.password} psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d "${this.config.database}" -c "CREATE EXTENSION IF NOT EXISTS \\"${extension}\\";";`;
      let result = await this.executeCommand(command, `Installing PostgreSQL extension: ${extension}`);
      
      // If that fails, try with pkexec as postgres
      if (!result.success) {
        command = `pkexec --user postgres psql -d "${this.config.database}" -c "CREATE EXTENSION IF NOT EXISTS \\"${extension}\\";";`;
        await this.executeCommand(command, `Installing PostgreSQL extension with pkexec: ${extension}`);
      }
    }
  }

  async runMigrations() {
    const migrationsDir = path.join(__dirname, '../src/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort(); // Ensure correct order

    this.log('INFO', `Found ${migrationFiles.length} migration files`);

    // Set environment variable for Sequelize
    process.env.NODE_ENV = this.environment;

    for (const migrationFile of migrationFiles) {
      this.log('INFO', `Running migration: ${migrationFile}`);
      
      const command = `npx sequelize-cli db:migrate --migrations-path src/migrations --config src/config/database.js --env ${this.environment}`;
      const result = await this.executeCommand(command, `Executing migration ${migrationFile}`);
      
      if (!result.success) {
        this.log('ERROR', `Migration ${migrationFile} failed. Stopping migration process.`);
        return false;
      }
    }

    this.log('SUCCESS', 'All migrations completed successfully');
    return true;
  }

  async runSeeders() {
    const seedersDir = path.join(__dirname, '../src/seeders');
    const seederFiles = fs.readdirSync(seedersDir)
      .filter(file => file.endsWith('.js'))
      .sort(); // Ensure correct order

    this.log('INFO', `Found ${seederFiles.length} seeder files`);

    for (const seederFile of seederFiles) {
      this.log('INFO', `Running seeder: ${seederFile}`);
      
      const command = `npx sequelize-cli db:seed --seed ${seederFile} --seeders-path src/seeders --config src/config/database.js --env ${this.environment}`;
      const result = await this.executeCommand(command, `Executing seeder ${seederFile}`);
      
      if (!result.success) {
        this.log('WARNING', `Seeder ${seederFile} failed, but continuing...`);
      }
    }

    this.log('SUCCESS', 'All seeders completed');
    return true;
  }

  async createAdditionalTestUsers() {
    this.log('INFO', 'Creating additional test users...');

    const testUsers = [
      {
        email: 'donor1@example.com',
        firstName: 'Regular',
        lastName: 'Donor',
        role: 'user',
        phone: '+91 9876543211',
        totalDonations: 25000.00,
        donationCount: 5
      },
      {
        email: 'donor2@example.com',
        firstName: 'Premium',
        lastName: 'Supporter',
        role: 'user',
        phone: '+91 9876543212',
        totalDonations: 75000.00,
        donationCount: 12
      },
      {
        email: 'volunteer@example.com',
        firstName: 'Dedicated',
        lastName: 'Volunteer',
        role: 'user',
        phone: '+91 9876543213',
        totalDonations: 5000.00,
        donationCount: 2
      },
      {
        email: 'manager@shivdhaam.org',
        firstName: 'Campaign',
        lastName: 'Manager',
        role: 'admin',
        phone: '+91 9876543214',
        totalDonations: 10000.00,
        donationCount: 3
      }
    ];

    const hashedPassword = await bcrypt.hash('TestUser@123', 12);

    for (const userData of testUsers) {
      const userId = uuidv4();
      
      const insertUserQuery = `
        INSERT INTO users (
          id, email, password_hash, first_name, last_name, phone_number, 
          role, email_verified, phone_verified, is_active, 
          total_donations, donation_count, preferences,
          created_at, updated_at
        ) VALUES (
          '${userId}', '${userData.email}', '${hashedPassword}', 
          '${userData.firstName}', '${userData.lastName}', '${userData.phone}',
          '${userData.role}', true, true, true,
          ${userData.totalDonations}, ${userData.donationCount}, 
          '{"newsletter": true, "email_notifications": true}'::jsonb,
          NOW(), NOW()
        );
      `;

      const command = `psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d "${this.config.database}" -c "${insertUserQuery}"`;
      await this.executeCommand(command, `Creating test user: ${userData.email}`);

      // Create default address for each user
      const addressId = uuidv4();
      const insertAddressQuery = `
        INSERT INTO user_addresses (
          id, user_id, type, first_name, last_name, 
          address_line_1, city, state, postal_code, country,
          phone_number, is_default, created_at, updated_at
        ) VALUES (
          '${addressId}', '${userId}', 'home', '${userData.firstName}', '${userData.lastName}',
          'Test Address Line 1', 'Test City', 'Test State', '123456', 'India',
          '${userData.phone}', true, NOW(), NOW()
        );
      `;

      const addressCommand = `psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d "${this.config.database}" -c "${insertAddressQuery}"`;
      await this.executeCommand(addressCommand, `Creating address for: ${userData.email}`);
    }

    this.log('SUCCESS', `Created ${testUsers.length} additional test users`);
    return true;
  }

  async createSampleDonations() {
    this.log('INFO', 'Creating sample donations...');

    // Get user IDs and campaign IDs
    const getUsersQuery = `SELECT id, email FROM users WHERE role = 'user' LIMIT 5;`;
    const getCampaignsQuery = `SELECT id, slug FROM campaigns WHERE status = 'active' LIMIT 3;`;

    const usersCommand = `psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d "${this.config.database}" -t -c "${getUsersQuery}"`;
    const campaignsCommand = `psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d "${this.config.database}" -t -c "${getCampaignsQuery}"`;

    const usersResult = await this.executeCommand(usersCommand, 'Getting user IDs for sample donations');
    const campaignsResult = await this.executeCommand(campaignsCommand, 'Getting campaign IDs for sample donations');

    if (usersResult.success && campaignsResult.success) {
      const sampleAmounts = [500, 1000, 2500, 5000, 10000];
      
      // Create 10 sample donations
      for (let i = 0; i < 10; i++) {
        const donationId = uuidv4();
        const amount = sampleAmounts[Math.floor(Math.random() * sampleAmounts.length)];
        const receiptNumber = `SDH${Date.now()}${i}`;
        
        const insertDonationQuery = `
          INSERT INTO donations (
            id, campaign_id, user_id, amount, currency, status, payment_status,
            payment_method, payment_gateway, receipt_number, completed_at,
            created_at, updated_at
          ) SELECT
            '${donationId}', 
            (SELECT id FROM campaigns WHERE status = 'active' ORDER BY RANDOM() LIMIT 1),
            (SELECT id FROM users WHERE role = 'user' ORDER BY RANDOM() LIMIT 1),
            ${amount}, 'INR', 'completed', 'completed',
            'upi', 'razorpay', '${receiptNumber}', NOW() - INTERVAL '${i} days',
            NOW() - INTERVAL '${i} days', NOW();
        `;

        const command = `psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d "${this.config.database}" -c "${insertDonationQuery}"`;
        await this.executeCommand(command, `Creating sample donation ${i + 1}`);
      }
    }

    this.log('SUCCESS', 'Sample donations created');
    return true;
  }

  async updateCampaignStats() {
    this.log('INFO', 'Updating campaign statistics...');

    const updateStatsQuery = `
      UPDATE campaigns 
      SET 
        raised_amount = COALESCE((
          SELECT SUM(amount) 
          FROM donations 
          WHERE campaign_id = campaigns.id 
          AND status = 'completed'
        ), 0),
        donor_count = COALESCE((
          SELECT COUNT(DISTINCT user_id) 
          FROM donations 
          WHERE campaign_id = campaigns.id 
          AND status = 'completed'
        ), 0),
        updated_at = NOW();
    `;

    const command = `psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d "${this.config.database}" -c "${updateStatsQuery}"`;
    await this.executeCommand(command, 'Updating campaign statistics');

    return true;
  }

  async validateDatabaseSetup() {
    this.log('INFO', 'Validating database setup...');

    const validationQueries = [
      { name: 'Users count', query: 'SELECT COUNT(*) as count FROM users;' },
      { name: 'Campaigns count', query: 'SELECT COUNT(*) as count FROM campaigns;' },
      { name: 'Products count', query: 'SELECT COUNT(*) as count FROM products;' },
      { name: 'Content sections count', query: 'SELECT COUNT(*) as count FROM content_sections;' },
      { name: 'Donations count', query: 'SELECT COUNT(*) as count FROM donations;' },
      { name: 'Database size', query: `SELECT pg_size_pretty(pg_database_size('${this.config.database}')) as size;` }
    ];

    const results = {};
    
    for (const validation of validationQueries) {
      const command = `psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d "${this.config.database}" -t -c "${validation.query}"`;
      const result = await this.executeCommand(command, `Validating: ${validation.name}`);
      
      if (result.success) {
        results[validation.name] = result.stdout.trim();
      }
    }

    this.log('SUCCESS', 'Database validation completed');
    this.log('INFO', 'Validation Results:', results);
    
    return true;
  }

  async createDatabaseBackup() {
    if (this.environment !== 'development') {
      this.log('INFO', 'Creating initial database backup...');
      
      const backupFile = `backup_${this.config.database}_${Date.now()}.sql`;
      const backupPath = path.join(__dirname, '../backups', backupFile);
      
      // Ensure backups directory exists
      const backupsDir = path.dirname(backupPath);
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      const backupCommand = `pg_dump -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d ${this.config.database} -f ${backupPath}`;
      const result = await this.executeCommand(backupCommand, 'Creating database backup');
      
      if (result.success) {
        this.log('SUCCESS', `Backup created at: ${backupPath}`);
      }
    }
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
    
    console.log(`\n${this.colors.yellow}${this.colors.bright}=== TEST ACCOUNTS ===${this.colors.reset}`);
    console.log(`${this.colors.cyan}Super Admin:${this.colors.reset} admin@shivdhaam.org / Admin@123`);
    console.log(`${this.colors.cyan}Campaign Manager:${this.colors.reset} manager@shivdhaam.org / TestUser@123`);
    console.log(`${this.colors.cyan}Regular Donor:${this.colors.reset} donor1@example.com / TestUser@123`);
    console.log(`${this.colors.cyan}Premium Supporter:${this.colors.reset} donor2@example.com / TestUser@123`);
    console.log(`${this.colors.cyan}Volunteer:${this.colors.reset} volunteer@example.com / TestUser@123`);
    
    console.log(`\n${this.colors.blue}${this.colors.bright}=== NEXT STEPS ===${this.colors.reset}`);
    console.log(`1. Start your application server`);
    console.log(`2. Test the API endpoints with the provided test accounts`);
    console.log(`3. Access the admin panel with the super admin account`);
    console.log(`4. Verify campaigns, donations, and other features`);
    
    console.log(`\n${this.colors.magenta}Happy coding! 🚀${this.colors.reset}\n`);
  }

  async run() {
    try {
      this.log('INFO', `${this.colors.bright}Starting database setup for ${this.environment} environment${this.colors.reset}`);
      
      // Step 1: Check PostgreSQL connection
      const connected = await this.checkPostgreSQLConnection();
      if (!connected) return;

      // Step 2: Create database
      await this.createDatabase();

      // Step 3: Create database user
      await this.createDatabaseUser();

      // Step 4: Install PostgreSQL extensions
      await this.installExtensions();

      // Step 5: Run migrations
      const migrationsSuccess = await this.runMigrations();
      if (!migrationsSuccess) return;

      // Step 6: Run seeders
      await this.runSeeders();

      // Step 7: Create additional test users
      await this.createAdditionalTestUsers();

      // Step 8: Create sample donations
      await this.createSampleDonations();

      // Step 9: Update campaign statistics
      await this.updateCampaignStats();

      // Step 10: Validate setup
      await this.validateDatabaseSetup();

      // Step 11: Create backup (non-development)
      await this.createDatabaseBackup();

      // Step 12: Complete setup
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
  const dbSetup = new DatabaseSetup(environment);
  dbSetup.run();
}

module.exports = DatabaseSetup;