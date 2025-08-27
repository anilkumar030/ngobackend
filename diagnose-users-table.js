#!/usr/bin/env node

/**
 * Database Schema Diagnosis Tool
 * 
 * This script analyzes the current state of the users table and compares it
 * with what the migration expects. It helps identify missing columns, indexes,
 * and other schema inconsistencies that are causing migration failures.
 */

'use strict';

const { Sequelize } = require('sequelize');
const dbConfig = require('./src/config/database');

class SchemaDiagnostic {
  constructor() {
    this.sequelize = dbConfig.sequelize;
    this.queryInterface = this.sequelize.getQueryInterface();
  }

  /**
   * Get current table structure
   */
  async getTableStructure(tableName) {
    try {
      const tableExists = await this.queryInterface.showAllTables()
        .then(tables => tables.includes(tableName));

      if (!tableExists) {
        return { exists: false, columns: {}, indexes: [] };
      }

      const columns = await this.queryInterface.describeTable(tableName);
      const indexes = await this.queryInterface.showIndex(tableName);

      return { exists: true, columns, indexes };
    } catch (error) {
      console.error(`Error getting table structure for ${tableName}:`, error.message);
      return { exists: false, columns: {}, indexes: [], error: error.message };
    }
  }

  /**
   * Expected columns from the 001_create_users.js migration
   */
  getExpectedUsersColumns() {
    return {
      id: { type: 'UUID', allowNull: false, primaryKey: true },
      email: { type: 'STRING', allowNull: false, unique: true },
      password_hash: { type: 'STRING', allowNull: false },
      first_name: { type: 'STRING', allowNull: false },
      last_name: { type: 'STRING', allowNull: false },
      phone_number: { type: 'STRING', allowNull: true },
      date_of_birth: { type: 'DATEONLY', allowNull: true },
      gender: { type: 'ENUM', allowNull: true },
      profile_image: { type: 'STRING', allowNull: true },
      role: { type: 'ENUM', allowNull: false, defaultValue: 'user' },
      email_verified: { type: 'BOOLEAN', defaultValue: false },
      phone_verified: { type: 'BOOLEAN', defaultValue: false },
      email_verification_token: { type: 'STRING', allowNull: true },
      phone_verification_code: { type: 'STRING', allowNull: true },
      reset_password_token: { type: 'STRING', allowNull: true },
      reset_password_expires: { type: 'DATE', allowNull: true },
      total_donations: { type: 'DECIMAL', defaultValue: 0.00 },
      donation_count: { type: 'INTEGER', defaultValue: 0 },
      preferences: { type: 'JSONB', defaultValue: {} },
      last_login: { type: 'DATE', allowNull: true },
      is_active: { type: 'BOOLEAN', defaultValue: true },
      created_at: { type: 'DATE', defaultValue: 'NOW()' },
      updated_at: { type: 'DATE', defaultValue: 'NOW()' },
      deleted_at: { type: 'DATE', allowNull: true }
    };
  }

  /**
   * Expected indexes from the migration
   */
  getExpectedUsersIndexes() {
    return [
      { name: 'users_email_unique', fields: ['email'], unique: true },
      { name: 'users_phone_number_idx', fields: ['phone_number'] },
      { name: 'users_role_idx', fields: ['role'] },
      { name: 'users_email_verified_idx', fields: ['email_verified'] },
      { name: 'users_is_active_idx', fields: ['is_active'] },
      { name: 'users_created_at_idx', fields: ['created_at'] },
      { name: 'users_total_donations_idx', fields: ['total_donations'] },
      { name: 'users_deleted_at_idx', fields: ['deleted_at'] }
    ];
  }

  /**
   * Compare current vs expected schema
   */
  compareSchema(current, expected) {
    const comparison = {
      missingColumns: [],
      extraColumns: [],
      columnDifferences: [],
      missingIndexes: [],
      extraIndexes: []
    };

    // Check for missing columns
    for (const [columnName, expectedDef] of Object.entries(expected.columns)) {
      if (!current.columns[columnName]) {
        comparison.missingColumns.push(columnName);
      } else {
        // Check for differences in column definitions
        const currentCol = current.columns[columnName];
        if (currentCol.type !== expectedDef.type) {
          comparison.columnDifferences.push({
            column: columnName,
            current: currentCol.type,
            expected: expectedDef.type
          });
        }
      }
    }

    // Check for extra columns
    for (const columnName of Object.keys(current.columns)) {
      if (!expected.columns[columnName]) {
        comparison.extraColumns.push(columnName);
      }
    }

    // Check for missing indexes
    const currentIndexNames = current.indexes.map(idx => idx.name);
    for (const expectedIdx of expected.indexes) {
      if (!currentIndexNames.includes(expectedIdx.name)) {
        comparison.missingIndexes.push(expectedIdx);
      }
    }

    // Check for extra indexes
    for (const currentIdx of current.indexes) {
      if (!expected.indexes.find(exp => exp.name === currentIdx.name)) {
        comparison.extraIndexes.push(currentIdx);
      }
    }

    return comparison;
  }

  /**
   * Check migration tracking table
   */
  async checkMigrationTracking() {
    try {
      const results = await this.sequelize.query(
        'SELECT name FROM "SequelizeMeta" ORDER BY name',
        { type: Sequelize.QueryTypes.SELECT }
      );
      return results.map(row => row.name);
    } catch (error) {
      console.log('Migration tracking table does not exist or is inaccessible');
      return [];
    }
  }

  /**
   * Generate SQL to fix missing columns
   */
  generateFixSQL(missingColumns, tableName = 'users') {
    const columnDefinitions = this.getExpectedUsersColumns();
    const sqlCommands = [];

    for (const columnName of missingColumns) {
      const colDef = columnDefinitions[columnName];
      let sql = `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}"`;
      
      switch (colDef.type) {
        case 'UUID':
          sql += ' UUID';
          break;
        case 'STRING':
          sql += ' VARCHAR(255)';
          break;
        case 'BOOLEAN':
          sql += ' BOOLEAN';
          break;
        case 'INTEGER':
          sql += ' INTEGER';
          break;
        case 'DECIMAL':
          sql += ' DECIMAL(15,2)';
          break;
        case 'DATE':
          sql += ' TIMESTAMPTZ';
          break;
        case 'DATEONLY':
          sql += ' DATE';
          break;
        case 'JSONB':
          sql += ' JSONB';
          break;
        case 'ENUM':
          if (columnName === 'gender') {
            sql += " gender_enum";
          } else if (columnName === 'role') {
            sql += " role_enum";
          }
          break;
        default:
          sql += ' TEXT';
      }

      if (colDef.allowNull === false) {
        sql += ' NOT NULL';
      }

      if (colDef.defaultValue !== undefined) {
        if (typeof colDef.defaultValue === 'boolean') {
          sql += ` DEFAULT ${colDef.defaultValue}`;
        } else if (typeof colDef.defaultValue === 'number') {
          sql += ` DEFAULT ${colDef.defaultValue}`;
        } else if (colDef.defaultValue === 'NOW()') {
          sql += ' DEFAULT NOW()';
        } else if (typeof colDef.defaultValue === 'object') {
          sql += " DEFAULT '{}'";
        } else {
          sql += ` DEFAULT '${colDef.defaultValue}'`;
        }
      }

      sql += ';';
      sqlCommands.push(sql);
    }

    return sqlCommands;
  }

  /**
   * Run comprehensive diagnosis
   */
  async runDiagnosis() {
    console.log('🔍 Running Database Schema Diagnosis');
    console.log('====================================\n');

    try {
      // Test connection
      await this.sequelize.authenticate();
      console.log('✅ Database connection successful\n');

      // Check migration tracking
      console.log('📋 Checking migration history...');
      const executedMigrations = await this.checkMigrationTracking();
      console.log(`Found ${executedMigrations.length} executed migrations:`);
      executedMigrations.forEach(name => console.log(`  - ${name}`));
      console.log();

      // Analyze users table
      console.log('🔍 Analyzing users table structure...');
      const current = await this.getTableStructure('users');
      const expected = {
        columns: this.getExpectedUsersColumns(),
        indexes: this.getExpectedUsersIndexes()
      };

      if (!current.exists) {
        console.log('❌ Users table does not exist!');
        console.log('   This suggests migration 001_create_users.js has never been executed successfully.');
        return;
      }

      console.log('✅ Users table exists');
      console.log(`   Found ${Object.keys(current.columns).length} columns`);
      console.log(`   Found ${current.indexes.length} indexes\n`);

      // Compare schemas
      console.log('📊 Schema Comparison Results:');
      console.log('=============================');
      
      const comparison = this.compareSchema(current, expected);

      // Missing columns (this is likely the cause of the migration failure)
      if (comparison.missingColumns.length > 0) {
        console.log('❌ Missing Columns:');
        comparison.missingColumns.forEach(col => console.log(`   - ${col}`));
        console.log();

        // Generate fix SQL
        console.log('🔧 SQL Commands to Fix Missing Columns:');
        console.log('=====================================');
        const fixSQL = this.generateFixSQL(comparison.missingColumns);
        fixSQL.forEach(sql => console.log(sql));
        console.log();
      } else {
        console.log('✅ All expected columns are present\n');
      }

      // Missing indexes
      if (comparison.missingIndexes.length > 0) {
        console.log('⚠️  Missing Indexes:');
        comparison.missingIndexes.forEach(idx => {
          console.log(`   - ${idx.name} on [${idx.fields.join(', ')}]`);
        });
        console.log();
      } else {
        console.log('✅ All expected indexes are present\n');
      }

      // Extra columns
      if (comparison.extraColumns.length > 0) {
        console.log('ℹ️  Extra Columns (not in migration):');
        comparison.extraColumns.forEach(col => console.log(`   - ${col}`));
        console.log();
      }

      // Column differences
      if (comparison.columnDifferences.length > 0) {
        console.log('⚠️  Column Type Differences:');
        comparison.columnDifferences.forEach(diff => {
          console.log(`   - ${diff.column}: current=${diff.current}, expected=${diff.expected}`);
        });
        console.log();
      }

      // Summary and recommendations
      console.log('💡 Recommendations:');
      console.log('==================');

      if (comparison.missingColumns.length > 0) {
        console.log('1. The migration failure is caused by missing columns in the existing users table.');
        console.log('2. Run the SQL commands above to add missing columns before re-running migrations.');
        console.log('3. Alternatively, create a new migration file to add these columns safely.');
        console.log('4. After fixing columns, re-run: node run-migrations.js');
      } else if (comparison.missingIndexes.length > 0) {
        console.log('1. Columns exist but indexes are missing.');
        console.log('2. Re-run migrations to create missing indexes: node run-migrations.js');
      } else {
        console.log('1. Schema appears to be correct.');
        console.log('2. The issue might be with migration tracking or permissions.');
        console.log('3. Try running: node run-migrations.js --force');
      }

    } catch (error) {
      console.error('❌ Diagnosis failed:', error.message);
      if (process.env.NODE_ENV === 'development') {
        console.error(error.stack);
      }
    } finally {
      await this.sequelize.close();
    }
  }
}

// Run diagnosis if this file is executed directly
if (require.main === module) {
  const diagnostic = new SchemaDiagnostic();
  diagnostic.runDiagnosis();
}

module.exports = { SchemaDiagnostic };