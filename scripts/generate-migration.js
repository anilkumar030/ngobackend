/**
 * Sequelize Migration Generator for Schema Synchronization
 * Automatically generates migration files based on schema differences
 */

const fs = require('fs').promises;
const path = require('path');
const { SchemaSynchronizer } = require('./schema-sync-automation');

class MigrationGenerator {
    constructor(config) {
        this.config = config;
        this.migrationsDir = path.join(__dirname, '../src/migrations');
        this.synchronizer = new SchemaSynchronizer(config);
    }

    /**
     * Generate timestamp for migration filename
     */
    generateTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');
        
        return `${year}${month}${day}${hour}${minute}${second}`;
    }

    /**
     * Get next migration number
     */
    async getNextMigrationNumber() {
        try {
            const files = await fs.readdir(this.migrationsDir);
            const migrationFiles = files.filter(file => file.match(/^\d{3}_.*\.js$/));
            
            if (migrationFiles.length === 0) {
                return '001';
            }
            
            const lastNumber = Math.max(...migrationFiles.map(file => 
                parseInt(file.substring(0, 3))
            ));
            
            return String(lastNumber + 1).padStart(3, '0');
        } catch (error) {
            console.error('Error getting migration number:', error);
            return '001';
        }
    }

    /**
     * Generate Sequelize data type from PostgreSQL type
     */
    mapDataType(pgType, characterMaxLength, numericPrecision, numericScale) {
        const typeMap = {
            'uuid': 'DataTypes.UUID',
            'character varying': characterMaxLength ? 
                `DataTypes.STRING(${characterMaxLength})` : 'DataTypes.STRING',
            'varchar': characterMaxLength ? 
                `DataTypes.STRING(${characterMaxLength})` : 'DataTypes.STRING',
            'text': 'DataTypes.TEXT',
            'integer': 'DataTypes.INTEGER',
            'bigint': 'DataTypes.BIGINT',
            'smallint': 'DataTypes.SMALLINT',
            'numeric': numericPrecision ? 
                `DataTypes.DECIMAL(${numericPrecision}${numericScale ? `,${numericScale}` : ''})` : 
                'DataTypes.DECIMAL',
            'decimal': numericPrecision ? 
                `DataTypes.DECIMAL(${numericPrecision}${numericScale ? `,${numericScale}` : ''})` : 
                'DataTypes.DECIMAL',
            'real': 'DataTypes.FLOAT',
            'double precision': 'DataTypes.DOUBLE',
            'boolean': 'DataTypes.BOOLEAN',
            'date': 'DataTypes.DATEONLY',
            'timestamp': 'DataTypes.DATE',
            'timestamp with time zone': 'DataTypes.DATE',
            'timestamp without time zone': 'DataTypes.DATE',
            'time': 'DataTypes.TIME',
            'json': 'DataTypes.JSON',
            'jsonb': 'DataTypes.JSONB',
            'array': 'DataTypes.ARRAY',
            'bytea': 'DataTypes.BLOB'
        };

        // Handle enum types (user-defined types)
        if (!typeMap[pgType]) {
            if (pgType.includes('_enum')) {
                return `DataTypes.ENUM(/* define enum values */)`;
            }
            return `DataTypes.STRING /* Unknown type: ${pgType} */`;
        }

        return typeMap[pgType];
    }

    /**
     * Generate column definition for migration
     */
    generateColumnDefinition(column) {
        const dataType = this.mapDataType(
            column.data_type, 
            column.character_maximum_length,
            column.numeric_precision,
            column.numeric_scale
        );

        let definition = `      ${column.column_name}: {\n`;
        definition += `        type: ${dataType}`;

        // Add allowNull
        if (column.is_nullable === 'NO') {
            definition += ',\n        allowNull: false';
        }

        // Add default value
        if (column.column_default) {
            let defaultValue = column.column_default;
            
            // Handle common defaults
            if (defaultValue.includes('gen_random_uuid()')) {
                definition += ',\n        defaultValue: DataTypes.UUIDV4';
            } else if (defaultValue.includes('CURRENT_TIMESTAMP') || defaultValue.includes('now()')) {
                definition += ',\n        defaultValue: DataTypes.NOW';
            } else if (defaultValue.match(/^'.*'::text$/)) {
                // String default
                const stringValue = defaultValue.replace(/^'(.*)'::text$/, '$1');
                definition += `,\n        defaultValue: '${stringValue}'`;
            } else if (defaultValue.match(/^\d+$/)) {
                // Numeric default
                definition += `,\n        defaultValue: ${defaultValue}`;
            } else if (defaultValue === 'true' || defaultValue === 'false') {
                // Boolean default
                definition += `,\n        defaultValue: ${defaultValue}`;
            } else {
                definition += `,\n        defaultValue: ${defaultValue} /* Review this default */`;
            }
        }

        definition += '\n      }';
        return definition;
    }

    /**
     * Generate migration for adding columns
     */
    async generateAddColumnsMigration(missingColumns) {
        const migrationNumber = await this.getNextMigrationNumber();
        const timestamp = this.generateTimestamp();
        const filename = `${migrationNumber}_add_missing_columns_${timestamp}.js`;
        
        let migrationContent = `'use strict';\n\n`;
        migrationContent += `/** @type {import('sequelize-cli').Migration} */\n`;
        migrationContent += `module.exports = {\n`;
        migrationContent += `  async up(queryInterface, Sequelize) {\n`;
        migrationContent += `    const { DataTypes } = Sequelize;\n\n`;
        
        // Group columns by table
        const columnsByTable = {};
        missingColumns.forEach(({ table, column }) => {
            if (!columnsByTable[table]) {
                columnsByTable[table] = [];
            }
            columnsByTable[table].push(column);
        });

        // Generate addColumn operations
        for (const [tableName, columns] of Object.entries(columnsByTable)) {
            migrationContent += `    // Add columns to ${tableName}\n`;
            
            for (const column of columns) {
                migrationContent += `    await queryInterface.addColumn('${tableName}', '${column.column_name}', {\n`;
                migrationContent += `      type: ${this.mapDataType(
                    column.data_type,
                    column.character_maximum_length,
                    column.numeric_precision,
                    column.numeric_scale
                )}`;
                
                if (column.is_nullable === 'NO') {
                    migrationContent += ',\n      allowNull: false';
                }
                
                if (column.column_default) {
                    migrationContent += ',\n      defaultValue: null // TODO: Set appropriate default';
                }
                
                migrationContent += '\n    });\n\n';
            }
        }

        migrationContent += `  },\n\n`;
        migrationContent += `  async down(queryInterface, Sequelize) {\n`;
        
        // Generate rollback operations
        for (const [tableName, columns] of Object.entries(columnsByTable)) {
            migrationContent += `    // Remove columns from ${tableName}\n`;
            
            for (const column of columns) {
                migrationContent += `    await queryInterface.removeColumn('${tableName}', '${column.column_name}');\n`;
            }
        }
        
        migrationContent += `  }\n`;
        migrationContent += `};\n`;

        return { filename, content: migrationContent };
    }

    /**
     * Generate migration for creating missing tables
     */
    async generateCreateTablesMigration(missingTables, localSchema) {
        const migrationNumber = await this.getNextMigrationNumber();
        const timestamp = this.generateTimestamp();
        const filename = `${migrationNumber}_create_missing_tables_${timestamp}.js`;
        
        let migrationContent = `'use strict';\n\n`;
        migrationContent += `/** @type {import('sequelize-cli').Migration} */\n`;
        migrationContent += `module.exports = {\n`;
        migrationContent += `  async up(queryInterface, Sequelize) {\n`;
        migrationContent += `    const { DataTypes } = Sequelize;\n\n`;
        
        for (const tableName of missingTables) {
            const columns = localSchema[tableName];
            if (!columns) continue;

            migrationContent += `    // Create ${tableName} table\n`;
            migrationContent += `    await queryInterface.createTable('${tableName}', {\n`;
            
            columns.forEach((column, index) => {
                migrationContent += this.generateColumnDefinition(column);
                if (index < columns.length - 1) {
                    migrationContent += ',\n';
                } else {
                    migrationContent += '\n';
                }
            });
            
            migrationContent += `    });\n\n`;
        }

        migrationContent += `  },\n\n`;
        migrationContent += `  async down(queryInterface, Sequelize) {\n`;
        
        // Generate rollback operations (drop tables in reverse order)
        const reversedTables = [...missingTables].reverse();
        for (const tableName of reversedTables) {
            migrationContent += `    await queryInterface.dropTable('${tableName}');\n`;
        }
        
        migrationContent += `  }\n`;
        migrationContent += `};\n`;

        return { filename, content: migrationContent };
    }

    /**
     * Generate migration for index creation
     */
    async generateIndexMigration(missingIndexes) {
        const migrationNumber = await this.getNextMigrationNumber();
        const timestamp = this.generateTimestamp();
        const filename = `${migrationNumber}_add_missing_indexes_${timestamp}.js`;
        
        let migrationContent = `'use strict';\n\n`;
        migrationContent += `/** @type {import('sequelize-cli').Migration} */\n`;
        migrationContent += `module.exports = {\n`;
        migrationContent += `  async up(queryInterface, Sequelize) {\n\n`;
        
        for (const index of missingIndexes) {
            migrationContent += `    // Create index ${index.index_name}\n`;
            
            if (index.is_unique) {
                migrationContent += `    await queryInterface.addIndex('${index.table_name}', {\n`;
                migrationContent += `      fields: [/* define fields */],\n`;
                migrationContent += `      unique: true,\n`;
                migrationContent += `      name: '${index.index_name}'\n`;
                migrationContent += `    });\n\n`;
            } else {
                migrationContent += `    await queryInterface.addIndex('${index.table_name}', {\n`;
                migrationContent += `      fields: [/* define fields */],\n`;
                migrationContent += `      name: '${index.index_name}'\n`;
                migrationContent += `    });\n\n`;
            }
        }

        migrationContent += `  },\n\n`;
        migrationContent += `  async down(queryInterface, Sequelize) {\n`;
        
        for (const index of missingIndexes) {
            migrationContent += `    await queryInterface.removeIndex('${index.table_name}', '${index.index_name}');\n`;
        }
        
        migrationContent += `  }\n`;
        migrationContent += `};\n`;

        return { filename, content: migrationContent };
    }

    /**
     * Write migration file to disk
     */
    async writeMigrationFile(filename, content) {
        const filePath = path.join(this.migrationsDir, filename);
        await fs.writeFile(filePath, content, 'utf8');
        console.log(`Migration file created: ${filename}`);
        return filePath;
    }

    /**
     * Main method to generate all necessary migrations
     */
    async generateMigrations() {
        try {
            console.log('Analyzing schema differences...');
            
            // Get schema differences
            const differences = await this.synchronizer.compareSchemas();
            
            const generatedFiles = [];

            // Generate migration for missing tables
            if (differences.missingTables.length > 0) {
                console.log(`Found ${differences.missingTables.length} missing tables`);
                
                const localSchema = await this.synchronizer.getSchemaStructure(
                    this.synchronizer.localPool, 
                    'local'
                );
                
                const migration = await this.generateCreateTablesMigration(
                    differences.missingTables,
                    localSchema
                );
                
                const filePath = await this.writeMigrationFile(migration.filename, migration.content);
                generatedFiles.push(filePath);
            }

            // Generate migration for missing columns
            if (differences.missingColumns.length > 0) {
                console.log(`Found ${differences.missingColumns.length} missing columns`);
                
                const migration = await this.generateAddColumnsMigration(differences.missingColumns);
                const filePath = await this.writeMigrationFile(migration.filename, migration.content);
                generatedFiles.push(filePath);
            }

            if (generatedFiles.length === 0) {
                console.log('No migrations needed - schemas are synchronized');
            } else {
                console.log('\nGenerated migration files:');
                generatedFiles.forEach(file => console.log(`  - ${path.basename(file)}`));
                
                console.log('\nNext steps:');
                console.log('1. Review the generated migration files');
                console.log('2. Test migrations on staging environment');
                console.log('3. Run migrations on production: npm run migrate');
            }

            return {
                success: true,
                generatedFiles,
                differences
            };

        } catch (error) {
            console.error('Migration generation failed:', error);
            throw error;
        } finally {
            await this.synchronizer.close();
        }
    }

    /**
     * Generate rollback migration for emergency use
     */
    async generateRollbackMigration(migrationToRollback) {
        const migrationNumber = await this.getNextMigrationNumber();
        const timestamp = this.generateTimestamp();
        const filename = `${migrationNumber}_rollback_${migrationToRollback}_${timestamp}.js`;
        
        let migrationContent = `'use strict';\n\n`;
        migrationContent += `/** @type {import('sequelize-cli').Migration} */\n`;
        migrationContent += `// EMERGENCY ROLLBACK MIGRATION\n`;
        migrationContent += `// This migration rollsback changes from ${migrationToRollback}\n\n`;
        migrationContent += `module.exports = {\n`;
        migrationContent += `  async up(queryInterface, Sequelize) {\n`;
        migrationContent += `    // TODO: Implement rollback logic\n`;
        migrationContent += `    // This should undo the changes made by ${migrationToRollback}\n`;
        migrationContent += `    throw new Error('Rollback logic not implemented');\n`;
        migrationContent += `  },\n\n`;
        migrationContent += `  async down(queryInterface, Sequelize) {\n`;
        migrationContent += `    // TODO: Implement forward migration logic\n`;
        migrationContent += `    throw new Error('Forward migration logic not implemented');\n`;
        migrationContent += `  }\n`;
        migrationContent += `};\n`;

        return { filename, content: migrationContent };
    }
}

// Configuration (same as schema-sync-automation.js)
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

// Usage
async function main() {
    if (!config.production.host) {
        console.error('Production database configuration not provided');
        console.log('Please set environment variables: PROD_DB_HOST, PROD_DB_NAME, PROD_DB_USERNAME, PROD_DB_PASSWORD');
        process.exit(1);
    }

    const generator = new MigrationGenerator(config);
    
    try {
        await generator.generateMigrations();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Export for use as module
module.exports = { MigrationGenerator };

// Run if called directly
if (require.main === module) {
    main();
}