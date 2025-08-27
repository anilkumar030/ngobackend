#!/usr/bin/env node
/**
 * Admin Password Reset Script for Shiv Dhaam Foundation
 * 
 * This script resets the password for an existing admin user.
 * It uses Sequelize ORM which automatically handles bcrypt hashing
 * through the beforeUpdate hook defined in the User model.
 * 
 * Usage: node scripts/reset-admin-password.js [email] [new-password]
 * Example: node scripts/reset-admin-password.js admin@shivdhaam.org shivdhaam
 */

const path = require('path');

// Console colors for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const levelColors = {
    'INFO': colors.cyan,
    'SUCCESS': colors.green,
    'WARNING': colors.yellow,
    'ERROR': colors.red,
    'DEBUG': colors.magenta
  };
  
  const color = levelColors[level] || colors.reset;
  console.log(`${color}[${timestamp}] [${level}]${colors.reset} ${message}`);
  
  if (data) {
    console.log(`${colors.blue}Data:${colors.reset}`, JSON.stringify(data, null, 2));
  }
}

async function resetAdminPassword() {
  try {
    // Get command line arguments
    const email = process.argv[2] || 'admin@shivdhaam.org';
    const newPassword = process.argv[3] || 'shivdhaam';
    
    log('INFO', `${colors.bright}Starting admin password reset${colors.reset}`);
    log('INFO', `Target email: ${email}`);
    log('INFO', `New password: ${newPassword}`);
    
    // Import User model and database connection
    const User = require('../src/models/User');
    const { sequelize, testConnection } = require('../src/config/database');
    
    // Test database connection first
    log('INFO', 'Testing database connection...');
    await testConnection();
    log('SUCCESS', 'Database connection established');
    
    // Find the admin user
    log('INFO', 'Searching for admin user...');
    const adminUser = await User.findOne({ 
      where: { 
        email: email 
      } 
    });
    
    if (!adminUser) {
      log('ERROR', `Admin user with email '${email}' not found`);
      log('INFO', 'Available users:');
      
      // Show available admin users
      const adminUsers = await User.findAll({
        where: {
          role: ['admin', 'super_admin']
        },
        attributes: ['email', 'role', 'first_name', 'last_name', 'is_active']
      });
      
      adminUsers.forEach(user => {
        console.log(`  - ${user.email} (${user.role}) - ${user.first_name} ${user.last_name} - Active: ${user.is_active}`);
      });
      
      process.exit(1);
    }
    
    log('SUCCESS', `Found admin user: ${adminUser.email} (${adminUser.role})`);
    log('INFO', `Current user details:`, {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      name: `${adminUser.first_name} ${adminUser.last_name}`,
      is_active: adminUser.is_active,
      email_verified: adminUser.email_verified,
      last_login: adminUser.last_login,
      created_at: adminUser.created_at
    });
    
    // Verify current password before changing (optional validation)
    log('INFO', 'Verifying current password hash exists...');
    if (!adminUser.password_hash) {
      log('ERROR', 'User does not have a password hash set');
      process.exit(1);
    }
    log('SUCCESS', 'Current password hash verified');
    
    // Update password - Sequelize will automatically hash it via beforeUpdate hook
    log('INFO', 'Updating password...');
    log('WARNING', 'The new password will be automatically hashed by bcrypt (salt rounds: 12)');
    
    // Store old hash for verification
    const oldPasswordHash = adminUser.password_hash;
    
    // Update the password_hash field - this will trigger the beforeUpdate hook
    // We need to use update with validate: false since validation runs before hooks
    adminUser.password_hash = newPassword;
    await adminUser.save({ validate: false });
    
    // Verify the password was actually changed
    await adminUser.reload();
    const newPasswordHash = adminUser.password_hash;
    
    if (oldPasswordHash === newPasswordHash) {
      log('ERROR', 'Password hash was not changed. Update may have failed.');
      process.exit(1);
    }
    
    log('SUCCESS', 'Password updated successfully!');
    log('INFO', 'Password hash comparison:', {
      old_hash_length: oldPasswordHash.length,
      new_hash_length: newPasswordHash.length,
      hashes_different: oldPasswordHash !== newPasswordHash,
      new_hash_starts_with_bcrypt: newPasswordHash.startsWith('$2')
    });
    
    // Test the new password
    log('INFO', 'Testing new password...');
    const passwordValid = await adminUser.validatePassword(newPassword);
    
    if (passwordValid) {
      log('SUCCESS', 'Password validation test passed!');
    } else {
      log('ERROR', 'Password validation test failed!');
      process.exit(1);
    }
    
    // Update last login to current time
    await adminUser.updateLastLogin();
    log('INFO', 'Updated last login timestamp');
    
    // Final summary
    console.log(`\n${colors.green}${colors.bright}=== PASSWORD RESET SUMMARY ===${colors.reset}`);
    console.log(`${colors.cyan}User Email:${colors.reset} ${adminUser.email}`);
    console.log(`${colors.cyan}User Role:${colors.reset} ${adminUser.role}`);
    console.log(`${colors.cyan}Full Name:${colors.reset} ${adminUser.fullName}`);
    console.log(`${colors.cyan}New Password:${colors.reset} ${newPassword}`);
    console.log(`${colors.cyan}Password Hash:${colors.reset} ${newPasswordHash.substring(0, 29)}...`);
    console.log(`${colors.cyan}Hash Algorithm:${colors.reset} bcrypt (salt rounds: 12)`);
    console.log(`${colors.cyan}Updated At:${colors.reset} ${new Date().toISOString()}`);
    
    console.log(`\n${colors.blue}${colors.bright}=== LOGIN INSTRUCTIONS ===${colors.reset}`);
    console.log(`You can now login with:`);
    console.log(`${colors.cyan}Email:${colors.reset} ${adminUser.email}`);
    console.log(`${colors.cyan}Password:${colors.reset} ${newPassword}`);
    
    console.log(`\n${colors.magenta}Password reset completed successfully! 🎉${colors.reset}\n`);
    
  } catch (error) {
    log('ERROR', `Password reset failed: ${error.message}`);
    log('DEBUG', 'Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  } finally {
    // Close database connection
    const { sequelize } = require('../src/config/database');
    if (sequelize) {
      await sequelize.close();
      log('INFO', 'Database connection closed');
    }
  }
}

// Main execution
if (require.main === module) {
  resetAdminPassword();
}

module.exports = resetAdminPassword;