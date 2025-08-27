-- Data Preservation and Rollback Strategies for PostgreSQL
-- Enterprise-grade safety measures for schema operations

-- ============================================================================
-- 1. COMPREHENSIVE DATA PRESERVATION FRAMEWORK
-- ============================================================================

-- Create audit and backup schema for data preservation
CREATE SCHEMA IF NOT EXISTS data_preservation;

-- Table to track all schema operations
CREATE TABLE IF NOT EXISTS data_preservation.schema_operations (
    id SERIAL PRIMARY KEY,
    operation_id UUID DEFAULT gen_random_uuid(),
    operation_type VARCHAR(50) NOT NULL, -- 'ADD_COLUMN', 'DROP_COLUMN', 'ALTER_TABLE', etc.
    table_name VARCHAR(255) NOT NULL,
    operation_details JSONB NOT NULL,
    backup_table_name VARCHAR(255),
    rollback_script TEXT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    executed_by VARCHAR(255) DEFAULT current_user,
    status VARCHAR(20) DEFAULT 'EXECUTED', -- 'EXECUTED', 'ROLLED_BACK', 'FAILED'
    rollback_executed_at TIMESTAMP,
    notes TEXT
);

-- Function to create data preservation backup before schema changes
CREATE OR REPLACE FUNCTION data_preservation.create_table_backup(
    source_table TEXT,
    operation_type TEXT DEFAULT 'SCHEMA_CHANGE',
    notes TEXT DEFAULT NULL
)
RETURNS TABLE(
    operation_id UUID,
    backup_table_name TEXT,
    rows_backed_up BIGINT,
    backup_size TEXT
) AS $$
DECLARE
    backup_name TEXT;
    op_id UUID;
    row_count BIGINT;
    backup_size_bytes BIGINT;
BEGIN
    -- Generate unique operation ID
    op_id := gen_random_uuid();
    
    -- Create backup table name with timestamp
    backup_name := format('backup_%s_%s_%s', 
                         source_table, 
                         to_char(now(), 'YYYYMMDD_HH24MISS'),
                         substring(op_id::TEXT, 1, 8));
    
    -- Create backup table in preservation schema
    EXECUTE format(
        'CREATE TABLE data_preservation.%I (LIKE public.%I INCLUDING ALL)',
        backup_name, source_table
    );
    
    -- Copy all data
    EXECUTE format(
        'INSERT INTO data_preservation.%I SELECT * FROM public.%I',
        backup_name, source_table
    );
    
    -- Get statistics
    EXECUTE format('SELECT COUNT(*) FROM data_preservation.%I', backup_name) INTO row_count;
    SELECT pg_total_relation_size(format('data_preservation.%I', backup_name)::regclass) INTO backup_size_bytes;
    
    -- Record the operation
    INSERT INTO data_preservation.schema_operations (
        operation_id, operation_type, table_name, operation_details,
        backup_table_name, notes
    ) VALUES (
        op_id, operation_type, source_table,
        jsonb_build_object(
            'backup_table', backup_name,
            'source_table', source_table,
            'rows_backed_up', row_count,
            'backup_size_bytes', backup_size_bytes
        ),
        backup_name, notes
    );
    
    RETURN QUERY SELECT 
        op_id,
        backup_name::TEXT,
        row_count,
        pg_size_pretty(backup_size_bytes)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. INCREMENTAL BACKUP FOR LARGE TABLES
-- ============================================================================

-- Function for incremental backups based on timestamp
CREATE OR REPLACE FUNCTION data_preservation.create_incremental_backup(
    source_table TEXT,
    timestamp_column TEXT DEFAULT 'updated_at',
    since_timestamp TIMESTAMP DEFAULT NULL
)
RETURNS TABLE(
    backup_table_name TEXT,
    rows_backed_up BIGINT,
    backup_size TEXT,
    time_range TEXT
) AS $$
DECLARE
    backup_name TEXT;
    row_count BIGINT;
    backup_size_bytes BIGINT;
    since_ts TIMESTAMP;
    until_ts TIMESTAMP;
BEGIN
    -- Default to last 24 hours if no timestamp provided
    since_ts := COALESCE(since_timestamp, now() - INTERVAL '24 hours');
    until_ts := now();
    
    -- Create backup table name
    backup_name := format('incremental_%s_%s', 
                         source_table, 
                         to_char(now(), 'YYYYMMDD_HH24MISS'));
    
    -- Create backup table
    EXECUTE format(
        'CREATE TABLE data_preservation.%I (LIKE public.%I INCLUDING ALL)',
        backup_name, source_table
    );
    
    -- Copy incremental data
    EXECUTE format(
        'INSERT INTO data_preservation.%I 
         SELECT * FROM public.%I 
         WHERE %I >= $1 AND %I <= $2',
        backup_name, source_table, timestamp_column, timestamp_column
    ) USING since_ts, until_ts;
    
    -- Get statistics
    EXECUTE format('SELECT COUNT(*) FROM data_preservation.%I', backup_name) INTO row_count;
    SELECT pg_total_relation_size(format('data_preservation.%I', backup_name)::regclass) INTO backup_size_bytes;
    
    RETURN QUERY SELECT 
        backup_name::TEXT,
        row_count,
        pg_size_pretty(backup_size_bytes)::TEXT,
        format('%s to %s', since_ts, until_ts)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. ROW-LEVEL CHANGE TRACKING
-- ============================================================================

-- Generic audit trigger function for change tracking
CREATE OR REPLACE FUNCTION data_preservation.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    audit_table_name TEXT;
    old_data JSONB;
    new_data JSONB;
BEGIN
    audit_table_name := 'audit_' || TG_TABLE_NAME;
    
    -- Convert row data to JSONB
    IF TG_OP = 'DELETE' THEN
        old_data := to_jsonb(OLD);
        new_data := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'INSERT' THEN
        old_data := NULL;
        new_data := to_jsonb(NEW);
    END IF;
    
    -- Create audit table if it doesn't exist
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS data_preservation.%I (
            audit_id SERIAL PRIMARY KEY,
            table_name TEXT NOT NULL,
            operation TEXT NOT NULL,
            old_data JSONB,
            new_data JSONB,
            changed_by TEXT DEFAULT current_user,
            changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', audit_table_name
    );
    
    -- Insert audit record
    EXECUTE format(
        'INSERT INTO data_preservation.%I 
         (table_name, operation, old_data, new_data) 
         VALUES ($1, $2, $3, $4)',
        audit_table_name
    ) USING TG_TABLE_NAME, TG_OP, old_data, new_data;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to enable audit tracking for a table
CREATE OR REPLACE FUNCTION data_preservation.enable_audit_tracking(table_name TEXT)
RETURNS TEXT AS $$
DECLARE
    trigger_name TEXT;
BEGIN
    trigger_name := format('audit_trigger_%s', table_name);
    
    -- Drop existing trigger if exists
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, table_name);
    
    -- Create audit trigger
    EXECUTE format(
        'CREATE TRIGGER %I 
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION data_preservation.audit_trigger_function()',
        trigger_name, table_name
    );
    
    RETURN format('Audit tracking enabled for table: %s', table_name);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. POINT-IN-TIME RECOVERY SIMULATION
-- ============================================================================

-- Function to restore table data to specific point in time
CREATE OR REPLACE FUNCTION data_preservation.restore_to_point_in_time(
    table_name TEXT,
    restore_timestamp TIMESTAMP,
    preview_only BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
    operation TEXT,
    affected_rows BIGINT,
    details TEXT
) AS $$
DECLARE
    audit_table_name TEXT;
    restore_table_name TEXT;
    inserts_count BIGINT := 0;
    updates_count BIGINT := 0;
    deletes_count BIGINT := 0;
BEGIN
    audit_table_name := 'audit_' || table_name;
    restore_table_name := format('restored_%s_%s', table_name, to_char(restore_timestamp, 'YYYYMMDD_HH24MISS'));
    
    -- Check if audit table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'data_preservation' 
        AND table_name = audit_table_name
    ) THEN
        RETURN QUERY SELECT 
            'ERROR'::TEXT,
            0::BIGINT,
            'Audit table not found. Audit tracking was not enabled for this table.'::TEXT;
        RETURN;
    END IF;
    
    IF preview_only THEN
        -- Preview mode: show what would be restored
        EXECUTE format(
            'SELECT COUNT(*) FROM data_preservation.%I 
             WHERE changed_at <= $1 AND operation = ''INSERT''',
            audit_table_name
        ) USING restore_timestamp INTO inserts_count;
        
        EXECUTE format(
            'SELECT COUNT(*) FROM data_preservation.%I 
             WHERE changed_at <= $1 AND operation = ''UPDATE''',
            audit_table_name
        ) USING restore_timestamp INTO updates_count;
        
        EXECUTE format(
            'SELECT COUNT(*) FROM data_preservation.%I 
             WHERE changed_at <= $1 AND operation = ''DELETE''',
            audit_table_name
        ) USING restore_timestamp INTO deletes_count;
        
        RETURN QUERY SELECT 
            'PREVIEW'::TEXT,
            inserts_count + updates_count + deletes_count,
            format('Inserts: %s, Updates: %s, Deletes: %s', inserts_count, updates_count, deletes_count)::TEXT;
    ELSE
        -- Actual restore (requires careful implementation)
        RETURN QUERY SELECT 
            'WARNING'::TEXT,
            0::BIGINT,
            'Actual restore implementation requires careful transaction management and testing.'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. ROLLBACK STRATEGY IMPLEMENTATION
-- ============================================================================

-- Function to generate and execute rollback scripts
CREATE OR REPLACE FUNCTION data_preservation.execute_rollback(
    operation_id UUID,
    confirm_rollback BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
    status TEXT,
    details TEXT,
    rows_affected BIGINT
) AS $$
DECLARE
    operation_record RECORD;
    backup_table_name TEXT;
    target_table_name TEXT;
    rows_count BIGINT;
BEGIN
    -- Get operation details
    SELECT * INTO operation_record
    FROM data_preservation.schema_operations
    WHERE operation_id = execute_rollback.operation_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            'ERROR'::TEXT,
            'Operation ID not found'::TEXT,
            0::BIGINT;
        RETURN;
    END IF;
    
    IF operation_record.status = 'ROLLED_BACK' THEN
        RETURN QUERY SELECT 
            'WARNING'::TEXT,
            'Operation already rolled back'::TEXT,
            0::BIGINT;
        RETURN;
    END IF;
    
    backup_table_name := operation_record.backup_table_name;
    target_table_name := operation_record.table_name;
    
    IF NOT confirm_rollback THEN
        -- Preview mode
        EXECUTE format('SELECT COUNT(*) FROM data_preservation.%I', backup_table_name) INTO rows_count;
        
        RETURN QUERY SELECT 
            'PREVIEW'::TEXT,
            format('Would restore %s rows to table %s from backup %s', 
                   rows_count, target_table_name, backup_table_name)::TEXT,
            rows_count;
        RETURN;
    END IF;
    
    -- Execute rollback
    BEGIN
        -- Start transaction for rollback
        
        -- Truncate current table (or drop and recreate)
        EXECUTE format('TRUNCATE TABLE public.%I CASCADE', target_table_name);
        
        -- Restore from backup
        EXECUTE format(
            'INSERT INTO public.%I SELECT * FROM data_preservation.%I',
            target_table_name, backup_table_name
        );
        
        GET DIAGNOSTICS rows_count = ROW_COUNT;
        
        -- Update operation status
        UPDATE data_preservation.schema_operations
        SET status = 'ROLLED_BACK',
            rollback_executed_at = CURRENT_TIMESTAMP
        WHERE operation_id = execute_rollback.operation_id;
        
        RETURN QUERY SELECT 
            'SUCCESS'::TEXT,
            format('Rollback completed. Restored %s rows.', rows_count)::TEXT,
            rows_count;
            
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'ERROR'::TEXT,
            format('Rollback failed: %s', SQLERRM)::TEXT,
            0::BIGINT;
    END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. DATA VALIDATION AND INTEGRITY CHECKS
-- ============================================================================

-- Function to validate data integrity after restore operations
CREATE OR REPLACE FUNCTION data_preservation.validate_data_integrity(
    table_name TEXT,
    backup_table_name TEXT DEFAULT NULL
)
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
DECLARE
    main_count BIGINT;
    backup_count BIGINT;
    foreign_key_violations BIGINT;
    constraint_violations BIGINT;
BEGIN
    -- Row count comparison
    EXECUTE format('SELECT COUNT(*) FROM public.%I', table_name) INTO main_count;
    
    IF backup_table_name IS NOT NULL THEN
        EXECUTE format('SELECT COUNT(*) FROM data_preservation.%I', backup_table_name) INTO backup_count;
        
        RETURN QUERY SELECT 
            'row_count_comparison'::TEXT,
            CASE WHEN main_count = backup_count THEN 'PASS' ELSE 'FAIL' END,
            format('Main: %s, Backup: %s', main_count, backup_count)::TEXT;
    END IF;
    
    -- Check foreign key violations
    -- This is a simplified check - would need specific implementation per table
    SELECT COUNT(*) INTO foreign_key_violations
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = validate_data_integrity.table_name
    AND tc.constraint_type = 'FOREIGN KEY';
    
    RETURN QUERY SELECT 
        'foreign_key_constraints'::TEXT,
        'INFO'::TEXT,
        format('%s foreign key constraints to validate', foreign_key_violations)::TEXT;
    
    -- Check constraint violations (simplified)
    SELECT COUNT(*) INTO constraint_violations
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = validate_data_integrity.table_name
    AND tc.constraint_type = 'CHECK';
    
    RETURN QUERY SELECT 
        'check_constraints'::TEXT,
        'INFO'::TEXT,
        format('%s check constraints to validate', constraint_violations)::TEXT;
        
    -- Additional integrity checks can be added here
    
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. CLEANUP AND MAINTENANCE
-- ============================================================================

-- Function to clean up old backups and audit data
CREATE OR REPLACE FUNCTION data_preservation.cleanup_old_backups(
    retention_days INTEGER DEFAULT 30,
    dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
    operation TEXT,
    table_name TEXT,
    size_freed TEXT,
    status TEXT
) AS $$
DECLARE
    table_record RECORD;
    table_size BIGINT;
BEGIN
    FOR table_record IN
        SELECT schemaname, tablename, pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'data_preservation'
        AND tablename LIKE 'backup_%'
        AND tablename ~ '\d{8}_\d{6}'  -- Match timestamp pattern
    LOOP
        table_size := table_record.size_bytes;
        
        IF dry_run THEN
            RETURN QUERY SELECT 
                'DRY_RUN'::TEXT,
                table_record.tablename::TEXT,
                pg_size_pretty(table_size)::TEXT,
                'WOULD_DELETE'::TEXT;
        ELSE
            BEGIN
                EXECUTE format('DROP TABLE IF EXISTS data_preservation.%I', table_record.tablename);
                
                RETURN QUERY SELECT 
                    'DELETE'::TEXT,
                    table_record.tablename::TEXT,
                    pg_size_pretty(table_size)::TEXT,
                    'SUCCESS'::TEXT;
                    
            EXCEPTION WHEN OTHERS THEN
                RETURN QUERY SELECT 
                    'DELETE'::TEXT,
                    table_record.tablename::TEXT,
                    pg_size_pretty(table_size)::TEXT,
                    ('ERROR: ' || SQLERRM)::TEXT;
            END;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- USAGE EXAMPLES AND BEST PRACTICES
-- ============================================================================

/*
-- Before major schema change:
SELECT * FROM data_preservation.create_table_backup('campaigns', 'ADD_COLUMN', 'Adding howyoucanhelp field');

-- Enable audit tracking for critical tables:
SELECT data_preservation.enable_audit_tracking('donations');
SELECT data_preservation.enable_audit_tracking('campaigns');

-- Create incremental backup:
SELECT * FROM data_preservation.create_incremental_backup('donations');

-- Preview rollback:
SELECT * FROM data_preservation.execute_rollback('operation-uuid-here', false);

-- Execute actual rollback:
SELECT * FROM data_preservation.execute_rollback('operation-uuid-here', true);

-- Validate data integrity:
SELECT * FROM data_preservation.validate_data_integrity('campaigns');

-- Cleanup old backups (dry run):
SELECT * FROM data_preservation.cleanup_old_backups(30, true);

-- View all schema operations:
SELECT * FROM data_preservation.schema_operations ORDER BY executed_at DESC;

BEST PRACTICES:
1. Always create backups before schema changes
2. Test rollback procedures in staging
3. Monitor backup sizes and cleanup regularly
4. Enable audit tracking for critical tables
5. Validate data integrity after operations
6. Document all major schema changes
7. Have emergency rollback procedures ready
*/