/**
 * Database Backup Script
 * 
 * Creates comprehensive backups of PostgreSQL database with multiple formats
 * and safety checks for production environments.
 * 
 * Features:
 * - Full schema and data backup
 * - Schema-only backup
 * - Data-only backup
 * - Multiple backup formats (custom, SQL)
 * - Compression support
 * - Verification of backup integrity
 * - Safe cleanup of old backups
 * 
 * Usage:
 * node database-backup.js [environment] [options]
 * 
 * Examples:
 * node database-backup.js production --full
 * node database-backup.js staging --schema-only
 * node database-backup.js development --data-only --compress
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync, spawn } = require('child_process');
const moment = require('moment');

// Load environment configuration
require('dotenv').config();

class DatabaseBackup {
  constructor(environment = 'development') {
    this.environment = environment;
    this.config = this.loadDatabaseConfig();
    this.backupDir = path.join(__dirname, 'backups');
    this.timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    this.logFile = path.join(this.backupDir, `backup-${this.timestamp}.log`);
    
    // Ensure backup directory exists
    this.initializeBackupDirectory();
  }

  /**
   * Load database configuration for the specified environment
   */
  loadDatabaseConfig() {
    const config = {
      development: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'shivdhaam_dev',
        username: process.env.DB_USERNAME || 'shivdhaam',
        password: process.env.DB_PASSWORD || 'shivdhaam'
      },
      staging: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD
      },
      production: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD
      }
    };

    if (!config[this.environment]) {
      throw new Error(`Unknown environment: ${this.environment}`);
    }

    const envConfig = config[this.environment];
    
    // Validate required configuration
    const required = ['host', 'database', 'username', 'password'];
    for (const field of required) {
      if (!envConfig[field]) {
        throw new Error(`Missing required database configuration: ${field} for environment ${this.environment}`);
      }
    }

    return envConfig;
  }

  /**
   * Initialize backup directory structure
   */
  async initializeBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'schema'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'data'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'full'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'logs'), { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create backup directories: ${error.message}`);
    }
  }

  /**
   * Log message to both console and log file
   */
  async log(message, level = 'info') {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    console.log(logMessage);
    
    try {
      await fs.appendFile(this.logFile, logMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Execute pg_dump command with proper error handling
   */
  async executePgDump(outputPath, options = []) {
    const { host, port, database, username, password } = this.config;
    
    const baseArgs = [
      '-h', host,
      '-p', port.toString(),
      '-U', username,
      '-d', database,
      '--verbose',
      '--no-password'
    ];

    const args = [...baseArgs, ...options, '-f', outputPath];
    
    await this.log(`Executing: pg_dump ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
      const env = { ...process.env, PGPASSWORD: password };
      const child = spawn('pg_dump', args, { env });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`pg_dump failed with code ${code}: ${stderr}`));
        }
      });
      
      child.on('error', (error) => {
        reject(new Error(`Failed to execute pg_dump: ${error.message}`));
      });
    });
  }

  /**
   * Create full database backup (schema + data)
   */
  async createFullBackup(compress = false) {
    await this.log('Starting full database backup...');
    
    const filename = `full_backup_${this.environment}_${this.timestamp}.backup`;
    const outputPath = path.join(this.backupDir, 'full', filename);
    
    const options = [
      '--format=custom',
      '--compress=9',
      '--create',
      '--clean',
      '--if-exists'
    ];

    try {
      await this.executePgDump(outputPath, options);
      
      const stats = await fs.stat(outputPath);
      await this.log(`Full backup completed successfully. Size: ${this.formatBytes(stats.size)}`);
      
      // Verify backup integrity
      await this.verifyBackup(outputPath);
      
      return {
        success: true,
        path: outputPath,
        size: stats.size,
        type: 'full'
      };
    } catch (error) {
      await this.log(`Full backup failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Create schema-only backup
   */
  async createSchemaBackup() {
    await this.log('Starting schema-only backup...');
    
    const filename = `schema_backup_${this.environment}_${this.timestamp}.sql`;
    const outputPath = path.join(this.backupDir, 'schema', filename);
    
    const options = [
      '--schema-only',
      '--create',
      '--clean',
      '--if-exists'
    ];

    try {
      await this.executePgDump(outputPath, options);
      
      const stats = await fs.stat(outputPath);
      await this.log(`Schema backup completed successfully. Size: ${this.formatBytes(stats.size)}`);
      
      return {
        success: true,
        path: outputPath,
        size: stats.size,
        type: 'schema'
      };
    } catch (error) {
      await this.log(`Schema backup failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Create data-only backup
   */
  async createDataBackup() {
    await this.log('Starting data-only backup...');
    
    const filename = `data_backup_${this.environment}_${this.timestamp}.backup`;
    const outputPath = path.join(this.backupDir, 'data', filename);
    
    const options = [
      '--format=custom',
      '--data-only',
      '--compress=9',
      '--disable-triggers'
    ];

    try {
      await this.executePgDump(outputPath, options);
      
      const stats = await fs.stat(outputPath);
      await this.log(`Data backup completed successfully. Size: ${this.formatBytes(stats.size)}`);
      
      return {
        success: true,
        path: outputPath,
        size: stats.size,
        type: 'data'
      };
    } catch (error) {
      await this.log(`Data backup failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Verify backup integrity using pg_restore
   */
  async verifyBackup(backupPath) {
    await this.log(`Verifying backup integrity: ${backupPath}`);
    
    try {
      const { password } = this.config;
      const env = { ...process.env, PGPASSWORD: password };
      
      // Use pg_restore to list the backup contents without restoring
      execSync(`pg_restore --list "${backupPath}"`, { env, stdio: 'pipe' });
      
      await this.log('Backup verification successful');
      return true;
    } catch (error) {
      await this.log(`Backup verification failed: ${error.message}`, 'error');
      throw new Error(`Backup verification failed: ${error.message}`);
    }
  }

  /**
   * Get backup information and statistics
   */
  async getBackupInfo() {
    const info = {
      environment: this.environment,
      database: this.config.database,
      host: this.config.host,
      timestamp: this.timestamp,
      backupDirectory: this.backupDir
    };

    try {
      // Get database size
      const { Sequelize } = require('sequelize');
      const sequelize = new Sequelize({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        username: this.config.username,
        password: this.config.password,
        dialect: 'postgres',
        logging: false
      });

      const [results] = await sequelize.query(`
        SELECT pg_size_pretty(pg_database_size('${this.config.database}')) as database_size,
               pg_database_size('${this.config.database}') as database_size_bytes
      `);

      info.databaseSize = results[0].database_size;
      info.databaseSizeBytes = parseInt(results[0].database_size_bytes);

      await sequelize.close();
    } catch (error) {
      await this.log(`Failed to get database size: ${error.message}`, 'warn');
    }

    return info;
  }

  /**
   * Clean old backups based on retention policy
   */
  async cleanOldBackups(retentionDays = 7) {
    await this.log(`Cleaning backups older than ${retentionDays} days...`);
    
    const cutoffDate = moment().subtract(retentionDays, 'days');
    let cleanedCount = 0;
    let cleanedSize = 0;

    const directories = ['schema', 'data', 'full'];
    
    for (const dir of directories) {
      const dirPath = path.join(this.backupDir, dir);
      
      try {
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stats = await fs.stat(filePath);
          
          if (moment(stats.mtime).isBefore(cutoffDate)) {
            cleanedSize += stats.size;
            await fs.unlink(filePath);
            cleanedCount++;
            await this.log(`Removed old backup: ${file}`);
          }
        }
      } catch (error) {
        await this.log(`Error cleaning directory ${dir}: ${error.message}`, 'warn');
      }
    }

    await this.log(`Cleanup completed. Removed ${cleanedCount} files, freed ${this.formatBytes(cleanedSize)}`);
    
    return { cleanedCount, cleanedSize };
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Create comprehensive backup report
   */
  async generateBackupReport(backups) {
    const report = {
      timestamp: this.timestamp,
      environment: this.environment,
      database: this.config.database,
      backups: backups,
      summary: {
        totalBackups: backups.length,
        totalSize: backups.reduce((sum, backup) => sum + backup.size, 0),
        successful: backups.filter(b => b.success).length,
        failed: backups.filter(b => !b.success).length
      }
    };

    const reportPath = path.join(this.backupDir, `backup-report-${this.timestamp}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    await this.log(`Backup report saved: ${reportPath}`);
    
    return report;
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  const environment = args[0] || 'development';
  
  // Parse options
  const options = {
    full: args.includes('--full'),
    schema: args.includes('--schema') || args.includes('--schema-only'),
    data: args.includes('--data') || args.includes('--data-only'),
    compress: args.includes('--compress'),
    cleanup: args.includes('--cleanup'),
    retentionDays: 7
  };

  // Default to full backup if no specific type specified
  if (!options.full && !options.schema && !options.data) {
    options.full = true;
  }

  try {
    const backup = new DatabaseBackup(environment);
    
    await backup.log('='.repeat(80));
    await backup.log(`DATABASE BACKUP STARTED`);
    await backup.log(`Environment: ${environment}`);
    await backup.log(`Database: ${backup.config.database}`);
    await backup.log(`Host: ${backup.config.host}`);
    await backup.log('='.repeat(80));

    const info = await backup.getBackupInfo();
    await backup.log(`Database size: ${info.databaseSize || 'Unknown'}`);

    const backups = [];

    // Create requested backups
    if (options.full) {
      try {
        const result = await backup.createFullBackup(options.compress);
        backups.push(result);
      } catch (error) {
        backups.push({ success: false, type: 'full', error: error.message });
      }
    }

    if (options.schema) {
      try {
        const result = await backup.createSchemaBackup();
        backups.push(result);
      } catch (error) {
        backups.push({ success: false, type: 'schema', error: error.message });
      }
    }

    if (options.data) {
      try {
        const result = await backup.createDataBackup();
        backups.push(result);
      } catch (error) {
        backups.push({ success: false, type: 'data', error: error.message });
      }
    }

    // Clean old backups if requested
    if (options.cleanup) {
      await backup.cleanOldBackups(options.retentionDays);
    }

    // Generate report
    const report = await backup.generateBackupReport(backups);

    await backup.log('='.repeat(80));
    await backup.log('BACKUP SUMMARY:');
    await backup.log(`Total backups: ${report.summary.totalBackups}`);
    await backup.log(`Successful: ${report.summary.successful}`);
    await backup.log(`Failed: ${report.summary.failed}`);
    await backup.log(`Total size: ${backup.formatBytes(report.summary.totalSize)}`);
    await backup.log('='.repeat(80));

    if (report.summary.failed > 0) {
      process.exit(1);
    }

    await backup.log('Database backup completed successfully!');
    
  } catch (error) {
    console.error('Backup failed:', error.message);
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = DatabaseBackup;