-- PostgreSQL Schema Introspection and Analysis Queries
-- For comparing local vs production database schemas

-- ============================================================================
-- 1. COMPREHENSIVE TABLE STRUCTURE COMPARISON
-- ============================================================================

-- Get complete table structure with all metadata
CREATE OR REPLACE FUNCTION get_table_structure()
RETURNS TABLE(
    table_name TEXT,
    column_name TEXT,
    ordinal_position INTEGER,
    column_default TEXT,
    is_nullable TEXT,
    data_type TEXT,
    character_maximum_length INTEGER,
    numeric_precision INTEGER,
    numeric_scale INTEGER,
    is_updatable TEXT,
    column_comment TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.table_name::TEXT,
        c.column_name::TEXT,
        c.ordinal_position,
        c.column_default::TEXT,
        c.is_nullable::TEXT,
        CASE 
            WHEN c.data_type = 'USER-DEFINED' THEN 
                c.udt_name::TEXT
            ELSE 
                c.data_type::TEXT
        END as data_type,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        c.is_updatable::TEXT,
        obj_description(pgc.oid)::TEXT as column_comment
    FROM information_schema.columns c
    LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
    WHERE c.table_schema = 'public'
    AND c.table_name IN (
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    )
    ORDER BY c.table_name, c.ordinal_position;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. INDEX ANALYSIS AND COMPARISON
-- ============================================================================

-- Get all indexes with detailed information
CREATE OR REPLACE FUNCTION get_index_structure()
RETURNS TABLE(
    table_name TEXT,
    index_name TEXT,
    index_type TEXT,
    is_unique BOOLEAN,
    is_primary BOOLEAN,
    column_names TEXT,
    index_definition TEXT,
    table_size TEXT,
    index_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.relname::TEXT as table_name,
        i.relname::TEXT as index_name,
        am.amname::TEXT as index_type,
        idx.indisunique as is_unique,
        idx.indisprimary as is_primary,
        array_to_string(ARRAY(
            SELECT pg_get_indexdef(idx.indexrelid, k + 1, true)
            FROM generate_subscripts(idx.indkey, 1) as k
            ORDER BY k
        ), ', ')::TEXT as column_names,
        pg_get_indexdef(idx.indexrelid)::TEXT as index_definition,
        pg_size_pretty(pg_relation_size(t.oid))::TEXT as table_size,
        pg_size_pretty(pg_relation_size(i.oid))::TEXT as index_size
    FROM pg_index idx
    JOIN pg_class i ON i.oid = idx.indexrelid
    JOIN pg_class t ON t.oid = idx.indrelid
    JOIN pg_am am ON i.relam = am.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.relname, i.relname;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. FOREIGN KEY CONSTRAINTS ANALYSIS
-- ============================================================================

-- Get all foreign key relationships
CREATE OR REPLACE FUNCTION get_foreign_key_constraints()
RETURNS TABLE(
    constraint_name TEXT,
    table_name TEXT,
    column_name TEXT,
    foreign_table_name TEXT,
    foreign_column_name TEXT,
    update_rule TEXT,
    delete_rule TEXT,
    match_option TEXT,
    is_deferrable TEXT,
    initially_deferred TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tc.constraint_name::TEXT,
        tc.table_name::TEXT,
        kcu.column_name::TEXT,
        ccu.table_name::TEXT as foreign_table_name,
        ccu.column_name::TEXT as foreign_column_name,
        rc.update_rule::TEXT,
        rc.delete_rule::TEXT,
        rc.match_option::TEXT,
        tc.is_deferrable::TEXT,
        tc.initially_deferred::TEXT
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. ENUM TYPES ANALYSIS
-- ============================================================================

-- Get all custom enum types and their values
CREATE OR REPLACE FUNCTION get_enum_types()
RETURNS TABLE(
    enum_name TEXT,
    enum_values TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.typname::TEXT as enum_name,
        array_agg(e.enumlabel ORDER BY e.enumsortorder)::TEXT[] as enum_values
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname
    ORDER BY t.typname;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. TRIGGERS AND FUNCTIONS ANALYSIS
-- ============================================================================

-- Get all triggers
CREATE OR REPLACE FUNCTION get_triggers()
RETURNS TABLE(
    table_name TEXT,
    trigger_name TEXT,
    trigger_timing TEXT,
    trigger_event TEXT,
    trigger_function TEXT,
    trigger_definition TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.table_name::TEXT,
        t.trigger_name::TEXT,
        t.action_timing::TEXT as trigger_timing,
        t.event_manipulation::TEXT as trigger_event,
        t.action_statement::TEXT as trigger_function,
        pg_get_triggerdef(pg_trigger.oid)::TEXT as trigger_definition
    FROM information_schema.triggers t
    JOIN pg_trigger ON pg_trigger.tgname = t.trigger_name
    WHERE t.trigger_schema = 'public'
    ORDER BY t.table_name, t.trigger_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. SEQUENCE ANALYSIS
-- ============================================================================

-- Get all sequences and their current state
CREATE OR REPLACE FUNCTION get_sequences()
RETURNS TABLE(
    sequence_name TEXT,
    data_type TEXT,
    start_value BIGINT,
    minimum_value BIGINT,
    maximum_value BIGINT,
    increment BIGINT,
    cycle_option TEXT,
    current_value BIGINT
) AS $$
DECLARE
    rec RECORD;
    current_val BIGINT;
BEGIN
    FOR rec IN 
        SELECT s.sequence_name, s.data_type, s.start_value::BIGINT, 
               s.minimum_value::BIGINT, s.maximum_value::BIGINT, 
               s.increment::BIGINT, s.cycle_option
        FROM information_schema.sequences s
        WHERE s.sequence_schema = 'public'
    LOOP
        -- Get current value safely
        BEGIN
            EXECUTE format('SELECT last_value FROM %I', rec.sequence_name) INTO current_val;
        EXCEPTION WHEN OTHERS THEN
            current_val := NULL;
        END;
        
        RETURN QUERY SELECT 
            rec.sequence_name::TEXT,
            rec.data_type::TEXT,
            rec.start_value,
            rec.minimum_value,
            rec.maximum_value,
            rec.increment,
            rec.cycle_option::TEXT,
            current_val;
    END LOOP;
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. JSONB COLUMN ANALYSIS
-- ============================================================================

-- Analyze JSONB columns and their structure
CREATE OR REPLACE FUNCTION analyze_jsonb_columns()
RETURNS TABLE(
    table_name TEXT,
    column_name TEXT,
    sample_keys TEXT[],
    sample_structure JSONB,
    distinct_key_count BIGINT
) AS $$
DECLARE
    rec RECORD;
    sample_keys TEXT[];
    sample_structure JSONB;
    key_count BIGINT;
BEGIN
    FOR rec IN 
        SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        AND c.data_type = 'jsonb'
    LOOP
        BEGIN
            -- Get sample keys from JSONB column
            EXECUTE format(
                'SELECT array_agg(DISTINCT jsonb_object_keys(%I)) FROM %I WHERE %I IS NOT NULL LIMIT 100',
                rec.column_name, rec.table_name, rec.column_name
            ) INTO sample_keys;
            
            -- Get a sample structure
            EXECUTE format(
                'SELECT %I FROM %I WHERE %I IS NOT NULL LIMIT 1',
                rec.column_name, rec.table_name, rec.column_name
            ) INTO sample_structure;
            
            -- Count distinct keys
            EXECUTE format(
                'SELECT COUNT(DISTINCT jsonb_object_keys(%I)) FROM %I WHERE %I IS NOT NULL',
                rec.column_name, rec.table_name, rec.column_name
            ) INTO key_count;
            
        EXCEPTION WHEN OTHERS THEN
            sample_keys := ARRAY[]::TEXT[];
            sample_structure := NULL;
            key_count := 0;
        END;
        
        RETURN QUERY SELECT 
            rec.table_name::TEXT,
            rec.column_name::TEXT,
            COALESCE(sample_keys, ARRAY[]::TEXT[]),
            sample_structure,
            COALESCE(key_count, 0);
    END LOOP;
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. COMPREHENSIVE SCHEMA COMPARISON FUNCTION
-- ============================================================================

-- Main function to generate complete schema comparison report
CREATE OR REPLACE FUNCTION generate_schema_report()
RETURNS TABLE(
    report_section TEXT,
    details JSONB
) AS $$
BEGIN
    -- Table structures
    RETURN QUERY SELECT 
        'table_structures'::TEXT,
        jsonb_agg(row_to_json(t)) as details
    FROM get_table_structure() t;
    
    -- Indexes
    RETURN QUERY SELECT 
        'indexes'::TEXT,
        jsonb_agg(row_to_json(t)) as details
    FROM get_index_structure() t;
    
    -- Foreign keys
    RETURN QUERY SELECT 
        'foreign_keys'::TEXT,
        jsonb_agg(row_to_json(t)) as details
    FROM get_foreign_key_constraints() t;
    
    -- Enum types
    RETURN QUERY SELECT 
        'enum_types'::TEXT,
        jsonb_agg(row_to_json(t)) as details
    FROM get_enum_types() t;
    
    -- Sequences
    RETURN QUERY SELECT 
        'sequences'::TEXT,
        jsonb_agg(row_to_json(t)) as details
    FROM get_sequences() t;
    
    -- JSONB analysis
    RETURN QUERY SELECT 
        'jsonb_columns'::TEXT,
        jsonb_agg(row_to_json(t)) as details
    FROM analyze_jsonb_columns() t;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. SCHEMA DRIFT DETECTION
-- ============================================================================

-- Function to detect schema differences between environments
CREATE OR REPLACE FUNCTION detect_schema_drift(
    baseline_schema JSONB,
    current_schema JSONB DEFAULT NULL
)
RETURNS TABLE(
    drift_type TEXT,
    table_name TEXT,
    column_name TEXT,
    difference_details JSONB
) AS $$
BEGIN
    -- If current_schema is not provided, generate it
    IF current_schema IS NULL THEN
        SELECT jsonb_object_agg(report_section, details) INTO current_schema
        FROM generate_schema_report();
    END IF;
    
    -- Compare and return differences
    -- This is a simplified version - full implementation would require
    -- more detailed comparison logic
    
    RETURN QUERY SELECT 
        'schema_comparison'::TEXT,
        'all_tables'::TEXT,
        'structure'::TEXT,
        jsonb_build_object(
            'baseline_tables', baseline_schema->'table_structures',
            'current_tables', current_schema->'table_structures'
        );
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

/*
-- Generate complete schema report
SELECT * FROM generate_schema_report();

-- Get table structures only
SELECT * FROM get_table_structure() WHERE table_name = 'campaigns';

-- Analyze indexes
SELECT * FROM get_index_structure() WHERE table_name IN ('campaigns', 'donations');

-- Check foreign key constraints
SELECT * FROM get_foreign_key_constraints();

-- Analyze JSONB columns
SELECT * FROM analyze_jsonb_columns();

-- Export schema for comparison
COPY (
    SELECT jsonb_pretty(jsonb_object_agg(report_section, details))
    FROM generate_schema_report()
) TO '/tmp/schema_export.json';
*/