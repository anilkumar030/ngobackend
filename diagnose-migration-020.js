const { Sequelize } = require('sequelize');
require('dotenv').config();

// Database connection
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false
  }
);

async function diagnoseMigration020() {
  try {
    console.log('🔍 Diagnosing Migration 020 Issue...\n');

    // Check if users table exists
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users';
    `);

    if (tables.length === 0) {
      console.log('❌ Users table does not exist!');
      return;
    }

    console.log('✅ Users table exists\n');

    // Get all columns in users table
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY column_name;
    `);

    // Check for specific columns that migration 020 works with
    console.log('🎯 Migration 020 target columns:');
    console.log('----------------------------------');
    
    const targetColumns = ['email_verified', 'is_email_verified', 'phone_verified', 'is_phone_verified'];
    const existingTargetColumns = [];
    
    for (const targetCol of targetColumns) {
      const exists = columns.some(col => col.column_name === targetCol);
      console.log(`${targetCol.padEnd(20)} | ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
      if (exists) {
        existingTargetColumns.push(targetCol);
      }
    }

    // Check indexes
    console.log('\n🗂️ Verification-related indexes:');
    console.log('----------------------------------');
    
    const [indexes] = await sequelize.query(`
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename = 'users' 
      AND (indexname LIKE '%verified%' OR indexname LIKE '%verification%');
    `);

    if (indexes.length === 0) {
      console.log('❌ No verification-related indexes found');
    } else {
      indexes.forEach(idx => {
        console.log(`✅ ${idx.indexname}`);
      });
    }

    // Check migration status
    console.log('\n📊 Migration status:');
    console.log('----------------------------------');
    
    const [migrations] = await sequelize.query(`
      SELECT name 
      FROM "SequelizeMeta" 
      WHERE name LIKE '%020%' OR name LIKE '%verification%'
      ORDER BY name;
    `);

    if (migrations.length === 0) {
      console.log('❌ No migration 020 records found in SequelizeMeta');
    } else {
      migrations.forEach(migration => {
        console.log(`✅ ${migration.name}`);
      });
    }

    // Check if both old and new columns have data
    console.log('\n📊 Data analysis:');
    console.log('----------------------------------');
    
    const hasOldColumns = existingTargetColumns.includes('email_verified') || existingTargetColumns.includes('phone_verified');
    const hasNewColumns = existingTargetColumns.includes('is_email_verified') || existingTargetColumns.includes('is_phone_verified');
    
    if (hasOldColumns && hasNewColumns) {
      console.log('⚠️  Both old and new columns exist - checking for data conflicts...');
      
      // Check for data in both columns
      const [dataCheck] = await sequelize.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN email_verified IS NOT NULL THEN 1 END) as has_old_email_verified,
          COUNT(CASE WHEN is_email_verified IS NOT NULL THEN 1 END) as has_new_email_verified,
          COUNT(CASE WHEN phone_verified IS NOT NULL THEN 1 END) as has_old_phone_verified,
          COUNT(CASE WHEN is_phone_verified IS NOT NULL THEN 1 END) as has_new_phone_verified
        FROM users;
      `);
      
      const data = dataCheck[0];
      console.log(`   Total users: ${data.total_users}`);
      if (existingTargetColumns.includes('email_verified')) {
        console.log(`   Users with old email_verified data: ${data.has_old_email_verified}`);
      }
      if (existingTargetColumns.includes('is_email_verified')) {
        console.log(`   Users with new is_email_verified data: ${data.has_new_email_verified}`);
      }
      if (existingTargetColumns.includes('phone_verified')) {
        console.log(`   Users with old phone_verified data: ${data.has_old_phone_verified}`);
      }
      if (existingTargetColumns.includes('is_phone_verified')) {
        console.log(`   Users with new is_phone_verified data: ${data.has_new_phone_verified}`);
      }
    }

    // Provide analysis and recommendations
    console.log('\n📈 ANALYSIS & RECOMMENDATIONS:');
    console.log('===============================');
    
    if (hasOldColumns && hasNewColumns) {
      console.log('🚨 ISSUE IDENTIFIED: Both old and new column names exist!');
      console.log('   This suggests migration 020 was partially applied.');
      console.log('   The renameColumn operation likely failed midway.');
      console.log('\n💡 SOLUTION:');
      console.log('   1. Data needs to be consolidated');
      console.log('   2. Duplicate columns need to be removed');
      console.log('   3. Migration tracking needs to be corrected');
    } else if (hasNewColumns && !hasOldColumns) {
      console.log('✅ Migration appears to have completed successfully.');
      console.log('   New column names are in place.');
      console.log('\n💡 SOLUTION:');
      console.log('   - Check if migration 020 is marked as completed in SequelizeMeta');
      console.log('   - If not, manually add the record to prevent re-running');
    } else if (hasOldColumns && !hasNewColumns) {
      console.log('📝 Migration has not been applied yet.');
      console.log('   Old column names are still in place.');
      console.log('\n💡 SOLUTION:');
      console.log('   - Migration should run normally');
      console.log('   - If it\'s failing, check for other issues (permissions, etc.)');
    } else {
      console.log('❌ Neither old nor new columns found - this is unexpected!');
      console.log('\n💡 SOLUTION:');
      console.log('   - Check if the users table was created properly');
      console.log('   - Review migration 001_create_users.js');
    }

    return {
      hasOldColumns,
      hasNewColumns,
      existingTargetColumns,
      indexes: indexes.map(idx => idx.indexname)
    };

  } catch (error) {
    console.error('❌ Error during diagnosis:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run if called directly
if (require.main === module) {
  diagnoseMigration020()
    .then(() => console.log('\n✨ Diagnosis complete!'))
    .catch(error => {
      console.error('\n💥 Diagnosis failed:', error.message);
      process.exit(1);
    });
}

module.exports = { diagnoseMigration020 };