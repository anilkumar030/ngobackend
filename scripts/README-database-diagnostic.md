# Database Connection Diagnostic Script

A comprehensive diagnostic tool for troubleshooting PostgreSQL database connection issues in Sequelize ORM applications.

## Overview

When you encounter "Database connection failed" errors with "DATABASE_CONNECTION_ERROR", this script systematically tests each potential failure point and provides clear, actionable feedback to help you identify and resolve the exact issue.

## Features

### Comprehensive Testing Categories

1. **Environment & Configuration**
   - Database configuration loading
   - Environment variable validation
   - Configuration completeness check

2. **Network Connectivity**
   - DNS resolution testing
   - Network connectivity to database host/port
   - PostgreSQL service availability check

3. **Database Authentication**
   - User credential validation
   - Authentication method verification

4. **Database Existence & Access**
   - Target database existence check
   - Database connection validation

5. **User Permissions**
   - Basic permission testing (SELECT, INSERT, UPDATE, DELETE, CREATE)
   - Schema access verification

6. **Connection Pool & Settings**
   - Sequelize connection testing
   - Connection pool configuration validation

7. **SSL/TLS Configuration**
   - SSL connection testing
   - Certificate validation

8. **Performance & Health**
   - Database query performance testing
   - Database size and health checks

## Usage

### Basic Usage

```bash
# Test current environment (uses NODE_ENV)
npm run db:diagnose

# Test specific environment
npm run db:diagnose:dev      # Development environment
npm run db:diagnose:staging  # Staging environment  
npm run db:diagnose:prod     # Production environment

# Direct script usage
node scripts/database-diagnostic.js
node scripts/database-diagnostic.js development
node scripts/database-diagnostic.js production --verbose
```

### Advanced Options

```bash
# Only validate configuration (no network tests)
npm run db:diagnose:config
node scripts/database-diagnostic.js --config-only

# Only test network connectivity
npm run db:diagnose:network
node scripts/database-diagnostic.js --network-only

# Verbose output with detailed information
node scripts/database-diagnostic.js --verbose

# Skip permission checks (faster execution)
node scripts/database-diagnostic.js --skip-permissions

# Custom timeout (default: 10 seconds)
node scripts/database-diagnostic.js --timeout=5000

# Show help
node scripts/database-diagnostic.js --help
```

## Sample Output

```
🔍 Database Connection Diagnostic
Environment: development
Started: 2024-01-15T10:30:00.000Z

✓ Configuration loaded for development environment
✓ Environment variables validation passed
✓ DNS resolution successful
✓ Network connectivity successful
✓ PostgreSQL service is running
✓ Database user credentials are valid
✗ Target database does not exist
  → Suggestion: Create the database: CREATE DATABASE myapp_dev;

📊 Diagnostic Report
============================================================

Environment & Configuration
✓ Configuration loaded for development environment
✓ Environment variables validation passed

Network Connectivity
✓ DNS resolution successful
✓ Network connectivity successful
✓ PostgreSQL service is running

Database Authentication
✓ Database user credentials are valid

Database Existence & Access
✗ Target database does not exist
  → Suggestion: Create the database: CREATE DATABASE myapp_dev;

Summary
──────────────────────────────
✓ Passed: 5
⚠ Warnings: 0
✗ Failed: 1
ℹ Skipped: 2
Duration: 1250ms

Overall Status: FAILED
Some critical tests failed - database connection will not work
```

## Common Issues and Solutions

### 1. Database Does Not Exist
**Symptom:** `✗ Target database does not exist`

**Solution:**
```sql
-- Connect to PostgreSQL as superuser and create database
CREATE DATABASE your_database_name;
GRANT ALL PRIVILEGES ON DATABASE your_database_name TO your_username;
```

### 2. User Authentication Failed
**Symptom:** `✗ Database user credential verification failed`

**Solutions:**
- Verify username and password in `.env` file
- Check if user exists: `SELECT usename FROM pg_user WHERE usename = 'your_username';`
- Reset password: `ALTER USER your_username PASSWORD 'new_password';`

### 3. Network Connection Refused
**Symptom:** `✗ Network connectivity failed (ECONNREFUSED)`

**Solutions:**
- Ensure PostgreSQL is running: `sudo systemctl status postgresql`
- Start PostgreSQL: `sudo systemctl start postgresql`
- Check if PostgreSQL is listening on correct port: `netstat -tlnp | grep 5432`

### 4. DNS Resolution Failed
**Symptom:** `✗ DNS resolution failed`

**Solutions:**
- Verify hostname spelling in configuration
- Use IP address instead of hostname
- Check DNS configuration
- Test with `nslookup your_hostname`

### 5. SSL Connection Issues
**Symptom:** `✗ SSL connection failed`

**Solutions:**
- Verify SSL certificate paths
- Check server SSL configuration
- Try disabling SSL temporarily for testing
- Ensure `rejectUnauthorized: false` for self-signed certificates

### 6. Permission Denied
**Symptom:** `✗ User has insufficient permissions`

**Solutions:**
```sql
-- Grant database privileges
GRANT ALL PRIVILEGES ON DATABASE your_db TO your_user;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO your_user;

-- Grant table privileges (if tables exist)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
```

## Environment Configuration

The script reads configuration from your existing database configuration file (`src/config/database.js`) and supports all environments defined there.

### Required Environment Variables

Based on your configuration, ensure these environment variables are set:

```bash
# Database connection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USERNAME=your_username  # or DB_USER
DB_PASSWORD=your_password

# Node environment
NODE_ENV=development
```

## Integration with Your Application

The diagnostic script uses the same configuration as your main application, ensuring that if the diagnostic passes, your application should be able to connect successfully.

### Before Running Your Application

```bash
# Run diagnostic first
npm run db:diagnose:dev

# If diagnostic passes, start your application
npm run dev
```

### In CI/CD Pipelines

```bash
# Add to your deployment scripts
npm run db:diagnose:prod
if [ $? -eq 0 ]; then
    echo "Database connectivity verified"
    npm start
else
    echo "Database connection failed - check configuration"
    exit 1
fi
```

## Troubleshooting Tips

1. **Start with configuration-only test** to verify basic setup
2. **Use verbose mode** for detailed debugging information
3. **Test network connectivity separately** to isolate network issues
4. **Check PostgreSQL logs** for additional error details
5. **Verify firewall settings** if connecting to remote database
6. **Test with different users** to isolate permission issues

## Exit Codes

- `0`: All tests passed successfully
- `1`: One or more critical tests failed

This makes the script suitable for use in automated environments and CI/CD pipelines.