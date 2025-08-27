#!/usr/bin/env node
/**
 * Database Status Checker - Health and Configuration Validator
 * 
 * This script provides comprehensive database status information:
 * - Connection status and performance
 * - Table counts and data statistics
 * - Migration and seeder status
 * - Configuration validation
 * - Performance metrics
 * 
 * Usage: node scripts/db-status.js [environment] [options]
 * Example: node scripts/db-status.js development --detailed
 */

const DatabaseInstaller = require('./DatabaseInstaller');
const { Sequelize } = require('sequelize');

class DatabaseStatusChecker extends DatabaseInstaller {
  constructor(options = {}) {
    super(options);
    this.statusData = {};
  }

  /**
   * Test connection performance
   */
  async checkConnectionPerformance() {
    this.logStep('Testing connection performance');
    
    const tests = [];
    const iterations = 5;

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      try {
        await this.sequelize.authenticate();
        tests.push(Date.now() - start);
      } catch (error) {
        tests.push(-1); // Error
      }
    }

    const validTests = tests.filter(t => t > 0);
    const avg = validTests.length > 0 ? validTests.reduce((a, b) => a + b, 0) / validTests.length : -1;
    const min = validTests.length > 0 ? Math.min(...validTests) : -1;
    const max = validTests.length > 0 ? Math.max(...validTests) : -1;

    return {
      successful: validTests.length,
      failed: tests.filter(t => t < 0).length,
      average: avg,
      min,
      max,
      status: validTests.length === iterations ? 'excellent' : 
              validTests.length >= iterations * 0.8 ? 'good' : 
              validTests.length > 0 ? 'poor' : 'failed'
    };
  }

  /**
   * Check database and table information
   */
  async checkDatabaseInfo() {
    this.logStep('Gathering database information');
    
    try {
      // Database size and statistics
      const [dbInfo] = await this.sequelize.query(`
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as database_size,
          current_database() as database_name,
          current_user as current_user,
          version() as postgresql_version
      `);

      // Table information
      const [tables] = await this.sequelize.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_stat_get_tuples_fetched(c.oid) as reads,
          pg_stat_get_tuples_inserted(c.oid) as inserts,
          pg_stat_get_tuples_updated(c.oid) as updates,
          pg_stat_get_tuples_deleted(c.oid) as deletes
        FROM pg_tables pt
        JOIN pg_class c ON c.relname = pt.tablename
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);

      // Row counts for major tables
      const tableQueries = [
        'users', 'campaigns', 'donations', 'products', 'orders', 
        'blog_posts', 'events', 'projects', 'testimonials'
      ];

      const rowCounts = {};
      for (const table of tableQueries) {
        try {
          const [count] = await this.sequelize.query(`SELECT COUNT(*) as count FROM ${table}`);
          rowCounts[table] = parseInt(count[0].count);
        } catch (error) {
          rowCounts[table] = 'N/A';
        }
      }

      return {
        database: dbInfo[0],
        tables: tables,
        rowCounts: rowCounts,
        tableCount: tables.length
      };
    } catch (error) {
      this.logError('Failed to gather database information', error);
      return null;
    }
  }

  /**
   * Check migration status
   */
  async checkMigrationStatus() {
    this.logStep('Checking migration status');
    
    try {
      // Get all migration files
      const fs = require('fs').promises;
      const path = require('path');
      const migrationsDir = path.resolve(__dirname, '../src/migrations');
      const migrationFiles = (await fs.readdir(migrationsDir))
        .filter(file => file.endsWith('.js'))
        .sort();

      // Get executed migrations
      const [executedMigrations] = await this.sequelize.query(
        'SELECT name FROM "SequelizeMeta" ORDER BY name'
      );
      const executedNames = executedMigrations.map(m => m.name);

      const pending = migrationFiles.filter(file => !executedNames.includes(file));

      return {
        total: migrationFiles.length,
        executed: executedNames.length,
        pending: pending.length,
        pendingMigrations: pending,
        executedMigrations: executedNames,
        status: pending.length === 0 ? 'up-to-date' : 'pending'
      };
    } catch (error) {
      this.logError('Failed to check migration status', error);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Check seeder status
   */
  async checkSeederStatus() {
    this.logStep('Checking seeder status');
    
    try {
      // Get all seeder files
      const fs = require('fs').promises;
      const path = require('path');
      const seedersDir = path.resolve(__dirname, '../src/seeders');
      const seederFiles = (await fs.readdir(seedersDir))
        .filter(file => file.endsWith('.js'))
        .sort();

      // Get executed seeders
      let executedSeeders = [];
      try {
        const [seeders] = await this.sequelize.query(
          'SELECT name FROM "SequelizeData" ORDER BY name'
        );
        executedSeeders = seeders.map(s => s.name);
      } catch (error) {
        // SequelizeData table doesn't exist
      }

      const pending = seederFiles.filter(file => !executedSeeders.includes(file));

      return {
        total: seederFiles.length,
        executed: executedSeeders.length,
        pending: pending.length,
        pendingSeeders: pending,
        executedSeeders: executedSeeders,
        status: pending.length === 0 ? 'up-to-date' : 'pending'
      };
    } catch (error) {
      this.logError('Failed to check seeder status', error);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Check PostgreSQL extensions
   */
  async checkExtensions() {
    this.logStep('Checking PostgreSQL extensions');
    
    try {
      const [extensions] = await this.sequelize.query(`
        SELECT extname, extversion 
        FROM pg_extension 
        WHERE extname IN ('uuid-ossp', 'pg_trgm', 'btree_gin', 'unaccent')
        ORDER BY extname
      `);

      const requiredExtensions = ['uuid-ossp', 'pg_trgm', 'btree_gin', 'unaccent'];
      const installedNames = extensions.map(ext => ext.extname);
      const missing = requiredExtensions.filter(ext => !installedNames.includes(ext));

      return {
        installed: extensions,
        missing: missing,
        status: missing.length === 0 ? 'complete' : 'incomplete'
      };
    } catch (error) {
      this.logError('Failed to check extensions', error);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Check indexes and performance
   */
  async checkIndexes() {
    this.logStep('Checking database indexes');
    
    try {
      const [indexes] = await this.sequelize.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
      `);

      // Check for missing important indexes
      const [unusedIndexes] = await this.sequelize.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          pg_stat_get_blocks_hit(indexrelid) as hits,
          pg_stat_get_blocks_read(indexrelid) as reads
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        AND pg_stat_get_blocks_hit(indexrelid) = 0
        AND pg_stat_get_blocks_read(indexrelid) = 0
      `);

      return {
        total: indexes.length,
        indexes: this.options.detailed ? indexes : indexes.length,
        unusedCount: unusedIndexes.length,
        unused: this.options.detailed ? unusedIndexes : unusedIndexes.length
      };
    } catch (error) {
      this.logError('Failed to check indexes', error);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Check system health
   */
  async checkSystemHealth() {
    this.logStep('Checking system health');
    
    try {
      const [connections] = await this.sequelize.query(`
        SELECT count(*) as connection_count
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);

      const [locks] = await this.sequelize.query(`
        SELECT count(*) as lock_count
        FROM pg_locks
      `);

      const [longQueries] = await this.sequelize.query(`
        SELECT count(*) as long_query_count
        FROM pg_stat_activity
        WHERE state = 'active'
        AND now() - query_start > interval '1 minute'
      `);

      return {
        activeConnections: parseInt(connections[0].connection_count),
        activeLocks: parseInt(locks[0].lock_count),
        longRunningQueries: parseInt(longQueries[0].long_query_count),
        status: 'healthy' // Could be more sophisticated
      };
    } catch (error) {
      this.logError('Failed to check system health', error);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Generate comprehensive status report
   */
  async generateStatusReport() {
    this.logStep('Generating comprehensive status report');
    
    if (!this.sequelize) {
      this.sequelize = new Sequelize(this.config);
    }

    const report = {
      environment: this.environment,
      timestamp: new Date().toISOString(),
      configuration: {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        username: this.config.username
      }
    };

    try {
      // Connection test
      report.connection = await this.checkConnectionPerformance();
      
      // Database information
      report.database = await this.checkDatabaseInfo();
      
      // Migration status
      report.migrations = await this.checkMigrationStatus();
      
      // Seeder status
      report.seeders = await this.checkSeederStatus();
      
      // Extensions
      report.extensions = await this.checkExtensions();
      
      // Indexes (if detailed)
      if (this.options.detailed) {
        report.indexes = await this.checkIndexes();
        report.systemHealth = await this.checkSystemHealth();
      }

      // Overall status
      report.overallStatus = this.calculateOverallStatus(report);
      
      return report;
    } catch (error) {
      this.logError('Failed to generate status report', error);
      report.error = error.message;
      report.overallStatus = 'error';
      return report;
    }
  }

  /**
   * Calculate overall database status
   */
  calculateOverallStatus(report) {
    const issues = [];
    
    if (report.connection?.status === 'failed') {
      issues.push('Connection failed');
    } else if (report.connection?.status === 'poor') {
      issues.push('Poor connection performance');
    }
    
    if (report.migrations?.status === 'pending') {
      issues.push(`${report.migrations.pending} pending migrations`);
    }
    
    if (report.extensions?.status === 'incomplete') {
      issues.push(`${report.extensions.missing.length} missing extensions`);
    }

    if (issues.length === 0) {
      return 'healthy';
    } else if (issues.length <= 2) {
      return 'warning';
    } else {
      return 'critical';
    }
  }

  /**
   * Display formatted status report
   */
  displayStatusReport(report) {
    const statusColors = {
      healthy: this.colors.green,
      warning: this.colors.yellow,
      critical: this.colors.red,
      error: this.colors.red
    };
    
    const statusColor = statusColors[report.overallStatus] || this.colors.white;
    
    console.log(`\n${statusColor}${this.colors.bright}═══════════════════════════════════════════════════════════════════════════════════════${this.colors.reset}`);
    console.log(`${statusColor}${this.colors.bright}                                 DATABASE STATUS REPORT                                 ${this.colors.reset}`);
    console.log(`${statusColor}${this.colors.bright}═══════════════════════════════════════════════════════════════════════════════════════${this.colors.reset}\n`);
    
    // Basic Information
    console.log(`${this.colors.cyan}Environment:${this.colors.reset} ${this.colors.bright}${report.environment}${this.colors.reset}`);
    console.log(`${this.colors.cyan}Database:${this.colors.reset} ${this.colors.bright}${report.configuration.database}${this.colors.reset}`);
    console.log(`${this.colors.cyan}Host:${this.colors.reset} ${this.colors.bright}${report.configuration.host}:${report.configuration.port}${this.colors.reset}`);
    console.log(`${this.colors.cyan}Overall Status:${this.colors.reset} ${statusColor}${this.colors.bright}${report.overallStatus.toUpperCase()}${this.colors.reset}\n`);

    // Connection Status
    if (report.connection) {
      const connStatus = report.connection.status;
      const connColor = connStatus === 'excellent' ? this.colors.green :
                       connStatus === 'good' ? this.colors.cyan :
                       connStatus === 'poor' ? this.colors.yellow : this.colors.red;
      
      console.log(`${this.colors.blue}${this.colors.bright}Connection Performance:${this.colors.reset}`);
      console.log(`  Status: ${connColor}${connStatus.toUpperCase()}${this.colors.reset}`);
      console.log(`  Success Rate: ${report.connection.successful}/${report.connection.successful + report.connection.failed}`);
      if (report.connection.average > 0) {
        console.log(`  Response Time: ${report.connection.average.toFixed(1)}ms avg (${report.connection.min}-${report.connection.max}ms)`);
      }
      console.log();
    }

    // Database Information
    if (report.database) {
      console.log(`${this.colors.blue}${this.colors.bright}Database Information:${this.colors.reset}`);
      console.log(`  Size: ${report.database.database.database_size}`);
      console.log(`  Tables: ${report.database.tableCount}`);
      console.log(`  PostgreSQL Version: ${report.database.database.postgresql_version.split(' ')[0]} ${report.database.database.postgresql_version.split(' ')[1]}`);
      
      console.log(`\n  ${this.colors.dim}Row Counts:${this.colors.reset}`);
      Object.entries(report.database.rowCounts).forEach(([table, count]) => {
        console.log(`    ${table}: ${count}`);
      });
      console.log();
    }

    // Migration Status
    if (report.migrations) {
      const migColor = report.migrations.status === 'up-to-date' ? this.colors.green : this.colors.yellow;
      console.log(`${this.colors.blue}${this.colors.bright}Migration Status:${this.colors.reset}`);
      console.log(`  Status: ${migColor}${report.migrations.status.toUpperCase()}${this.colors.reset}`);
      console.log(`  Executed: ${report.migrations.executed}/${report.migrations.total}`);
      
      if (report.migrations.pending > 0) {
        console.log(`  ${this.colors.yellow}Pending migrations:${this.colors.reset}`);
        report.migrations.pendingMigrations.forEach(migration => {
          console.log(`    - ${migration}`);
        });
      }
      console.log();
    }

    // Seeder Status
    if (report.seeders) {
      const seederColor = report.seeders.status === 'up-to-date' ? this.colors.green : this.colors.yellow;
      console.log(`${this.colors.blue}${this.colors.bright}Seeder Status:${this.colors.reset}`);
      console.log(`  Status: ${seederColor}${report.seeders.status.toUpperCase()}${this.colors.reset}`);
      console.log(`  Executed: ${report.seeders.executed}/${report.seeders.total}`);
      
      if (report.seeders.pending > 0) {
        console.log(`  ${this.colors.yellow}Pending seeders:${this.colors.reset}`);
        report.seeders.pendingSeeders.forEach(seeder => {
          console.log(`    - ${seeder}`);
        });
      }
      console.log();
    }

    // Extensions
    if (report.extensions) {
      const extColor = report.extensions.status === 'complete' ? this.colors.green : this.colors.yellow;
      console.log(`${this.colors.blue}${this.colors.bright}Extensions:${this.colors.reset}`);
      console.log(`  Status: ${extColor}${report.extensions.status.toUpperCase()}${this.colors.reset}`);
      
      if (report.extensions.installed.length > 0) {
        console.log(`  Installed:`);
        report.extensions.installed.forEach(ext => {
          console.log(`    ✓ ${ext.extname} v${ext.extversion}`);
        });
      }
      
      if (report.extensions.missing.length > 0) {
        console.log(`  ${this.colors.yellow}Missing:${this.colors.reset}`);
        report.extensions.missing.forEach(ext => {
          console.log(`    ✗ ${ext}`);
        });
      }
      console.log();
    }

    // Detailed information
    if (this.options.detailed && report.indexes) {
      console.log(`${this.colors.blue}${this.colors.bright}Index Information:${this.colors.reset}`);
      console.log(`  Total Indexes: ${report.indexes.total}`);
      if (report.indexes.unusedCount > 0) {
        console.log(`  ${this.colors.yellow}Unused Indexes: ${report.indexes.unusedCount}${this.colors.reset}`);
      }
      console.log();
    }

    if (this.options.detailed && report.systemHealth) {
      console.log(`${this.colors.blue}${this.colors.bright}System Health:${this.colors.reset}`);
      console.log(`  Active Connections: ${report.systemHealth.activeConnections}`);
      console.log(`  Active Locks: ${report.systemHealth.activeLocks}`);
      console.log(`  Long Running Queries: ${report.systemHealth.longRunningQueries}`);
      console.log();
    }

    // Timestamp
    console.log(`${this.colors.dim}Report generated: ${report.timestamp}${this.colors.reset}\n`);
  }

  /**
   * Main status check process
   */
  async checkStatus() {
    try {
      this.logStep('Starting database status check');
      this.logInfo(`Environment: ${this.environment}`);

      const report = await this.generateStatusReport();
      
      if (this.options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        this.displayStatusReport(report);
      }
      
      return report;

    } catch (error) {
      this.logError('Status check failed', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

async function checkDatabaseStatus() {
  const args = process.argv.slice(2);
  const environment = args.find(arg => !arg.startsWith('--')) || 'development';
  
  const options = {
    environment,
    verbose: args.includes('--verbose') || args.includes('-v'),
    detailed: args.includes('--detailed') || args.includes('-d'),
    json: args.includes('--json'),
  };

  console.log(`\n📊 Checking database status for ${environment} environment...\n`);

  try {
    const checker = new DatabaseStatusChecker(options);
    const report = await checker.checkStatus();
    
    // Exit with appropriate code based on status
    const exitCode = report.overallStatus === 'healthy' ? 0 :
                    report.overallStatus === 'warning' ? 1 : 2;
    
    process.exit(exitCode);
  } catch (error) {
    console.error(`\n❌ Status check failed: ${error.message}`);
    if (options.verbose) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(3);
  }
}

// Run if called directly
if (require.main === module) {
  checkDatabaseStatus().catch(console.error);
}

module.exports = { DatabaseStatusChecker, checkDatabaseStatus };