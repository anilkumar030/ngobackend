-- Grant necessary permissions to shivdhaam user
-- This needs to be run as postgres superuser

-- Grant CREATE privilege on public schema
GRANT CREATE ON SCHEMA public TO shivdhaam;

-- Grant USAGE privilege on public schema  
GRANT USAGE ON SCHEMA public TO shivdhaam;

-- Grant ALL privileges on all tables in public schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO shivdhaam;

-- Grant ALL privileges on all sequences in public schema
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO shivdhaam;

-- Grant ALL privileges on all functions in public schema
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO shivdhaam;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO shivdhaam;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO shivdhaam;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO shivdhaam;

-- Make shivdhaam a superuser (if needed)
-- ALTER USER shivdhaam CREATEDB CREATEROLE;

SELECT 'Permissions granted to shivdhaam user' as status;