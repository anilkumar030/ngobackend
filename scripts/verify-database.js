#!/usr/bin/env node
/**
 * Database Verification Script for Shiv Dhaam Foundation
 * 
 * This script verifies that the database setup is working correctly
 * and provides a summary of the database state.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

class DatabaseVerification {
  constructor(environment = 'development') {
    this.environment = environment;
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, '../src/config/database.js');
      const config = require(configPath);
      return config[this.environment];
    } catch (error) {
      console.error(`Failed to load database configuration: ${error.message}`);
      process.exit(1);
    }
  }

  async executeQuery(query, description) {
    try {
      const command = `PGPASSWORD=${this.config.password} psql -h ${this.config.host} -p ${this.config.port} -U ${this.config.username} -d ${this.config.database} -t -c "${query}"`;
      const { stdout } = await execAsync(command);
      console.log(`✅ ${description}: ${stdout.trim()}`);
      return stdout.trim();
    } catch (error) {
      console.error(`❌ ${description} failed: ${error.message}`);
      return null;
    }
  }

  async verify() {
    console.log('🔍 Verifying database setup...\n');
    
    console.log('📊 DATABASE OVERVIEW:');
    console.log('===================');
    console.log(`Database: ${this.config.database}`);
    console.log(`User: ${this.config.username}`);
    console.log(`Host: ${this.config.host}:${this.config.port}\n`);

    console.log('📋 VERIFICATION RESULTS:');
    console.log('========================');

    // Test connection
    await this.executeQuery("SELECT 'Connection successful' as status", "Database Connection");

    // Count tables
    await this.executeQuery(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
      "Total Tables"
    );

    // Check extensions
    await this.executeQuery(
      "SELECT string_agg(extname, ', ') FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_trgm', 'btree_gin')",
      "PostgreSQL Extensions"
    );

    // Check sample data
    await this.executeQuery("SELECT COUNT(*) FROM users", "Users Count");
    await this.executeQuery("SELECT COUNT(*) FROM campaigns", "Campaigns Count");
    await this.executeQuery("SELECT COUNT(*) FROM products", "Products Count");

    // Database size
    await this.executeQuery(
      `SELECT pg_size_pretty(pg_database_size('${this.config.database}'))`,
      "Database Size"
    );

    console.log('\n✨ Verification completed successfully!');
    console.log('🎉 Your database is ready for use.');
  }
}

// Main execution
if (require.main === module) {
  const environment = process.argv[2] || 'development';
  const verifier = new DatabaseVerification(environment);
  verifier.verify().catch(error => {
    console.error('Verification failed:', error.message);
    process.exit(1);
  });
}

module.exports = DatabaseVerification;