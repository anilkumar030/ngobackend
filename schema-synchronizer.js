/**
 * Database Schema Synchronizer
 * 
 * Safely synchronizes database schemas by applying only additive changes
 * (tables, columns, indexes, constraints) without removing or modifying existing data.
 * 
 * Features:
 * - Transaction-based atomic operations
 * - Dry-run mode for testing
 * - Only additive changes (never deletes)
 * - Comprehensive rollback mechanisms
 * - Data preservation safeguards
 * - Progress tracking and detailed logging
 * - Validation before and after changes
 * 
 * Usage:
 * node schema-synchronizer.js <comparison-file> [options]
 * 
 * Examples:
 * node schema-synchronizer.js comparison.json --dry-run
 * node schema-synchronizer.js comparison.json --apply --backup
 * node schema-synchronizer.js comparison.json --apply --no-indexes
 */

const fs = require('fs').promises;
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const moment = require('moment');

// Load environment configuration
require('dotenv').config();

class SchemaSynchronizer {
  constructor(environment = 'production') {
    this.environment = environment;
    this.config = this.loadDatabaseConfig();
    this.sequelize = null;
    this.timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    this.outputDir = path.join(__dirname, 'sync-logs');
    this.logFile = path.join(this.outputDir, `sync-${this.timestamp}.log`);
    this.rollbackFile = path.join(this.outputDir, `rollback-${this.timestamp}.sql`);
    
    this.syncStats = {
      tablesCreated: 0,
      columnsAdded: 0,
      indexesCreated: 0,
      constraintsAdded: 0,
      sequencesCreated: 0,
      errors: 0,
      warnings: 0
    };

    this.rollbackStatements = [];
    
    this.initializeOutputDirectory();
  }

  /**
   * Load database configuration
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

    return config[this.environment];
  }

  /**
   * Initialize database connection
   */
  async connect() {
    try {
      this.sequelize = new Sequelize({
        ...this.config,
        dialect: 'postgres',
        logging: (sql) => this.log(`SQL: ${sql}`, 'debug'),
        pool: {
          max: 5,
          min: 1,
          acquire: 30000,
          idle: 10000
        }
      });

      await this.sequelize.authenticate();
      await this.log(`✓ Connected to database: ${this.config.database}`);
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Initialize output directory
   */
  async initializeOutputDirectory() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create output directory: ${error.message}`);
    }
  }

  /**
   * Log message to both console and file
   */
  async log(message, level = 'info') {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (level !== 'debug') {
      console.log(logMessage);
    }
    
    try {
      await fs.appendFile(this.logFile, logMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Load comparison file
   */
  async loadComparison(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const comparison = JSON.parse(content);
      await this.log(`✓ Loaded comparison from: ${filePath}`);
      return comparison;
    } catch (error) {
      throw new Error(`Failed to load comparison file: ${error.message}`);
    }
  }

  /**
   * Validate that synchronization is safe
   */
  async validateSynchronization(comparison) {
    await this.log('Validating synchronization safety...');

    const issues = [];

    // Check for critical differences
    if (comparison.summary.critical_differences > 0) {
      issues.push(`Found ${comparison.summary.critical_differences} critical differences that require manual review`);
    }

    // Check for destructive operations (we only allow additive operations)
    const destructiveOps = [
      ...comparison.differences.tables.missing_in_source,
      ...comparison.differences.columns.missing_in_source,
      ...comparison.differences.indexes.missing_in_source,
      ...comparison.differences.constraints.missing_in_source
    ];

    if (destructiveOps.length > 0) {
      await this.log('⚠️  Found elements that exist in target but not in source - these will be ignored for safety', 'warn');
    }

    // Check for data type incompatibilities
    comparison.differences.columns.modified.forEach(col => {
      col.differences.forEach(diff => {
        if (diff.type === 'data_type_change' && diff.compatibility === 'INCOMPATIBLE') {
          issues.push(`Incompatible data type change in ${col.table}.${col.column}: ${diff.source} → ${diff.target}`);
        }
      });
    });

    // Check for NOT NULL constraints on existing columns
    comparison.differences.columns.modified.forEach(col => {
      col.differences.forEach(diff => {
        if (diff.type === 'nullable_change' && diff.risk === 'HIGH') {
          issues.push(`NOT NULL constraint on existing column ${col.table}.${col.column} may fail with existing data`);
        }
      });
    });

    if (issues.length > 0) {
      await this.log('❌ Validation failed:', 'error');
      issues.forEach(issue => this.log(`  - ${issue}`, 'error'));
      return false;
    }

    await this.log('✅ Validation passed - synchronization is safe to proceed');
    return true;
  }

  /**
   * Create backup before making changes
   */
  async createBackup() {
    await this.log('Creating database backup before synchronization...');
    
    try {
      const { spawn } = require('child_process');
      const backupPath = path.join(this.outputDir, `pre-sync-backup-${this.timestamp}.backup`);
      
      const args = [
        '-h', this.config.host,
        '-p', this.config.port.toString(),
        '-U', this.config.username,
        '-d', this.config.database,
        '--format=custom',
        '--compress=9',
        '--verbose',
        '--no-password',
        '-f', backupPath
      ];

      return new Promise((resolve, reject) => {
        const env = { ...process.env, PGPASSWORD: this.config.password };
        const child = spawn('pg_dump', args, { env });
        
        let stderr = '';
        
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        child.on('close', async (code) => {
          if (code === 0) {
            await this.log(`✓ Backup created: ${backupPath}`);
            resolve(backupPath);
          } else {
            reject(new Error(`Backup failed with code ${code}: ${stderr}`));
          }
        });
        
        child.on('error', (error) => {
          reject(new Error(`Failed to execute pg_dump: ${error.message}`));
        });
      });
    } catch (error) {
      await this.log(`❌ Backup failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Execute SQL within a transaction with rollback capability
   */
  async executeSql(sql, description, transaction = null) {
    try {
      await this.log(`Executing: ${description}`);
      
      if (transaction) {
        await transaction.query(sql);
      } else {
        await this.sequelize.query(sql);
      }
      
      await this.log(`✓ ${description} completed`);
      return true;
    } catch (error) {
      await this.log(`❌ ${description} failed: ${error.message}`, 'error');
      this.syncStats.errors++;
      throw error;
    }
  }

  /**
   * Create missing sequences
   */
  async createSequences(sequences, transaction, dryRun = false) {
    if (sequences.length === 0) return;

    await this.log(`Creating ${sequences.length} missing sequences...`);

    for (const seq of sequences) {
      const sql = `
        CREATE SEQUENCE IF NOT EXISTS "${seq.name}"
        START WITH ${seq.start_value}
        INCREMENT BY ${seq.increment}
        MINVALUE ${seq.minimum_value || 1}
        MAXVALUE ${seq.maximum_value || 9223372036854775807}
        ${seq.cycle_option === 'YES' ? 'CYCLE' : 'NO CYCLE'};
      `;

      const rollbackSql = `DROP SEQUENCE IF EXISTS "${seq.name}";`;

      if (dryRun) {
        await this.log(`[DRY RUN] Would create sequence: ${seq.name}`);
      } else {
        await this.executeSql(sql, `Create sequence ${seq.name}`, transaction);
        this.rollbackStatements.push(rollbackSql);
        this.syncStats.sequencesCreated++;
      }
    }
  }

  /**
   * Create missing tables
   */
  async createTables(tables, sourceSchema, transaction, dryRun = false) {
    if (tables.length === 0) return;

    await this.log(`Creating ${tables.length} missing tables...`);

    for (const tableInfo of tables) {
      const tableName = tableInfo.name;
      const table = sourceSchema.tables[tableName];
      
      if (!table) {
        await this.log(`⚠️  Table ${tableName} not found in source schema`, 'warn');
        continue;
      }

      // Build CREATE TABLE statement
      let sql = `CREATE TABLE "${tableName}" (\n`;
      
      const columnDefs = table.columns.map(col => {
        let def = `  "${col.column_name}" ${col.data_type}`;
        
        // Handle data type parameters
        if (col.character_maximum_length) {
          def += `(${col.character_maximum_length})`;
        } else if (col.numeric_precision && col.numeric_scale) {
          def += `(${col.numeric_precision},${col.numeric_scale})`;
        } else if (col.numeric_precision) {
          def += `(${col.numeric_precision})`;
        }
        
        // Handle NOT NULL
        if (col.is_nullable === 'NO') {
          def += ' NOT NULL';
        }
        
        // Handle DEFAULT values
        if (col.column_default) {
          def += ` DEFAULT ${col.column_default}`;
        }
        
        return def;
      });
      
      sql += columnDefs.join(',\n');
      sql += '\n);';

      // Add table comment if exists
      if (table.comment) {
        sql += `\nCOMMENT ON TABLE "${tableName}" IS '${table.comment.replace(/'/g, "''")}';`;
      }

      // Add column comments
      table.columns.forEach(col => {
        if (col.column_comment) {
          sql += `\nCOMMENT ON COLUMN "${tableName}"."${col.column_name}" IS '${col.column_comment.replace(/'/g, "''")}';`;
        }
      });

      const rollbackSql = `DROP TABLE IF EXISTS "${tableName}" CASCADE;`;

      if (dryRun) {
        await this.log(`[DRY RUN] Would create table: ${tableName} with ${table.columns.length} columns`);
      } else {
        await this.executeSql(sql, `Create table ${tableName}`, transaction);
        this.rollbackStatements.push(rollbackSql);
        this.syncStats.tablesCreated++;
      }
    }
  }

  /**
   * Add missing columns
   */
  async addColumns(columns, transaction, dryRun = false) {
    if (columns.length === 0) return;

    await this.log(`Adding ${columns.length} missing columns...`);

    for (const col of columns) {
      let sql = `ALTER TABLE "${col.table}" ADD COLUMN "${col.column}" ${col.data_type}`;
      
      // Handle data type parameters
      if (col.character_maximum_length) {
        sql += `(${col.character_maximum_length})`;
      } else if (col.numeric_precision && col.numeric_scale) {
        sql += `(${col.numeric_precision},${col.numeric_scale})`;
      } else if (col.numeric_precision) {
        sql += `(${col.numeric_precision})`;
      }

      // Handle constraints
      if (col.is_nullable === 'NO') {
        if (col.default_value) {
          sql += ` NOT NULL DEFAULT ${col.default_value}`;
        } else {
          await this.log(`⚠️  Column ${col.table}.${col.column} is NOT NULL but has no default value - adding as nullable`, 'warn');
          this.syncStats.warnings++;
        }
      } else if (col.default_value) {
        sql += ` DEFAULT ${col.default_value}`;
      }

      sql += ';';

      // Add column comment if exists
      if (col.column_comment) {
        sql += `\nCOMMENT ON COLUMN "${col.table}"."${col.column}" IS '${col.column_comment.replace(/'/g, "''")}';`;
      }

      const rollbackSql = `ALTER TABLE "${col.table}" DROP COLUMN IF EXISTS "${col.column}";`;

      if (dryRun) {
        await this.log(`[DRY RUN] Would add column: ${col.table}.${col.column} (${col.data_type})`);
      } else {
        await this.executeSql(sql, `Add column ${col.table}.${col.column}`, transaction);
        this.rollbackStatements.push(rollbackSql);
        this.syncStats.columnsAdded++;
      }
    }
  }

  /**
   * Create missing indexes
   */
  async createIndexes(indexes, transaction, dryRun = false) {
    if (indexes.length === 0) return;

    await this.log(`Creating ${indexes.length} missing indexes...`);

    for (const idx of indexes) {
      // Skip primary key indexes as they're created with tables
      if (idx.is_primary) {
        continue;
      }

      const columns = Array.isArray(idx.columns) ? idx.columns : [idx.columns];
      const columnList = columns.map(c => `"${c}"`).join(', ');
      
      let sql = `CREATE ${idx.is_unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${idx.index}" ON "${idx.table}" (${columnList});`;

      const rollbackSql = `DROP INDEX IF EXISTS "${idx.index}";`;

      if (dryRun) {
        await this.log(`[DRY RUN] Would create index: ${idx.table}.${idx.index} on (${columns.join(', ')})`);
      } else {
        await this.executeSql(sql, `Create index ${idx.table}.${idx.index}`, transaction);
        this.rollbackStatements.push(rollbackSql);
        this.syncStats.indexesCreated++;
      }
    }
  }

  /**
   * Add missing constraints
   */
  async addConstraints(constraints, transaction, dryRun = false) {
    if (constraints.length === 0) return;

    await this.log(`Adding ${constraints.length} missing constraints...`);

    // Group constraints by type for proper ordering
    const constraintTypes = {
      'PRIMARY KEY': [],
      'UNIQUE': [],
      'FOREIGN KEY': [],
      'CHECK': []
    };

    constraints.forEach(constraint => {
      if (constraintTypes[constraint.type]) {
        constraintTypes[constraint.type].push(constraint);
      }
    });

    // Process constraints in order (PK, UNIQUE, FK, CHECK)
    for (const [type, constraintList] of Object.entries(constraintTypes)) {
      for (const constraint of constraintList) {
        let sql = '';
        let rollbackSql = '';

        if (type === 'PRIMARY KEY') {
          sql = `ALTER TABLE "${constraint.table}" ADD CONSTRAINT "${constraint.constraint}" PRIMARY KEY ("${constraint.column}");`;
          rollbackSql = `ALTER TABLE "${constraint.table}" DROP CONSTRAINT IF EXISTS "${constraint.constraint}";`;
        } else if (type === 'UNIQUE') {
          sql = `ALTER TABLE "${constraint.table}" ADD CONSTRAINT "${constraint.constraint}" UNIQUE ("${constraint.column}");`;
          rollbackSql = `ALTER TABLE "${constraint.table}" DROP CONSTRAINT IF EXISTS "${constraint.constraint}";`;
        } else if (type === 'FOREIGN KEY') {
          sql = `ALTER TABLE "${constraint.table}" ADD CONSTRAINT "${constraint.constraint}" FOREIGN KEY ("${constraint.column}") REFERENCES "${constraint.foreign_table}" ("${constraint.foreign_column}")`;
          if (constraint.update_rule && constraint.update_rule !== 'NO ACTION') {
            sql += ` ON UPDATE ${constraint.update_rule}`;
          }
          if (constraint.delete_rule && constraint.delete_rule !== 'NO ACTION') {
            sql += ` ON DELETE ${constraint.delete_rule}`;
          }
          sql += ';';
          rollbackSql = `ALTER TABLE "${constraint.table}" DROP CONSTRAINT IF EXISTS "${constraint.constraint}";`;
        } else if (type === 'CHECK') {
          sql = `ALTER TABLE "${constraint.table}" ADD CONSTRAINT "${constraint.constraint}" CHECK (${constraint.check_clause});`;
          rollbackSql = `ALTER TABLE "${constraint.table}" DROP CONSTRAINT IF EXISTS "${constraint.constraint}";`;
        }

        if (sql) {
          if (dryRun) {
            await this.log(`[DRY RUN] Would add ${type} constraint: ${constraint.table}.${constraint.constraint}`);
          } else {
            try {
              await this.executeSql(sql, `Add ${type} constraint ${constraint.table}.${constraint.constraint}`, transaction);
              this.rollbackStatements.push(rollbackSql);
              this.syncStats.constraintsAdded++;
            } catch (error) {
              await this.log(`⚠️  Failed to add constraint ${constraint.table}.${constraint.constraint}: ${error.message}`, 'warn');
              this.syncStats.warnings++;
            }
          }
        }
      }
    }
  }

  /**
   * Generate rollback script
   */
  async generateRollbackScript() {
    const rollbackSql = [
      '-- Rollback Script for Schema Synchronization',
      `-- Generated: ${new Date().toISOString()}`,
      `-- Environment: ${this.environment}`,
      `-- Database: ${this.config.database}`,
      '--',
      '-- WARNING: This script will undo all changes made during synchronization.',
      '-- Review carefully before executing!',
      '--',
      '',
      '-- Execute rollback statements in reverse order',
      ...this.rollbackStatements.reverse()
    ].join('\n');

    await fs.writeFile(this.rollbackFile, rollbackSql);
    await this.log(`✓ Rollback script generated: ${this.rollbackFile}`);
    
    return this.rollbackFile;
  }

  /**
   * Perform schema synchronization
   */
  async synchronize(comparisonFile, options = {}) {
    const {
      dryRun = false,
      createBackup = true,
      includeIndexes = true,
      includeConstraints = true,
      includeSequences = true
    } = options;

    await this.connect();

    try {
      await this.log('='.repeat(80));
      await this.log('SCHEMA SYNCHRONIZATION STARTED');
      await this.log(`Environment: ${this.environment}`);
      await this.log(`Database: ${this.config.database}`);
      await this.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY CHANGES'}`);
      await this.log('='.repeat(80));

      // Load comparison data
      const comparison = await this.loadComparison(comparisonFile);
      
      // Load source schema for table creation
      const sourceSchemaPath = comparison.metadata.source.database + '_schema.json';
      let sourceSchema = null;
      try {
        sourceSchema = await this.loadComparison(sourceSchemaPath);
      } catch (error) {
        await this.log(`⚠️  Could not load source schema file: ${sourceSchemaPath}`, 'warn');
      }

      // Validate synchronization safety
      const isValid = await this.validateSynchronization(comparison);
      if (!isValid && !options.force) {
        throw new Error('Synchronization validation failed. Use --force to override.');
      }

      // Create backup
      if (createBackup && !dryRun) {
        await this.createBackup();
      }

      // Start transaction for atomic operations
      let transaction = null;
      if (!dryRun) {
        transaction = await this.sequelize.transaction();
        await this.log('✓ Transaction started');
      }

      try {
        // Synchronize in safe order: sequences, tables, columns, indexes, constraints
        
        if (includeSequences) {
          await this.createSequences(
            comparison.differences.sequences.missing_in_target,
            transaction,
            dryRun
          );
        }

        if (sourceSchema) {
          await this.createTables(
            comparison.differences.tables.missing_in_target,
            sourceSchema,
            transaction,
            dryRun
          );
        }

        await this.addColumns(
          comparison.differences.columns.missing_in_target,
          transaction,
          dryRun
        );

        if (includeIndexes) {
          await this.createIndexes(
            comparison.differences.indexes.missing_in_target,
            transaction,
            dryRun
          );
        }

        if (includeConstraints) {
          await this.addConstraints(
            comparison.differences.constraints.missing_in_target,
            transaction,
            dryRun
          );
        }

        // Commit transaction
        if (transaction) {
          await transaction.commit();
          await this.log('✓ Transaction committed successfully');
        }

        // Generate rollback script
        if (!dryRun && this.rollbackStatements.length > 0) {
          await this.generateRollbackScript();
        }

        // Final summary
        await this.log('='.repeat(80));
        await this.log('SYNCHRONIZATION SUMMARY:');
        await this.log(`Tables created: ${this.syncStats.tablesCreated}`);
        await this.log(`Columns added: ${this.syncStats.columnsAdded}`);
        await this.log(`Indexes created: ${this.syncStats.indexesCreated}`);
        await this.log(`Constraints added: ${this.syncStats.constraintsAdded}`);
        await this.log(`Sequences created: ${this.syncStats.sequencesCreated}`);
        await this.log(`Warnings: ${this.syncStats.warnings}`);
        await this.log(`Errors: ${this.syncStats.errors}`);
        await this.log('='.repeat(80));

        if (dryRun) {
          await this.log('✓ Dry run completed successfully - no changes were made');
        } else {
          await this.log('✓ Schema synchronization completed successfully!');
        }

        return {
          success: true,
          stats: this.syncStats,
          rollbackFile: this.rollbackFile,
          logFile: this.logFile
        };

      } catch (error) {
        // Rollback transaction
        if (transaction) {
          await transaction.rollback();
          await this.log('❌ Transaction rolled back due to error', 'error');
        }
        throw error;
      }

    } finally {
      if (this.sequelize) {
        await this.sequelize.close();
      }
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node schema-synchronizer.js <comparison-file> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --dry-run           Show what would be done without making changes');
    console.error('  --apply             Apply changes to database');
    console.error('  --environment=ENV   Target environment (default: production)');
    console.error('  --no-backup         Skip backup creation');
    console.error('  --no-indexes        Skip index creation');
    console.error('  --no-constraints    Skip constraint creation');
    console.error('  --no-sequences      Skip sequence creation');
    console.error('  --force             Force synchronization despite validation warnings');
    console.error('');
    console.error('Examples:');
    console.error('  node schema-synchronizer.js comparison.json --dry-run');
    console.error('  node schema-synchronizer.js comparison.json --apply --environment=staging');
    process.exit(1);
  }

  const comparisonFile = args[0];
  const environment = args.find(arg => arg.startsWith('--environment='))?.split('=')[1] || 'production';
  
  const options = {
    dryRun: args.includes('--dry-run'),
    apply: args.includes('--apply'),
    createBackup: !args.includes('--no-backup'),
    includeIndexes: !args.includes('--no-indexes'),
    includeConstraints: !args.includes('--no-constraints'),
    includeSequences: !args.includes('--no-sequences'),
    force: args.includes('--force')
  };

  // Default to dry-run if neither --dry-run nor --apply is specified
  if (!options.dryRun && !options.apply) {
    options.dryRun = true;
    console.log('No mode specified, defaulting to --dry-run');
  }

  try {
    const synchronizer = new SchemaSynchronizer(environment);
    const result = await synchronizer.synchronize(comparisonFile, options);
    
    console.log('\n✓ Synchronization completed successfully!');
    console.log(`Log file: ${result.logFile}`);
    if (result.rollbackFile) {
      console.log(`Rollback script: ${result.rollbackFile}`);
    }
    
  } catch (error) {
    console.error('Schema synchronization failed:', error.message);
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

module.exports = SchemaSynchronizer;