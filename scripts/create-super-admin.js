#!/usr/bin/env node
/**
 * Super Admin User Creation Script for Shiv Dhaam Foundation
 * 
 * This script creates a new super admin user with all rights.
 * It handles password hashing, email validation, and creates default address.
 * 
 * Usage: node scripts/create-super-admin.js <email> <password>
 * Example: node scripts/create-super-admin.js admin@example.com MySecurePass123
 */

const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

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

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password) {
  const errors = [];
  
  if (!password) {
    errors.push('Password is required');
    return { valid: false, errors };
  }
  
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one digit');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return { valid: errors.length === 0, errors };
}

async function createSuperAdmin() {
  try {
    // Get command line arguments
    const email = process.argv[2];
    const password = process.argv[3];
    
    // Validate arguments
    if (!email || !password) {
      console.log(`${colors.red}${colors.bright}Error: Missing required arguments${colors.reset}`);
      console.log(`Usage: node scripts/create-super-admin.js <email> <password>`);
      console.log(`Example: node scripts/create-super-admin.js admin@example.com MySecurePass123`);
      process.exit(1);
    }
    
    // Validate email format
    if (!validateEmail(email)) {
      log('ERROR', 'Invalid email format provided');
      process.exit(1);
    }
    
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      log('ERROR', 'Password validation failed:');
      passwordValidation.errors.forEach(error => console.log(`  ${colors.red}- ${error}${colors.reset}`));
      process.exit(1);
    }
    
    log('INFO', `${colors.bright}Starting super admin creation${colors.reset}`);
    log('INFO', `Email: ${email}`);
    log('INFO', `Password length: ${password.length} characters`);
    
    // Import User model and database connection
    const User = require('../src/models/User');
    const UserAddress = require('../src/models/UserAddress');
    const { sequelize, testConnection } = require('../src/config/database');
    
    // Test database connection
    log('INFO', 'Testing database connection...');
    await testConnection();
    log('SUCCESS', 'Database connection established');
    
    // Check if user already exists
    log('INFO', 'Checking if user already exists...');
    const existingUser = await User.findOne({ 
      where: { email: email } 
    });
    
    if (existingUser) {
      log('ERROR', `User with email '${email}' already exists`);
      log('INFO', 'Existing user details:', {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
        name: `${existingUser.first_name} ${existingUser.last_name}`,
        is_active: existingUser.is_active,
        created_at: existingUser.created_at
      });
      process.exit(1);
    }
    
    log('SUCCESS', 'Email is available for new user');
    
    // Hash password
    log('INFO', 'Hashing password with bcrypt (salt rounds: 12)...');
    const hashedPassword = await bcrypt.hash(password, 12);
    log('SUCCESS', 'Password hashed successfully');
    
    // Generate user ID
    const userId = uuidv4();
    log('INFO', `Generated user ID: ${userId}`);
    
    // Create user transaction
    log('INFO', 'Starting database transaction...');
    const transaction = await sequelize.transaction();
    
    try {
      // Create super admin user
      log('INFO', 'Creating super admin user...');
      const newUser = await User.create({
        id: userId,
        email: email,
        password_hash: hashedPassword,
        first_name: 'Super',
        last_name: 'Admin',
        role: 'super_admin',
        is_email_verified: true,
        is_phone_verified: false,
        is_active: true,
        total_donations: 0.00,
        donation_count: 0,
        preferences: {
          newsletter: true,
          email_notifications: true,
          sms_notifications: true
        }
      }, { transaction });
      
      log('SUCCESS', 'Super admin user created successfully');
      
      // Create default address
      log('INFO', 'Creating default address...');
      const addressId = uuidv4();
      await UserAddress.create({
        id: addressId,
        user_id: userId,
        type: 'home',
        first_name: 'Super',
        last_name: 'Admin',
        company: process.env.PROJECT_NAME || 'Shiv Dhaam Foundation',
        address_line_1: 'Admin Office',
        address_line_2: 'Administrative Building',
        city: 'Delhi',
        state: 'Delhi',
        postal_code: '110001',
        country: 'India',
        phone_number: '+91 9876543210',
        is_default: true
      }, { transaction });
      
      log('SUCCESS', 'Default address created successfully');
      
      // Commit transaction
      await transaction.commit();
      log('SUCCESS', 'Database transaction committed');
      
      // Test login credentials
      log('INFO', 'Testing login credentials...');
      const testUser = await User.findOne({ where: { email: email } });
      const passwordValid = await testUser.validatePassword(password);
      
      if (passwordValid) {
        log('SUCCESS', 'Login credentials test passed!');
      } else {
        log('ERROR', 'Login credentials test failed!');
        throw new Error('Password validation failed');
      }
      
      // Final summary
      console.log(`\n${colors.green}${colors.bright}=== SUPER ADMIN CREATION SUMMARY ===${colors.reset}`);
      console.log(`${colors.cyan}User ID:${colors.reset} ${newUser.id}`);
      console.log(`${colors.cyan}Email:${colors.reset} ${newUser.email}`);
      console.log(`${colors.cyan}Role:${colors.reset} ${newUser.role}`);
      console.log(`${colors.cyan}Full Name:${colors.reset} ${newUser.first_name} ${newUser.last_name}`);
      console.log(`${colors.cyan}Email Verified:${colors.reset} ${newUser.is_email_verified}`);
      console.log(`${colors.cyan}Active Status:${colors.reset} ${newUser.is_active}`);
      console.log(`${colors.cyan}Created At:${colors.reset} ${newUser.created_at}`);
      console.log(`${colors.cyan}Password Hash:${colors.reset} ${hashedPassword.substring(0, 29)}...`);
      
      console.log(`\n${colors.blue}${colors.bright}=== LOGIN CREDENTIALS ===${colors.reset}`);
      console.log(`Email: ${email}`);
      console.log(`Password: [Use the password provided as script argument]`);
      console.log(`Role: super_admin (full access rights)`);
      
      console.log(`\n${colors.magenta}Super admin user created successfully! 🎉${colors.reset}\n`);
      
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      log('ERROR', 'Database transaction rolled back');
      throw error;
    }
    
  } catch (error) {
    log('ERROR', `Super admin creation failed: ${error.message}`);
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
  createSuperAdmin();
}

module.exports = createSuperAdmin;