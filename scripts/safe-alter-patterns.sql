-- Safe ALTER TABLE Patterns for Production PostgreSQL
-- Best practices for schema changes without downtime

-- ============================================================================
-- 1. SAFE COLUMN ADDITION PATTERNS
-- ============================================================================

-- Pattern 1: Add nullable column with default (safest)
-- This is safe because it doesn't require table rewrite
DO $$
BEGIN
    -- Check if column exists before adding
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'campaigns' 
        AND column_name = 'new_column'
    ) THEN
        ALTER TABLE campaigns 
        ADD COLUMN new_column VARCHAR(255) DEFAULT NULL;
        
        RAISE NOTICE 'Column new_column added to campaigns table';
    ELSE
        RAISE NOTICE 'Column new_column already exists in campaigns table';
    END IF;
END
$$;

-- Pattern 2: Add column with NOT NULL and default (requires table rewrite)
-- Use this pattern carefully for large tables
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'campaigns' 
        AND column_name = 'status_updated_at'
    ) THEN
        -- Step 1: Add nullable column with default
        ALTER TABLE campaigns 
        ADD COLUMN status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        
        -- Step 2: Update existing rows (in batches for large tables)
        UPDATE campaigns 
        SET status_updated_at = updated_at 
        WHERE status_updated_at IS NULL;
        
        -- Step 3: Add NOT NULL constraint
        ALTER TABLE campaigns 
        ALTER COLUMN status_updated_at SET NOT NULL;
        
        RAISE NOTICE 'Column status_updated_at added with NOT NULL constraint';
    END IF;
END
$$;

-- Pattern 3: Batch update for large tables
-- Use this for tables with millions of rows
CREATE OR REPLACE FUNCTION safe_batch_update(
    table_name TEXT,
    column_name TEXT,
    update_expression TEXT,
    batch_size INTEGER DEFAULT 10000
)
RETURNS INTEGER AS $$
DECLARE
    total_updated INTEGER := 0;
    rows_updated INTEGER;
    min_id UUID;
    max_id UUID;
BEGIN
    -- Get ID range
    EXECUTE format('SELECT MIN(id), MAX(id) FROM %I', table_name) 
    INTO min_id, max_id;
    
    LOOP
        -- Update in batches
        EXECUTE format(
            'UPDATE %I SET %I = %s WHERE id >= $1 AND %I IS NULL LIMIT $2',
            table_name, column_name, update_expression, column_name
        ) USING min_id, batch_size;
        
        GET DIAGNOSTICS rows_updated = ROW_COUNT;
        total_updated := total_updated + rows_updated;
        
        -- Exit if no more rows to update
        EXIT WHEN rows_updated = 0;
        
        -- Sleep to avoid blocking
        PERFORM pg_sleep(0.1);
    END LOOP;
    
    RETURN total_updated;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. SAFE INDEX CREATION PATTERNS
-- ============================================================================

-- Pattern 1: Create index concurrently (no blocking)
-- This is the safest way to add indexes to production tables
DO $$
BEGIN
    -- Check if index exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'donations' 
        AND indexname = 'idx_donations_created_at_status'
    ) THEN
        -- Create index concurrently
        CREATE INDEX CONCURRENTLY idx_donations_created_at_status 
        ON donations (created_at, status);
        
        RAISE NOTICE 'Index idx_donations_created_at_status created concurrently';
    ELSE
        RAISE NOTICE 'Index idx_donations_created_at_status already exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Failed to create index: %', SQLERRM;
END
$$;

-- Pattern 2: Create partial index for better performance
-- Useful for frequently queried subsets
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'campaigns' 
        AND indexname = 'idx_campaigns_active_featured'
    ) THEN
        CREATE INDEX CONCURRENTLY idx_campaigns_active_featured 
        ON campaigns (created_at DESC) 
        WHERE status = 'active' AND featured = true;
        
        RAISE NOTICE 'Partial index idx_campaigns_active_featured created';
    END IF;
END
$$;

-- Pattern 3: GIN index for JSONB columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'campaigns' 
        AND indexname = 'idx_campaigns_tags_gin'
    ) THEN
        CREATE INDEX CONCURRENTLY idx_campaigns_tags_gin 
        ON campaigns USING GIN (tags);
        
        RAISE NOTICE 'GIN index idx_campaigns_tags_gin created';
    END IF;
END
$$;

-- ============================================================================
-- 3. SAFE CONSTRAINT ADDITION PATTERNS
-- ============================================================================

-- Pattern 1: Add foreign key constraint safely
DO $$
BEGIN
    -- Check if constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'donations'
        AND constraint_name = 'fk_donations_campaign_id'
    ) THEN
        -- Add foreign key constraint
        ALTER TABLE donations
        ADD CONSTRAINT fk_donations_campaign_id
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
        ON UPDATE CASCADE ON DELETE RESTRICT;
        
        RAISE NOTICE 'Foreign key constraint fk_donations_campaign_id added';
    END IF;
END
$$;

-- Pattern 2: Add check constraint with validation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'donations'
        AND constraint_name = 'chk_donations_amount_positive'
    ) THEN
        -- First, ensure all existing data meets the constraint
        UPDATE donations 
        SET donation_amount = 100 
        WHERE donation_amount < 100;
        
        -- Add check constraint
        ALTER TABLE donations
        ADD CONSTRAINT chk_donations_amount_positive
        CHECK (donation_amount > 0);
        
        RAISE NOTICE 'Check constraint chk_donations_amount_positive added';
    END IF;
END
$$;

-- ============================================================================
-- 4. SAFE ENUM TYPE MODIFICATIONS
-- ============================================================================

-- Pattern 1: Add new enum value (safe)
DO $$
BEGIN
    -- Check if enum value exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'donation_status_enum'
        AND e.enumlabel = 'processing'
    ) THEN
        ALTER TYPE donation_status_enum ADD VALUE 'processing';
        RAISE NOTICE 'Added processing to donation_status_enum';
    END IF;
END
$$;

-- Pattern 2: Complex enum modification (requires recreation)
-- This is needed when removing values or changing order
DO $$
BEGIN
    -- Create new enum type
    DO $inner$
    BEGIN
        CREATE TYPE campaign_status_new AS ENUM (
            'draft', 'active', 'completed', 'paused', 'cancelled', 'archived'
        );
    EXCEPTION
        WHEN duplicate_object THEN
            -- Type already exists, recreate it
            DROP TYPE campaign_status_new CASCADE;
            CREATE TYPE campaign_status_new AS ENUM (
                'draft', 'active', 'completed', 'paused', 'cancelled', 'archived'
            );
    END
    $inner$;
    
    -- Add new column with new type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'campaigns'
        AND column_name = 'status_new'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN status_new campaign_status_new;
        
        -- Migrate data
        UPDATE campaigns SET status_new = status::TEXT::campaign_status_new;
        
        -- In a separate transaction later:
        -- ALTER TABLE campaigns DROP COLUMN status;
        -- ALTER TABLE campaigns RENAME COLUMN status_new TO status;
        -- DROP TYPE campaign_status_enum;
        -- ALTER TYPE campaign_status_new RENAME TO campaign_status_enum;
    END IF;
END
$$;

-- ============================================================================
-- 5. SAFE TABLE MODIFICATION FOR LARGE TABLES
-- ============================================================================

-- Pattern 1: Lock-free table modifications using triggers
-- For very large tables where ALTER TABLE would take too long

-- Step 1: Create new table with desired structure
CREATE TABLE campaigns_new (LIKE campaigns INCLUDING ALL);
-- Add new columns to campaigns_new
ALTER TABLE campaigns_new ADD COLUMN new_field VARCHAR(255);

-- Step 2: Create trigger to sync changes
CREATE OR REPLACE FUNCTION sync_campaigns_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO campaigns_new SELECT NEW.*, NULL;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE campaigns_new SET 
            title = NEW.title,
            description = NEW.description,
            -- ... other fields
            updated_at = NEW.updated_at
        WHERE id = NEW.id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM campaigns_new WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (would be temporary during migration)
-- CREATE TRIGGER sync_campaigns_insert AFTER INSERT ON campaigns 
--   FOR EACH ROW EXECUTE FUNCTION sync_campaigns_changes();
-- CREATE TRIGGER sync_campaigns_update AFTER UPDATE ON campaigns 
--   FOR EACH ROW EXECUTE FUNCTION sync_campaigns_changes();
-- CREATE TRIGGER sync_campaigns_delete AFTER DELETE ON campaigns 
--   FOR EACH ROW EXECUTE FUNCTION sync_campaigns_changes();

-- ============================================================================
-- 6. ROLLBACK STRATEGIES FOR SCHEMA CHANGES
-- ============================================================================

-- Create rollback script generator
CREATE OR REPLACE FUNCTION generate_rollback_script(
    operation_type TEXT,
    table_name TEXT,
    column_name TEXT DEFAULT NULL,
    constraint_name TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    rollback_sql TEXT;
BEGIN
    CASE operation_type
        WHEN 'ADD_COLUMN' THEN
            rollback_sql := format('ALTER TABLE %I DROP COLUMN IF EXISTS %I;', 
                                 table_name, column_name);
        WHEN 'ADD_CONSTRAINT' THEN
            rollback_sql := format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I;', 
                                 table_name, constraint_name);
        WHEN 'ADD_INDEX' THEN
            rollback_sql := format('DROP INDEX IF EXISTS %I;', constraint_name);
        ELSE
            rollback_sql := '-- No rollback script available for this operation';
    END CASE;
    
    RETURN rollback_sql;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. MIGRATION SAFETY CHECKLIST FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION pre_migration_safety_check(table_name TEXT)
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
DECLARE
    table_size BIGINT;
    active_connections INTEGER;
    lock_count INTEGER;
BEGIN
    -- Check table size
    SELECT pg_total_relation_size(table_name::regclass) INTO table_size;
    
    RETURN QUERY SELECT 
        'table_size'::TEXT,
        CASE WHEN table_size > 1073741824 THEN 'WARNING' ELSE 'OK' END,
        'Table size: ' || pg_size_pretty(table_size);
    
    -- Check active connections
    SELECT count(*) INTO active_connections
    FROM pg_stat_activity 
    WHERE state = 'active' AND datname = current_database();
    
    RETURN QUERY SELECT 
        'active_connections'::TEXT,
        CASE WHEN active_connections > 10 THEN 'WARNING' ELSE 'OK' END,
        'Active connections: ' || active_connections::TEXT;
    
    -- Check for existing locks
    SELECT count(*) INTO lock_count
    FROM pg_locks 
    WHERE relation = table_name::regclass;
    
    RETURN QUERY SELECT 
        'existing_locks'::TEXT,
        CASE WHEN lock_count > 0 THEN 'WARNING' ELSE 'OK' END,
        'Existing locks: ' || lock_count::TEXT;
    
    -- Check for running queries on table
    RETURN QUERY
    SELECT 
        'running_queries'::TEXT,
        CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END,
        'Queries accessing table: ' || COUNT(*)::TEXT
    FROM pg_stat_activity 
    WHERE query ILIKE '%' || table_name || '%' 
    AND state = 'active';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- USAGE EXAMPLES AND BEST PRACTICES
-- ============================================================================

/*
-- Before any migration, run safety check
SELECT * FROM pre_migration_safety_check('campaigns');

-- Generate rollback script before changes
SELECT generate_rollback_script('ADD_COLUMN', 'campaigns', 'new_field');

-- Safe column addition workflow:
1. Add nullable column
2. Update in batches
3. Add NOT NULL constraint
4. Create indexes concurrently

-- For large tables (>1GB):
1. Consider maintenance windows
2. Use CONCURRENTLY for indexes
3. Use batch updates
4. Monitor lock contention
5. Have rollback plan ready

-- Always test schema changes on:
1. Copy of production data
2. Load testing environment
3. Staging environment
*/