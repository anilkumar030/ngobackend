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
    logging: console.log // Enable logging to see what's happening
  }
);

async function fixMigration020() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🔧 Starting Migration 020 Fix...\n');

    // Step 1: Check current state
    console.log('📊 Step 1: Analyzing current state...');
    
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name IN ('email_verified', 'is_email_verified', 'phone_verified', 'is_phone_verified');
    `, { transaction });

    const existingColumns = columns.map(col => col.column_name);
    console.log('Existing columns:', existingColumns);

    const hasOldEmail = existingColumns.includes('email_verified');
    const hasNewEmail = existingColumns.includes('is_email_verified');
    const hasOldPhone = existingColumns.includes('phone_verified');
    const hasNewPhone = existingColumns.includes('is_phone_verified');

    console.log(`Old email column (email_verified): ${hasOldEmail ? '✅' : '❌'}`);
    console.log(`New email column (is_email_verified): ${hasNewEmail ? '✅' : '❌'}`);
    console.log(`Old phone column (phone_verified): ${hasOldPhone ? '✅' : '❌'}`);
    console.log(`New phone column (is_phone_verified): ${hasNewPhone ? '✅' : '❌'}\n`);

    // Step 2: Handle email_verified columns
    console.log('📧 Step 2: Handling email verification columns...');
    
    if (hasOldEmail && hasNewEmail) {
      console.log('Both email columns exist - consolidating data...');
      
      // Copy data from old to new if new is null
      await sequelize.query(`
        UPDATE users 
        SET is_email_verified = email_verified 
        WHERE is_email_verified IS NULL AND email_verified IS NOT NULL;
      `, { transaction });
      
      // Drop the old column
      await sequelize.query(`ALTER TABLE users DROP COLUMN IF EXISTS email_verified;`, { transaction });
      console.log('✅ Consolidated email_verified → is_email_verified');
      
    } else if (hasOldEmail && !hasNewEmail) {
      console.log('Only old email column exists - renaming...');
      
      // Rename the column
      await sequelize.query(`ALTER TABLE users RENAME COLUMN email_verified TO is_email_verified;`, { transaction });
      console.log('✅ Renamed email_verified → is_email_verified');
      
    } else if (!hasOldEmail && hasNewEmail) {
      console.log('✅ New email column already in place');
      
    } else {
      console.log('❌ Neither email column exists - this is a problem!');
      
      // Create the new column
      await sequelize.query(`
        ALTER TABLE users 
        ADD COLUMN is_email_verified BOOLEAN DEFAULT false;
      `, { transaction });
      console.log('✅ Created is_email_verified column');
    }

    // Step 3: Handle phone_verified columns
    console.log('\n📱 Step 3: Handling phone verification columns...');
    
    if (hasOldPhone && hasNewPhone) {
      console.log('Both phone columns exist - consolidating data...');
      
      // Copy data from old to new if new is null
      await sequelize.query(`
        UPDATE users 
        SET is_phone_verified = phone_verified 
        WHERE is_phone_verified IS NULL AND phone_verified IS NOT NULL;
      `, { transaction });
      
      // Drop the old column
      await sequelize.query(`ALTER TABLE users DROP COLUMN IF EXISTS phone_verified;`, { transaction });
      console.log('✅ Consolidated phone_verified → is_phone_verified');
      
    } else if (hasOldPhone && !hasNewPhone) {
      console.log('Only old phone column exists - renaming...');
      
      // Rename the column
      await sequelize.query(`ALTER TABLE users RENAME COLUMN phone_verified TO is_phone_verified;`, { transaction });
      console.log('✅ Renamed phone_verified → is_phone_verified');
      
    } else if (!hasOldPhone && hasNewPhone) {
      console.log('✅ New phone column already in place');
      
    } else {
      console.log('❌ Neither phone column exists - this is a problem!');
      
      // Create the new column
      await sequelize.query(`
        ALTER TABLE users 
        ADD COLUMN is_phone_verified BOOLEAN DEFAULT false;
      `, { transaction });
      console.log('✅ Created is_phone_verified column');
    }

    // Step 4: Handle indexes
    console.log('\n🗂️ Step 4: Handling indexes...');
    
    // Check existing indexes
    const [indexes] = await sequelize.query(`
      SELECT indexname
      FROM pg_indexes 
      WHERE tablename = 'users' 
      AND indexname IN ('users_email_verified_idx', 'users_is_email_verified_idx');
    `, { transaction });

    const existingIndexes = indexes.map(idx => idx.indexname);
    console.log('Existing indexes:', existingIndexes);

    const hasOldIndex = existingIndexes.includes('users_email_verified_idx');
    const hasNewIndex = existingIndexes.includes('users_is_email_verified_idx');

    if (hasOldIndex && !hasNewIndex) {
      console.log('Removing old index and creating new one...');
      
      await sequelize.query(`DROP INDEX IF EXISTS users_email_verified_idx;`, { transaction });
      await sequelize.query(`
        CREATE INDEX users_is_email_verified_idx ON users (is_email_verified);
      `, { transaction });
      console.log('✅ Updated index email_verified → is_email_verified');
      
    } else if (hasOldIndex && hasNewIndex) {
      console.log('Both indexes exist - removing old one...');
      
      await sequelize.query(`DROP INDEX IF EXISTS users_email_verified_idx;`, { transaction });
      console.log('✅ Removed old index');
      
    } else if (!hasOldIndex && hasNewIndex) {
      console.log('✅ New index already in place');
      
    } else {
      console.log('Creating new index...');
      
      await sequelize.query(`
        CREATE INDEX users_is_email_verified_idx ON users (is_email_verified);
      `, { transaction });
      console.log('✅ Created new index');
    }

    // Step 5: Update migration tracking
    console.log('\n📝 Step 5: Updating migration tracking...');
    
    // Check if migration 020 is already marked as completed
    const [migrationRecords] = await sequelize.query(`
      SELECT name FROM "SequelizeMeta" WHERE name = '020_rename_verification_fields.js';
    `, { transaction });

    if (migrationRecords.length === 0) {
      console.log('Adding migration 020 to completed migrations...');
      
      await sequelize.query(`
        INSERT INTO "SequelizeMeta" (name) 
        VALUES ('020_rename_verification_fields.js')
        ON CONFLICT (name) DO NOTHING;
      `, { transaction });
      console.log('✅ Migration 020 marked as completed');
    } else {
      console.log('✅ Migration 020 already marked as completed');
    }

    // Step 6: Verify final state
    console.log('\n🔍 Step 6: Verifying final state...');
    
    const [finalColumns] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name IN ('email_verified', 'is_email_verified', 'phone_verified', 'is_phone_verified')
      ORDER BY column_name;
    `, { transaction });

    const finalColumnNames = finalColumns.map(col => col.column_name);
    console.log('Final columns:', finalColumnNames);

    const [finalIndexes] = await sequelize.query(`
      SELECT indexname
      FROM pg_indexes 
      WHERE tablename = 'users' 
      AND indexname LIKE '%verified%'
      ORDER BY indexname;
    `, { transaction });

    const finalIndexNames = finalIndexes.map(idx => idx.indexname);
    console.log('Final indexes:', finalIndexNames);

    // Commit the transaction
    await transaction.commit();
    
    console.log('\n🎉 SUCCESS! Migration 020 has been fixed successfully!');
    console.log('\nFinal verification:');
    console.log(`✅ is_email_verified column: ${finalColumnNames.includes('is_email_verified') ? 'EXISTS' : 'MISSING'}`);
    console.log(`✅ is_phone_verified column: ${finalColumnNames.includes('is_phone_verified') ? 'EXISTS' : 'MISSING'}`);
    console.log(`❌ email_verified column: ${finalColumnNames.includes('email_verified') ? 'STILL EXISTS (PROBLEM!)' : 'REMOVED'}`);
    console.log(`❌ phone_verified column: ${finalColumnNames.includes('phone_verified') ? 'STILL EXISTS (PROBLEM!)' : 'REMOVED'}`);
    console.log(`✅ is_email_verified index: ${finalIndexNames.includes('users_is_email_verified_idx') ? 'EXISTS' : 'MISSING'}`);

    return true;

  } catch (error) {
    // Rollback the transaction
    await transaction.rollback();
    console.error('\n💥 Fix failed! Rolling back changes...');
    console.error('Error:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run if called directly
if (require.main === module) {
  fixMigration020()
    .then(() => {
      console.log('\n✨ Fix completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('1. Run remaining migrations: npm run migrate');
      console.log('2. Test your application');
      console.log('3. Verify user authentication works correctly');
    })
    .catch(error => {
      console.error('\n💥 Fix failed:', error.message);
      console.log('\n🔄 You can safely run this script again to retry.');
      process.exit(1);
    });
}

module.exports = { fixMigration020 };