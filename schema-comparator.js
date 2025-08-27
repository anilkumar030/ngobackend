/**
 * Database Schema Comparator
 * 
 * Compares database schemas between different environments or schema files
 * to identify differences for synchronization purposes.
 * 
 * Features:
 * - Compare live databases or schema files
 * - Identify missing tables, columns, indexes, constraints
 * - Detect data type differences and potential conflicts
 * - Generate detailed difference reports
 * - Provide migration recommendations
 * - Safety analysis for proposed changes
 * 
 * Usage:
 * node schema-comparator.js [source] [target] [options]
 * 
 * Examples:
 * node schema-comparator.js development production
 * node schema-comparator.js schema-local.json production
 * node schema-comparator.js development schema-prod.json --detailed
 */

const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');
const SchemaExtractor = require('./schema-extractor');

// Load environment configuration
require('dotenv').config();

class SchemaComparator {
  constructor() {
    this.timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    this.outputDir = path.join(__dirname, 'schema-comparisons');
    
    this.initializeOutputDirectory();
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
   * Load schema from file or extract from database
   */
  async loadSchema(source) {
    // Check if source is a file path
    if (source.endsWith('.json') || source.includes('/') || source.includes('\\')) {
      try {
        const filePath = path.resolve(source);
        const content = await fs.readFile(filePath, 'utf8');
        const schema = JSON.parse(content);
        console.log(`✓ Loaded schema from file: ${filePath}`);
        return schema;
      } catch (error) {
        throw new Error(`Failed to load schema file: ${error.message}`);
      }
    }

    // Assume it's an environment name
    try {
      const extractor = new SchemaExtractor(source);
      const schema = await extractor.extractSchema();
      console.log(`✓ Extracted schema from ${source} environment`);
      return schema;
    } catch (error) {
      throw new Error(`Failed to extract schema from ${source}: ${error.message}`);
    }
  }

  /**
   * Compare two schemas and generate difference report
   */
  async compareSchemas(sourceSchema, targetSchema, options = {}) {
    console.log('Comparing schemas...');
    
    const comparison = {
      metadata: {
        source: {
          database: sourceSchema.metadata.database,
          environment: sourceSchema.metadata.environment,
          extracted_at: sourceSchema.metadata.extracted_at
        },
        target: {
          database: targetSchema.metadata.database,
          environment: targetSchema.metadata.environment,
          extracted_at: targetSchema.metadata.extracted_at
        },
        compared_at: new Date().toISOString(),
        compared_by: 'schema-comparator',
        version: '1.0.0'
      },
      differences: {
        tables: {
          missing_in_target: [],
          missing_in_source: [],
          modified: []
        },
        columns: {
          missing_in_target: [],
          missing_in_source: [],
          modified: []
        },
        indexes: {
          missing_in_target: [],
          missing_in_source: [],
          modified: []
        },
        constraints: {
          missing_in_target: [],
          missing_in_source: [],
          modified: []
        },
        sequences: {
          missing_in_target: [],
          missing_in_source: [],
          modified: []
        }
      },
      summary: {
        total_differences: 0,
        critical_differences: 0,
        safe_to_sync: true,
        requires_manual_review: []
      },
      recommendations: []
    };

    // Compare tables
    await this.compareTables(sourceSchema, targetSchema, comparison);
    
    // Compare columns
    await this.compareColumns(sourceSchema, targetSchema, comparison);
    
    // Compare indexes
    await this.compareIndexes(sourceSchema, targetSchema, comparison);
    
    // Compare constraints
    await this.compareConstraints(sourceSchema, targetSchema, comparison);
    
    // Compare sequences
    await this.compareSequences(sourceSchema, targetSchema, comparison);
    
    // Calculate summary
    this.calculateSummary(comparison);
    
    // Generate recommendations
    this.generateRecommendations(comparison);
    
    console.log(`✓ Schema comparison completed`);
    return comparison;
  }

  /**
   * Compare tables between schemas
   */
  async compareTables(sourceSchema, targetSchema, comparison) {
    const sourceTables = Object.keys(sourceSchema.tables);
    const targetTables = Object.keys(targetSchema.tables);

    // Find missing tables
    const missingInTarget = sourceTables.filter(table => !targetTables.includes(table));
    const missingInSource = targetTables.filter(table => !sourceTables.includes(table));

    comparison.differences.tables.missing_in_target = missingInTarget.map(tableName => ({
      name: tableName,
      columns: sourceSchema.tables[tableName].columns.length,
      size: sourceSchema.tables[tableName].size,
      type: 'missing_table'
    }));

    comparison.differences.tables.missing_in_source = missingInSource.map(tableName => ({
      name: tableName,
      columns: targetSchema.tables[tableName].columns.length,
      size: targetSchema.tables[tableName].size,
      type: 'extra_table'
    }));

    // Find modified tables (tables that exist in both but might have differences)
    const commonTables = sourceTables.filter(table => targetTables.includes(table));
    
    for (const tableName of commonTables) {
      const sourceTable = sourceSchema.tables[tableName];
      const targetTable = targetSchema.tables[tableName];
      
      const tableDiff = {
        name: tableName,
        differences: []
      };

      // Compare basic properties
      if (sourceTable.comment !== targetTable.comment) {
        tableDiff.differences.push({
          type: 'comment_change',
          source: sourceTable.comment,
          target: targetTable.comment
        });
      }

      if (tableDiff.differences.length > 0) {
        comparison.differences.tables.modified.push(tableDiff);
      }
    }
  }

  /**
   * Compare columns between schemas
   */
  async compareColumns(sourceSchema, targetSchema, comparison) {
    const sourceColumns = this.flattenColumns(sourceSchema);
    const targetColumns = this.flattenColumns(targetSchema);

    // Create column keys for comparison
    const sourceKeys = sourceColumns.map(col => `${col.table_name}.${col.column_name}`);
    const targetKeys = targetColumns.map(col => `${col.table_name}.${col.column_name}`);

    // Find missing columns
    const missingInTarget = sourceColumns.filter(col => 
      !targetKeys.includes(`${col.table_name}.${col.column_name}`)
    );

    const missingInSource = targetColumns.filter(col => 
      !sourceKeys.includes(`${col.table_name}.${col.column_name}`)
    );

    comparison.differences.columns.missing_in_target = missingInTarget.map(col => ({
      table: col.table_name,
      column: col.column_name,
      data_type: col.data_type,
      is_nullable: col.is_nullable,
      default_value: col.column_default,
      is_primary_key: col.is_primary_key,
      is_foreign_key: col.is_foreign_key,
      type: 'missing_column'
    }));

    comparison.differences.columns.missing_in_source = missingInSource.map(col => ({
      table: col.table_name,
      column: col.column_name,
      data_type: col.data_type,
      is_nullable: col.is_nullable,
      default_value: col.column_default,
      is_primary_key: col.is_primary_key,
      is_foreign_key: col.is_foreign_key,
      type: 'extra_column'
    }));

    // Find modified columns
    const commonColumns = sourceColumns.filter(sourceCol => 
      targetKeys.includes(`${sourceCol.table_name}.${sourceCol.column_name}`)
    );

    for (const sourceCol of commonColumns) {
      const targetCol = targetColumns.find(col => 
        col.table_name === sourceCol.table_name && 
        col.column_name === sourceCol.column_name
      );

      if (targetCol) {
        const columnDiff = this.compareColumnDefinitions(sourceCol, targetCol);
        if (columnDiff.differences.length > 0) {
          comparison.differences.columns.modified.push(columnDiff);
        }
      }
    }
  }

  /**
   * Compare column definitions
   */
  compareColumnDefinitions(sourceCol, targetCol) {
    const columnDiff = {
      table: sourceCol.table_name,
      column: sourceCol.column_name,
      differences: []
    };

    // Compare data types
    if (sourceCol.data_type !== targetCol.data_type) {
      columnDiff.differences.push({
        type: 'data_type_change',
        source: sourceCol.data_type,
        target: targetCol.data_type,
        compatibility: this.checkDataTypeCompatibility(sourceCol.data_type, targetCol.data_type)
      });
    }

    // Compare nullability
    if (sourceCol.is_nullable !== targetCol.is_nullable) {
      columnDiff.differences.push({
        type: 'nullable_change',
        source: sourceCol.is_nullable,
        target: targetCol.is_nullable,
        risk: sourceCol.is_nullable === 'YES' && targetCol.is_nullable === 'NO' ? 'HIGH' : 'LOW'
      });
    }

    // Compare default values
    if (sourceCol.column_default !== targetCol.column_default) {
      columnDiff.differences.push({
        type: 'default_change',
        source: sourceCol.column_default,
        target: targetCol.column_default
      });
    }

    // Compare constraints
    if (sourceCol.is_primary_key !== targetCol.is_primary_key) {
      columnDiff.differences.push({
        type: 'primary_key_change',
        source: sourceCol.is_primary_key,
        target: targetCol.is_primary_key,
        risk: 'CRITICAL'
      });
    }

    if (sourceCol.is_foreign_key !== targetCol.is_foreign_key) {
      columnDiff.differences.push({
        type: 'foreign_key_change',
        source: sourceCol.is_foreign_key,
        target: targetCol.is_foreign_key,
        risk: 'HIGH'
      });
    }

    return columnDiff;
  }

  /**
   * Check data type compatibility
   */
  checkDataTypeCompatibility(sourceType, targetType) {
    const compatibilityMatrix = {
      'integer': ['bigint', 'numeric', 'real', 'double precision'],
      'bigint': ['numeric', 'real', 'double precision'],
      'smallint': ['integer', 'bigint', 'numeric', 'real', 'double precision'],
      'numeric': ['real', 'double precision'],
      'real': ['double precision'],
      'character varying': ['text'],
      'character': ['character varying', 'text'],
      'text': []
    };

    if (sourceType === targetType) {
      return 'IDENTICAL';
    }

    if (compatibilityMatrix[sourceType]?.includes(targetType)) {
      return 'COMPATIBLE';
    }

    if (compatibilityMatrix[targetType]?.includes(sourceType)) {
      return 'LOSSY';
    }

    return 'INCOMPATIBLE';
  }

  /**
   * Compare indexes between schemas
   */
  async compareIndexes(sourceSchema, targetSchema, comparison) {
    const sourceIndexes = this.flattenIndexes(sourceSchema);
    const targetIndexes = this.flattenIndexes(targetSchema);

    const sourceKeys = sourceIndexes.map(idx => `${idx.table_name}.${idx.index_name}`);
    const targetKeys = targetIndexes.map(idx => `${idx.table_name}.${idx.index_name}`);

    // Find missing indexes
    const missingInTarget = sourceIndexes.filter(idx => 
      !targetKeys.includes(`${idx.table_name}.${idx.index_name}`)
    );

    const missingInSource = targetIndexes.filter(idx => 
      !sourceKeys.includes(`${idx.table_name}.${idx.index_name}`)
    );

    comparison.differences.indexes.missing_in_target = missingInTarget.map(idx => ({
      table: idx.table_name,
      index: idx.index_name,
      columns: idx.columns,
      is_unique: idx.is_unique,
      is_primary: idx.is_primary,
      type: 'missing_index'
    }));

    comparison.differences.indexes.missing_in_source = missingInSource.map(idx => ({
      table: idx.table_name,
      index: idx.index_name,
      columns: idx.columns,
      is_unique: idx.is_unique,
      is_primary: idx.is_primary,
      type: 'extra_index'
    }));

    // Find modified indexes
    const commonIndexes = sourceIndexes.filter(sourceIdx => 
      targetKeys.includes(`${sourceIdx.table_name}.${sourceIdx.index_name}`)
    );

    for (const sourceIdx of commonIndexes) {
      const targetIdx = targetIndexes.find(idx => 
        idx.table_name === sourceIdx.table_name && 
        idx.index_name === sourceIdx.index_name
      );

      if (targetIdx) {
        const indexDiff = this.compareIndexDefinitions(sourceIdx, targetIdx);
        if (indexDiff.differences.length > 0) {
          comparison.differences.indexes.modified.push(indexDiff);
        }
      }
    }
  }

  /**
   * Compare index definitions
   */
  compareIndexDefinitions(sourceIdx, targetIdx) {
    const indexDiff = {
      table: sourceIdx.table_name,
      index: sourceIdx.index_name,
      differences: []
    };

    // Compare columns
    if (JSON.stringify(sourceIdx.columns) !== JSON.stringify(targetIdx.columns)) {
      indexDiff.differences.push({
        type: 'columns_change',
        source: sourceIdx.columns,
        target: targetIdx.columns
      });
    }

    // Compare uniqueness
    if (sourceIdx.is_unique !== targetIdx.is_unique) {
      indexDiff.differences.push({
        type: 'uniqueness_change',
        source: sourceIdx.is_unique,
        target: targetIdx.is_unique,
        risk: 'HIGH'
      });
    }

    return indexDiff;
  }

  /**
   * Compare constraints between schemas
   */
  async compareConstraints(sourceSchema, targetSchema, comparison) {
    const sourceConstraints = this.flattenConstraints(sourceSchema);
    const targetConstraints = this.flattenConstraints(targetSchema);

    const sourceKeys = sourceConstraints.map(c => `${c.table_name}.${c.constraint_name}`);
    const targetKeys = targetConstraints.map(c => `${c.table_name}.${c.constraint_name}`);

    // Find missing constraints
    const missingInTarget = sourceConstraints.filter(c => 
      !targetKeys.includes(`${c.table_name}.${c.constraint_name}`)
    );

    const missingInSource = targetConstraints.filter(c => 
      !sourceKeys.includes(`${c.table_name}.${c.constraint_name}`)
    );

    comparison.differences.constraints.missing_in_target = missingInTarget.map(c => ({
      table: c.table_name,
      constraint: c.constraint_name,
      type: c.constraint_type,
      column: c.column_name,
      foreign_table: c.foreign_table_name,
      foreign_column: c.foreign_column_name,
      difference_type: 'missing_constraint'
    }));

    comparison.differences.constraints.missing_in_source = missingInSource.map(c => ({
      table: c.table_name,
      constraint: c.constraint_name,
      type: c.constraint_type,
      column: c.column_name,
      foreign_table: c.foreign_table_name,
      foreign_column: c.foreign_column_name,
      difference_type: 'extra_constraint'
    }));
  }

  /**
   * Compare sequences between schemas
   */
  async compareSequences(sourceSchema, targetSchema, comparison) {
    const sourceSequences = sourceSchema.sequences || [];
    const targetSequences = targetSchema.sequences || [];

    const sourceNames = sourceSequences.map(s => s.sequence_name);
    const targetNames = targetSequences.map(s => s.sequence_name);

    // Find missing sequences
    const missingInTarget = sourceSequences.filter(s => 
      !targetNames.includes(s.sequence_name)
    );

    const missingInSource = targetSequences.filter(s => 
      !sourceNames.includes(s.sequence_name)
    );

    comparison.differences.sequences.missing_in_target = missingInTarget.map(s => ({
      name: s.sequence_name,
      start_value: s.start_value,
      increment: s.increment,
      current_value: s.current_value,
      type: 'missing_sequence'
    }));

    comparison.differences.sequences.missing_in_source = missingInSource.map(s => ({
      name: s.sequence_name,
      start_value: s.start_value,
      increment: s.increment,
      current_value: s.current_value,
      type: 'extra_sequence'
    }));
  }

  /**
   * Helper functions to flatten schema structures
   */
  flattenColumns(schema) {
    const columns = [];
    Object.values(schema.tables).forEach(table => {
      table.columns.forEach(column => {
        columns.push({ ...column, table_name: table.name });
      });
    });
    return columns;
  }

  flattenIndexes(schema) {
    const indexes = [];
    Object.values(schema.tables).forEach(table => {
      table.indexes.forEach(index => {
        indexes.push({ ...index, table_name: table.name });
      });
    });
    return indexes;
  }

  flattenConstraints(schema) {
    const constraints = [];
    Object.values(schema.tables).forEach(table => {
      table.constraints.forEach(constraint => {
        constraints.push({ ...constraint, table_name: table.name });
      });
    });
    return constraints;
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary(comparison) {
    const counts = {
      tables: Object.values(comparison.differences.tables).reduce((sum, arr) => sum + arr.length, 0),
      columns: Object.values(comparison.differences.columns).reduce((sum, arr) => sum + arr.length, 0),
      indexes: Object.values(comparison.differences.indexes).reduce((sum, arr) => sum + arr.length, 0),
      constraints: Object.values(comparison.differences.constraints).reduce((sum, arr) => sum + arr.length, 0),
      sequences: Object.values(comparison.differences.sequences).reduce((sum, arr) => sum + arr.length, 0)
    };

    comparison.summary.total_differences = Object.values(counts).reduce((sum, count) => sum + count, 0);

    // Count critical differences
    let criticalCount = 0;
    const manualReview = [];

    // Critical: Primary key changes
    comparison.differences.columns.modified.forEach(col => {
      col.differences.forEach(diff => {
        if (diff.risk === 'CRITICAL') {
          criticalCount++;
          manualReview.push(`Critical change in ${col.table}.${col.column}: ${diff.type}`);
        }
      });
    });

    // Critical: Data type incompatibilities
    comparison.differences.columns.modified.forEach(col => {
      col.differences.forEach(diff => {
        if (diff.type === 'data_type_change' && diff.compatibility === 'INCOMPATIBLE') {
          criticalCount++;
          manualReview.push(`Incompatible data type change in ${col.table}.${col.column}: ${diff.source} → ${diff.target}`);
        }
      });
    });

    // Critical: NOT NULL changes on existing columns
    comparison.differences.columns.modified.forEach(col => {
      col.differences.forEach(diff => {
        if (diff.type === 'nullable_change' && diff.risk === 'HIGH') {
          criticalCount++;
          manualReview.push(`NOT NULL constraint added to ${col.table}.${col.column} - may fail with existing data`);
        }
      });
    });

    comparison.summary.critical_differences = criticalCount;
    comparison.summary.safe_to_sync = criticalCount === 0;
    comparison.summary.requires_manual_review = manualReview;
  }

  /**
   * Generate migration recommendations
   */
  generateRecommendations(comparison) {
    const recommendations = [];

    // Recommend table creation
    if (comparison.differences.tables.missing_in_target.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Schema Sync',
        action: 'Create missing tables',
        details: comparison.differences.tables.missing_in_target.map(t => t.name),
        safety: 'SAFE',
        description: 'Create tables that exist in source but not in target'
      });
    }

    // Recommend column addition
    if (comparison.differences.columns.missing_in_target.length > 0) {
      const safeColumns = comparison.differences.columns.missing_in_target.filter(col => 
        col.is_nullable === 'YES' || col.default_value
      );
      
      const riskyColumns = comparison.differences.columns.missing_in_target.filter(col => 
        col.is_nullable === 'NO' && !col.default_value
      );

      if (safeColumns.length > 0) {
        recommendations.push({
          priority: 'HIGH',
          category: 'Schema Sync',
          action: 'Add missing columns (safe)',
          details: safeColumns.map(c => `${c.table}.${c.column}`),
          safety: 'SAFE',
          description: 'Add nullable columns or columns with default values'
        });
      }

      if (riskyColumns.length > 0) {
        recommendations.push({
          priority: 'HIGH',
          category: 'Schema Sync',
          action: 'Add missing columns (requires attention)',
          details: riskyColumns.map(c => `${c.table}.${c.column}`),
          safety: 'REQUIRES_REVIEW',
          description: 'Add NOT NULL columns without defaults - requires data migration'
        });
      }
    }

    // Recommend index creation
    if (comparison.differences.indexes.missing_in_target.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Performance',
        action: 'Create missing indexes',
        details: comparison.differences.indexes.missing_in_target.map(i => `${i.table}.${i.index}`),
        safety: 'SAFE',
        description: 'Create indexes for better query performance'
      });
    }

    // Recommend constraint addition
    if (comparison.differences.constraints.missing_in_target.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Data Integrity',
        action: 'Add missing constraints',
        details: comparison.differences.constraints.missing_in_target.map(c => `${c.table}.${c.constraint}`),
        safety: 'REQUIRES_REVIEW',
        description: 'Add constraints - may fail if data violates constraints'
      });
    }

    // Recommend sequence creation
    if (comparison.differences.sequences.missing_in_target.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Schema Sync',
        action: 'Create missing sequences',
        details: comparison.differences.sequences.missing_in_target.map(s => s.name),
        safety: 'SAFE',
        description: 'Create sequences for auto-increment columns'
      });
    }

    comparison.recommendations = recommendations;
  }

  /**
   * Export comparison report
   */
  async exportReport(comparison, format = 'json') {
    const timestamp = this.timestamp;
    const filename = `schema-comparison-${comparison.metadata.source.environment}-vs-${comparison.metadata.target.environment}-${timestamp}`;
    
    if (format === 'json') {
      const filePath = path.join(this.outputDir, `${filename}.json`);
      await fs.writeFile(filePath, JSON.stringify(comparison, null, 2));
      console.log(`✓ Comparison report exported to: ${filePath}`);
      return filePath;
    }

    if (format === 'html') {
      const htmlContent = this.generateHtmlReport(comparison);
      const filePath = path.join(this.outputDir, `${filename}.html`);
      await fs.writeFile(filePath, htmlContent);
      console.log(`✓ HTML report exported to: ${filePath}`);
      return filePath;
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Generate HTML report
   */
  generateHtmlReport(comparison) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Schema Comparison Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        .summary { background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .critical { background: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 10px 0; }
        .warning { background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 10px 0; }
        .safe { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .diff-section { margin: 30px 0; }
        .diff-count { font-weight: bold; color: #d32f2f; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Database Schema Comparison Report</h1>
        <p><strong>Source:</strong> ${comparison.metadata.source.database} (${comparison.metadata.source.environment})</p>
        <p><strong>Target:</strong> ${comparison.metadata.target.database} (${comparison.metadata.target.environment})</p>
        <p><strong>Compared:</strong> ${comparison.metadata.compared_at}</p>
    </div>

    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Total Differences:</strong> <span class="diff-count">${comparison.summary.total_differences}</span></p>
        <p><strong>Critical Issues:</strong> <span class="diff-count">${comparison.summary.critical_differences}</span></p>
        <p><strong>Safe to Sync:</strong> ${comparison.summary.safe_to_sync ? '✅ Yes' : '❌ No'}</p>
    </div>

    ${comparison.summary.requires_manual_review.length > 0 ? `
    <div class="critical">
        <h3>⚠️ Requires Manual Review</h3>
        <ul>
            ${comparison.summary.requires_manual_review.map(item => `<li>${item}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    <div class="diff-section">
        <h2>Recommendations</h2>
        ${comparison.recommendations.map(rec => `
            <div class="${rec.safety === 'SAFE' ? 'safe' : rec.safety === 'REQUIRES_REVIEW' ? 'warning' : 'critical'}">
                <h4>${rec.action} (${rec.priority})</h4>
                <p><strong>Category:</strong> ${rec.category}</p>
                <p><strong>Safety:</strong> ${rec.safety}</p>
                <p>${rec.description}</p>
                <ul>
                    ${rec.details.map(detail => `<li>${detail}</li>`).join('')}
                </ul>
            </div>
        `).join('')}
    </div>

    <div class="diff-section">
        <h2>Missing Tables in Target</h2>
        ${comparison.differences.tables.missing_in_target.length > 0 ? `
        <table>
            <tr><th>Table Name</th><th>Columns</th><th>Size</th></tr>
            ${comparison.differences.tables.missing_in_target.map(table => `
                <tr><td>${table.name}</td><td>${table.columns}</td><td>${table.size}</td></tr>
            `).join('')}
        </table>
        ` : '<p>No missing tables found.</p>'}
    </div>

    <div class="diff-section">
        <h2>Missing Columns in Target</h2>
        ${comparison.differences.columns.missing_in_target.length > 0 ? `
        <table>
            <tr><th>Table</th><th>Column</th><th>Data Type</th><th>Nullable</th><th>Default</th></tr>
            ${comparison.differences.columns.missing_in_target.map(col => `
                <tr><td>${col.table}</td><td>${col.column}</td><td>${col.data_type}</td><td>${col.is_nullable}</td><td>${col.default_value || 'None'}</td></tr>
            `).join('')}
        </table>
        ` : '<p>No missing columns found.</p>'}
    </div>

</body>
</html>`;
    return html;
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node schema-comparator.js <source> <target> [options]');
    console.error('Examples:');
    console.error('  node schema-comparator.js development production');
    console.error('  node schema-comparator.js schema-local.json production');
    console.error('  node schema-comparator.js development schema-prod.json --html');
    process.exit(1);
  }

  const source = args[0];
  const target = args[1];
  
  const options = {
    detailed: args.includes('--detailed'),
    exportHtml: args.includes('--html'),
    exportJson: !args.includes('--html') // Default to JSON unless HTML specified
  };

  try {
    const comparator = new SchemaComparator();
    
    console.log('='.repeat(60));
    console.log('SCHEMA COMPARISON STARTED');
    console.log(`Source: ${source}`);
    console.log(`Target: ${target}`);
    console.log('='.repeat(60));

    // Load schemas
    const sourceSchema = await comparator.loadSchema(source);
    const targetSchema = await comparator.loadSchema(target);

    // Compare schemas
    const comparison = await comparator.compareSchemas(sourceSchema, targetSchema, options);

    // Export report
    const exports = [];
    if (options.exportJson) {
      const jsonPath = await comparator.exportReport(comparison, 'json');
      exports.push(jsonPath);
    }
    
    if (options.exportHtml) {
      const htmlPath = await comparator.exportReport(comparison, 'html');
      exports.push(htmlPath);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('COMPARISON SUMMARY:');
    console.log(`Total differences: ${comparison.summary.total_differences}`);
    console.log(`Critical issues: ${comparison.summary.critical_differences}`);
    console.log(`Safe to sync: ${comparison.summary.safe_to_sync ? 'Yes' : 'No'}`);
    
    if (comparison.recommendations.length > 0) {
      console.log(`\nRecommendations: ${comparison.recommendations.length}`);
      comparison.recommendations.forEach(rec => {
        console.log(`  - ${rec.action} (${rec.priority}, ${rec.safety})`);
      });
    }

    if (comparison.summary.requires_manual_review.length > 0) {
      console.log('\n⚠️  Manual review required:');
      comparison.summary.requires_manual_review.forEach(item => {
        console.log(`  - ${item}`);
      });
    }

    console.log('='.repeat(60));
    console.log('✓ Schema comparison completed successfully!');
    console.log('Reports generated:');
    exports.forEach(file => console.log(`  - ${file}`));
    
  } catch (error) {
    console.error('Schema comparison failed:', error.message);
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

module.exports = SchemaComparator;