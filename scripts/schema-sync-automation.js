/**
 * PostgreSQL Schema Synchronization Automation
 * Safely synchronizes schema between local and production environments
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

class SchemaSynchronizer {
    constructor(config) {
        this.localConfig = config.local;
        this.productionConfig = config.production;
        this.localPool = new Pool(this.localConfig);
        this.productionPool = new Pool(this.productionConfig);
        this.logFile = path.join(__dirname, 'schema-sync.log');
    }

    /**
     * Log messages with timestamp
     */
    async log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}\n`;
        console.log(logEntry.trim());
        await fs.appendFile(this.logFile, logEntry);
    }

    /**
     * Get complete schema structure from database
     */
    async getSchemaStructure(pool, dbName) {
        const query = `
            SELECT 
                c.table_name,
                c.column_name,
                c.ordinal_position,
                c.column_default,
                c.is_nullable,
                CASE 
                    WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name
                    ELSE c.data_type
                END as data_type,
                c.character_maximum_length,
                c.numeric_precision,
                c.numeric_scale
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
            AND c.table_name IN (
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
            )
            ORDER BY c.table_name, c.ordinal_position;
        `;

        try {
            const result = await pool.query(query);
            return this.groupByTable(result.rows);
        } catch (error) {
            await this.log(`Error getting schema structure from ${dbName}: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * Get indexes from database
     */
    async getIndexes(pool, dbName) {
        const query = `
            SELECT 
                t.relname as table_name,
                i.relname as index_name,
                idx.indisunique as is_unique,
                idx.indisprimary as is_primary,
                pg_get_indexdef(idx.indexrelid) as index_definition
            FROM pg_index idx
            JOIN pg_class i ON i.oid = idx.indexrelid
            JOIN pg_class t ON t.oid = idx.indrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
            AND NOT idx.indisprimary
            ORDER BY t.relname, i.relname;
        `;

        try {
            const result = await pool.query(query);
            return result.rows;
        } catch (error) {
            await this.log(`Error getting indexes from ${dbName}: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * Get foreign key constraints
     */
    async getForeignKeys(pool, dbName) {
        const query = `
            SELECT 
                tc.constraint_name,
                tc.table_name,
                kcu.column_name,
                ccu.table_name as foreign_table_name,
                ccu.column_name as foreign_column_name,
                rc.update_rule,
                rc.delete_rule
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu 
                ON ccu.constraint_name = tc.constraint_name
            JOIN information_schema.referential_constraints rc
                ON tc.constraint_name = rc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
            ORDER BY tc.table_name, tc.constraint_name;
        `;

        try {
            const result = await pool.query(query);
            return result.rows;
        } catch (error) {
            await this.log(`Error getting foreign keys from ${dbName}: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * Group columns by table name
     */
    groupByTable(columns) {
        return columns.reduce((acc, column) => {
            if (!acc[column.table_name]) {
                acc[column.table_name] = [];
            }
            acc[column.table_name].push(column);
            return acc;
        }, {});
    }

    /**
     * Compare schemas and identify differences
     */
    async compareSchemas() {
        await this.log('Starting schema comparison...');
        
        try {
            // Get schema structures
            const [localSchema, prodSchema] = await Promise.all([
                this.getSchemaStructure(this.localPool, 'local'),
                this.getSchemaStructure(this.productionPool, 'production')
            ]);

            const differences = {
                missingTables: [],
                missingColumns: [],
                differentColumns: [],
                extraTables: [],
                extraColumns: []
            };

            // Compare tables and columns
            for (const [tableName, localColumns] of Object.entries(localSchema)) {
                if (!prodSchema[tableName]) {
                    differences.missingTables.push(tableName);
                    continue;
                }

                const prodColumns = prodSchema[tableName];
                const prodColumnMap = new Map(prodColumns.map(col => [col.column_name, col]));

                for (const localCol of localColumns) {
                    const prodCol = prodColumnMap.get(localCol.column_name);
                    
                    if (!prodCol) {
                        differences.missingColumns.push({
                            table: tableName,
                            column: localCol
                        });
                    } else if (this.columnsAreDifferent(localCol, prodCol)) {
                        differences.differentColumns.push({
                            table: tableName,
                            local: localCol,
                            production: prodCol
                        });
                    }
                }
            }

            // Check for extra tables in production
            for (const tableName of Object.keys(prodSchema)) {
                if (!localSchema[tableName]) {
                    differences.extraTables.push(tableName);
                }
            }

            await this.log(`Schema comparison completed. Found ${differences.missingTables.length} missing tables, ${differences.missingColumns.length} missing columns`);
            
            return differences;
        } catch (error) {
            await this.log(`Schema comparison failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * Check if two columns are different
     */
    columnsAreDifferent(localCol, prodCol) {
        return localCol.data_type !== prodCol.data_type ||
               localCol.is_nullable !== prodCol.is_nullable ||
               localCol.column_default !== prodCol.column_default ||
               localCol.character_maximum_length !== prodCol.character_maximum_length;
    }

    /**
     * Generate migration SQL for missing columns
     */
    generateColumnMigrationSQL(missingColumns) {
        const sql = [];
        
        for (const { table, column } of missingColumns) {
            let dataType = column.data_type;
            
            // Add length for character types
            if (column.character_maximum_length && 
                ['character varying', 'varchar', 'character', 'char'].includes(dataType)) {
                dataType += `(${column.character_maximum_length})`;
            }
            
            // Add precision and scale for numeric types
            if (column.numeric_precision && column.data_type === 'numeric') {
                dataType += `(${column.numeric_precision}`;
                if (column.numeric_scale) {
                    dataType += `,${column.numeric_scale}`;
                }
                dataType += ')';
            }

            let columnSQL = `ALTER TABLE ${table} ADD COLUMN ${column.column_name} ${dataType}`;
            
            // Add default if exists
            if (column.column_default) {
                columnSQL += ` DEFAULT ${column.column_default}`;
            }
            
            // Add NOT NULL if needed
            if (column.is_nullable === 'NO') {
                // For NOT NULL columns, we need to be careful
                columnSQL += ';';
                sql.push(`-- Add column as nullable first`);
                sql.push(columnSQL);
                sql.push(`-- Update existing rows if needed`);
                sql.push(`-- UPDATE ${table} SET ${column.column_name} = 'default_value' WHERE ${column.column_name} IS NULL;`);
                sql.push(`-- Add NOT NULL constraint`);
                sql.push(`ALTER TABLE ${table} ALTER COLUMN ${column.column_name} SET NOT NULL;`);
            } else {
                columnSQL += ';';
                sql.push(columnSQL);
            }
        }
        
        return sql;
    }

    /**
     * Create production backup before migration
     */
    async createProductionBackup() {
        await this.log('Creating production backup...');
        
        const backupQuery = `
            SELECT data_preservation.create_table_backup($1, 'SCHEMA_SYNC', 'Pre-schema-sync backup')
        `;
        
        try {
            // Get all table names
            const tablesResult = await this.productionPool.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
            `);
            
            const backupResults = [];
            for (const row of tablesResult.rows) {
                const result = await this.productionPool.query(backupQuery, [row.table_name]);
                backupResults.push(result.rows[0]);
            }
            
            await this.log(`Production backup completed for ${backupResults.length} tables`);
            return backupResults;
        } catch (error) {
            await this.log(`Production backup failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * Execute migration SQL safely
     */
    async executeMigration(sqlStatements, dryRun = true) {
        if (dryRun) {
            await this.log('DRY RUN MODE - SQL statements that would be executed:');
            for (const sql of sqlStatements) {
                await this.log(`  ${sql}`);
            }
            return { success: true, dryRun: true };
        }

        const client = await this.productionPool.connect();
        
        try {
            await client.query('BEGIN');
            await this.log('Starting transaction for schema migration...');
            
            for (const sql of sqlStatements) {
                if (sql.startsWith('--')) {
                    await this.log(`Comment: ${sql}`);
                    continue;
                }
                
                await this.log(`Executing: ${sql}`);
                await client.query(sql);
            }
            
            await client.query('COMMIT');
            await this.log('Schema migration completed successfully');
            
            return { success: true, dryRun: false, statementsExecuted: sqlStatements.length };
        } catch (error) {
            await client.query('ROLLBACK');
            await this.log(`Schema migration failed, rolled back: ${error.message}`, 'ERROR');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Validate schema after migration
     */
    async validateMigration() {
        await this.log('Validating schema after migration...');
        
        try {
            const differences = await this.compareSchemas();
            
            const hasIssues = differences.missingTables.length > 0 || 
                            differences.missingColumns.length > 0 ||
                            differences.differentColumns.length > 0;
            
            if (hasIssues) {
                await this.log('Schema validation found remaining differences', 'WARNING');
                return { valid: false, differences };
            } else {
                await this.log('Schema validation passed - schemas are synchronized');
                return { valid: true, differences };
            }
        } catch (error) {
            await this.log(`Schema validation failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * Main synchronization method
     */
    async synchronize(options = {}) {
        const { 
            dryRun = true, 
            createBackup = true, 
            validateAfter = true 
        } = options;

        try {
            await this.log(`Starting schema synchronization (dryRun: ${dryRun})`);
            
            // Step 1: Compare schemas
            const differences = await this.compareSchemas();
            
            if (differences.missingTables.length === 0 && 
                differences.missingColumns.length === 0) {
                await this.log('Schemas are already synchronized');
                return { 
                    success: true, 
                    message: 'No changes needed',
                    differences 
                };
            }

            // Step 2: Create backup if not dry run
            let backupResults = null;
            if (!dryRun && createBackup) {
                backupResults = await this.createProductionBackup();
            }

            // Step 3: Generate migration SQL
            const migrationSQL = [];
            
            // Handle missing tables (would need table creation logic)
            if (differences.missingTables.length > 0) {
                migrationSQL.push('-- Missing tables need to be created manually or via migrations');
                for (const tableName of differences.missingTables) {
                    migrationSQL.push(`-- Missing table: ${tableName}`);
                }
            }
            
            // Handle missing columns
            if (differences.missingColumns.length > 0) {
                migrationSQL.push('-- Adding missing columns');
                migrationSQL.push(...this.generateColumnMigrationSQL(differences.missingColumns));
            }

            // Step 4: Execute migration
            const migrationResult = await this.executeMigration(migrationSQL, dryRun);

            // Step 5: Validate if not dry run
            let validationResult = null;
            if (!dryRun && validateAfter) {
                validationResult = await this.validateMigration();
            }

            return {
                success: true,
                dryRun,
                differences,
                migrationResult,
                backupResults,
                validationResult
            };

        } catch (error) {
            await this.log(`Schema synchronization failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * Close database connections
     */
    async close() {
        await Promise.all([
            this.localPool.end(),
            this.productionPool.end()
        ]);
        await this.log('Database connections closed');
    }
}

// Configuration
const config = {
    local: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'shivdhaam_dev',
        user: process.env.DB_USERNAME || 'shivdhaam',
        password: process.env.DB_PASSWORD || 'shivdhaam',
        ssl: false
    },
    production: {
        host: process.env.PROD_DB_HOST,
        port: process.env.PROD_DB_PORT || 5432,
        database: process.env.PROD_DB_NAME,
        user: process.env.PROD_DB_USERNAME,
        password: process.env.PROD_DB_PASSWORD,
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    }
};

// Usage example
async function main() {
    if (!config.production.host) {
        console.error('Production database configuration not provided');
        console.log('Please set environment variables: PROD_DB_HOST, PROD_DB_NAME, PROD_DB_USERNAME, PROD_DB_PASSWORD');
        process.exit(1);
    }

    const synchronizer = new SchemaSynchronizer(config);
    
    try {
        // First run in dry-run mode
        console.log('Running schema synchronization in DRY RUN mode...');
        const dryRunResult = await synchronizer.synchronize({ dryRun: true });
        
        console.log('\nDry run results:');
        console.log(JSON.stringify(dryRunResult, null, 2));
        
        // Uncomment the following lines to execute actual migration
        // WARNING: Only run this after testing in staging environment
        /*
        if (dryRunResult.differences.missingColumns.length > 0) {
            console.log('\nExecuting actual migration...');
            const migrationResult = await synchronizer.synchronize({ 
                dryRun: false,
                createBackup: true,
                validateAfter: true 
            });
            console.log('\nMigration results:');
            console.log(JSON.stringify(migrationResult, null, 2));
        }
        */
        
    } catch (error) {
        console.error('Schema synchronization error:', error);
        process.exit(1);
    } finally {
        await synchronizer.close();
    }
}

// Export for use as module
module.exports = { SchemaSynchronizer, config };

// Run if called directly
if (require.main === module) {
    main();
}