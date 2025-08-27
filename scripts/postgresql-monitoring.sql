-- PostgreSQL Database Monitoring and Diagnostics Script
-- Run these queries to monitor database health and troubleshoot connection issues

-- =============================================================================
-- CONNECTION MONITORING
-- =============================================================================

-- Check current active connections
SELECT 
    datname AS database,
    count(*) AS active_connections,
    state,
    query_start,
    state_change
FROM pg_stat_activity 
WHERE state IS NOT NULL
GROUP BY datname, state, query_start, state_change
ORDER BY datname, active_connections DESC;

-- Check connection limits and current usage
SELECT 
    setting AS max_connections,
    (SELECT count(*) FROM pg_stat_activity) AS current_connections,
    ROUND((SELECT count(*) FROM pg_stat_activity)::numeric / setting::numeric * 100, 2) AS usage_percentage
FROM pg_settings 
WHERE name = 'max_connections';

-- Identify long-running queries (running for more than 5 minutes)
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state,
    datname,
    usename,
    application_name,
    client_addr
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
    AND state != 'idle';

-- Check for blocked queries
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- =============================================================================
-- SCRAM AUTHENTICATION MONITORING
-- =============================================================================

-- Check authentication methods in pg_hba.conf (requires superuser)
-- Note: This query may fail with permission denied for non-superuser accounts
SELECT 
    type,
    database,
    user_name,
    address,
    netmask,
    auth_method,
    options
FROM pg_hba_file_rules
WHERE auth_method LIKE '%scram%' OR auth_method = 'md5' OR auth_method = 'password';

-- Check failed authentication attempts from logs (if log_connections is enabled)
-- This requires access to PostgreSQL logs, typically in /var/log/postgresql/

-- =============================================================================
-- DATABASE PERFORMANCE MONITORING
-- =============================================================================

-- Check database size and activity
SELECT 
    d.datname AS database_name,
    pg_size_pretty(pg_database_size(d.datname)) AS size,
    s.numbackends AS active_connections,
    s.xact_commit AS commits,
    s.xact_rollback AS rollbacks,
    s.blks_read AS blocks_read,
    s.blks_hit AS blocks_hit,
    ROUND((s.blks_hit::numeric / GREATEST(s.blks_hit + s.blks_read, 1)) * 100, 2) AS cache_hit_ratio
FROM pg_database d
LEFT JOIN pg_stat_database s ON d.datname = s.datname
WHERE d.datname NOT IN ('template0', 'template1', 'postgres')
ORDER BY pg_database_size(d.datname) DESC;

-- Check table sizes in current database
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check slow queries (requires pg_stat_statements extension)
-- Uncomment if pg_stat_statements is installed:
/*
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    ROUND((100.0 * total_time / sum(total_time) OVER())::numeric, 2) AS percentage
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;
*/

-- =============================================================================
-- INDEX USAGE MONITORING
-- =============================================================================

-- Check index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Find unused indexes (potential candidates for removal)
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public' 
    AND idx_scan = 0
    AND indexname NOT LIKE '%_pkey';

-- =============================================================================
-- SEQUELIZE-SPECIFIC MONITORING
-- =============================================================================

-- Check Sequelize migrations status
SELECT name, executed_at
FROM "SequelizeMeta" 
ORDER BY executed_at DESC;

-- Check for common Sequelize tables and their row counts
SELECT 
    table_name,
    (SELECT COUNT(*) FROM users) AS user_count,
    (SELECT COUNT(*) FROM campaigns) AS campaign_count,
    (SELECT COUNT(*) FROM donations) AS donation_count,
    (SELECT COUNT(*) FROM products) AS product_count,
    (SELECT COUNT(*) FROM orders) AS order_count,
    (SELECT COUNT(*) FROM gallery) AS gallery_count
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'users'
LIMIT 1;

-- =============================================================================
-- ERROR DIAGNOSIS QUERIES
-- =============================================================================

-- Check for foreign key constraint violations
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE contype = 'f' 
    AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Check for missing columns that might cause Sequelize errors
-- This helps identify schema mismatches
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name IN ('users', 'campaigns', 'donations', 'products', 'orders', 'gallery')
ORDER BY table_name, ordinal_position;

-- =============================================================================
-- QUICK HEALTH CHECK QUERY
-- =============================================================================

-- Single query to check overall database health
SELECT 
    'Database Health Check' AS check_type,
    current_database() AS database_name,
    version() AS postgres_version,
    current_user AS current_user,
    (SELECT setting FROM pg_settings WHERE name = 'max_connections') AS max_connections,
    (SELECT count(*) FROM pg_stat_activity) AS current_connections,
    CASE 
        WHEN (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') > 0 
        THEN 'Active queries detected'
        ELSE 'No active queries'
    END AS activity_status,
    CASE 
        WHEN (SELECT count(*) FROM pg_locks WHERE NOT granted) > 0 
        THEN 'Blocked queries detected'
        ELSE 'No blocked queries'
    END AS lock_status;