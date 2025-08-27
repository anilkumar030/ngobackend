# Database Diagnostic Script - Usage Examples

## Quick Start Examples

### 1. Basic Diagnostic (Recommended First Step)
```bash
npm run db:diagnose
```
This runs a complete diagnostic for your current environment.

### 2. Environment-Specific Testing
```bash
# Development environment with detailed output
npm run db:diagnose:dev

# Production environment with detailed output
npm run db:diagnose:prod

# Staging environment
npm run db:diagnose:staging
```

### 3. Configuration-Only Testing
```bash
# Only validate configuration files and environment variables
npm run db:diagnose:config
```
Use this when:
- You just want to verify your config files are correct
- You're in an environment without database access
- You're debugging configuration issues

### 4. Network-Only Testing
```bash
# Only test network connectivity to database
npm run db:diagnose:network
```
Use this when:
- Database configuration is correct but connection fails
- You suspect firewall or network issues
- You want to test if PostgreSQL service is running

## Common Troubleshooting Scenarios

### Scenario 1: "Database connection failed" Error
```bash
# Step 1: Check if it's a configuration issue
npm run db:diagnose:config

# Step 2: If config is ok, check network
npm run db:diagnose:network

# Step 3: If network is ok, run full diagnostic
npm run db:diagnose --verbose
```

### Scenario 2: Setting Up New Environment
```bash
# Step 1: Validate configuration
node scripts/database-diagnostic.js production --config-only

# Step 2: Test network connectivity
node scripts/database-diagnostic.js production --network-only

# Step 3: Full diagnostic
node scripts/database-diagnostic.js production --verbose
```

### Scenario 3: CI/CD Pipeline Integration
```bash
#!/bin/bash
# In your deployment script

echo "Testing database connectivity..."
npm run db:diagnose:prod

if [ $? -eq 0 ]; then
    echo "✅ Database connectivity verified - proceeding with deployment"
    npm start
else
    echo "❌ Database connection failed - deployment aborted"
    exit 1
fi
```

### Scenario 4: Quick Health Check
```bash
# Fast check without permission testing (good for monitoring)
node scripts/database-diagnostic.js --skip-permissions
```

## Sample Outputs and What They Mean

### ✅ All Good - Ready to Deploy
```
Overall Status: PASSED
All tests passed successfully
```
**Action:** Your application should work fine.

### ⚠️ Warnings - Proceed with Caution
```
Overall Status: WARNING
Tests passed with warnings - connection may work with limitations
```
**Action:** Check warning details, may impact some functionality.

### ❌ Critical Issues - Must Fix
```
Overall Status: FAILED
Some critical tests failed - database connection will not work
```
**Action:** Fix the failed tests before running your application.

## Advanced Usage

### Custom Timeout for Slow Networks
```bash
# 30-second timeout instead of default 10 seconds
node scripts/database-diagnostic.js --timeout=30000
```

### Multiple Environment Testing
```bash
# Test all environments quickly
for env in development staging production; do
    echo "Testing $env environment..."
    node scripts/database-diagnostic.js $env --config-only
done
```

### Integration with Application Startup
```javascript
// In your server startup code
const DatabaseDiagnostic = require('./scripts/database-diagnostic');

async function startServer() {
    // Run diagnostic before starting server
    const diagnostic = new DatabaseDiagnostic();
    const report = await diagnostic.runDiagnostic();
    
    if (report.status === 'failure') {
        console.error('Database diagnostic failed - server will not start');
        process.exit(1);
    }
    
    // Continue with server startup...
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
```

## Docker Environment Usage

### Testing Database Connectivity in Docker
```bash
# From within Docker container
docker exec -it your-container npm run db:diagnose

# Before starting container services
docker-compose run --rm api npm run db:diagnose:prod
```

### Docker Compose Health Check Integration
```yaml
# In docker-compose.yml
services:
  api:
    image: your-app
    healthcheck:
      test: ["CMD", "npm", "run", "db:diagnose:config"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Common Error Patterns and Quick Fixes

### Pattern: DNS Resolution Failed
```
✗ DNS resolution failed
Cannot resolve mydb.example.com
```
**Quick Fix:** 
```bash
# Test DNS manually
nslookup mydb.example.com

# Or use IP address in config temporarily
DB_HOST=192.168.1.100
```

### Pattern: Connection Refused
```
✗ Network connectivity failed
ECONNREFUSED: Connection refused
```
**Quick Fix:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql
sudo systemctl start postgresql

# Check if port is correct
netstat -tlnp | grep 5432
```

### Pattern: Authentication Failed
```
✗ Database user credential verification failed
28P01: password authentication failed
```
**Quick Fix:**
```bash
# Reset password in PostgreSQL
sudo -u postgres psql
ALTER USER your_username PASSWORD 'new_password';
```

### Pattern: Database Not Found
```
✗ Target database does not exist
Database 'myapp_prod' not found
```
**Quick Fix:**
```sql
-- Create database
CREATE DATABASE myapp_prod;
GRANT ALL PRIVILEGES ON DATABASE myapp_prod TO your_username;
```

## Monitoring and Alerting

### Automated Health Checks
```bash
#!/bin/bash
# health-check.sh

npm run db:diagnose --skip-permissions > /tmp/db-health.log 2>&1

if [ $? -eq 0 ]; then
    echo "Database health: OK"
else
    echo "Database health: FAILED"
    # Send alert (email, Slack, etc.)
    cat /tmp/db-health.log | mail -s "Database Health Alert" admin@yourcompany.com
fi
```

### Cron Job for Regular Checks
```bash
# Add to crontab for regular monitoring
# Run every 5 minutes
*/5 * * * * cd /path/to/your/app && npm run db:diagnose --skip-permissions
```

This diagnostic script is designed to be your first line of defense when dealing with database connectivity issues. It provides clear, actionable feedback that helps you quickly identify and resolve problems.