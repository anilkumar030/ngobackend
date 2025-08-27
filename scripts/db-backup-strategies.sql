-- PostgreSQL Database Backup and Recovery Strategies
-- For Shivdhaam Backend Application

-- ============================================================================
-- 1. COMPLETE DATABASE BACKUP STRATEGIES
-- ============================================================================

-- Full database backup with custom format (recommended for production)
-- Custom format allows selective restore and parallel operations
/*
pg_dump -h localhost -U shivdhaam -d shivdhaam_prod \
  --format=custom \
  --compress=9 \
  --verbose \
  --file="shivdhaam_backup_$(date +%Y%m%d_%H%M%S).backup"
*/

-- Schema-only backup (structure without data)
/*
pg_dump -h localhost -U shivdhaam -d shivdhaam_prod \
  --schema-only \
  --format=custom \
  --file="shivdhaam_schema_$(date +%Y%m%d_%H%M%S).backup"
*/

-- Data-only backup (data without structure)
/*
pg_dump -h localhost -U shivdhaam -d shivdhaam_prod \
  --data-only \
  --format=custom \
  --file="shivdhaam_data_$(date +%Y%m%d_%H%M%S).backup"
*/

-- ============================================================================
-- 2. INCREMENTAL BACKUP STRATEGY (WAL-E or pgBackRest)
-- ============================================================================

-- Enable WAL archiving for point-in-time recovery
-- Add to postgresql.conf:
/*
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /var/lib/postgresql/wal_archive/%f && cp %p /var/lib/postgresql/wal_archive/%f'
max_wal_senders = 3
checkpoint_completion_target = 0.9
*/

-- ============================================================================
-- 3. TABLE-SPECIFIC BACKUP FOR LARGE TABLES
-- ============================================================================

-- Backup critical tables separately for faster operations
-- Campaigns table backup
/*
pg_dump -h localhost -U shivdhaam -d shivdhaam_prod \
  --table=campaigns \
  --format=custom \
  --file="campaigns_backup_$(date +%Y%m%d_%H%M%S).backup"
*/

-- Donations table backup (most critical for business)
/*
pg_dump -h localhost -U shivdhaam -d shivdhaam_prod \
  --table=donations \
  --format=custom \
  --file="donations_backup_$(date +%Y%m%d_%H%M%S).backup"
*/

-- ============================================================================
-- 4. PRE-SCHEMA-CHANGE BACKUP STRATEGY
-- ============================================================================

-- Create a complete backup before any schema changes
-- This script should be run before migrations
CREATE OR REPLACE FUNCTION create_pre_migration_backup()
RETURNS TABLE(backup_info TEXT) AS $$
DECLARE
    backup_timestamp TEXT;
    backup_file TEXT;
BEGIN
    backup_timestamp := to_char(now(), 'YYYYMMDD_HH24MISS');
    backup_file := 'pre_migration_' || backup_timestamp || '.backup';
    
    -- Log the backup operation
    INSERT INTO migration_backups (backup_name, created_at, backup_type)
    VALUES (backup_file, now(), 'pre_migration');
    
    RETURN QUERY SELECT 
        'Backup created: ' || backup_file || ' at ' || backup_timestamp;
END;
$$ LANGUAGE plpgsql;

-- Create backup tracking table
CREATE TABLE IF NOT EXISTS migration_backups (
    id SERIAL PRIMARY KEY,
    backup_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    backup_type VARCHAR(50) NOT NULL,
    migration_version VARCHAR(50),
    notes TEXT
);

-- ============================================================================
-- 5. RECOVERY STRATEGIES
-- ============================================================================

-- Point-in-time recovery setup
-- Restore base backup and replay WAL files to specific time
/*
pg_basebackup -h localhost -U postgres -D /var/lib/postgresql/backup_restore -Ft -z -P

# Restore to specific time
echo "restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'" > /var/lib/postgresql/backup_restore/recovery.conf
echo "recovery_target_time = '2024-01-15 14:30:00'" >> /var/lib/postgresql/backup_restore/recovery.conf
*/

-- Quick schema comparison for validation
CREATE OR REPLACE FUNCTION compare_schema_versions()
RETURNS TABLE(
    table_name TEXT,
    column_name TEXT,
    data_type TEXT,
    is_nullable TEXT,
    column_default TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.table_name::TEXT,
        c.column_name::TEXT,
        c.data_type::TEXT,
        c.is_nullable::TEXT,
        c.column_default::TEXT
    FROM information_schema.tables t
    JOIN information_schema.columns c ON t.table_name = c.table_name
    WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name, c.ordinal_position;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. AUTOMATED BACKUP VALIDATION
-- ============================================================================

-- Function to validate backup integrity
CREATE OR REPLACE FUNCTION validate_backup_integrity(backup_file TEXT)
RETURNS TABLE(validation_result TEXT) AS $$
DECLARE
    table_count INTEGER;
    expected_tables TEXT[] := ARRAY[
        'users', 'campaigns', 'donations', 'products', 'orders', 
        'order_items', 'blog_posts', 'gallery', 'content_sections',
        'events', 'projects', 'testimonials', 'statistics', 
        'certificates', 'saved_campaigns', 'project_updates',
        'event_registrations', 'user_addresses'
    ];
BEGIN
    -- Check if all expected tables exist
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = ANY(expected_tables);
    
    IF table_count = array_length(expected_tables, 1) THEN
        RETURN QUERY SELECT 'Backup validation: SUCCESS - All tables present';
    ELSE
        RETURN QUERY SELECT 'Backup validation: WARNING - Missing tables detected';
    END IF;
    
    -- Additional integrity checks can be added here
    RETURN QUERY SELECT 'Tables found: ' || table_count::TEXT || '/' || array_length(expected_tables, 1)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. EMERGENCY ROLLBACK PROCEDURES
-- ============================================================================

-- Quick rollback function (use with extreme caution)
CREATE OR REPLACE FUNCTION emergency_schema_rollback(migration_id TEXT)
RETURNS TEXT AS $$
DECLARE
    rollback_sql TEXT;
BEGIN
    -- This is a placeholder - actual implementation would depend on
    -- your migration tracking system
    
    -- Log the rollback attempt
    INSERT INTO schema_rollbacks (migration_id, attempted_at, status)
    VALUES (migration_id, now(), 'initiated');
    
    RETURN 'Rollback initiated for migration: ' || migration_id;
END;
$$ LANGUAGE plpgsql;

-- Create rollback tracking table
CREATE TABLE IF NOT EXISTS schema_rollbacks (
    id SERIAL PRIMARY KEY,
    migration_id VARCHAR(255) NOT NULL,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(50) NOT NULL,
    error_message TEXT
);

-- ============================================================================
-- USAGE EXAMPLES AND BEST PRACTICES
-- ============================================================================

/*
BACKUP SCHEDULE RECOMMENDATIONS:

1. Daily automated backups:
   - Full backup every night during low traffic
   - Retain 7 days of daily backups

2. Weekly backups:
   - Full backup with extended retention
   - Retain 4 weeks of weekly backups

3. Monthly backups:
   - Archive-quality backups
   - Retain 12 months of monthly backups

4. Pre-deployment backups:
   - Always backup before any deployment
   - Include schema and data

5. Critical operation backups:
   - Before bulk data operations
   - Before schema migrations
   - Before major updates

RECOVERY TESTING:
- Test backup restoration monthly
- Validate data integrity after restoration
- Document recovery procedures
- Train team on emergency procedures
*/