'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Get project name from environment variable with fallback
const PROJECT_NAME = process.env.PROJECT_NAME || 'Shiv Dhaam Foundation';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash('Admin@123', 12);
    const adminId = uuidv4();
    
    await queryInterface.bulkInsert('users', [
      {
        id: adminId,
        email: process.env.ADMIN_EMAIL || 'admin@shivdhaam.org',
        password_hash: hashedPassword,
        first_name: 'System',
        last_name: 'Administrator',
        phone_number: '+91 9876543210',
        role: 'super_admin',
        is_email_verified: true,
        is_phone_verified: true,
        is_active: true,
        total_donations: 0.00,
        donation_count: 0,
        preferences: JSON.stringify({
          newsletter: true,
          email_notifications: true,
          sms_notifications: true
        }),
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // Create default address for admin
    await queryInterface.bulkInsert('user_addresses', [
      {
        id: uuidv4(),
        user_id: adminId,
        type: 'home',
        first_name: 'System',
        last_name: 'Administrator',
        company: PROJECT_NAME,
        address_line_1: 'Temple Complex',
        address_line_2: 'Main Temple Road',
        city: 'Haridwar',
        state: 'Uttarakhand',
        postal_code: '249401',
        country: 'India',
        phone_number: '+91 9876543210',
        is_default: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('user_addresses', {
      user_id: {
        [Sequelize.Op.in]: queryInterface.sequelize.literal(
          `(SELECT id FROM users WHERE email = '${process.env.ADMIN_EMAIL || 'admin@shivdhaam.org'}')`
        )
      }
    });
    
    await queryInterface.bulkDelete('users', {
      email: process.env.ADMIN_EMAIL || 'admin@shivdhaam.org'
    });
  }
};