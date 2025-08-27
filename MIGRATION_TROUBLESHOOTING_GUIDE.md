# Migration Troubleshooting Guide

## Problem Summary

The production server is experiencing migration failures with the following symptoms:

1. **Migration 001_create_users.js fails** with error: "column 'email_verified' does not exist"
2. **Users table exists** but is missing some expected columns
3. **Index creation fails** because it references non-existent columns
4. **Same migrations work locally** but fail on the server

## Root Cause Analysis

### Why This Happens

1. **Partial Table Creation**: The users table was created at some point, but not all columns were added (possibly from an interrupted migration or manual table creation)

2. **Schema Drift**: The production database schema diverged from what the migration expects due to:
   - Manual database changes
   - Incomplete migration execution
   - Different migration history between environments

3. **Index Creation on Missing Columns**: The migration tries to create indexes on columns that don't exist, causing the entire migration to fail and rollback

### Why Running Migration Files Directly Doesn't Work

```bash
# This WILL NOT work:
node src/migrations/001_create_users.js
```

**Reason**: Migration files are not standalone scripts. They export functions that expect:
- `queryInterface` object (Sequelize's database interface)
- `Sequelize` constructor with data types
- Transaction context
- Proper error handling and rollback mechanisms

Migration files must be executed through a migration runner that provides these dependencies.

## Solutions

### Option 1: Use the Schema Fix Script (Recommended)

```bash
# Step 1: Diagnose the current state
node diagnose-users-table.js

# Step 2: Preview what will be fixed
node fix-users-schema.js --dry-run

# Step 3: Apply the fixes
node fix-users-schema.js --force

# Step 4: Run migrations
node run-migrations.js
```

### Option 2: Use the New Migration

```bash
# Run the new migration that fixes missing columns
node run-migrations.js

# This will execute migration 026_fix_missing_users_columns.js
# which safely adds missing columns and creates indexes
```

### Option 3: Manual Database Fix

If you prefer to fix the database manually:

```sql
-- Add missing columns to users table
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN phone_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN phone_verification_code VARCHAR(10);
ALTER TABLE users ADD COLUMN reset_password_token VARCHAR(255);
ALTER TABLE users ADD COLUMN reset_password_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN total_donations DECIMAL(15,2) DEFAULT 0.00;
ALTER TABLE users ADD COLUMN donation_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN last_login TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

-- Then run migrations
node run-migrations.js
```

## Enhanced Migration Runner Features

The updated `run-migrations.js` now includes:

### 1. Column Existence Checking

```javascript
// Before creating an index, check if columns exist
const missingColumns = [];
for (const column of columnsToCheck) {
  const columnExists = await this.columnExists(tableName, column);
  if (!columnExists) {
    missingColumns.push(column);
  }
}
```

### 2. Graceful Index Creation

```javascript
if (missingColumns.length > 0) {
  console.log(`  ⚠️  Cannot create index: missing columns [${missingColumns.join(', ')}]`);
  console.log(`      Skipping index creation - fix schema first`);
  return;
}
```

### 3. Better Error Handling

- Migrations continue even if some operations fail
- Clear error messages indicating what went wrong
- Suggestions for fixing issues

## Diagnostic Tools

### 1. Schema Diagnosis Tool

```bash
node diagnose-users-table.js
```

**Output includes:**
- Current vs expected column comparison
- Missing columns list
- Missing indexes list
- SQL commands to fix issues
- Recommendations

### 2. Schema Fix Tool

```bash
node fix-users-schema.js --dry-run  # Preview changes
node fix-users-schema.js --force    # Apply changes
```

**Features:**
- Safe column addition with proper data types
- ENUM type creation
- Transaction-wrapped operations
- Rollback on errors

## Prevention Strategies

### 1. Always Use Migration Runner

```bash
# Correct way to run migrations
node run-migrations.js

# Never run migration files directly
# node src/migrations/001_create_users.js  # ❌ Wrong
```

### 2. Test Migrations in Staging

Before deploying to production:

```bash
# Test migration runner
NODE_ENV=staging node run-migrations.js --dry-run
NODE_ENV=staging node run-migrations.js
```

### 3. Backup Before Migrations

```bash
# Backup database before running migrations
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 4. Use Schema Validation

Add to your CI/CD pipeline:

```bash
# Validate schema consistency
node diagnose-users-table.js
```

## Migration Best Practices

### 1. Idempotent Migrations

All migrations should be safe to run multiple times:

```javascript
// Check before creating
const tableExists = await queryInterface.showAllTables()
  .then(tables => tables.includes('users'));

if (!tableExists) {
  await queryInterface.createTable('users', columns);
}
```

### 2. Column Existence Checks

```javascript
// Check before adding columns
const tableInfo = await queryInterface.describeTable('users');
if (!tableInfo.hasOwnProperty('email_verified')) {
  await queryInterface.addColumn('users', 'email_verified', {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  });
}
```

### 3. Index Safety

```javascript
// Check columns exist before creating indexes
const columnExists = await this.columnExists('users', 'email_verified');
if (columnExists) {
  await queryInterface.addIndex('users', ['email_verified']);
}
```

## Troubleshooting Commands

### Check Migration Status

```bash
# See which migrations have been executed
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT * FROM \"SequelizeMeta\" ORDER BY name;"
```

### Check Table Structure

```bash
# Describe users table
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\d users"
```

### Check Indexes

```bash
# List all indexes on users table
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\d+ users"
```

### Reset Migration Tracking (Use with caution)

```bash
# If you need to reset migration tracking
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "DROP TABLE IF EXISTS \"SequelizeMeta\";"
```

## Error Resolution Matrix

| Error | Cause | Solution |
|-------|-------|----------|
| `column 'email_verified' does not exist` | Missing column in existing table | Run `fix-users-schema.js --force` |
| `relation "users" already exists` | Table exists but migration tracking is missing | Add to SequelizeMeta table |
| `index "users_email_idx" already exists` | Index exists but not tracked | Use `--force` flag or check index manually |
| `permission denied` | Database user lacks privileges | Grant necessary permissions |

## Next Steps

1. **Immediate Fix**: Run the schema fix script on production
2. **Verify**: Use diagnostic tool to confirm all issues are resolved
3. **Test**: Run migrations in staging before production
4. **Monitor**: Add schema validation to deployment pipeline
5. **Document**: Keep track of any manual database changes

## Contact Information

If you encounter issues not covered in this guide:

1. Check the detailed error logs
2. Run the diagnostic tool for more information
3. Review the migration file contents
4. Check database permissions and connectivity