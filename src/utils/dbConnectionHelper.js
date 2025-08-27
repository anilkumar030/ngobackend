/**
 * Database Connection Helper Utilities
 * 
 * This module provides utilities for handling PostgreSQL connections with proper
 * password handling, SCRAM authentication support, and connection validation.
 * 
 * @author Claude Code Assistant
 * @created 2025-08-14
 */

const { Client } = require('pg');
const { Sequelize } = require('sequelize');

/**
 * PostgreSQL Connection Helper Class
 * Handles SCRAM authentication and connection validation properly
 */
class PostgreSQLConnectionHelper {
  /**
   * Create a PostgreSQL client with proper password handling
   * @param {Object} config - Database configuration
   * @param {string} config.host - Database host
   * @param {number} config.port - Database port
   * @param {string} config.username - Database username
   * @param {string} config.password - Database password
   * @param {string} config.database - Database name
   * @param {Object} config.ssl - SSL configuration
   * @param {number} timeout - Connection timeout in milliseconds
   * @returns {Client} PostgreSQL client instance
   */
  static createClient(config, timeout = 10000) {
    // Ensure password is properly handled for SCRAM authentication
    const clientConfig = {
      host: config.host,
      port: config.port,
      user: config.username,
      database: config.database,
      connectionTimeoutMillis: timeout,
      ssl: config.ssl || false
    };

    // Only set password if it's provided and not empty
    // This prevents SCRAM authentication errors with empty passwords
    if (config.password !== null && config.password !== undefined && config.password !== '') {
      clientConfig.password = String(config.password); // Ensure it's a string
    } else {
      // For connections that don't require passwords (like peer authentication)
      // Don't set the password field at all
      clientConfig.password = null;
    }

    return new Client(clientConfig);
  }

  /**
   * Test database connectivity with proper error handling
   * @param {Object} config - Database configuration
   * @param {number} timeout - Connection timeout
   * @returns {Promise<Object>} Connection test result
   */
  static async testConnection(config, timeout = 10000) {
    const client = this.createClient(config, timeout);
    const result = {
      success: false,
      error: null,
      details: {},
      suggestions: []
    };

    try {
      await client.connect();
      
      // Test basic query
      const versionResult = await client.query('SELECT version(), current_database(), current_user');
      const row = versionResult.rows[0];
      
      result.success = true;
      result.details = {
        version: row.version.split(' ').slice(0, 2).join(' '),
        database: row.current_database,
        user: row.current_user,
        host: config.host,
        port: config.port
      };

      await client.end();
      return result;
    } catch (error) {
      result.error = error;
      result.details.errorCode = error.code;
      result.details.errorMessage = error.message;
      
      // Provide specific suggestions based on error type
      result.suggestions = this.getErrorSuggestions(error);
      
      try {
        await client.end();
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      return result;
    }
  }

  /**
   * Get appropriate suggestions based on error type
   * @param {Error} error - Database connection error
   * @returns {Array<string>} Array of suggestion strings
   */
  static getErrorSuggestions(error) {
    const suggestions = [];

    switch (error.code) {
      case '28P01':
        suggestions.push('Password authentication failed - verify the password');
        suggestions.push('Check if the user account is active and not locked');
        break;
      
      case '28000':
        suggestions.push('User does not exist or account is disabled');
        suggestions.push('Create the user or enable the account');
        break;
      
      case '3D000':
        suggestions.push(`Database does not exist - create it with: CREATE DATABASE ${error.database || 'your_database'};`);
        break;
      
      case '42501':
        suggestions.push('User does not have permission to connect to the database');
        suggestions.push('Grant connection privileges to the user');
        break;
      
      case 'ECONNREFUSED':
        suggestions.push('PostgreSQL server is not running');
        suggestions.push('Start PostgreSQL: sudo systemctl start postgresql');
        break;
      
      case 'ENOTFOUND':
        suggestions.push('Cannot resolve hostname - check if the host is correct');
        suggestions.push('Verify DNS configuration');
        break;
      
      case 'ETIMEDOUT':
        suggestions.push('Connection timeout - check network connectivity');
        suggestions.push('Verify firewall settings');
        break;
      
      default:
        if (error.message && error.message.includes('SASL')) {
          suggestions.push('SCRAM authentication error - ensure password is provided as a string');
          suggestions.push('Check if PostgreSQL is configured for SCRAM-SHA-256 authentication');
        } else if (error.message && error.message.includes('SCRAM')) {
          suggestions.push('SCRAM authentication method requires proper password encoding');
          suggestions.push('Ensure the password is not null or empty when using SCRAM');
        } else {
          suggestions.push('Check database configuration and network connectivity');
        }
        break;
    }

    return suggestions;
  }

  /**
   * Validate Sequelize configuration for PostgreSQL
   * @param {Object} config - Sequelize configuration
   * @returns {Object} Validation result
   */
  static validateSequelizeConfig(config) {
    const issues = [];
    const recommendations = [];

    // Check dialect
    if (config.dialect !== 'postgres') {
      issues.push('Dialect must be "postgres" for PostgreSQL');
    }

    // Check required fields
    const requiredFields = ['username', 'database', 'host'];
    requiredFields.forEach(field => {
      if (!config[field]) {
        issues.push(`Missing required field: ${field}`);
      }
    });

    // Check password handling
    if (config.password === '') {
      recommendations.push('Empty password detected - consider using null instead for peer authentication');
    }

    // Check pool configuration
    if (config.pool) {
      if (config.pool.max < config.pool.min) {
        issues.push('Pool max must be greater than or equal to min');
      }
      if (config.pool.max > 50) {
        recommendations.push('Pool max > 50 may cause connection exhaustion');
      }
    } else {
      recommendations.push('Consider adding pool configuration for better performance');
    }

    // Check SSL configuration
    if (config.dialectOptions?.ssl) {
      if (config.dialectOptions.ssl.rejectUnauthorized === false) {
        recommendations.push('SSL rejectUnauthorized: false is insecure for production');
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Create a properly configured Sequelize instance
   * @param {Object} config - Database configuration
   * @returns {Sequelize} Configured Sequelize instance
   */
  static createSequelizeInstance(config) {
    const validation = this.validateSequelizeConfig(config);
    
    if (!validation.valid) {
      throw new Error(`Invalid Sequelize configuration: ${validation.issues.join(', ')}`);
    }

    // Create enhanced configuration with proper defaults
    const enhancedConfig = {
      ...config,
      pool: {
        max: 10,
        min: 2,
        acquire: 30000,
        idle: 10000,
        ...config.pool
      },
      define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        ...config.define
      },
      logging: config.logging !== undefined ? config.logging : console.log,
      retry: {
        max: 3,
        ...config.retry
      }
    };

    return new Sequelize(
      enhancedConfig.database,
      enhancedConfig.username,
      enhancedConfig.password,
      enhancedConfig
    );
  }

  /**
   * Test Sequelize connection with comprehensive error handling
   * @param {Sequelize} sequelize - Sequelize instance
   * @returns {Promise<Object>} Connection test result
   */
  static async testSequelizeConnection(sequelize) {
    const result = {
      success: false,
      error: null,
      details: {},
      suggestions: []
    };

    try {
      await sequelize.authenticate();
      
      // Get connection details
      const [results] = await sequelize.query('SELECT version(), current_database(), current_user');
      const row = results[0];
      
      result.success = true;
      result.details = {
        version: row.version.split(' ').slice(0, 2).join(' '),
        database: row.current_database,
        user: row.current_user,
        dialect: sequelize.getDialect(),
        poolSize: sequelize.connectionManager.pool?.size || 'N/A'
      };

      return result;
    } catch (error) {
      result.error = error;
      result.details.errorMessage = error.message;
      result.suggestions = this.getErrorSuggestions(error);
      
      return result;
    }
  }
}

module.exports = {
  PostgreSQLConnectionHelper
};