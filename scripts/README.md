# Database Cleanup Scripts

This directory contains scripts for managing and cleaning the Shivdhaam database.

## cleanup-database.js

A comprehensive script that removes all data from campaigns, projects, certificates, donations, events, store (products/orders), and gallery tables while respecting foreign key constraints.

### What it does

The script deletes data from the following tables in the correct order:

1. **Testimonials** - Reviews and testimonials for campaigns/projects/events
2. **Saved Campaigns** - User-saved campaigns for later reference
3. **Donations** - All donation records
4. **Certificates** - Tax exemption certificates
5. **Project Updates** - Progress updates for projects
6. **Event Registrations** - Event registration records
7. **Order Items** - Individual items in orders
8. **Orders** - Customer orders
9. **Products** - Store products
10. **Campaigns** - Fundraising campaigns
11. **Projects** - Development projects
12. **Events** - Events and activities
13. **Gallery Items** - Image gallery

### Safety Features

- ✅ **Database Connection Verification**: Ensures database is accessible before proceeding
- ✅ **Record Count Display**: Shows current record counts before deletion
- ✅ **Double Confirmation**: Requires two explicit confirmations from user
- ✅ **Proper Deletion Order**: Handles foreign key constraints automatically
- ✅ **Progress Tracking**: Shows progress for each table being cleaned
- ✅ **Verification**: Verifies cleanup completion after deletion
- ✅ **Error Handling**: Comprehensive error handling with detailed messages
- ✅ **Graceful Interruption**: Handles Ctrl+C interruption safely

### Usage

#### Prerequisites

1. Make sure you have a backup of your database
2. Ensure all environment variables are properly set
3. Verify database connection is working

#### Running the script

```bash
# From the project root directory
cd "/home/anil/shivdhaam backend"

# Run the cleanup script
node scripts/cleanup-database.js

# Or make it executable and run directly
chmod +x scripts/cleanup-database.js
./scripts/cleanup-database.js
```

#### Interactive Process

1. The script will show current record counts
2. Display warning about data deletion
3. Ask for first confirmation (type "yes")
4. Ask for final confirmation (type "DELETE ALL DATA")
5. Proceed with deletion in proper order
6. Show progress and completion summary
7. Verify all tables are cleaned

### Example Output

```
🧹 Shivdhaam Database Cleanup Script
====================================

✅ Database connection established

📊 Current record counts:
================================
Campaigns           : 25
Projects            : 12
Certificates        : 156
Donations           : 1,234
Events              : 8
Event Registrations : 45
Products            : 67
Orders              : 234
Order Items         : 456
Gallery Items       : 89
Saved Campaigns     : 78
Project Updates     : 34
Testimonials        : 23
================================
Total records: 2,461

⚠️  WARNING: This action cannot be undone!
This will permanently delete ALL data from the following tables:
- Campaigns and related donations
- Projects and project updates
- Certificates
- Events and registrations
- Store products, orders, and order items
- Gallery images
- Saved campaigns and testimonials

Are you sure you want to continue? (type "yes" to confirm): yes
This is your final warning. Type "DELETE ALL DATA" to proceed: DELETE ALL DATA

🚀 Starting database cleanup...

🗑️  Deleting 23 records from Testimonials...
✅ Testimonials: Deleted 23 records in 0.12s
🗑️  Deleting 78 records from Saved Campaigns...
✅ Saved Campaigns: Deleted 78 records in 0.08s
...
🎉 Database cleanup completed successfully!
📊 Total records deleted: 2,461
⏱️  Total time: 3.45s

🔍 Verifying cleanup...
✅ Cleanup verification passed - all target tables are empty

🔄 Resetting auto-increment sequences...
✅ Sequences reset (UUIDs don't require sequence reset)

👋 Database connection closed. Goodbye!
```

### Important Notes

⚠️ **BACKUP FIRST**: Always backup your database before running this script

⚠️ **IRREVERSIBLE**: This operation cannot be undone. All data will be permanently deleted.

⚠️ **PRODUCTION USE**: Be extra careful when running in production environments.

⚠️ **USER DATA**: This script does NOT delete user accounts, only the content they created.

### What is NOT deleted

- User accounts and profiles
- User addresses
- Blog posts
- Content sections
- Statistics
- System settings and configurations

### Troubleshooting

#### Script fails with foreign key constraint error

The script handles foreign key constraints by deleting in the proper order. If you encounter constraint errors:

1. Check if there are custom foreign key relationships not accounted for
2. Manually delete problematic records first
3. Re-run the script

#### Script hangs or times out

For very large databases:

1. Consider deleting data in smaller batches
2. Increase database connection timeout settings
3. Run during off-peak hours

#### Permission errors

Ensure the database user has DELETE permissions on all target tables:

```sql
GRANT DELETE ON ALL TABLES IN SCHEMA public TO your_db_user;
```

### Development and Testing

For development/testing purposes, you can import the cleanup functions:

```javascript
const { cleanupDatabase, getRecordCounts } = require('./scripts/cleanup-database');

// Get current counts without deleting
getRecordCounts().then(console.log);

// Full cleanup (will still require confirmations)
cleanupDatabase().then(() => console.log('Cleanup complete'));
```

### Support

If you encounter issues:

1. Check database connection and permissions
2. Verify all required models are properly imported
3. Ensure foreign key constraints are properly defined
4. Check server logs for detailed error messages

---

**Created by**: Claude Assistant  
**Last Updated**: August 2025  
**Compatible with**: Node.js 16+, PostgreSQL, Sequelize ORM