const { Sequelize } = require('sequelize');
const { PostgreSQLConnectionHelper } = require('../utils/dbConnectionHelper');

// Database configuration for different environments
const config = {
  development: {
    username: process.env.DB_USERNAME || 'shivdhaam',
    password: process.env.DB_PASSWORD || 'shivdhaam',
    database: process.env.DB_NAME || 'shivdhaam_dev',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log,
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    }
  },
  
  test: {
    username: process.env.TEST_DB_USERNAME || 'shivdhaam',
    password: process.env.TEST_DB_PASSWORD || 'shivdhaam',
    database: process.env.TEST_DB_NAME || 'shivdhaam_test',
    host: process.env.TEST_DB_HOST || 'localhost',
    port: process.env.TEST_DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 1,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    }
  },
  
  staging: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 15,
      min: 5,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  },
  
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
};

const environment = process.env.NODE_ENV || 'development';
const dbConfig = config[environment];

// Create Sequelize instance with enhanced configuration
const sequelize = PostgreSQLConnectionHelper.createSequelizeInstance(dbConfig);

// Enhanced database connection test with comprehensive error handling
const testConnection = async () => {
  try {
    const testResult = await PostgreSQLConnectionHelper.testSequelizeConnection(sequelize);
    
    if (testResult.success) {
      console.log(`✓ Database connection established successfully for ${environment} environment.`);
      console.log(`  Database: ${testResult.details.database}`);
      console.log(`  User: ${testResult.details.user}`);
      console.log(`  Version: ${testResult.details.version}`);
    } else {
      console.error('✗ Database connection failed:');
      console.error(`  Error: ${testResult.details.errorMessage}`);
      
      if (testResult.suggestions.length > 0) {
        console.error('  Suggestions:');
        testResult.suggestions.forEach(suggestion => {
          console.error(`    - ${suggestion}`);
        });
      }
      
      process.exit(1);
    }
  } catch (error) {
    console.error('Unable to connect to the database:', error.message);
    process.exit(1);
  }
};

module.exports = {
  sequelize,
  testConnection,
  config,
  ...config
};