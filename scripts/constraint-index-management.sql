-- PostgreSQL Constraint and Index Management Best Practices
-- Optimized for Shivdhaam donation platform

-- ============================================================================
-- 1. STRATEGIC INDEX DESIGN FOR CAMPAIGNS TABLE
-- ============================================================================

-- Primary performance indexes for campaign queries
-- These support the most common query patterns

-- Campaign listing with filters (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_public_listing
ON campaigns (status, visibility, verified, featured, created_at DESC)
WHERE status = 'active' AND visibility = 'public' AND verified = true;

-- Category-based browsing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_category_active
ON campaigns (category, status, created_at DESC)
WHERE status = 'active' AND visibility = 'public';

-- Search by slug (unique access pattern)
-- Already exists as unique constraint, but ensure it's optimized
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_slug_unique
ON campaigns (slug);

-- Progress-based queries (campaigns near completion)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_progress_analysis
ON campaigns (target_amount, raised_amount, status)
WHERE status = 'active';

-- Creator dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_creator_dashboard
ON campaigns (created_by, status, created_at DESC);

-- ============================================================================
-- 2. STRATEGIC INDEX DESIGN FOR DONATIONS TABLE
-- ============================================================================

-- Most critical indexes for donation processing and reporting

-- Campaign donation aggregation (most frequent query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donations_campaign_stats
ON donations (campaign_id, status, payment_status, completed_at)
WHERE status = 'completed' AND payment_status = 'completed';

-- User donation history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donations_user_history
ON donations (user_id, status, created_at DESC)
WHERE user_id IS NOT NULL;

-- Payment gateway reconciliation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donations_payment_reconciliation
ON donations (razorpay_order_id, razorpay_payment_id, payment_status);

-- Receipt generation and tax queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donations_receipts
ON donations (receipt_number)
WHERE receipt_number IS NOT NULL;

-- Daily donation analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donations_daily_analytics
ON donations (created_at, status, donation_amount)
WHERE status = 'completed';

-- Anonymous vs public donation display
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donations_public_display
ON donations (campaign_id, is_anonymous, show_name_publicly, completed_at DESC)
WHERE status = 'completed';

-- ============================================================================
-- 3. JSONB INDEX OPTIMIZATION
-- ============================================================================

-- Campaign tags search (GIN index for array overlap)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_tags_gin
ON campaigns USING GIN (tags)
WHERE tags IS NOT NULL AND jsonb_array_length(tags) > 0;

-- Campaign metadata search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_metadata_gin
ON campaigns USING GIN (metadata)
WHERE metadata IS NOT NULL;

-- HowYouCanHelp search and filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_howyoucanhelp_gin
ON campaigns USING GIN (howyoucanhelp)
WHERE howyoucanhelp IS NOT NULL;

-- Donation metadata for payment analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donations_metadata_gin
ON donations USING GIN (metadata)
WHERE metadata IS NOT NULL;

-- Specific JSONB path indexes for frequent queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_metadata_beneficiary
ON campaigns USING GIN ((metadata->'beneficiary'))
WHERE metadata ? 'beneficiary';

-- ============================================================================
-- 4. CONSTRAINT DESIGN PATTERNS
-- ============================================================================

-- Business logic constraints for data integrity

-- Ensure campaign progress consistency
ALTER TABLE campaigns 
ADD CONSTRAINT chk_campaigns_raised_not_negative 
CHECK (raised_amount >= 0);

ALTER TABLE campaigns 
ADD CONSTRAINT chk_campaigns_target_positive 
CHECK (target_amount > 0);

ALTER TABLE campaigns 
ADD CONSTRAINT chk_campaigns_donor_count_not_negative 
CHECK (donor_count >= 0);

-- Date consistency constraints
ALTER TABLE campaigns 
ADD CONSTRAINT chk_campaigns_end_after_start 
CHECK (end_date IS NULL OR start_date IS NULL OR end_date > start_date);

-- Donation amount constraints
ALTER TABLE donations 
ADD CONSTRAINT chk_donations_amount_positive 
CHECK (donation_amount > 0);

ALTER TABLE donations 
ADD CONSTRAINT chk_donations_tip_not_negative 
CHECK (tip_amount >= 0);

ALTER TABLE donations 
ADD CONSTRAINT chk_donations_total_consistent 
CHECK (total_amount = donation_amount + tip_amount);

-- Email format validation
ALTER TABLE donations 
ADD CONSTRAINT chk_donations_email_format 
CHECK (donor_email IS NULL OR donor_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Phone format validation (Indian format)
ALTER TABLE donations 
ADD CONSTRAINT chk_donations_phone_format 
CHECK (donor_phone IS NULL OR donor_phone ~* '^[\+]?[0-9\-\(\)\s]{10,20}$');

-- PAN format validation (Indian PAN)
ALTER TABLE donations 
ADD CONSTRAINT chk_donations_pan_format 
CHECK (donor_pan IS NULL OR donor_pan ~* '^[A-Z]{5}[0-9]{4}[A-Z]{1}$');

-- ============================================================================
-- 5. PARTIAL INDEXES FOR SPECIFIC USE CASES
-- ============================================================================

-- Active featured campaigns (homepage queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_homepage_featured
ON campaigns (created_at DESC, target_amount, raised_amount)
WHERE status = 'active' AND featured = true AND visibility = 'public';

-- Urgent campaigns (near deadline)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_urgent
ON campaigns (end_date, status, raised_amount, target_amount)
WHERE status = 'active' AND end_date IS NOT NULL 
AND end_date > CURRENT_DATE AND end_date <= CURRENT_DATE + INTERVAL '7 days';

-- High-value donations for VIP processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donations_high_value
ON donations (created_at DESC, donor_email, donor_phone)
WHERE donation_amount >= 500000; -- ₹5000 and above

-- Failed payments for retry processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donations_failed_retry
ON donations (created_at, razorpay_order_id, failure_reason)
WHERE status = 'failed' AND created_at >= CURRENT_DATE - INTERVAL '7 days';

-- Anonymous donations for public display
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donations_anonymous_display
ON donations (campaign_id, created_at DESC, donation_amount)
WHERE status = 'completed' AND is_anonymous = true;

-- ============================================================================
-- 6. FOREIGN KEY CONSTRAINT OPTIMIZATION
-- ============================================================================

-- Ensure all foreign keys have corresponding indexes for performance

-- Campaigns table foreign keys
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_created_by
ON campaigns (created_by);

-- Donations table foreign keys  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donations_campaign_id
ON donations (campaign_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donations_user_id
ON donations (user_id);

-- User addresses
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_addresses_user_id
ON user_addresses (user_id);

-- Orders and order items
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_id
ON orders (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
ON order_items (order_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_product_id
ON order_items (product_id);

-- ============================================================================
-- 7. INDEX MAINTENANCE AND MONITORING
-- ============================================================================

-- Function to analyze index usage and efficiency
CREATE OR REPLACE FUNCTION analyze_index_performance()
RETURNS TABLE(
    schemaname TEXT,
    tablename TEXT,
    indexname TEXT,
    table_size TEXT,
    index_size TEXT,
    index_scans BIGINT,
    tuples_read BIGINT,
    tuples_fetched BIGINT,
    efficiency_ratio NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname::TEXT,
        s.tablename::TEXT,
        s.indexname::TEXT,
        pg_size_pretty(pg_relation_size(s.indexrelid))::TEXT as index_size,
        pg_size_pretty(pg_relation_size(s.relid))::TEXT as table_size,
        s.idx_scan,
        s.idx_tup_read,
        s.idx_tup_fetch,
        CASE 
            WHEN s.idx_tup_read > 0 THEN 
                ROUND((s.idx_tup_fetch::NUMERIC / s.idx_tup_read::NUMERIC) * 100, 2)
            ELSE 0 
        END as efficiency_ratio
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON s.indexrelid = i.indexrelid
    WHERE s.schemaname = 'public'
    ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to identify unused indexes
CREATE OR REPLACE FUNCTION find_unused_indexes()
RETURNS TABLE(
    schemaname TEXT,
    tablename TEXT,
    indexname TEXT,
    index_size TEXT,
    index_scans BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname::TEXT,
        s.tablename::TEXT,
        s.indexname::TEXT,
        pg_size_pretty(pg_relation_size(s.indexrelid))::TEXT,
        s.idx_scan
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON s.indexrelid = i.indexrelid
    WHERE s.schemaname = 'public'
    AND s.idx_scan < 10  -- Very low usage
    AND NOT i.indisunique  -- Not unique indexes
    AND NOT i.indisprimary  -- Not primary key indexes
    ORDER BY pg_relation_size(s.indexrelid) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to check constraint violations before adding
CREATE OR REPLACE FUNCTION check_constraint_violations(
    table_name TEXT,
    constraint_condition TEXT
)
RETURNS TABLE(
    violation_count BIGINT,
    sample_violations JSONB
) AS $$
DECLARE
    violation_count BIGINT;
    sample_data JSONB;
BEGIN
    -- Count violations
    EXECUTE format(
        'SELECT COUNT(*) FROM %I WHERE NOT (%s)',
        table_name, constraint_condition
    ) INTO violation_count;
    
    -- Get sample violations (first 5)
    IF violation_count > 0 THEN
        EXECUTE format(
            'SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM %I WHERE NOT (%s) LIMIT 5) t',
            table_name, constraint_condition
        ) INTO sample_data;
    ELSE
        sample_data := '[]'::JSONB;
    END IF;
    
    RETURN QUERY SELECT violation_count, sample_data;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. AUTOMATIC INDEX MAINTENANCE
-- ============================================================================

-- Function to rebuild fragmented indexes
CREATE OR REPLACE FUNCTION maintain_indexes()
RETURNS TABLE(
    operation TEXT,
    index_name TEXT,
    status TEXT
) AS $$
DECLARE
    idx_record RECORD;
BEGIN
    -- Find indexes that might benefit from rebuilding
    FOR idx_record IN
        SELECT 
            schemaname, tablename, indexname,
            pg_relation_size(indexrelid) as index_size
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        AND pg_relation_size(indexrelid) > 100 * 1024 * 1024  -- > 100MB
    LOOP
        BEGIN
            -- Reindex concurrently (PostgreSQL 12+)
            EXECUTE format('REINDEX INDEX CONCURRENTLY %I.%I', 
                         idx_record.schemaname, idx_record.indexname);
            
            RETURN QUERY SELECT 
                'REINDEX'::TEXT,
                idx_record.indexname::TEXT,
                'SUCCESS'::TEXT;
                
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT 
                'REINDEX'::TEXT,
                idx_record.indexname::TEXT,
                ('ERROR: ' || SQLERRM)::TEXT;
        END;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. CONSTRAINT VALIDATION STRATEGIES
-- ============================================================================

-- Validate foreign key constraints before adding
CREATE OR REPLACE FUNCTION validate_foreign_key_integrity(
    source_table TEXT,
    source_column TEXT,
    target_table TEXT,
    target_column TEXT
)
RETURNS TABLE(
    orphaned_records BIGINT,
    sample_orphans JSONB
) AS $$
DECLARE
    orphan_count BIGINT;
    sample_data JSONB;
BEGIN
    -- Count orphaned records
    EXECUTE format(
        'SELECT COUNT(*) FROM %I s WHERE s.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %I t WHERE t.%I = s.%I)',
        source_table, source_column, target_table, target_column, source_column
    ) INTO orphan_count;
    
    -- Get sample orphaned records
    IF orphan_count > 0 THEN
        EXECUTE format(
            'SELECT jsonb_agg(row_to_json(s)) FROM (SELECT s.* FROM %I s WHERE s.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %I t WHERE t.%I = s.%I) LIMIT 5) s',
            source_table, source_column, target_table, target_column, source_column
        ) INTO sample_data;
    ELSE
        sample_data := '[]'::JSONB;
    END IF;
    
    RETURN QUERY SELECT orphan_count, sample_data;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- USAGE EXAMPLES AND MONITORING
-- ============================================================================

/*
-- Monitor index performance
SELECT * FROM analyze_index_performance() ORDER BY efficiency_ratio DESC;

-- Find unused indexes for cleanup
SELECT * FROM find_unused_indexes();

-- Check constraint violations before adding
SELECT * FROM check_constraint_violations('donations', 'donation_amount > 0');

-- Validate foreign key integrity
SELECT * FROM validate_foreign_key_integrity('donations', 'campaign_id', 'campaigns', 'id');

-- Periodic maintenance (run during low traffic)
SELECT * FROM maintain_indexes();

-- Monitor constraint violations
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE contype = 'c' 
AND NOT convalidated;
*/