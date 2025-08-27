#!/usr/bin/env node
/**
 * Environment Configuration Validator
 * 
 * This module validates environment-specific configurations and ensures
 * all required settings are properly configured for each environment:
 * - Database connection parameters
 * - Security settings validation
 * - Performance configuration checks
 * - Environment-specific requirements
 * 
 * @author Shiv Dhaam Foundation
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

class EnvironmentValidator {
  constructor(environment = 'development') {
    this.environment = environment;
    this.validationResults = {
      passed: [],
      failed: [],
      warnings: [],
      score: 0
    };

    // Console styling
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

    // Load configuration
    this.config = this.loadConfiguration();
  }

  /**
   * Load database configuration
   */
  loadConfiguration() {
    try {
      const configPath = path.resolve(__dirname, '../src/config/database.js');
      const config = require(configPath);
      
      if (!config[this.environment]) {
        throw new Error(`Configuration for environment '${this.environment}' not found`);
      }

      return config[this.environment];
    } catch (error) {
      this.addFailure('Configuration Loading', `Failed to load database configuration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add validation result
   */
  addSuccess(category, message, details = null) {
    this.validationResults.passed.push({ category, message, details });
    this.validationResults.score += 1;
    this.log('SUCCESS', `✓ ${category}: ${message}`, details);
  }

  addFailure(category, message, details = null) {
    this.validationResults.failed.push({ category, message, details });
    this.log('ERROR', `✗ ${category}: ${message}`, details);
  }

  addWarning(category, message, details = null) {
    this.validationResults.warnings.push({ category, message, details });
    this.log('WARNING', `⚠ ${category}: ${message}`, details);
  }

  /**
   * Enhanced logging
   */
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const levelColors = {
      SUCCESS: this.colors.green,
      WARNING: this.colors.yellow,
      ERROR: this.colors.red,
      INFO: this.colors.cyan,
      DEBUG: this.colors.magenta
    };

    const color = levelColors[level] || this.colors.reset;
    console.log(`${color}[${level}]${this.colors.reset} ${message}`);
    
    if (data) {
      console.log(`${this.colors.blue}Details:${this.colors.reset}`, data);
    }
  }

  /**
   * Validate basic database configuration
   */
  validateBasicConfiguration() {
    const category = 'Basic Configuration';
    
    // Required fields
    const requiredFields = ['username', 'password', 'database', 'host', 'port', 'dialect'];
    
    for (const field of requiredFields) {
      if (!this.config[field]) {
        this.addFailure(category, `Missing required field: ${field}`);
      } else {
        this.addSuccess(category, `Required field present: ${field}`);
      }
    }

    // Validate dialect
    if (this.config.dialect !== 'postgres') {
      this.addWarning(category, `Unexpected dialect: ${this.config.dialect} (expected: postgres)`);
    } else {
      this.addSuccess(category, 'Database dialect is PostgreSQL');
    }

    // Validate port
    const port = parseInt(this.config.port);
    if (isNaN(port) || port < 1 || port > 65535) {
      this.addFailure(category, `Invalid port number: ${this.config.port}`);
    } else if (port === 5432) {
      this.addSuccess(category, 'Using standard PostgreSQL port (5432)');
    } else {
      this.addWarning(category, `Using non-standard PostgreSQL port: ${port}`);
    }
  }

  /**
   * Validate security configuration
   */
  validateSecurityConfiguration() {
    const category = 'Security Configuration';

    // Password validation
    if (this.config.password) {
      if (this.config.password.length < 8) {
        this.addFailure(category, 'Database password is too short (minimum 8 characters)');
      } else {
        this.addSuccess(category, 'Database password length is adequate');
      }

      // Check for default/weak passwords
      const weakPasswords = ['password', '123456', 'admin', 'postgres', 'shivdhaam'];
      if (weakPasswords.includes(this.config.password.toLowerCase())) {
        this.addFailure(category, 'Database password appears to be weak or default');
      } else {
        this.addSuccess(category, 'Database password is not a common weak password');
      }
    }

    // SSL configuration for non-development environments
    if (this.environment !== 'development') {
      if (!this.config.dialectOptions?.ssl) {
        this.addFailure(category, 'SSL not configured for non-development environment');
      } else {
        this.addSuccess(category, 'SSL configuration present for production environment');
        
        if (this.config.dialectOptions.ssl.rejectUnauthorized === false) {
          this.addWarning(category, 'SSL configured to accept unauthorized connections');
        }
      }
    } else {
      this.addSuccess(category, 'SSL not required for development environment');
    }

    // Username validation
    if (this.config.username === 'postgres') {
      if (this.environment === 'production') {
        this.addFailure(category, 'Using superuser account (postgres) in production');
      } else {
        this.addWarning(category, 'Using superuser account (postgres) - consider dedicated user');
      }
    } else {
      this.addSuccess(category, 'Using dedicated database user (not postgres superuser)');
    }
  }

  /**
   * Validate connection pool configuration
   */
  validateConnectionPoolConfiguration() {
    const category = 'Connection Pool';

    if (!this.config.pool) {
      this.addWarning(category, 'No connection pool configuration found');
      return;
    }

    const pool = this.config.pool;

    // Validate pool settings based on environment
    const recommendations = {
      development: { min: 2, max: 10, acquire: 30000, idle: 10000 },
      test: { min: 1, max: 5, acquire: 30000, idle: 10000 },
      staging: { min: 5, max: 15, acquire: 30000, idle: 10000 },
      production: { min: 5, max: 20, acquire: 60000, idle: 300000 }
    };

    const recommended = recommendations[this.environment] || recommendations.development;

    // Check minimum connections
    if (pool.min < recommended.min) {
      this.addWarning(category, `Minimum connections (${pool.min}) below recommended (${recommended.min})`);
    } else if (pool.min > recommended.min * 2) {
      this.addWarning(category, `Minimum connections (${pool.min}) much higher than recommended (${recommended.min})`);
    } else {
      this.addSuccess(category, `Minimum connections (${pool.min}) within recommended range`);
    }

    // Check maximum connections
    if (pool.max < recommended.max * 0.5) {
      this.addWarning(category, `Maximum connections (${pool.max}) below recommended (${recommended.max})`);
    } else if (pool.max > recommended.max * 2) {
      this.addWarning(category, `Maximum connections (${pool.max}) much higher than recommended (${recommended.max})`);
    } else {
      this.addSuccess(category, `Maximum connections (${pool.max}) within recommended range`);
    }

    // Check acquire timeout
    if (pool.acquire < 10000) {
      this.addWarning(category, `Acquire timeout (${pool.acquire}ms) may be too short`);
    } else if (pool.acquire > 120000) {
      this.addWarning(category, `Acquire timeout (${pool.acquire}ms) may be too long`);
    } else {
      this.addSuccess(category, `Acquire timeout (${pool.acquire}ms) is reasonable`);
    }

    // Check idle timeout
    if (this.environment === 'production') {
      if (pool.idle < 60000) {
        this.addWarning(category, `Idle timeout (${pool.idle}ms) may be too short for production`);
      } else {
        this.addSuccess(category, `Idle timeout (${pool.idle}ms) appropriate for production`);
      }
    } else {
      this.addSuccess(category, `Idle timeout (${pool.idle}ms) configured`);
    }
  }

  /**
   * Validate environment-specific requirements
   */
  validateEnvironmentRequirements() {
    const category = 'Environment Requirements';

    switch (this.environment) {
      case 'development':
        this.validateDevelopmentRequirements();
        break;
      case 'test':
        this.validateTestRequirements();
        break;
      case 'staging':
        this.validateStagingRequirements();
        break;
      case 'production':
        this.validateProductionRequirements();
        break;
      default:
        this.addWarning(category, `Unknown environment: ${this.environment}`);
    }
  }

  /**
   * Validate development environment requirements
   */
  validateDevelopmentRequirements() {
    const category = 'Development Environment';

    // Logging should be enabled for development
    if (this.config.logging === false) {
      this.addWarning(category, 'Database logging disabled in development');
    } else {
      this.addSuccess(category, 'Database logging enabled for development');
    }

    // Database name should indicate development
    if (!this.config.database.includes('dev') && !this.config.database.includes('development')) {
      this.addWarning(category, 'Database name does not clearly indicate development environment');
    } else {
      this.addSuccess(category, 'Database name clearly indicates development environment');
    }
  }

  /**
   * Validate test environment requirements
   */
  validateTestRequirements() {
    const category = 'Test Environment';

    // Logging should be disabled for tests
    if (this.config.logging !== false) {
      this.addWarning(category, 'Database logging not disabled for test environment');
    } else {
      this.addSuccess(category, 'Database logging disabled for test environment');
    }

    // Database should be separate from development
    if (this.config.database.includes('dev') || this.config.database === 'shivdhaam') {
      this.addFailure(category, 'Test database may conflict with development database');
    } else {
      this.addSuccess(category, 'Test database is properly separated');
    }

    // Test database should be clearly named
    if (!this.config.database.includes('test')) {
      this.addWarning(category, 'Database name does not clearly indicate test environment');
    } else {
      this.addSuccess(category, 'Database name clearly indicates test environment');
    }
  }

  /**
   * Validate staging environment requirements
   */
  validateStagingRequirements() {
    const category = 'Staging Environment';

    // Should use environment variables
    if (this.config.password && !this.config.password.startsWith('process.env')) {
      this.addWarning(category, 'Hardcoded password detected - should use environment variables');
    } else {
      this.addSuccess(category, 'Using environment variables for sensitive data');
    }

    // Logging should be minimal
    if (this.config.logging === console.log) {
      this.addWarning(category, 'Full logging enabled in staging - consider reducing');
    } else {
      this.addSuccess(category, 'Appropriate logging configuration for staging');
    }
  }

  /**
   * Validate production environment requirements
   */
  validateProductionRequirements() {
    const category = 'Production Environment';

    // All configuration should come from environment variables
    const envVarFields = ['username', 'password', 'database', 'host'];
    for (const field of envVarFields) {
      if (this.config[field] && typeof this.config[field] === 'string' && !this.config[field].includes('process.env')) {
        this.addFailure(category, `Hardcoded ${field} in production configuration`);
      } else {
        this.addSuccess(category, `${field} properly configured via environment variables`);
      }
    }

    // Logging should be disabled or minimal
    if (this.config.logging === console.log) {
      this.addFailure(category, 'Full console logging enabled in production');
    } else if (this.config.logging === false) {
      this.addSuccess(category, 'Database logging disabled for production');
    } else {
      this.addSuccess(category, 'Custom logging configuration for production');
    }

    // SSL should be required
    if (!this.config.dialectOptions?.ssl?.require) {
      this.addFailure(category, 'SSL not required for production database connections');
    } else {
      this.addSuccess(category, 'SSL required for production database connections');
    }

    // Pool configuration should be optimized for production
    if (this.config.pool?.max < 15) {
      this.addWarning(category, 'Maximum connection pool size may be too small for production');
    }
  }

  /**
   * Test actual database connectivity
   */
  async testDatabaseConnection() {
    const category = 'Database Connection';
    
    try {
      const sequelize = new Sequelize(this.config);
      
      // Test basic connection
      await sequelize.authenticate();
      this.addSuccess(category, 'Database connection successful');
      
      // Test query execution
      const [results] = await sequelize.query('SELECT version() as version');
      const version = results[0].version;
      this.addSuccess(category, `PostgreSQL version: ${version.split(' ')[1]}`);
      
      // Test transaction support
      const transaction = await sequelize.transaction();
      await transaction.rollback();
      this.addSuccess(category, 'Transaction support verified');
      
      // Test extensions (if any)
      try {
        const [extensions] = await sequelize.query("SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_trgm')");
        if (extensions.length > 0) {
          this.addSuccess(category, `Extensions available: ${extensions.map(e => e.extname).join(', ')}`);
        } else {
          this.addWarning(category, 'No common extensions found (uuid-ossp, pg_trgm)');
        }
      } catch (error) {
        this.addWarning(category, 'Could not check extensions');
      }
      
      await sequelize.close();
      
    } catch (error) {
      this.addFailure(category, `Connection failed: ${error.message}`);
      
      // Provide specific guidance based on error type
      if (error.message.includes('ECONNREFUSED')) {
        this.addFailure(category, 'PostgreSQL server is not running or not accepting connections');
      } else if (error.message.includes('authentication failed')) {
        this.addFailure(category, 'Authentication failed - check username/password');
      } else if (error.message.includes('database') && error.message.includes('does not exist')) {
        this.addFailure(category, 'Database does not exist - run setup first');
      }
    }
  }

  /**
   * Validate file and directory permissions
   */
  validateFilePermissions() {
    const category = 'File Permissions';
    
    const pathsToCheck = [
      { path: path.resolve(__dirname, '../src/config'), type: 'directory', required: true },
      { path: path.resolve(__dirname, '../src/migrations'), type: 'directory', required: true },
      { path: path.resolve(__dirname, '../src/seeders'), type: 'directory', required: true },
      { path: path.resolve(__dirname, '../backups'), type: 'directory', required: false },
      { path: path.resolve(__dirname, '../logs'), type: 'directory', required: false }
    ];

    for (const item of pathsToCheck) {
      try {
        const stats = fs.statSync(item.path);
        
        if (item.type === 'directory' && !stats.isDirectory()) {
          this.addFailure(category, `${item.path} is not a directory`);
          continue;
        }
        
        if (item.type === 'file' && !stats.isFile()) {
          this.addFailure(category, `${item.path} is not a file`);
          continue;
        }
        
        // Check read permissions
        try {
          fs.accessSync(item.path, fs.constants.R_OK);
          this.addSuccess(category, `Read access to ${path.basename(item.path)}`);
        } catch (error) {
          this.addFailure(category, `No read access to ${item.path}`);
        }
        
        // Check write permissions for directories
        if (item.type === 'directory') {
          try {
            fs.accessSync(item.path, fs.constants.W_OK);
            this.addSuccess(category, `Write access to ${path.basename(item.path)}`);
          } catch (error) {
            this.addWarning(category, `No write access to ${item.path}`);
          }
        }
        
      } catch (error) {
        if (item.required) {
          this.addFailure(category, `Required path not found: ${item.path}`);
        } else {
          this.addWarning(category, `Optional path not found: ${item.path}`);
        }
      }
    }
  }

  /**
   * Run comprehensive validation
   */
  async validate() {
    console.log(`${this.colors.cyan}${this.colors.bright}═══════════════════════════════════════════════════════════════════════════════════════${this.colors.reset}`);
    console.log(`${this.colors.cyan}${this.colors.bright}                           ENVIRONMENT VALIDATION REPORT                            ${this.colors.reset}`);
    console.log(`${this.colors.cyan}${this.colors.bright}═══════════════════════════════════════════════════════════════════════════════════════${this.colors.reset}\n`);
    
    console.log(`${this.colors.blue}Environment:${this.colors.reset} ${this.colors.bright}${this.environment}${this.colors.reset}`);
    console.log(`${this.colors.blue}Timestamp:${this.colors.reset} ${new Date().toISOString()}\n`);

    try {
      // Run all validation checks
      this.validateBasicConfiguration();
      this.validateSecurityConfiguration();
      this.validateConnectionPoolConfiguration();
      this.validateEnvironmentRequirements();
      this.validateFilePermissions();
      await this.testDatabaseConnection();
      
      // Calculate final score
      const totalChecks = this.validationResults.passed.length + this.validationResults.failed.length;
      const scorePercentage = totalChecks > 0 ? Math.round((this.validationResults.passed.length / totalChecks) * 100) : 0;
      
      // Display summary
      this.displayValidationSummary(scorePercentage);
      
      return {
        environment: this.environment,
        score: scorePercentage,
        passed: this.validationResults.passed.length,
        failed: this.validationResults.failed.length,
        warnings: this.validationResults.warnings.length,
        results: this.validationResults
      };
      
    } catch (error) {
      this.addFailure('Validation Process', `Validation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Display validation summary
   */
  displayValidationSummary(scorePercentage) {
    console.log(`\n${this.colors.blue}${this.colors.bright}VALIDATION SUMMARY${this.colors.reset}\n`);
    
    const scoreColor = scorePercentage >= 90 ? this.colors.green :
                      scorePercentage >= 70 ? this.colors.yellow : this.colors.red;
    
    console.log(`${this.colors.cyan}Overall Score:${this.colors.reset} ${scoreColor}${this.colors.bright}${scorePercentage}%${this.colors.reset}`);
    console.log(`${this.colors.green}✓ Passed:${this.colors.reset} ${this.validationResults.passed.length}`);
    console.log(`${this.colors.yellow}⚠ Warnings:${this.colors.reset} ${this.validationResults.warnings.length}`);
    console.log(`${this.colors.red}✗ Failed:${this.colors.reset} ${this.validationResults.failed.length}\n`);
    
    // Show status indicator
    if (scorePercentage >= 90) {
      console.log(`${this.colors.green}${this.colors.bright}🎉 EXCELLENT - Environment is well configured!${this.colors.reset}`);
    } else if (scorePercentage >= 70) {
      console.log(`${this.colors.yellow}${this.colors.bright}⚠️  GOOD - Minor issues found, but environment is usable${this.colors.reset}`);
    } else if (scorePercentage >= 50) {
      console.log(`${this.colors.yellow}${this.colors.bright}⚠️  FAIR - Several issues found, review recommended${this.colors.reset}`);
    } else {
      console.log(`${this.colors.red}${this.colors.bright}❌ POOR - Significant issues found, fixes required${this.colors.reset}`);
    }
    
    // Show critical failures
    if (this.validationResults.failed.length > 0) {
      console.log(`\n${this.colors.red}${this.colors.bright}CRITICAL ISSUES:${this.colors.reset}`);
      this.validationResults.failed.forEach(failure => {
        console.log(`  ${this.colors.red}✗${this.colors.reset} ${failure.category}: ${failure.message}`);
      });
    }
    
    // Show warnings
    if (this.validationResults.warnings.length > 0) {
      console.log(`\n${this.colors.yellow}${this.colors.bright}WARNINGS:${this.colors.reset}`);
      this.validationResults.warnings.forEach(warning => {
        console.log(`  ${this.colors.yellow}⚠${this.colors.reset} ${warning.category}: ${warning.message}`);
      });
    }
    
    console.log(`\n${this.colors.dim}Validation completed at ${new Date().toISOString()}${this.colors.reset}\n`);
  }
}

module.exports = EnvironmentValidator;