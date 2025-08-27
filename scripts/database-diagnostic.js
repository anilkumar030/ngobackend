#!/usr/bin/env node

/**
 * Comprehensive Database Connection Diagnostic Script
 * 
 * This script performs systematic diagnosis of PostgreSQL database connection issues
 * for Sequelize ORM applications. It tests each potential failure point and provides
 * clear, actionable feedback.
 * 
 * Usage: node scripts/database-diagnostic.js [environment] [options]
 * 
 * Examples:
 *   node scripts/database-diagnostic.js                    # Uses current NODE_ENV
 *   node scripts/database-diagnostic.js development        # Tests development environment
 *   node scripts/database-diagnostic.js production         # Tests production environment
 *   node scripts/database-diagnostic.js --verbose          # Detailed output
 *   node scripts/database-diagnostic.js --config-only      # Only validate configuration
 *   node scripts/database-diagnostic.js --network-only     # Only test network connectivity
 */

require('dotenv').config();
const { Client } = require('pg');
const { Sequelize } = require('sequelize');
const net = require('net');
const dns = require('dns').promises;
const path = require('path');
const fs = require('fs').promises;

// Color output utilities
const colors = {
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

// Diagnostic status symbols
const symbols = {
  success: '✓',
  failure: '✗',
  warning: '⚠',
  info: 'ℹ',
  loading: '⏳',
  arrow: '→'
};

/**
 * Database Connection Diagnostic Class
 */
class DatabaseDiagnostic {
  constructor(environment = null, options = {}) {
    this.environment = environment || process.env.NODE_ENV || 'development';
    this.options = {
      verbose: options.verbose || false,
      configOnly: options.configOnly || false,
      networkOnly: options.networkOnly || false,
      skipPermissions: options.skipPermissions || false,
      timeout: options.timeout || 10000,
      ...options
    };
    
    this.results = [];
    this.config = null;
    this.sequelize = null;
    this.pgClient = null;
    this.startTime = Date.now();
    
    // Test categories
    this.categories = {
      environment: 'Environment & Configuration',
      network: 'Network Connectivity',
      authentication: 'Database Authentication',
      database: 'Database Existence & Access',
      permissions: 'User Permissions',
      connection: 'Connection Pool & Settings',
      ssl: 'SSL/TLS Configuration',
      performance: 'Performance & Health'
    };
  }

  /**
   * Add a test result
   */
  addResult(category, test, status, message, details = null, suggestion = null) {
    const result = {
      category,
      test,
      status, // 'success', 'failure', 'warning', 'skip'
      message,
      details,
      suggestion,
      timestamp: new Date().toISOString()
    };
    
    this.results.push(result);
    
    if (this.options.verbose || status === 'failure') {
      this.logResult(result);
    }
  }

  /**
   * Log a test result with appropriate formatting
   */
  logResult(result) {
    const statusColor = {
      success: colors.green,
      failure: colors.red,
      warning: colors.yellow,
      skip: colors.dim
    };
    
    const statusSymbol = {
      success: symbols.success,
      failure: symbols.failure,
      warning: symbols.warning,
      skip: symbols.info
    };
    
    const color = statusColor[result.status] || colors.white;
    const symbol = statusSymbol[result.status] || symbols.info;
    
    console.log(`${color}${symbol} ${result.message}${colors.reset}`);
    
    if (result.details && this.options.verbose) {
      console.log(`  ${colors.dim}${symbols.arrow} ${result.details}${colors.reset}`);
    }
    
    if (result.suggestion && result.status === 'failure') {
      console.log(`  ${colors.yellow}${symbols.arrow} Suggestion: ${result.suggestion}${colors.reset}`);
    }
  }

  /**
   * Load and validate database configuration
   */
  async loadDatabaseConfig() {
    try {
      // Load configuration from database.js
      const dbConfigPath = path.join(__dirname, '../src/config/database.js');
      delete require.cache[require.resolve(dbConfigPath)];
      const dbConfig = require(dbConfigPath);
      
      if (!dbConfig.config || !dbConfig.config[this.environment]) {
        throw new Error(`Configuration for environment '${this.environment}' not found`);
      }
      
      this.config = dbConfig.config[this.environment];
      
      this.addResult(
        'environment',
        'config_loading',
        'success',
        `Configuration loaded for ${this.environment} environment`,
        `Host: ${this.config.host}:${this.config.port}, Database: ${this.config.database}`
      );
      
      return true;
    } catch (error) {
      this.addResult(
        'environment',
        'config_loading',
        'failure',
        'Failed to load database configuration',
        error.message,
        'Check if src/config/database.js exists and exports valid configuration'
      );
      return false;
    }
  }

  /**
   * Validate environment variables
   */
  async validateEnvironmentVariables() {
    const requiredVars = [];
    const optionalVars = [];
    
    // Determine required variables based on configuration
    if (this.config.username && this.config.username.includes('process.env')) {
      requiredVars.push('DB_USERNAME');
    }
    if (this.config.password && this.config.password.includes('process.env')) {
      requiredVars.push('DB_PASSWORD');
    }
    if (this.config.database && this.config.database.includes('process.env')) {
      requiredVars.push('DB_NAME');
    }
    if (this.config.host && this.config.host.includes('process.env')) {
      requiredVars.push('DB_HOST');
    }
    
    optionalVars.push('DB_PORT', 'NODE_ENV');
    
    let missingRequired = [];
    let missingOptional = [];
    
    // Check required variables
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missingRequired.push(varName);
      }
    }
    
    // Check optional variables
    for (const varName of optionalVars) {
      if (!process.env[varName]) {
        missingOptional.push(varName);
      }
    }
    
    if (missingRequired.length > 0) {
      this.addResult(
        'environment',
        'env_variables',
        'failure',
        'Required environment variables are missing',
        `Missing: ${missingRequired.join(', ')}`,
        'Set the missing environment variables in your .env file'
      );
      return false;
    }
    
    if (missingOptional.length > 0) {
      this.addResult(
        'environment',
        'env_variables',
        'warning',
        'Optional environment variables are missing',
        `Missing: ${missingOptional.join(', ')}`,
        'Consider setting these variables for better configuration control'
      );
    }
    
    this.addResult(
      'environment',
      'env_variables',
      'success',
      'Environment variables validation passed',
      `Checked ${requiredVars.length} required and ${optionalVars.length} optional variables`
    );
    
    return true;
  }

  /**
   * Test DNS resolution for database host
   */
  async testDNSResolution() {
    try {
      const host = this.config.host;
      
      if (host === 'localhost' || host === '127.0.0.1') {
        this.addResult(
          'network',
          'dns_resolution',
          'success',
          'Using localhost - DNS resolution not required',
          `Host: ${host}`
        );
        return true;
      }
      
      const addresses = await dns.lookup(host);
      
      this.addResult(
        'network',
        'dns_resolution',
        'success',
        'DNS resolution successful',
        `${host} resolves to ${addresses.address}`
      );
      
      return true;
    } catch (error) {
      this.addResult(
        'network',
        'dns_resolution',
        'failure',
        'DNS resolution failed',
        `Cannot resolve ${this.config.host}: ${error.message}`,
        'Check if the hostname is correct and DNS is properly configured'
      );
      return false;
    }
  }

  /**
   * Test network connectivity to database host and port
   */
  async testNetworkConnectivity() {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        this.addResult(
          'network',
          'connectivity',
          'failure',
          'Network connectivity test timed out',
          `Cannot connect to ${this.config.host}:${this.config.port}`,
          'Check firewall settings, network connectivity, and ensure PostgreSQL is running'
        );
        resolve(false);
      }, this.options.timeout);

      socket.connect(this.config.port, this.config.host, () => {
        clearTimeout(timeout);
        socket.destroy();
        this.addResult(
          'network',
          'connectivity',
          'success',
          'Network connectivity successful',
          `Successfully connected to ${this.config.host}:${this.config.port}`
        );
        resolve(true);
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        socket.destroy();
        this.addResult(
          'network',
          'connectivity',
          'failure',
          'Network connectivity failed',
          `${error.code}: ${error.message}`,
          this.getNetworkErrorSuggestion(error.code)
        );
        resolve(false);
      });
    });
  }

  /**
   * Get suggestion based on network error code
   */
  getNetworkErrorSuggestion(errorCode) {
    const suggestions = {
      'ENOTFOUND': 'Check if hostname is correct and DNS is configured',
      'ECONNREFUSED': 'Ensure PostgreSQL is running and listening on the specified port',
      'ETIMEDOUT': 'Check firewall settings and network connectivity',
      'ENETUNREACH': 'Check network routing and connectivity',
      'ECONNRESET': 'Connection was reset - check server configuration'
    };
    
    return suggestions[errorCode] || 'Check network connectivity and server configuration';
  }

  /**
   * Test PostgreSQL service availability
   */
  async testPostgreSQLService() {
    // Strategy: Test PostgreSQL service without authentication first
    // This avoids SCRAM authentication issues while still confirming the service is running
    
    try {
      // First, try to connect without authentication (will likely fail but confirms service is running)
      const testClient = new Client({
        host: this.config.host,
        port: this.config.port,
        user: 'postgres',
        password: null, // Explicitly set to null instead of empty string to avoid SCRAM issues
        database: 'postgres',
        connectionTimeoutMillis: this.options.timeout,
        ssl: this.config.dialectOptions?.ssl || false
      });

      await testClient.connect();
      
      // Test PostgreSQL version if connection succeeds
      const versionResult = await testClient.query('SELECT version()');
      const version = versionResult.rows[0].version;
      
      await testClient.end();
      
      this.addResult(
        'network',
        'postgresql_service',
        'success',
        'PostgreSQL service is running',
        version.split(' ').slice(0, 2).join(' ')
      );
      
      return true;
    } catch (error) {
      // Handle specific authentication and connection errors
      if (error.code === '28P01' || error.code === '28000') {
        // Authentication failed - but PostgreSQL is running and accessible
        this.addResult(
          'network',
          'postgresql_service',
          'success',
          'PostgreSQL service is running (authentication required)',
          'Service is accessible but requires proper credentials'
        );
        return true;
      } else if (error.code === '3D000') {
        // Database doesn't exist - but PostgreSQL is running
        this.addResult(
          'network',
          'postgresql_service',
          'success',
          'PostgreSQL service is running (postgres database not found)',
          'Service is accessible - will test with configured credentials'
        );
        return true;
      } else if (error.message && error.message.includes('SASL') || error.message && error.message.includes('SCRAM')) {
        // SCRAM authentication error - PostgreSQL is running but requires proper authentication
        this.addResult(
          'network',
          'postgresql_service',
          'success',
          'PostgreSQL service is running (SCRAM authentication enabled)',
          'Service uses SCRAM-SHA-256 authentication - will test with configured credentials'
        );
        return true;
      } else if (error.code === 'ECONNREFUSED') {
        // Connection refused - PostgreSQL is not running
        this.addResult(
          'network',
          'postgresql_service',
          'failure',
          'PostgreSQL service is not running',
          'Connection refused - PostgreSQL server is not accepting connections',
          'Start PostgreSQL service: sudo systemctl start postgresql'
        );
        return false;
      } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        // Network issues
        this.addResult(
          'network',
          'postgresql_service',
          'failure',
          'Cannot reach PostgreSQL service',
          `Network error: ${error.message}`,
          'Check hostname and network connectivity'
        );
        return false;
      }
      
      // Fallback: try to determine if it's a service issue or authentication issue
      const isNetworkError = error.code && ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH'].includes(error.code);
      
      if (isNetworkError) {
        this.addResult(
          'network',
          'postgresql_service',
          'failure',
          'PostgreSQL service is not accessible',
          `${error.code || 'Unknown'}: ${error.message}`,
          'Ensure PostgreSQL is installed, running, and configured to accept connections'
        );
        return false;
      } else {
        // Likely an authentication or permission issue, which means PostgreSQL is running
        this.addResult(
          'network',
          'postgresql_service',
          'success',
          'PostgreSQL service is running (connection details need verification)',
          `Authentication/permission issue detected: ${error.message}`,
          'Service appears to be running - will verify with configured credentials'
        );
        return true;
      }
    }
  }

  /**
   * Test database user credentials
   */
  async testUserCredentials() {
    try {
      this.pgClient = new Client({
        host: this.config.host,
        port: this.config.port,
        user: this.config.username,
        password: this.config.password,
        database: 'postgres', // Connect to default database first
        connectionTimeoutMillis: this.options.timeout,
        ssl: this.config.dialectOptions?.ssl || false
      });

      await this.pgClient.connect();
      
      this.addResult(
        'authentication',
        'credentials',
        'success',
        'Database user credentials are valid',
        `Successfully authenticated as ${this.config.username}`
      );
      
      return true;
    } catch (error) {
      let suggestion = 'Check username and password in your configuration';
      
      if (error.code === '28P01') {
        suggestion = 'Password authentication failed - verify the password';
      } else if (error.code === '28000') {
        suggestion = 'User does not exist or account is disabled';
      }
      
      this.addResult(
        'authentication',
        'credentials',
        'failure',
        'Database user credential verification failed',
        `${error.code}: ${error.message}`,
        suggestion
      );
      return false;
    }
  }

  /**
   * Test if target database exists
   */
  async testDatabaseExists() {
    if (!this.pgClient) {
      this.addResult(
        'database',
        'existence',
        'skip',
        'Database existence check skipped - no authenticated connection'
      );
      return false;
    }

    try {
      const result = await this.pgClient.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [this.config.database]
      );
      
      if (result.rows.length > 0) {
        this.addResult(
          'database',
          'existence',
          'success',
          'Target database exists',
          `Database '${this.config.database}' found`
        );
        return true;
      } else {
        this.addResult(
          'database',
          'existence',
          'failure',
          'Target database does not exist',
          `Database '${this.config.database}' not found`,
          `Create the database: CREATE DATABASE ${this.config.database};`
        );
        return false;
      }
    } catch (error) {
      this.addResult(
        'database',
        'existence',
        'failure',
        'Failed to check database existence',
        error.message,
        'Ensure you have permission to query pg_database'
      );
      return false;
    }
  }

  /**
   * Test database connection with target database
   */
  async testTargetDatabaseConnection() {
    try {
      // Close existing connection
      if (this.pgClient) {
        await this.pgClient.end();
      }
      
      // Connect directly to target database
      this.pgClient = new Client({
        host: this.config.host,
        port: this.config.port,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
        connectionTimeoutMillis: this.options.timeout,
        ssl: this.config.dialectOptions?.ssl || false
      });

      await this.pgClient.connect();
      
      this.addResult(
        'database',
        'target_connection',
        'success',
        'Successfully connected to target database',
        `Connected to ${this.config.database}`
      );
      
      return true;
    } catch (error) {
      let suggestion = 'Check if database exists and user has access rights';
      
      if (error.code === '3D000') {
        suggestion = `Database '${this.config.database}' does not exist - create it first`;
      } else if (error.code === '42501') {
        suggestion = `User '${this.config.username}' does not have permission to connect to '${this.config.database}'`;
      }
      
      this.addResult(
        'database',
        'target_connection',
        'failure',
        'Cannot connect to target database',
        `${error.code}: ${error.message}`,
        suggestion
      );
      return false;
    }
  }

  /**
   * Test user permissions
   */
  async testUserPermissions() {
    if (!this.pgClient || this.options.skipPermissions) {
      this.addResult(
        'permissions',
        'user_permissions',
        'skip',
        'User permissions check skipped'
      );
      return false;
    }

    const permissions = {
      select: false,
      insert: false,
      update: false,
      delete: false,
      create: false,
      schema: false
    };

    try {
      // Test SELECT permission
      try {
        await this.pgClient.query('SELECT 1');
        permissions.select = true;
      } catch (error) {
        if (error.code !== '42501') throw error;
      }

      // Test CREATE permission on database
      try {
        await this.pgClient.query('CREATE TABLE test_permissions_temp (id INTEGER)');
        await this.pgClient.query('DROP TABLE test_permissions_temp');
        permissions.create = true;
        permissions.insert = true;
        permissions.update = true;
        permissions.delete = true;
      } catch (error) {
        if (error.code !== '42501') {
          // If error is not permission denied, log it
          if (this.options.verbose) {
            console.log(`Permission test error: ${error.message}`);
          }
        }
      }

      // Check schema permissions
      try {
        const schemaResult = await this.pgClient.query(
          `SELECT schema_name FROM information_schema.schemata 
           WHERE schema_owner = $1 OR schema_name = 'public'`,
          [this.config.username]
        );
        permissions.schema = schemaResult.rows.length > 0;
      } catch (error) {
        // Ignore schema check errors
      }

      const permissionList = Object.entries(permissions)
        .filter(([key, value]) => value)
        .map(([key]) => key.toUpperCase());

      if (permissionList.length > 0) {
        this.addResult(
          'permissions',
          'user_permissions',
          'success',
          'User has database permissions',
          `Permissions: ${permissionList.join(', ')}`
        );
      } else {
        this.addResult(
          'permissions',
          'user_permissions',
          'failure',
          'User has insufficient permissions',
          'No basic permissions detected',
          `Grant necessary permissions: GRANT ALL PRIVILEGES ON DATABASE ${this.config.database} TO ${this.config.username};`
        );
      }

      return permissionList.length > 0;
    } catch (error) {
      this.addResult(
        'permissions',
        'user_permissions',
        'warning',
        'Could not fully test user permissions',
        error.message
      );
      return false;
    }
  }

  /**
   * Test Sequelize connection
   */
  async testSequelizeConnection() {
    try {
      this.sequelize = new Sequelize(
        this.config.database,
        this.config.username,
        this.config.password,
        {
          ...this.config,
          logging: false, // Disable logging for test
          retry: {
            max: 1
          }
        }
      );

      await this.sequelize.authenticate();
      
      this.addResult(
        'connection',
        'sequelize',
        'success',
        'Sequelize connection successful',
        'ORM connection established successfully'
      );
      
      return true;
    } catch (error) {
      this.addResult(
        'connection',
        'sequelize',
        'failure',
        'Sequelize connection failed',
        error.message,
        'Check database configuration and network connectivity'
      );
      return false;
    }
  }

  /**
   * Test connection pool settings
   */
  async testConnectionPool() {
    if (!this.sequelize) {
      this.addResult(
        'connection',
        'pool',
        'skip',
        'Connection pool test skipped - no Sequelize instance'
      );
      return false;
    }

    try {
      const pool = this.sequelize.connectionManager.pool;
      const poolConfig = this.config.pool || {};
      
      const poolInfo = {
        size: pool ? pool.size : 'N/A',
        available: pool ? pool.available : 'N/A',
        used: pool ? pool.used : 'N/A',
        pending: pool ? pool.pending : 'N/A'
      };
      
      this.addResult(
        'connection',
        'pool',
        'success',
        'Connection pool is configured',
        `Pool settings - Min: ${poolConfig.min}, Max: ${poolConfig.max}, Current: ${poolInfo.size}`
      );
      
      return true;
    } catch (error) {
      this.addResult(
        'connection',
        'pool',
        'warning',
        'Could not retrieve connection pool information',
        error.message
      );
      return false;
    }
  }

  /**
   * Test SSL configuration
   */
  async testSSLConfiguration() {
    const sslConfig = this.config.dialectOptions?.ssl;
    
    if (!sslConfig) {
      this.addResult(
        'ssl',
        'configuration',
        'success',
        'SSL is not configured (using plain connection)',
        'No SSL configuration found - using unencrypted connection'
      );
      return true;
    }

    try {
      // Test SSL connection
      const sslClient = new Client({
        host: this.config.host,
        port: this.config.port,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
        ssl: sslConfig,
        connectionTimeoutMillis: this.options.timeout
      });

      await sslClient.connect();
      
      // Query SSL status
      const sslResult = await sslClient.query('SELECT ssl_is_used()');
      const sslUsed = sslResult.rows[0].ssl_is_used;
      
      await sslClient.end();
      
      this.addResult(
        'ssl',
        'configuration',
        'success',
        'SSL connection successful',
        `SSL is ${sslUsed ? 'active' : 'not active'}, rejectUnauthorized: ${sslConfig.rejectUnauthorized}`
      );
      
      return true;
    } catch (error) {
      this.addResult(
        'ssl',
        'configuration',
        'failure',
        'SSL connection failed',
        error.message,
        'Check SSL certificates and server SSL configuration'
      );
      return false;
    }
  }

  /**
   * Test database performance
   */
  async testDatabasePerformance() {
    if (!this.pgClient) {
      this.addResult(
        'performance',
        'health_check',
        'skip',
        'Performance test skipped - no database connection'
      );
      return false;
    }

    try {
      // Test basic query performance
      const startTime = Date.now();
      await this.pgClient.query('SELECT NOW(), version(), current_database()');
      const queryTime = Date.now() - startTime;
      
      let status = 'success';
      if (queryTime > 1000) {
        status = 'warning';
      }
      
      this.addResult(
        'performance',
        'query_performance',
        status,
        'Database query performance test',
        `Simple query took ${queryTime}ms`,
        queryTime > 1000 ? 'Query response is slow - check database performance' : null
      );
      
      // Check database size (if permission available)
      try {
        const sizeResult = await this.pgClient.query(
          `SELECT pg_size_pretty(pg_database_size($1)) as size`,
          [this.config.database]
        );
        
        this.addResult(
          'performance',
          'database_size',
          'success',
          'Database size information',
          `Database size: ${sizeResult.rows[0].size}`
        );
      } catch (error) {
        // Ignore if we can't get size info
      }
      
      return true;
    } catch (error) {
      this.addResult(
        'performance',
        'health_check',
        'warning',
        'Performance test failed',
        error.message
      );
      return false;
    }
  }

  /**
   * Run all diagnostic tests
   */
  async runDiagnostic() {
    console.log(`${colors.bright}${colors.blue}🔍 Database Connection Diagnostic${colors.reset}`);
    console.log(`${colors.dim}Environment: ${this.environment}${colors.reset}`);
    console.log(`${colors.dim}Started: ${new Date().toISOString()}${colors.reset}\n`);

    // Load configuration
    const configLoaded = await this.loadDatabaseConfig();
    if (!configLoaded) {
      return this.generateReport();
    }

    // Validate environment variables
    await this.validateEnvironmentVariables();

    if (this.options.configOnly) {
      return this.generateReport();
    }

    // Network tests
    await this.testDNSResolution();
    await this.testNetworkConnectivity();
    await this.testPostgreSQLService();

    if (this.options.networkOnly) {
      return this.generateReport();
    }

    // Authentication tests
    const credentialsValid = await this.testUserCredentials();
    if (!credentialsValid) {
      return this.generateReport();
    }

    // Database tests
    await this.testDatabaseExists();
    const targetConnected = await this.testTargetDatabaseConnection();
    
    if (targetConnected) {
      await this.testUserPermissions();
      await this.testDatabasePerformance();
    }

    // Connection tests
    await this.testSequelizeConnection();
    await this.testConnectionPool();
    await this.testSSLConfiguration();

    return this.generateReport();
  }

  /**
   * Generate diagnostic report
   */
  generateReport() {
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    
    console.log(`\n${colors.bright}${colors.blue}📊 Diagnostic Report${colors.reset}`);
    console.log('='.repeat(60));
    
    // Group results by category
    const groupedResults = this.results.reduce((groups, result) => {
      if (!groups[result.category]) {
        groups[result.category] = [];
      }
      groups[result.category].push(result);
      return groups;
    }, {});

    // Count results by status
    const statusCounts = this.results.reduce((counts, result) => {
      counts[result.status] = (counts[result.status] || 0) + 1;
      return counts;
    }, {});

    // Display results by category
    Object.entries(groupedResults).forEach(([category, results]) => {
      const categoryName = this.categories[category] || category;
      console.log(`\n${colors.bright}${categoryName}${colors.reset}`);
      
      results.forEach(result => {
        this.logResult(result);
      });
    });

    // Summary
    console.log(`\n${colors.bright}Summary${colors.reset}`);
    console.log('─'.repeat(30));
    console.log(`${colors.green}${symbols.success} Passed: ${statusCounts.success || 0}${colors.reset}`);
    console.log(`${colors.yellow}${symbols.warning} Warnings: ${statusCounts.warning || 0}${colors.reset}`);
    console.log(`${colors.red}${symbols.failure} Failed: ${statusCounts.failure || 0}${colors.reset}`);
    console.log(`${colors.dim}${symbols.info} Skipped: ${statusCounts.skip || 0}${colors.reset}`);
    console.log(`${colors.dim}Duration: ${duration}ms${colors.reset}`);

    // Overall status
    const hasFailures = statusCounts.failure > 0;
    const hasWarnings = statusCounts.warning > 0;
    
    let overallStatus = 'success';
    let overallMessage = 'All tests passed successfully';
    
    if (hasFailures) {
      overallStatus = 'failure';
      overallMessage = 'Some critical tests failed - database connection will not work';
    } else if (hasWarnings) {
      overallStatus = 'warning';
      overallMessage = 'Tests passed with warnings - connection may work with limitations';
    }

    console.log(`\n${colors.bright}Overall Status: ${colors.reset}${statusCounts.failure > 0 ? colors.red + 'FAILED' : statusCounts.warning > 0 ? colors.yellow + 'WARNING' : colors.green + 'PASSED'}${colors.reset}`);
    console.log(`${colors.dim}${overallMessage}${colors.reset}`);

    // Cleanup
    this.cleanup();

    return {
      status: overallStatus,
      results: this.results,
      summary: statusCounts,
      duration,
      environment: this.environment
    };
  }

  /**
   * Cleanup connections
   */
  async cleanup() {
    try {
      if (this.pgClient) {
        await this.pgClient.end();
      }
      if (this.sequelize) {
        await this.sequelize.close();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Command line interface
 */
async function main() {
  const args = process.argv.slice(2);
  const environment = args.find(arg => !arg.startsWith('--')) || process.env.NODE_ENV || 'development';
  
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    configOnly: args.includes('--config-only'),
    networkOnly: args.includes('--network-only'),
    skipPermissions: args.includes('--skip-permissions'),
    timeout: parseInt(args.find(arg => arg.startsWith('--timeout='))?.split('=')[1]) || 10000
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${colors.bright}Database Connection Diagnostic Script${colors.reset}

Usage: node scripts/database-diagnostic.js [environment] [options]

Environments:
  development   Test development environment (default)
  staging       Test staging environment  
  production    Test production environment
  test          Test testing environment

Options:
  --verbose, -v         Show detailed output
  --config-only         Only validate configuration
  --network-only        Only test network connectivity
  --skip-permissions    Skip permission checks
  --timeout=<ms>        Connection timeout in milliseconds (default: 10000)
  --help, -h            Show this help message

Examples:
  node scripts/database-diagnostic.js
  node scripts/database-diagnostic.js production --verbose
  node scripts/database-diagnostic.js --config-only
  node scripts/database-diagnostic.js development --network-only
    `);
    return;
  }

  try {
    const diagnostic = new DatabaseDiagnostic(environment, options);
    const report = await diagnostic.runDiagnostic();
    
    // Exit with appropriate code
    process.exit(report.status === 'failure' ? 1 : 0);
  } catch (error) {
    console.error(`${colors.red}${symbols.failure} Diagnostic script failed: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = DatabaseDiagnostic;