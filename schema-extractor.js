/**
 * Database Schema Extractor
 * 
 * Extracts comprehensive database schema information from PostgreSQL
 * for comparison and synchronization purposes.
 * 
 * Features:
 * - Complete table structure analysis
 * - Column definitions with data types, constraints, defaults
 * - Index information and optimization recommendations
 * - Foreign key relationships and constraints
 * - Sequence and trigger information
 * - Table statistics and size information
 * - Schema export in JSON and SQL formats
 * 
 * Usage:
 * node schema-extractor.js [environment] [options]
 * 
 * Examples:
 * node schema-extractor.js development --export-json
 * node schema-extractor.js production --export-sql --include-data-stats
 */

const fs = require('fs').promises;
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const moment = require('moment');

// Load environment configuration
require('dotenv').config();

class SchemaExtractor {
  constructor(environment = 'development') {
    this.environment = environment;
    this.config = this.loadDatabaseConfig();
    this.sequelize = null;
    this.timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    this.outputDir = path.join(__dirname, 'schema-exports');
    
    this.initializeOutputDirectory();
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
        logging: false,
        pool: {
          max: 5,
          min: 1,
          acquire: 30000,
          idle: 10000
        }
      });

      await this.sequelize.authenticate();
      console.log(`✓ Connected to database: ${this.config.database}`);
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Close database connection
   */
  async disconnect() {
    if (this.sequelize) {
      await this.sequelize.close();
      console.log('✓ Database connection closed');
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
   * Extract all tables information
   */
  async extractTables() {
    console.log('Extracting table information...');
    
    const query = `
      SELECT 
        t.table_name,
        t.table_type,
        obj_description(c.oid) as table_comment,
        pg_size_pretty(pg_total_relation_size(c.oid)) as table_size,
        pg_total_relation_size(c.oid) as table_size_bytes,
        s.n_tup_ins as inserts,
        s.n_tup_upd as updates,
        s.n_tup_del as deletes,
        s.n_live_tup as live_tuples,
        s.n_dead_tup as dead_tuples
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
      LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
      WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name;
    `;

    const tables = await this.sequelize.query(query, { type: QueryTypes.SELECT });
    
    console.log(`✓ Found ${tables.length} tables`);
    return tables;
  }

  /**
   * Extract columns for all tables
   */
  async extractColumns() {
    console.log('Extracting column information...');
    
    const query = `
      SELECT 
        c.table_name,
        c.column_name,
        c.ordinal_position,
        c.column_default,
        c.is_nullable,
        c.data_type,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        c.datetime_precision,
        c.udt_name,
        col_description(pgc.oid, c.ordinal_position) as column_comment,
        CASE 
          WHEN pk.column_name IS NOT NULL THEN true 
          ELSE false 
        END as is_primary_key,
        CASE 
          WHEN fk.column_name IS NOT NULL THEN true 
          ELSE false 
        END as is_foreign_key,
        fk.foreign_table_name,
        fk.foreign_column_name,
        CASE 
          WHEN c.column_default LIKE 'nextval%' THEN true 
          ELSE false 
        END as is_auto_increment
      FROM information_schema.columns c
      LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
      LEFT JOIN (
        SELECT 
          kcu.table_name, 
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
      ) pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name
      LEFT JOIN (
        SELECT 
          kcu.table_name,
          kcu.column_name,
          ccu.table_name as foreign_table_name,
          ccu.column_name as foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
      ) fk ON fk.table_name = c.table_name AND fk.column_name = c.column_name
      WHERE c.table_schema = 'public'
      ORDER BY c.table_name, c.ordinal_position;
    `;

    const columns = await this.sequelize.query(query, { type: QueryTypes.SELECT });
    
    console.log(`✓ Found ${columns.length} columns`);
    return columns;
  }

  /**
   * Extract indexes information
   */
  async extractIndexes() {
    console.log('Extracting index information...');
    
    const query = `
      SELECT 
        t.relname as table_name,
        i.relname as index_name,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary,
        array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
        pg_size_pretty(pg_relation_size(i.oid)) as index_size,
        pg_relation_size(i.oid) as index_size_bytes,
        s.idx_tup_read,
        s.idx_tup_fetch,
        s.idx_scan,
        am.amname as index_type
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid
      LEFT JOIN pg_stat_user_indexes s ON s.indexrelname = i.relname
      JOIN pg_am am ON i.relam = am.oid
      WHERE t.relkind = 'r'
        AND a.attnum = ANY(ix.indkey)
        AND t.relname NOT LIKE 'pg_%'
      GROUP BY t.relname, i.relname, ix.indisunique, ix.indisprimary, 
               i.oid, s.idx_tup_read, s.idx_tup_fetch, s.idx_scan, am.amname
      ORDER BY t.relname, i.relname;
    `;

    const indexes = await this.sequelize.query(query, { type: QueryTypes.SELECT });
    
    console.log(`✓ Found ${indexes.length} indexes`);
    return indexes;
  }

  /**
   * Extract constraints information
   */
  async extractConstraints() {
    console.log('Extracting constraint information...');
    
    const query = `
      SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name as foreign_table_name,
        ccu.column_name as foreign_column_name,
        rc.update_rule,
        rc.delete_rule,
        cc.check_clause
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
      LEFT JOIN information_schema.referential_constraints rc 
        ON tc.constraint_name = rc.constraint_name
      LEFT JOIN information_schema.check_constraints cc 
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
    `;

    const constraints = await this.sequelize.query(query, { type: QueryTypes.SELECT });
    
    console.log(`✓ Found ${constraints.length} constraints`);
    return constraints;
  }

  /**
   * Extract sequences information
   */
  async extractSequences() {
    console.log('Extracting sequence information...');
    
    const query = `
      SELECT 
        s.sequence_name,
        s.data_type,
        s.start_value,
        s.minimum_value,
        s.maximum_value,
        s.increment,
        s.cycle_option,
        COALESCE(p.last_value, s.start_value) as current_value
      FROM information_schema.sequences s
      LEFT JOIN pg_sequences p ON p.sequencename = s.sequence_name
      WHERE s.sequence_schema = 'public'
      ORDER BY s.sequence_name;
    `;

    const sequences = await this.sequelize.query(query, { type: QueryTypes.SELECT });
    
    console.log(`✓ Found ${sequences.length} sequences`);
    return sequences;
  }

  /**
   * Extract triggers information
   */
  async extractTriggers() {
    console.log('Extracting trigger information...');
    
    const query = `
      SELECT 
        t.trigger_name,
        t.event_manipulation,
        t.event_object_table as table_name,
        t.action_timing,
        t.action_condition,
        t.action_statement,
        t.action_orientation,
        t.action_reference_old_table,
        t.action_reference_new_table
      FROM information_schema.triggers t
      WHERE t.trigger_schema = 'public'
      ORDER BY t.event_object_table, t.trigger_name;
    `;

    const triggers = await this.sequelize.query(query, { type: QueryTypes.SELECT });
    
    console.log(`✓ Found ${triggers.length} triggers`);
    return triggers;
  }

  /**
   * Extract database information
   */
  async extractDatabaseInfo() {
    console.log('Extracting database information...');
    
    const queries = {
      version: "SELECT version() as version",
      size: `SELECT pg_size_pretty(pg_database_size('${this.config.database}')) as size, 
                    pg_database_size('${this.config.database}') as size_bytes`,
      settings: `SELECT name, setting, unit, context, category, short_desc 
                 FROM pg_settings 
                 WHERE name IN ('shared_buffers', 'effective_cache_size', 'work_mem', 
                               'maintenance_work_mem', 'max_connections', 'wal_buffers',
                               'checkpoint_completion_target', 'random_page_cost')
                 ORDER BY category, name`
    };

    const results = {};
    for (const [key, query] of Object.entries(queries)) {
      results[key] = await this.sequelize.query(query, { type: QueryTypes.SELECT });
    }

    return results;
  }

  /**
   * Extract complete database schema
   */
  async extractSchema(options = {}) {
    await this.connect();

    try {
      console.log('='.repeat(60));
      console.log('EXTRACTING DATABASE SCHEMA');
      console.log(`Environment: ${this.environment}`);
      console.log(`Database: ${this.config.database}`);
      console.log(`Host: ${this.config.host}`);
      console.log('='.repeat(60));

      const schema = {
        metadata: {
          database: this.config.database,
          host: this.config.host,
          environment: this.environment,
          extracted_at: new Date().toISOString(),
          extracted_by: 'schema-extractor',
          version: '1.0.0'
        }
      };

      // Extract all schema components
      const [
        tables,
        columns,
        indexes,
        constraints,
        sequences,
        triggers,
        dbInfo
      ] = await Promise.all([
        this.extractTables(),
        this.extractColumns(),
        this.extractIndexes(),
        this.extractConstraints(),
        this.extractSequences(),
        this.extractTriggers(),
        this.extractDatabaseInfo()
      ]);

      // Organize data by table
      schema.tables = {};
      
      // Group columns by table
      const columnsByTable = {};
      columns.forEach(col => {
        if (!columnsByTable[col.table_name]) {
          columnsByTable[col.table_name] = [];
        }
        columnsByTable[col.table_name].push(col);
      });

      // Group indexes by table
      const indexesByTable = {};
      indexes.forEach(idx => {
        if (!indexesByTable[idx.table_name]) {
          indexesByTable[idx.table_name] = [];
        }
        indexesByTable[idx.table_name].push(idx);
      });

      // Group constraints by table
      const constraintsByTable = {};
      constraints.forEach(constraint => {
        if (!constraintsByTable[constraint.table_name]) {
          constraintsByTable[constraint.table_name] = [];
        }
        constraintsByTable[constraint.table_name].push(constraint);
      });

      // Build comprehensive table information
      tables.forEach(table => {
        schema.tables[table.table_name] = {
          name: table.table_name,
          type: table.table_type,
          comment: table.table_comment,
          size: table.table_size,
          size_bytes: table.table_size_bytes,
          statistics: {
            inserts: table.inserts,
            updates: table.updates,
            deletes: table.deletes,
            live_tuples: table.live_tuples,
            dead_tuples: table.dead_tuples
          },
          columns: columnsByTable[table.table_name] || [],
          indexes: indexesByTable[table.table_name] || [],
          constraints: constraintsByTable[table.table_name] || []
        };
      });

      schema.sequences = sequences;
      schema.triggers = triggers;
      schema.database_info = dbInfo;

      // Calculate summary statistics
      schema.summary = {
        total_tables: tables.length,
        total_columns: columns.length,
        total_indexes: indexes.length,
        total_constraints: constraints.length,
        total_sequences: sequences.length,
        total_triggers: triggers.length,
        database_size: dbInfo.size[0]?.size,
        database_size_bytes: dbInfo.size[0]?.size_bytes
      };

      console.log('='.repeat(60));
      console.log('EXTRACTION SUMMARY:');
      console.log(`Tables: ${schema.summary.total_tables}`);
      console.log(`Columns: ${schema.summary.total_columns}`);
      console.log(`Indexes: ${schema.summary.total_indexes}`);
      console.log(`Constraints: ${schema.summary.total_constraints}`);
      console.log(`Sequences: ${schema.summary.total_sequences}`);
      console.log(`Triggers: ${schema.summary.total_triggers}`);
      console.log(`Database Size: ${schema.summary.database_size}`);
      console.log('='.repeat(60));

      return schema;

    } finally {
      await this.disconnect();
    }
  }

  /**
   * Export schema to JSON file
   */
  async exportToJson(schema, filename = null) {
    const fileName = filename || `schema_${this.environment}_${this.timestamp}.json`;
    const filePath = path.join(this.outputDir, fileName);
    
    await fs.writeFile(filePath, JSON.stringify(schema, null, 2));
    console.log(`✓ Schema exported to JSON: ${filePath}`);
    
    return filePath;
  }

  /**
   * Export schema to SQL file
   */
  async exportToSql(schema, filename = null) {
    const fileName = filename || `schema_${this.environment}_${this.timestamp}.sql`;
    const filePath = path.join(this.outputDir, fileName);
    
    let sql = '';
    
    // Add header comment
    sql += `-- Database Schema Export\n`;
    sql += `-- Database: ${schema.metadata.database}\n`;
    sql += `-- Environment: ${schema.metadata.environment}\n`;
    sql += `-- Extracted: ${schema.metadata.extracted_at}\n`;
    sql += `--\n\n`;

    // Add sequences
    if (schema.sequences && schema.sequences.length > 0) {
      sql += `-- SEQUENCES\n`;
      sql += `--\n\n`;
      
      schema.sequences.forEach(seq => {
        sql += `CREATE SEQUENCE IF NOT EXISTS "${seq.sequence_name}"\n`;
        sql += `    START WITH ${seq.start_value}\n`;
        sql += `    INCREMENT BY ${seq.increment}\n`;
        sql += `    MINVALUE ${seq.minimum_value}\n`;
        sql += `    MAXVALUE ${seq.maximum_value}\n`;
        sql += `    ${seq.cycle_option === 'YES' ? 'CYCLE' : 'NO CYCLE'};\n\n`;
      });
    }

    // Add tables
    Object.values(schema.tables).forEach(table => {
      sql += `-- Table: ${table.name}\n`;
      if (table.comment) {
        sql += `-- ${table.comment}\n`;
      }
      sql += `--\n\n`;
      
      sql += `CREATE TABLE IF NOT EXISTS "${table.name}" (\n`;
      
      const columnDefs = table.columns.map(col => {
        let def = `    "${col.column_name}" ${col.data_type}`;
        
        if (col.character_maximum_length) {
          def += `(${col.character_maximum_length})`;
        } else if (col.numeric_precision && col.numeric_scale) {
          def += `(${col.numeric_precision},${col.numeric_scale})`;
        } else if (col.numeric_precision) {
          def += `(${col.numeric_precision})`;
        }
        
        if (col.is_nullable === 'NO') {
          def += ' NOT NULL';
        }
        
        if (col.column_default) {
          def += ` DEFAULT ${col.column_default}`;
        }
        
        return def;
      });
      
      sql += columnDefs.join(',\n');
      sql += `\n);\n\n`;
      
      // Add column comments
      table.columns.forEach(col => {
        if (col.column_comment) {
          sql += `COMMENT ON COLUMN "${table.name}"."${col.column_name}" IS '${col.column_comment}';\n`;
        }
      });
      
      if (table.comment) {
        sql += `COMMENT ON TABLE "${table.name}" IS '${table.comment}';\n`;
      }
      
      sql += '\n';
      
      // Add indexes (excluding primary key)
      table.indexes.forEach(idx => {
        if (!idx.is_primary) {
          sql += `CREATE ${idx.is_unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${idx.index_name}" ON "${table.name}" (${idx.columns.map(c => `"${c}"`).join(', ')});\n`;
        }
      });
      
      sql += '\n';
    });

    await fs.writeFile(filePath, sql);
    console.log(`✓ Schema exported to SQL: ${filePath}`);
    
    return filePath;
  }

  /**
   * Generate schema comparison report
   */
  async generateComparisonReport(schema) {
    const report = {
      metadata: schema.metadata,
      analysis: {
        tables_without_primary_key: [],
        tables_without_indexes: [],
        large_tables: [],
        unused_indexes: [],
        missing_foreign_key_indexes: [],
        tables_with_dead_tuples: []
      },
      recommendations: []
    };

    // Analyze tables
    Object.values(schema.tables).forEach(table => {
      // Check for primary key
      const hasPrimaryKey = table.constraints.some(c => c.constraint_type === 'PRIMARY KEY');
      if (!hasPrimaryKey) {
        report.analysis.tables_without_primary_key.push(table.name);
      }

      // Check for indexes (excluding primary key)
      const hasIndexes = table.indexes.some(idx => !idx.is_primary);
      if (!hasIndexes && table.columns.length > 1) {
        report.analysis.tables_without_indexes.push(table.name);
      }

      // Check table size
      if (table.size_bytes > 100 * 1024 * 1024) { // > 100MB
        report.analysis.large_tables.push({
          name: table.name,
          size: table.size,
          size_bytes: table.size_bytes
        });
      }

      // Check for unused indexes
      table.indexes.forEach(idx => {
        if (idx.idx_scan === 0 && !idx.is_primary && !idx.is_unique) {
          report.analysis.unused_indexes.push({
            table: table.name,
            index: idx.index_name,
            size: idx.index_size
          });
        }
      });

      // Check for dead tuples
      if (table.statistics.dead_tuples > 1000) {
        report.analysis.tables_with_dead_tuples.push({
          name: table.name,
          dead_tuples: table.statistics.dead_tuples,
          live_tuples: table.statistics.live_tuples
        });
      }

      // Check for missing foreign key indexes
      table.constraints.forEach(constraint => {
        if (constraint.constraint_type === 'FOREIGN KEY') {
          const hasIndex = table.indexes.some(idx => 
            idx.columns.includes(constraint.column_name)
          );
          if (!hasIndex) {
            report.analysis.missing_foreign_key_indexes.push({
              table: table.name,
              column: constraint.column_name,
              references: `${constraint.foreign_table_name}.${constraint.foreign_column_name}`
            });
          }
        }
      });
    });

    // Generate recommendations
    if (report.analysis.tables_without_primary_key.length > 0) {
      report.recommendations.push({
        priority: 'HIGH',
        category: 'Data Integrity',
        issue: 'Tables without primary keys',
        tables: report.analysis.tables_without_primary_key,
        action: 'Add primary key constraints to ensure data integrity and enable replication'
      });
    }

    if (report.analysis.missing_foreign_key_indexes.length > 0) {
      report.recommendations.push({
        priority: 'HIGH',
        category: 'Performance',
        issue: 'Missing indexes on foreign key columns',
        details: report.analysis.missing_foreign_key_indexes,
        action: 'Create indexes on foreign key columns to improve join performance'
      });
    }

    if (report.analysis.unused_indexes.length > 0) {
      report.recommendations.push({
        priority: 'MEDIUM',
        category: 'Storage Optimization',
        issue: 'Unused indexes consuming storage',
        details: report.analysis.unused_indexes,
        action: 'Consider dropping unused indexes to save storage space'
      });
    }

    if (report.analysis.tables_with_dead_tuples.length > 0) {
      report.recommendations.push({
        priority: 'MEDIUM',
        category: 'Maintenance',
        issue: 'Tables with high dead tuple count',
        details: report.analysis.tables_with_dead_tuples,
        action: 'Run VACUUM ANALYZE to reclaim space and update statistics'
      });
    }

    const reportPath = path.join(this.outputDir, `schema-analysis-${this.environment}-${this.timestamp}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`✓ Schema analysis report generated: ${reportPath}`);
    
    return report;
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  const environment = args[0] || 'development';
  
  const options = {
    exportJson: args.includes('--export-json') || args.includes('--json'),
    exportSql: args.includes('--export-sql') || args.includes('--sql'),
    includeAnalysis: args.includes('--include-analysis') || args.includes('--analysis'),
    outputFile: args.find(arg => arg.startsWith('--output='))?.split('=')[1]
  };

  // Default to JSON export if no format specified
  if (!options.exportJson && !options.exportSql) {
    options.exportJson = true;
  }

  try {
    const extractor = new SchemaExtractor(environment);
    const schema = await extractor.extractSchema(options);

    const exports = [];

    if (options.exportJson) {
      const jsonPath = await extractor.exportToJson(schema, options.outputFile);
      exports.push(jsonPath);
    }

    if (options.exportSql) {
      const sqlPath = await extractor.exportToSql(schema, options.outputFile);
      exports.push(sqlPath);
    }

    if (options.includeAnalysis) {
      const report = await extractor.generateComparisonReport(schema);
      console.log(`\n✓ Generated ${report.recommendations.length} recommendations`);
    }

    console.log('\n✓ Schema extraction completed successfully!');
    console.log('Exported files:');
    exports.forEach(file => console.log(`  - ${file}`));
    
  } catch (error) {
    console.error('Schema extraction failed:', error.message);
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

module.exports = SchemaExtractor;