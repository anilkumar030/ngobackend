#!/usr/bin/env node
/**
 * Database Recovery and Rollback System
 * 
 * This module provides comprehensive error recovery and rollback capabilities:
 * - Automatic transaction management
 * - Checkpoint creation and restoration
 * - Failed migration rollback
 * - Emergency database recovery
 * - Backup restoration
 * 
 * @author Shiv Dhaam Foundation
 * @version 2.0.0
 */

const { Sequelize } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class DatabaseRecovery {
  constructor(config, options = {}) {
    this.config = config;
    this.sequelize = null;
    this.transaction = null;
    this.checkpoints = new Map();
    this.recoveryLog = [];
    
    this.options = {
      autoBackup: options.autoBackup !== false,
      maxBackups: options.maxBackups || 5,
      checkpointTimeout: options.checkpointTimeout || 300000, // 5 minutes
      verbose: options.verbose || false,
      ...options
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
  }

  /**
   * Enhanced logging
   */
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const levelColors = {
      SUCCESS: this.colors.green,
      INFO: this.colors.cyan,
      WARNING: this.colors.yellow,
      ERROR: this.colors.red,
      DEBUG: this.colors.magenta
    };

    const color = levelColors[level] || this.colors.reset;
    const prefix = `${color}[${timestamp}] [RECOVERY] [${level}]${this.colors.reset}`;
    
    console.log(`${prefix} ${message}`);
    
    // Add to recovery log
    this.recoveryLog.push({
      timestamp,
      level,
      message,
      data: data || null
    });
    
    if (data && this.options.verbose) {
      console.log(`${this.colors.blue}Data:${this.colors.reset}`, JSON.stringify(data, null, 2));
    }
  }

  logSuccess(message, data) { this.log('SUCCESS', message, data); }
  logInfo(message, data) { this.log('INFO', message, data); }
  logWarning(message, data) { this.log('WARNING', message, data); }
  logError(message, error) { this.log('ERROR', message, error?.message || error); }
  logDebug(message, data) { if (this.options.verbose) this.log('DEBUG', message, data); }

  /**
   * Initialize recovery system
   */
  async initialize() {
    try {
      this.sequelize = new Sequelize(this.config);
      await this.sequelize.authenticate();
      
      // Create recovery tables if they don't exist
      await this.createRecoveryTables();
      
      this.logInfo('Recovery system initialized successfully');
      return true;
    } catch (error) {
      this.logError('Failed to initialize recovery system', error);
      throw error;
    }
  }

  /**
   * Create recovery tracking tables
   */
  async createRecoveryTables() {
    await this.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "DatabaseCheckpoints" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        backup_path TEXT,
        schema_snapshot JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        metadata JSONB DEFAULT '{}'::jsonb
      );
    `);

    await this.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "RecoveryLog" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        operation_type VARCHAR(100) NOT NULL,
        operation_id VARCHAR(255),
        status VARCHAR(50) NOT NULL,
        error_message TEXT,
        rollback_actions JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        metadata JSONB DEFAULT '{}'::jsonb
      );
    `);

    this.logDebug('Recovery tables created/verified');
  }

  /**
   * Start a recovery transaction
   */
  async startTransaction(options = {}) {
    try {
      if (this.transaction) {
        await this.transaction.rollback();
      }
      
      this.transaction = await this.sequelize.transaction({
        isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE,
        autocommit: false,
        ...options
      });
      
      this.logInfo('Recovery transaction started');
      return this.transaction;
    } catch (error) {
      this.logError('Failed to start recovery transaction', error);
      throw error;
    }
  }

  /**
   * Commit recovery transaction
   */
  async commitTransaction() {
    if (!this.transaction) {
      this.logWarning('No active transaction to commit');
      return;
    }

    try {
      await this.transaction.commit();
      this.transaction = null;
      this.logSuccess('Recovery transaction committed');
    } catch (error) {
      this.logError('Failed to commit recovery transaction', error);
      await this.rollbackTransaction();
      throw error;
    }
  }

  /**
   * Rollback recovery transaction
   */
  async rollbackTransaction() {
    if (!this.transaction) {
      this.logWarning('No active transaction to rollback');
      return;
    }

    try {
      await this.transaction.rollback();
      this.transaction = null;
      this.logSuccess('Recovery transaction rolled back');
    } catch (error) {
      this.logError('Failed to rollback recovery transaction', error);
      this.transaction = null;
    }
  }

  /**
   * Create a database checkpoint
   */
  async createCheckpoint(name, description = null, options = {}) {
    const checkpointId = crypto.randomUUID();
    
    try {
      this.logInfo(`Creating checkpoint: ${name}`);
      
      // Create backup if requested
      let backupPath = null;
      if (options.createBackup !== false) {
        backupPath = await this.createBackup(name);
      }

      // Capture schema snapshot
      const schemaSnapshot = await this.captureSchemaSnapshot();
      
      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setTime(expiresAt.getTime() + (options.ttl || this.options.checkpointTimeout));
      
      // Store checkpoint
      await this.sequelize.query(`
        INSERT INTO "DatabaseCheckpoints" (
          id, name, description, backup_path, schema_snapshot, expires_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description,
          backup_path = EXCLUDED.backup_path,
          schema_snapshot = EXCLUDED.schema_snapshot,
          expires_at = EXCLUDED.expires_at,
          metadata = EXCLUDED.metadata,
          created_at = CURRENT_TIMESTAMP
      `, {
        replacements: [
          checkpointId,
          name,
          description || `Checkpoint created at ${new Date().toISOString()}`,
          backupPath,
          JSON.stringify(schemaSnapshot),
          expiresAt,
          JSON.stringify(options.metadata || {})
        ]
      });

      const checkpoint = {
        id: checkpointId,
        name,
        description,
        backupPath,
        schemaSnapshot,
        expiresAt,
        metadata: options.metadata || {}
      };

      this.checkpoints.set(name, checkpoint);
      this.logSuccess(`Checkpoint '${name}' created successfully`);
      
      return checkpoint;
    } catch (error) {
      this.logError(`Failed to create checkpoint '${name}'`, error);
      throw error;
    }
  }

  /**
   * Restore from checkpoint
   */
  async restoreCheckpoint(name, options = {}) {
    try {
      this.logInfo(`Restoring from checkpoint: ${name}`);
      
      // Get checkpoint data
      const [checkpoints] = await this.sequelize.query(`
        SELECT * FROM "DatabaseCheckpoints" 
        WHERE name = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      `, { replacements: [name] });

      if (checkpoints.length === 0) {
        throw new Error(`Checkpoint '${name}' not found or expired`);
      }

      const checkpoint = checkpoints[0];
      
      // Start transaction for atomic restore
      await this.startTransaction();
      
      try {
        // Restore from backup if available
        if (checkpoint.backup_path && options.restoreFromBackup !== false) {
          await this.restoreFromBackup(checkpoint.backup_path, options);
        }
        
        // Verify schema consistency
        if (options.verifySchema !== false) {
          await this.verifySchemaConsistency(checkpoint.schema_snapshot);
        }
        
        await this.commitTransaction();
        this.logSuccess(`Successfully restored from checkpoint '${name}'`);
        
        return checkpoint;
      } catch (error) {
        await this.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      this.logError(`Failed to restore from checkpoint '${name}'`, error);
      throw error;
    }
  }

  /**
   * Create database backup
   */
  async createBackup(name) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.resolve(__dirname, '../backups/recovery');
      const backupFile = `${name}_${timestamp}.sql`;
      const backupPath = path.join(backupDir, backupFile);

      // Ensure backup directory exists
      await fs.mkdir(backupDir, { recursive: true });

      // Create backup using pg_dump
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const command = `PGPASSWORD=${this.config.password} pg_dump -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d ${this.config.database} -f "${backupPath}" --clean --if-exists --verbose`;
      
      await execAsync(command);
      
      // Verify backup file exists and has content
      const stats = await fs.stat(backupPath);
      if (stats.size === 0) {
        throw new Error('Backup file is empty');
      }

      this.logSuccess(`Backup created: ${backupPath} (${(stats.size / 1024).toFixed(2)} KB)`);
      
      // Clean up old backups
      await this.cleanupOldBackups(backupDir);
      
      return backupPath;
    } catch (error) {
      this.logError('Failed to create backup', error);
      throw error;
    }
  }

  /**
   * Restore from backup file
   */
  async restoreFromBackup(backupPath, options = {}) {
    try {
      this.logInfo(`Restoring from backup: ${backupPath}`);
      
      // Verify backup file exists
      await fs.access(backupPath);
      
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Restore using psql
      const command = `PGPASSWORD=${this.config.password} psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d ${this.config.database} -f "${backupPath}" --quiet`;
      
      if (options.verbose) {
        command.replace('--quiet', '--verbose');
      }
      
      await execAsync(command);
      
      this.logSuccess('Database restored from backup successfully');
    } catch (error) {
      this.logError('Failed to restore from backup', error);
      throw error;
    }
  }

  /**
   * Capture current schema snapshot
   */
  async captureSchemaSnapshot() {
    try {
      const snapshot = {};
      
      // Get table information
      const [tables] = await this.sequelize.query(`
        SELECT 
          table_name,
          table_type
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      snapshot.tables = tables;

      // Get column information
      const [columns] = await this.sequelize.query(`
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `);

      snapshot.columns = columns;

      // Get index information
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

      snapshot.indexes = indexes;

      // Get constraint information
      const [constraints] = await this.sequelize.query(`
        SELECT 
          table_name,
          constraint_name,
          constraint_type
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public'
        ORDER BY table_name, constraint_name
      `);

      snapshot.constraints = constraints;

      this.logDebug('Schema snapshot captured', { 
        tables: tables.length, 
        columns: columns.length, 
        indexes: indexes.length, 
        constraints: constraints.length 
      });

      return snapshot;
    } catch (error) {
      this.logError('Failed to capture schema snapshot', error);
      throw error;
    }
  }

  /**
   * Verify schema consistency
   */
  async verifySchemaConsistency(expectedSnapshot) {
    try {
      this.logInfo('Verifying schema consistency');
      
      const currentSnapshot = await this.captureSchemaSnapshot();
      const issues = [];

      // Compare tables
      const expectedTables = new Set(expectedSnapshot.tables.map(t => t.table_name));
      const currentTables = new Set(currentSnapshot.tables.map(t => t.table_name));
      
      for (const table of expectedTables) {
        if (!currentTables.has(table)) {
          issues.push(`Missing table: ${table}`);
        }
      }

      for (const table of currentTables) {
        if (!expectedTables.has(table)) {
          issues.push(`Unexpected table: ${table}`);
        }
      }

      // Compare critical columns
      const expectedColumns = new Map();
      expectedSnapshot.columns.forEach(col => {
        const key = `${col.table_name}.${col.column_name}`;
        expectedColumns.set(key, col);
      });

      const currentColumns = new Map();
      currentSnapshot.columns.forEach(col => {
        const key = `${col.table_name}.${col.column_name}`;
        currentColumns.set(key, col);
      });

      for (const [key, expectedCol] of expectedColumns) {
        const currentCol = currentColumns.get(key);
        if (!currentCol) {
          issues.push(`Missing column: ${key}`);
        } else if (expectedCol.data_type !== currentCol.data_type) {
          issues.push(`Column type mismatch: ${key} (expected: ${expectedCol.data_type}, found: ${currentCol.data_type})`);
        }
      }

      if (issues.length > 0) {
        this.logWarning(`Schema inconsistencies found: ${issues.length} issues`);
        issues.forEach(issue => this.logWarning(`  - ${issue}`));
        
        if (this.options.strictVerification) {
          throw new Error(`Schema verification failed: ${issues.length} inconsistencies found`);
        }
      } else {
        this.logSuccess('Schema consistency verified');
      }

      return { consistent: issues.length === 0, issues };
    } catch (error) {
      this.logError('Schema verification failed', error);
      throw error;
    }
  }

  /**
   * Emergency recovery procedure
   */
  async emergencyRecovery(options = {}) {
    try {
      this.logInfo('Starting emergency recovery procedure');
      
      const recoverySteps = [
        { name: 'Connection Test', action: () => this.sequelize.authenticate() },
        { name: 'Schema Validation', action: () => this.validateCriticalTables() },
        { name: 'Data Integrity Check', action: () => this.checkDataIntegrity() },
        { name: 'Index Rebuild', action: () => this.rebuildCriticalIndexes() },
        { name: 'Statistics Update', action: () => this.updateTableStatistics() }
      ];

      const results = [];
      
      for (const step of recoverySteps) {
        try {
          this.logInfo(`Recovery step: ${step.name}`);
          await step.action();
          results.push({ step: step.name, status: 'success' });
          this.logSuccess(`✓ ${step.name} completed`);
        } catch (error) {
          results.push({ step: step.name, status: 'failed', error: error.message });
          this.logError(`✗ ${step.name} failed`, error);
          
          if (options.stopOnError) {
            throw error;
          }
        }
      }

      const failedSteps = results.filter(r => r.status === 'failed');
      
      if (failedSteps.length === 0) {
        this.logSuccess('Emergency recovery completed successfully');
      } else {
        this.logWarning(`Emergency recovery completed with ${failedSteps.length} failed steps`);
      }

      return results;
    } catch (error) {
      this.logError('Emergency recovery procedure failed', error);
      throw error;
    }
  }

  /**
   * Validate critical tables exist and are accessible
   */
  async validateCriticalTables() {
    const criticalTables = [
      'users', 'campaigns', 'donations', 'SequelizeMeta'
    ];

    for (const table of criticalTables) {
      try {
        await this.sequelize.query(`SELECT 1 FROM ${table} LIMIT 1`);
      } catch (error) {
        throw new Error(`Critical table '${table}' is not accessible: ${error.message}`);
      }
    }
  }

  /**
   * Check basic data integrity
   */
  async checkDataIntegrity() {
    const checks = [
      {
        name: 'User integrity',
        query: 'SELECT COUNT(*) as count FROM users WHERE email IS NULL OR email = \'\''
      },
      {
        name: 'Campaign integrity', 
        query: 'SELECT COUNT(*) as count FROM campaigns WHERE title IS NULL OR title = \'\''
      },
      {
        name: 'Donation integrity',
        query: 'SELECT COUNT(*) as count FROM donations WHERE amount <= 0'
      }
    ];

    for (const check of checks) {
      const [result] = await this.sequelize.query(check.query);
      if (result[0].count > 0) {
        this.logWarning(`${check.name}: ${result[0].count} integrity issues found`);
      }
    }
  }

  /**
   * Rebuild critical indexes
   */
  async rebuildCriticalIndexes() {
    const criticalIndexes = [
      'REINDEX INDEX CONCURRENTLY IF EXISTS users_email_idx',
      'REINDEX INDEX CONCURRENTLY IF EXISTS campaigns_status_idx',
      'REINDEX INDEX CONCURRENTLY IF EXISTS donations_campaign_id_idx'
    ];

    for (const indexCommand of criticalIndexes) {
      try {
        await this.sequelize.query(indexCommand);
      } catch (error) {
        this.logWarning(`Failed to rebuild index: ${error.message}`);
      }
    }
  }

  /**
   * Update table statistics
   */
  async updateTableStatistics() {
    await this.sequelize.query('ANALYZE');
    this.logInfo('Table statistics updated');
  }

  /**
   * Clean up old backups
   */
  async cleanupOldBackups(backupDir) {
    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files
        .filter(file => file.endsWith('.sql'))
        .map(file => ({
          name: file,
          path: path.join(backupDir, file),
          stats: null
        }));

      // Get file stats
      for (const file of backupFiles) {
        try {
          file.stats = await fs.stat(file.path);
        } catch (error) {
          this.logWarning(`Failed to get stats for backup file: ${file.name}`);
        }
      }

      // Sort by creation time (newest first)
      backupFiles.sort((a, b) => {
        if (!a.stats || !b.stats) return 0;
        return b.stats.birthtime - a.stats.birthtime;
      });

      // Remove old backups (keep maxBackups)
      const filesToDelete = backupFiles.slice(this.options.maxBackups);
      
      for (const file of filesToDelete) {
        try {
          await fs.unlink(file.path);
          this.logDebug(`Deleted old backup: ${file.name}`);
        } catch (error) {
          this.logWarning(`Failed to delete old backup ${file.name}: ${error.message}`);
        }
      }

      if (filesToDelete.length > 0) {
        this.logInfo(`Cleaned up ${filesToDelete.length} old backup files`);
      }
    } catch (error) {
      this.logWarning('Failed to clean up old backups', error);
    }
  }

  /**
   * Get recovery log
   */
  getRecoveryLog() {
    return this.recoveryLog;
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      if (this.transaction) {
        await this.rollbackTransaction();
      }
      
      if (this.sequelize) {
        await this.sequelize.close();
        this.sequelize = null;
      }
      
      this.logInfo('Recovery system cleaned up');
    } catch (error) {
      this.logError('Error during recovery cleanup', error);
    }
  }
}

module.exports = DatabaseRecovery;