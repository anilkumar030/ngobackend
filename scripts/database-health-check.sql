-- Comprehensive PostgreSQL Database Health Check
-- For production database monitoring and maintenance

-- ============================================================================
-- 1. DATABASE OVERVIEW AND BASIC HEALTH METRICS
-- ============================================================================

-- Function to perform comprehensive database health check
CREATE OR REPLACE FUNCTION perform_database_health_check()
RETURNS TABLE(
    category TEXT,
    metric TEXT,
    value TEXT,
    status TEXT,
    recommendation TEXT
) AS $$
DECLARE
    db_size BIGINT;
    connection_count INTEGER;
    active_queries INTEGER;
    long_running_queries INTEGER;
    lock_count INTEGER;
    deadlock_count BIGINT;
    cache_hit_ratio NUMERIC;
    index_hit_ratio NUMERIC;
    table_count INTEGER;
    largest_table_size BIGINT;
    unused_index_count INTEGER;
    fragmented_index_count INTEGER;
BEGIN
    -- Database size
    SELECT pg_database_size(current_database()) INTO db_size;
    
    RETURN QUERY SELECT 
        'database_size'::TEXT,
        'total_size'::TEXT,
        pg_size_pretty(db_size)::TEXT,
        CASE WHEN db_size > 50 * 1024^3 THEN 'WARNING' ELSE 'OK' END,
        CASE WHEN db_size > 50 * 1024^3 THEN 'Database size >50GB, consider archiving' ELSE 'Database size is healthy' END;
    
    -- Connection metrics
    SELECT count(*) INTO connection_count
    FROM pg_stat_activity 
    WHERE datname = current_database();
    
    RETURN QUERY SELECT 
        'connections'::TEXT,
        'total_connections'::TEXT,
        connection_count::TEXT,
        CASE WHEN connection_count > 80 THEN 'WARNING' ELSE 'OK' END,
        CASE WHEN connection_count > 80 THEN 'High connection count, check connection pooling' ELSE 'Connection count is normal' END;
    
    -- Active queries
    SELECT count(*) INTO active_queries
    FROM pg_stat_activity 
    WHERE state = 'active' AND datname = current_database();
    
    RETURN QUERY SELECT 
        'connections'::TEXT,
        'active_queries'::TEXT,
        active_queries::TEXT,
        CASE WHEN active_queries > 20 THEN 'WARNING' ELSE 'OK' END,
        CASE WHEN active_queries > 20 THEN 'High active query count, investigate performance' ELSE 'Active query count is normal' END;
    
    -- Long running queries (>5 minutes)
    SELECT count(*) INTO long_running_queries
    FROM pg_stat_activity 
    WHERE state = 'active' 
    AND now() - query_start > interval '5 minutes'
    AND datname = current_database();
    
    RETURN QUERY SELECT 
        'performance'::TEXT,
        'long_running_queries'::TEXT,
        long_running_queries::TEXT,
        CASE WHEN long_running_queries > 0 THEN 'WARNING' ELSE 'OK' END,
        CASE WHEN long_running_queries > 0 THEN 'Long running queries detected, investigate' ELSE 'No long running queries' END;
    
    -- Lock analysis
    SELECT count(*) INTO lock_count
    FROM pg_locks 
    WHERE NOT granted;
    
    RETURN QUERY SELECT 
        'locks'::TEXT,
        'blocked_queries'::TEXT,
        lock_count::TEXT,
        CASE WHEN lock_count > 0 THEN 'WARNING' ELSE 'OK' END,
        CASE WHEN lock_count > 0 THEN 'Blocked queries detected, check for lock contention' ELSE 'No blocked queries' END;
    
    -- Cache hit ratio
    SELECT 
        ROUND(
            (sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0)) * 100, 2
        ) INTO cache_hit_ratio
    FROM pg_statio_user_tables;
    
    RETURN QUERY SELECT 
        'performance'::TEXT,
        'cache_hit_ratio'::TEXT,
        COALESCE(cache_hit_ratio, 0)::TEXT || '%',
        CASE WHEN COALESCE(cache_hit_ratio, 0) < 95 THEN 'WARNING' ELSE 'OK' END,
        CASE WHEN COALESCE(cache_hit_ratio, 0) < 95 THEN 'Low cache hit ratio, consider increasing shared_buffers' ELSE 'Cache hit ratio is healthy' END;
    
    -- Index hit ratio
    SELECT 
        ROUND(
            (sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0)) * 100, 2
        ) INTO index_hit_ratio
    FROM pg_statio_user_indexes;
    
    RETURN QUERY SELECT 
        'performance'::TEXT,
        'index_hit_ratio'::TEXT,
        COALESCE(index_hit_ratio, 0)::TEXT || '%',
        CASE WHEN COALESCE(index_hit_ratio, 0) < 95 THEN 'WARNING' ELSE 'OK' END,
        CASE WHEN COALESCE(index_hit_ratio, 0) < 95 THEN 'Low index hit ratio, investigate index usage' ELSE 'Index hit ratio is healthy' END;
    
    -- Table count
    SELECT count(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    
    RETURN QUERY SELECT 
        'schema'::TEXT,
        'table_count'::TEXT,
        table_count::TEXT,
        'INFO'::TEXT,
        'Current number of tables in database'::TEXT;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. TABLE-SPECIFIC HEALTH ANALYSIS
-- ============================================================================

-- Function to analyze table health metrics
CREATE OR REPLACE FUNCTION analyze_table_health()
RETURNS TABLE(
    table_name TEXT,
    table_size TEXT,
    row_count BIGINT,
    dead_tuples BIGINT,
    live_tuples BIGINT,
    last_vacuum TIMESTAMP,
    last_analyze TIMESTAMP,
    vacuum_needed BOOLEAN,
    analyze_needed BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname || '.' || relname as table_name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as table_size,
        n_tup_ins + n_tup_upd + n_tup_del as row_count,
        n_dead_tup as dead_tuples,
        n_live_tup as live_tuples,
        last_vacuum,
        last_analyze,
        -- Vacuum needed if dead tuples > 10% of live tuples or > 1000 dead tuples
        (n_dead_tup > GREATEST(n_live_tup * 0.1, 1000)) as vacuum_needed,
        -- Analyze needed if no recent analyze or significant changes
        (last_analyze IS NULL OR 
         last_analyze < now() - interval '7 days' OR
         (n_mod_since_analyze > GREATEST(n_live_tup * 0.1, 1000))) as analyze_needed
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. INDEX HEALTH AND PERFORMANCE ANALYSIS
-- ============================================================================

-- Function to analyze index health
CREATE OR REPLACE FUNCTION analyze_index_health()
RETURNS TABLE(
    table_name TEXT,
    index_name TEXT,
    index_size TEXT,
    index_scans BIGINT,
    tuples_read BIGINT,
    tuples_fetched BIGINT,
    selectivity_ratio NUMERIC,
    usage_category TEXT,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.relname::TEXT as table_name,
        s.indexrelname::TEXT as index_name,
        pg_size_pretty(pg_relation_size(s.indexrelid))::TEXT as index_size,
        s.idx_scan as index_scans,
        s.idx_tup_read as tuples_read,
        s.idx_tup_fetch as tuples_fetched,
        CASE 
            WHEN s.idx_tup_read > 0 THEN 
                ROUND((s.idx_tup_fetch::NUMERIC / s.idx_tup_read::NUMERIC) * 100, 2)
            ELSE 0 
        END as selectivity_ratio,
        CASE 
            WHEN s.idx_scan = 0 THEN 'UNUSED'
            WHEN s.idx_scan < 10 THEN 'LOW_USAGE'
            WHEN s.idx_scan < 100 THEN 'MODERATE_USAGE'
            ELSE 'HIGH_USAGE'
        END as usage_category,
        CASE 
            WHEN s.idx_scan = 0 THEN 'Consider dropping this unused index'
            WHEN s.idx_scan < 10 AND pg_relation_size(s.indexrelid) > 10 * 1024 * 1024 THEN 'Low usage large index, consider dropping'
            WHEN s.idx_tup_read > 0 AND (s.idx_tup_fetch::NUMERIC / s.idx_tup_read::NUMERIC) < 0.1 THEN 'Poor selectivity, review index design'
            ELSE 'Index appears healthy'
        END as recommendation
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON s.indexrelid = i.indexrelid
    WHERE NOT i.indisunique AND NOT i.indisprimary
    ORDER BY s.idx_scan DESC, pg_relation_size(s.indexrelid) DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. QUERY PERFORMANCE ANALYSIS
-- ============================================================================

-- Function to analyze slow queries (requires pg_stat_statements extension)
CREATE OR REPLACE FUNCTION analyze_slow_queries()
RETURNS TABLE(
    query_text TEXT,
    calls BIGINT,
    total_time NUMERIC,
    mean_time NUMERIC,
    max_time NUMERIC,
    rows_returned BIGINT,
    temp_files BIGINT,
    temp_bytes BIGINT
) AS $$
BEGIN
    -- Check if pg_stat_statements is available
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
    ) THEN
        RETURN QUERY SELECT 
            'pg_stat_statements extension not installed'::TEXT,
            0::BIGINT, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::BIGINT, 0::BIGINT, 0::BIGINT;
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT 
        LEFT(s.query, 100)::TEXT as query_text,
        s.calls,
        ROUND(s.total_exec_time, 2) as total_time,
        ROUND(s.mean_exec_time, 2) as mean_time,
        ROUND(s.max_exec_time, 2) as max_time,
        s.rows as rows_returned,
        s.temp_files,
        s.temp_blks_written * current_setting('block_size')::BIGINT as temp_bytes
    FROM pg_stat_statements s
    WHERE s.dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
    ORDER BY s.mean_exec_time DESC
    LIMIT 20;
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
        'Error accessing pg_stat_statements'::TEXT,
        0::BIGINT, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::BIGINT, 0::BIGINT, 0::BIGINT;
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. REPLICATION AND BACKUP STATUS
-- ============================================================================

-- Function to check replication lag (if applicable)
CREATE OR REPLACE FUNCTION check_replication_status()
RETURNS TABLE(
    replication_info TEXT,
    status TEXT,
    details TEXT
) AS $$
DECLARE
    is_primary BOOLEAN;
    replication_lag INTERVAL;
    replica_count INTEGER;
BEGIN
    -- Check if this is a primary or replica
    SELECT NOT pg_is_in_recovery() INTO is_primary;
    
    IF is_primary THEN
        -- Count active replicas
        SELECT count(*) INTO replica_count
        FROM pg_stat_replication;
        
        RETURN QUERY SELECT 
            'replication_role'::TEXT,
            'PRIMARY'::TEXT,
            format('Active replicas: %s', replica_count)::TEXT;
            
        -- Return replica details if any
        IF replica_count > 0 THEN
            RETURN QUERY
            SELECT 
                'replica_status'::TEXT,
                CASE WHEN state = 'streaming' THEN 'OK' ELSE 'WARNING' END,
                format('Client: %s, State: %s, Lag: %s', 
                       client_addr, state, 
                       COALESCE(replay_lag::TEXT, 'unknown'))::TEXT
            FROM pg_stat_replication;
        END IF;
    ELSE
        -- This is a replica, check lag
        SELECT now() - pg_last_xact_replay_timestamp() INTO replication_lag;
        
        RETURN QUERY SELECT 
            'replication_role'::TEXT,
            'REPLICA'::TEXT,
            format('Replication lag: %s', COALESCE(replication_lag::TEXT, 'unknown'))::TEXT;
            
        RETURN QUERY SELECT 
            'replication_lag'::TEXT,
            CASE WHEN replication_lag > interval '1 minute' THEN 'WARNING' ELSE 'OK' END,
            COALESCE(replication_lag::TEXT, 'Lag measurement unavailable')::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. SECURITY AND CONFIGURATION CHECKS
-- ============================================================================

-- Function to check security configuration
CREATE OR REPLACE FUNCTION check_security_configuration()
RETURNS TABLE(
    security_check TEXT,
    status TEXT,
    current_value TEXT,
    recommendation TEXT
) AS $$
DECLARE
    ssl_enabled TEXT;
    log_connections TEXT;
    log_disconnections TEXT;
    log_statement TEXT;
    password_encryption TEXT;
BEGIN
    -- SSL configuration
    SELECT current_setting('ssl', true) INTO ssl_enabled;
    
    RETURN QUERY SELECT 
        'ssl_enabled'::TEXT,
        CASE WHEN ssl_enabled = 'on' THEN 'OK' ELSE 'WARNING' END,
        COALESCE(ssl_enabled, 'unknown')::TEXT,
        CASE WHEN ssl_enabled != 'on' THEN 'Enable SSL for security' ELSE 'SSL is properly configured' END;
    
    -- Connection logging
    SELECT current_setting('log_connections', true) INTO log_connections;
    
    RETURN QUERY SELECT 
        'log_connections'::TEXT,
        CASE WHEN log_connections = 'on' THEN 'OK' ELSE 'INFO' END,
        COALESCE(log_connections, 'unknown')::TEXT,
        'Consider enabling for audit trail'::TEXT;
    
    -- Statement logging
    SELECT current_setting('log_statement', true) INTO log_statement;
    
    RETURN QUERY SELECT 
        'log_statement'::TEXT,
        'INFO'::TEXT,
        COALESCE(log_statement, 'unknown')::TEXT,
        CASE WHEN log_statement = 'none' THEN 'Consider logging DDL statements' ELSE 'Statement logging configured' END;
    
    -- Password encryption
    SELECT current_setting('password_encryption', true) INTO password_encryption;
    
    RETURN QUERY SELECT 
        'password_encryption'::TEXT,
        CASE WHEN password_encryption = 'scram-sha-256' THEN 'OK' ELSE 'WARNING' END,
        COALESCE(password_encryption, 'unknown')::TEXT,
        CASE WHEN password_encryption != 'scram-sha-256' THEN 'Use scram-sha-256 for better security' ELSE 'Password encryption is secure' END;
    
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. COMPREHENSIVE HEALTH CHECK REPORT
-- ============================================================================

-- Main function to generate complete health report
CREATE OR REPLACE FUNCTION generate_health_report()
RETURNS TABLE(
    report_section TEXT,
    details JSONB
) AS $$
BEGIN
    -- Database overview
    RETURN QUERY SELECT 
        'database_health'::TEXT,
        jsonb_agg(row_to_json(t)) as details
    FROM perform_database_health_check() t;
    
    -- Table health
    RETURN QUERY SELECT 
        'table_health'::TEXT,
        jsonb_agg(row_to_json(t)) as details
    FROM analyze_table_health() t;
    
    -- Index health
    RETURN QUERY SELECT 
        'index_health'::TEXT,
        jsonb_agg(row_to_json(t)) as details
    FROM analyze_index_health() t;
    
    -- Query performance
    RETURN QUERY SELECT 
        'query_performance'::TEXT,
        jsonb_agg(row_to_json(t)) as details
    FROM analyze_slow_queries() t;
    
    -- Replication status
    RETURN QUERY SELECT 
        'replication_status'::TEXT,
        jsonb_agg(row_to_json(t)) as details
    FROM check_replication_status() t;
    
    -- Security configuration
    RETURN QUERY SELECT 
        'security_configuration'::TEXT,
        jsonb_agg(row_to_json(t)) as details
    FROM check_security_configuration() t;
    
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. AUTOMATED MAINTENANCE RECOMMENDATIONS
-- ============================================================================

-- Function to generate maintenance recommendations
CREATE OR REPLACE FUNCTION generate_maintenance_recommendations()
RETURNS TABLE(
    priority TEXT,
    recommendation TEXT,
    sql_command TEXT,
    estimated_time TEXT
) AS $$
DECLARE
    table_rec RECORD;
    index_rec RECORD;
BEGIN
    -- High priority: Tables needing vacuum
    FOR table_rec IN
        SELECT table_name, dead_tuples, live_tuples
        FROM analyze_table_health()
        WHERE vacuum_needed = true
    LOOP
        RETURN QUERY SELECT 
            'HIGH'::TEXT,
            format('Vacuum table %s (%s dead tuples)', table_rec.table_name, table_rec.dead_tuples)::TEXT,
            format('VACUUM ANALYZE %s;', table_rec.table_name)::TEXT,
            CASE 
                WHEN table_rec.live_tuples > 1000000 THEN '10-30 minutes'
                WHEN table_rec.live_tuples > 100000 THEN '1-5 minutes'
                ELSE '<1 minute'
            END::TEXT;
    END LOOP;
    
    -- Medium priority: Tables needing analyze
    FOR table_rec IN
        SELECT table_name
        FROM analyze_table_health()
        WHERE analyze_needed = true AND vacuum_needed = false
    LOOP
        RETURN QUERY SELECT 
            'MEDIUM'::TEXT,
            format('Analyze table %s (statistics outdated)', table_rec.table_name)::TEXT,
            format('ANALYZE %s;', table_rec.table_name)::TEXT,
            '<1 minute'::TEXT;
    END LOOP;
    
    -- Low priority: Unused indexes
    FOR index_rec IN
        SELECT table_name, index_name, index_size
        FROM analyze_index_health()
        WHERE usage_category = 'UNUSED'
    LOOP
        RETURN QUERY SELECT 
            'LOW'::TEXT,
            format('Consider dropping unused index %s on %s (%s)', 
                   index_rec.index_name, index_rec.table_name, index_rec.index_size)::TEXT,
            format('DROP INDEX IF EXISTS %s;', index_rec.index_name)::TEXT,
            '<1 minute'::TEXT;
    END LOOP;
    
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- USAGE EXAMPLES AND SCHEDULED MAINTENANCE
-- ============================================================================

/*
-- Run complete health check
SELECT * FROM generate_health_report();

-- Check specific components
SELECT * FROM perform_database_health_check();
SELECT * FROM analyze_table_health();
SELECT * FROM analyze_index_health();

-- Get maintenance recommendations
SELECT * FROM generate_maintenance_recommendations() ORDER BY 
    CASE priority 
        WHEN 'HIGH' THEN 1 
        WHEN 'MEDIUM' THEN 2 
        WHEN 'LOW' THEN 3 
    END;

-- Export health report to file
COPY (
    SELECT jsonb_pretty(jsonb_object_agg(report_section, details))
    FROM generate_health_report()
) TO '/tmp/db_health_report.json';

-- Set up daily health check (example cron job)
-- 0 6 * * * psql -d shivdhaam_prod -c "SELECT * FROM generate_health_report();" > /var/log/db_health_$(date +\%Y\%m\%d).log

RECOMMENDED MONITORING SCHEDULE:
1. Daily: Basic health metrics and maintenance recommendations
2. Weekly: Full health report with detailed analysis
3. Monthly: Index usage analysis and cleanup
4. Quarterly: Security configuration review
*/