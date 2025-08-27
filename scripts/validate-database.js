#!/usr/bin/env node
/**
 * Database Validation Script for Shiv Dhaam Foundation
 * 
 * This script validates the database setup by checking:
 * - Database connectivity
 * - Table existence and structure
 * - Sample data integrity
 * - Index performance
 * - Foreign key relationships
 * 
 * Usage: node scripts/validate-database.js [environment]
 * Example: node scripts/validate-database.js development
 */

const path = require('path');
const { sequelize } = require('../src/config/database');

class DatabaseValidator {
  constructor(environment = 'development') {
    this.environment = environment;
    this.errors = [];
    this.warnings = [];
    this.success = [];
    
    // Console colors
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

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const colors = {
      'SUCCESS': this.colors.green,
      'WARNING': this.colors.yellow,
      'ERROR': this.colors.red,
      'INFO': this.colors.cyan
    };
    
    const color = colors[level] || this.colors.reset;
    console.log(`${color}[${level}]${this.colors.reset} ${message}`);
    
    if (data && this.environment === 'development') {
      console.log(`${this.colors.blue}Data:${this.colors.reset}`, data);
    }
  }

  async validateConnection() {
    try {
      await sequelize.authenticate();
      this.success.push('Database connection established successfully');
      this.log('SUCCESS', 'Database connection validation passed');
      return true;
    } catch (error) {
      this.errors.push(`Database connection failed: ${error.message}`);
      this.log('ERROR', 'Database connection validation failed', error.message);
      return false;
    }
  }

  async validateTables() {
    const expectedTables = [
      'users', 'user_addresses', 'campaigns', 'donations', 'products',
      'orders', 'order_items', 'blog_posts', 'gallery', 'content_sections',
      'events', 'event_registrations', 'projects', 'project_updates',
      'testimonials', 'statistics', 'certificates', 'saved_campaigns'
    ];

    try {
      const [results] = await sequelize.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
      );
      
      const existingTables = results.map(row => row.table_name);
      
      // Check for missing tables
      const missingTables = expectedTables.filter(table => !existingTables.includes(table));
      const extraTables = existingTables.filter(table => 
        !expectedTables.includes(table) && !table.startsWith('SequelizeMeta')
      );

      if (missingTables.length === 0) {
        this.success.push(`All ${expectedTables.length} expected tables exist`);
        this.log('SUCCESS', 'Table existence validation passed');
      } else {
        this.errors.push(`Missing tables: ${missingTables.join(', ')}`);
        this.log('ERROR', 'Missing tables found', missingTables);
      }

      if (extraTables.length > 0) {
        this.warnings.push(`Extra tables found: ${extraTables.join(', ')}`);
        this.log('WARNING', 'Extra tables found', extraTables);
      }

      return missingTables.length === 0;
    } catch (error) {
      this.errors.push(`Table validation failed: ${error.message}`);
      this.log('ERROR', 'Table validation failed', error.message);
      return false;
    }
  }

  async validateSampleData() {
    const dataChecks = [
      { table: 'users', minCount: 5, description: 'User accounts' },
      { table: 'campaigns', minCount: 3, description: 'Sample campaigns' },
      { table: 'products', minCount: 3, description: 'Sample products' },
      { table: 'events', minCount: 3, description: 'Sample events' },
      { table: 'projects', minCount: 3, description: 'Sample projects' },
      { table: 'statistics', minCount: 10, description: 'Statistics data' }
    ];

    try {
      for (const check of dataChecks) {
        const [results] = await sequelize.query(`SELECT COUNT(*) as count FROM ${check.table}`);
        const count = parseInt(results[0].count);
        
        if (count >= check.minCount) {
          this.success.push(`${check.description}: ${count} records found`);
        } else {
          this.errors.push(`Insufficient ${check.description}: expected >= ${check.minCount}, found ${count}`);
        }
      }
      
      this.log('SUCCESS', 'Sample data validation completed');
      return true;
    } catch (error) {
      this.errors.push(`Sample data validation failed: ${error.message}`);
      this.log('ERROR', 'Sample data validation failed', error.message);
      return false;
    }
  }

  async validateIndexes() {
    try {
      const [results] = await sequelize.query(`
        SELECT 
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname NOT LIKE '%_pkey'
        ORDER BY tablename, indexname
      `);

      const indexCount = results.length;
      if (indexCount > 20) {
        this.success.push(`Database indexes: ${indexCount} indexes found`);
        this.log('SUCCESS', 'Index validation passed', { indexCount });
      } else {
        this.warnings.push(`Low index count: ${indexCount} indexes found`);
        this.log('WARNING', 'Low index count', { indexCount });
      }

      return true;
    } catch (error) {
      this.errors.push(`Index validation failed: ${error.message}`);
      this.log('ERROR', 'Index validation failed', error.message);
      return false;
    }
  }

  async validateConstraints() {
    try {
      const [results] = await sequelize.query(`
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
        WHERE constraint_type = 'FOREIGN KEY'
        ORDER BY tc.table_name
      `);

      const constraintCount = results.length;
      if (constraintCount > 15) {
        this.success.push(`Foreign key constraints: ${constraintCount} relationships defined`);
        this.log('SUCCESS', 'Constraint validation passed', { constraintCount });
      } else {
        this.warnings.push(`Low constraint count: ${constraintCount} relationships found`);
        this.log('WARNING', 'Low constraint count', { constraintCount });
      }

      return true;
    } catch (error) {
      this.errors.push(`Constraint validation failed: ${error.message}`);
      this.log('ERROR', 'Constraint validation failed', error.message);
      return false;
    }
  }

  async validateUserRoles() {
    try {
      const [results] = await sequelize.query(`
        SELECT role, COUNT(*) as count 
        FROM users 
        GROUP BY role 
        ORDER BY role
      `);

      const roleDistribution = {};
      results.forEach(row => {
        roleDistribution[row.role] = parseInt(row.count);
      });

      const hasAdmin = roleDistribution.admin > 0 || roleDistribution.super_admin > 0;
      const hasUsers = roleDistribution.user > 0;

      if (hasAdmin && hasUsers) {
        this.success.push('User roles: Admin and regular users present');
        this.log('SUCCESS', 'User role validation passed', roleDistribution);
      } else {
        this.errors.push('Missing required user roles');
        this.log('ERROR', 'User role validation failed', roleDistribution);
      }

      return hasAdmin && hasUsers;
    } catch (error) {
      this.errors.push(`User role validation failed: ${error.message}`);
      this.log('ERROR', 'User role validation failed', error.message);
      return false;
    }
  }

  async validateDatabaseSize() {
    try {
      const [results] = await sequelize.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);

      const size = results[0].size;
      this.success.push(`Database size: ${size}`);
      this.log('INFO', 'Database size validation', { size });
      return true;
    } catch (error) {
      this.warnings.push(`Database size check failed: ${error.message}`);
      this.log('WARNING', 'Database size check failed', error.message);
      return false;
    }
  }

  async validateJSONBColumns() {
    try {
      const [results] = await sequelize.query(`
        SELECT 
          table_name,
          column_name
        FROM information_schema.columns
        WHERE data_type = 'jsonb'
        AND table_schema = 'public'
        ORDER BY table_name, column_name
      `);

      const jsonbCount = results.length;
      if (jsonbCount > 10) {
        this.success.push(`JSONB columns: ${jsonbCount} flexible data columns found`);
        this.log('SUCCESS', 'JSONB validation passed', { jsonbCount });
      } else {
        this.warnings.push(`Low JSONB usage: ${jsonbCount} columns found`);
        this.log('WARNING', 'Low JSONB usage', { jsonbCount });
      }

      return true;
    } catch (error) {
      this.warnings.push(`JSONB validation failed: ${error.message}`);
      this.log('WARNING', 'JSONB validation failed', error.message);
      return false;
    }
  }

  async generateReport() {
    console.log(`\n${this.colors.bright}${this.colors.blue}=== DATABASE VALIDATION REPORT ===${this.colors.reset}`);
    console.log(`${this.colors.cyan}Environment:${this.colors.reset} ${this.environment}`);
    console.log(`${this.colors.cyan}Timestamp:${this.colors.reset} ${new Date().toISOString()}`);

    // Success summary
    if (this.success.length > 0) {
      console.log(`\n${this.colors.green}${this.colors.bright}✓ SUCCESSFUL VALIDATIONS (${this.success.length}):${this.colors.reset}`);
      this.success.forEach(item => {
        console.log(`${this.colors.green}  ✓ ${item}${this.colors.reset}`);
      });
    }

    // Warnings summary
    if (this.warnings.length > 0) {
      console.log(`\n${this.colors.yellow}${this.colors.bright}⚠ WARNINGS (${this.warnings.length}):${this.colors.reset}`);
      this.warnings.forEach(item => {
        console.log(`${this.colors.yellow}  ⚠ ${item}${this.colors.reset}`);
      });
    }

    // Errors summary
    if (this.errors.length > 0) {
      console.log(`\n${this.colors.red}${this.colors.bright}✗ ERRORS (${this.errors.length}):${this.colors.reset}`);
      this.errors.forEach(item => {
        console.log(`${this.colors.red}  ✗ ${item}${this.colors.reset}`);
      });
    }

    // Overall status
    const isValid = this.errors.length === 0;
    const statusColor = isValid ? this.colors.green : this.colors.red;
    const statusIcon = isValid ? '✓' : '✗';
    const statusText = isValid ? 'VALID' : 'INVALID';

    console.log(`\n${this.colors.bright}${statusColor}=== OVERALL STATUS: ${statusIcon} ${statusText} ===${this.colors.reset}\n`);

    return isValid;
  }

  async run() {
    try {
      this.log('INFO', `${this.colors.bright}Starting database validation for ${this.environment} environment${this.colors.reset}`);

      // Run all validations
      await this.validateConnection();
      await this.validateTables();
      await this.validateSampleData();
      await this.validateIndexes();
      await this.validateConstraints();
      await this.validateUserRoles();
      await this.validateDatabaseSize();
      await this.validateJSONBColumns();

      // Generate final report
      const isValid = await this.generateReport();

      // Close database connection
      await sequelize.close();

      if (isValid) {
        this.log('SUCCESS', 'Database validation completed successfully');
        process.exit(0);
      } else {
        this.log('ERROR', 'Database validation failed - please check the errors above');
        process.exit(1);
      }

    } catch (error) {
      this.log('ERROR', `Validation process failed: ${error.message}`);
      this.log('ERROR', 'Stack trace:', error.stack);
      await sequelize.close();
      process.exit(1);
    }
  }
}

// Main execution
if (require.main === module) {
  const environment = process.argv[2] || process.env.NODE_ENV || 'development';
  const validator = new DatabaseValidator(environment);
  validator.run();
}

module.exports = DatabaseValidator;