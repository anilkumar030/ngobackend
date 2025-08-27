#!/usr/bin/env node

/**
 * Database Cleanup Script
 * 
 * This script removes all data from campaigns, projects, certificates, donations, 
 * events, store (products/orders), and gallery tables while respecting foreign key constraints.
 * 
 * WARNING: This will permanently delete all data from the specified tables.
 * Make sure to backup your database before running this script.
 */

const readline = require('readline');
const { sequelize } = require('../src/config/database');

// Import all models
const {
  Campaign,
  Project,
  Certificate, 
  Donation,
  Event,
  EventRegistration,
  Product,
  Order,
  OrderItem,
  Gallery,
  SavedCampaign,
  ProjectUpdate,
  Testimonial
} = require('../src/models');

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Prompt user for confirmation
 */
function askConfirmation(message) {
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      resolve(answer.toLowerCase().trim());
    });
  });
}

/**
 * Get counts of records in each table
 */
async function getRecordCounts() {
  console.log('\n📊 Current record counts:');
  console.log('================================');
  
  try {
    const counts = await Promise.all([
      Campaign.count(),
      Project.count(), 
      Certificate.count(),
      Donation.count(),
      Event.count(),
      EventRegistration.count(),
      Product.count(),
      Order.count(),
      OrderItem.count(),
      Gallery.count(),
      SavedCampaign.count(),
      ProjectUpdate.count(),
      Testimonial.count()
    ]);

    const tables = [
      'Campaigns', 'Projects', 'Certificates', 'Donations', 'Events', 
      'Event Registrations', 'Products', 'Orders', 'Order Items', 'Gallery Items',
      'Saved Campaigns', 'Project Updates', 'Testimonials'
    ];

    let totalRecords = 0;
    tables.forEach((table, index) => {
      console.log(`${table.padEnd(20)}: ${counts[index].toLocaleString()}`);
      totalRecords += counts[index];
    });
    
    console.log('================================');
    console.log(`Total records: ${totalRecords.toLocaleString()}`);
    
    return { counts, totalRecords, tables };
  } catch (error) {
    console.error('❌ Error getting record counts:', error.message);
    throw error;
  }
}

/**
 * Delete records from a table with progress tracking
 */
async function deleteFromTable(model, tableName) {
  try {
    const count = await model.count();
    if (count === 0) {
      console.log(`✅ ${tableName}: Already empty`);
      return 0;
    }
    
    console.log(`🗑️  Deleting ${count.toLocaleString()} records from ${tableName}...`);
    const startTime = Date.now();
    
    const result = await model.destroy({
      where: {},
      force: true // This bypasses soft delete if implemented
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ ${tableName}: Deleted ${result.toLocaleString()} records in ${duration}s`);
    
    return result;
  } catch (error) {
    console.error(`❌ Error deleting from ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Main cleanup function
 */
async function cleanupDatabase() {
  console.log('🧹 Shivdhaam Database Cleanup Script');
  console.log('====================================\n');
  
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Get current record counts
    const { counts, totalRecords } = await getRecordCounts();
    
    if (totalRecords === 0) {
      console.log('\n🎉 Database is already clean! No records to delete.');
      return;
    }
    
    // Ask for confirmation
    console.log('\n⚠️  WARNING: This action cannot be undone!');
    console.log('This will permanently delete ALL data from the following tables:');
    console.log('- Campaigns and related donations');
    console.log('- Projects and project updates'); 
    console.log('- Certificates');
    console.log('- Events and registrations');
    console.log('- Store products, orders, and order items');
    console.log('- Gallery images');
    console.log('- Saved campaigns and testimonials\n');
    
    const confirm1 = await askConfirmation('Are you sure you want to continue? (type "yes" to confirm): ');
    if (confirm1 !== 'yes') {
      console.log('❌ Operation cancelled.');
      return;
    }
    
    const confirm2 = await askConfirmation('This is your final warning. Type "DELETE ALL DATA" to proceed: ');
    if (confirm2 !== 'delete all data') {
      console.log('❌ Operation cancelled.');
      return;
    }
    
    console.log('\n🚀 Starting database cleanup...\n');
    const overallStartTime = Date.now();
    
    // Delete in proper order to respect foreign key constraints
    const deletionSteps = [
      // Step 1: Delete child records first
      { model: Testimonial, name: 'Testimonials' },
      { model: SavedCampaign, name: 'Saved Campaigns' },
      { model: Donation, name: 'Donations' },
      { model: Certificate, name: 'Certificates' },
      { model: ProjectUpdate, name: 'Project Updates' },
      { model: EventRegistration, name: 'Event Registrations' },
      { model: OrderItem, name: 'Order Items' },
      
      // Step 2: Delete parent records
      { model: Order, name: 'Orders' },
      { model: Product, name: 'Products' },
      { model: Campaign, name: 'Campaigns' },
      { model: Project, name: 'Projects' },
      { model: Event, name: 'Events' },
      { model: Gallery, name: 'Gallery Items' }
    ];
    
    let totalDeleted = 0;
    for (const step of deletionSteps) {
      const deleted = await deleteFromTable(step.model, step.name);
      totalDeleted += deleted;
    }
    
    const overallDuration = ((Date.now() - overallStartTime) / 1000).toFixed(2);
    
    console.log('\n🎉 Database cleanup completed successfully!');
    console.log(`📊 Total records deleted: ${totalDeleted.toLocaleString()}`);
    console.log(`⏱️  Total time: ${overallDuration}s`);
    
    // Verify cleanup
    console.log('\n🔍 Verifying cleanup...');
    const { totalRecords: remainingRecords } = await getRecordCounts();
    
    if (remainingRecords === 0) {
      console.log('✅ Cleanup verification passed - all target tables are empty');
    } else {
      console.log(`⚠️  Warning: ${remainingRecords} records remain in target tables`);
    }
    
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

/**
 * Reset database auto-increment sequences (PostgreSQL specific)
 */
async function resetSequences() {
  try {
    console.log('\n🔄 Resetting auto-increment sequences...');
    
    // Note: This is PostgreSQL specific. For other databases, this step would be different.
    const tableNames = [
      'campaigns', 'projects', 'certificates', 'donations', 'events',
      'event_registrations', 'products', 'orders', 'order_items', 'gallery',
      'saved_campaigns', 'project_updates', 'testimonials'
    ];
    
    // In PostgreSQL with UUID primary keys, we don't need to reset sequences
    // But if you have any integer-based sequences, you can reset them here
    
    console.log('✅ Sequences reset (UUIDs don\'t require sequence reset)');
    
  } catch (error) {
    console.warn('⚠️  Could not reset sequences:', error.message);
  }
}

/**
 * Script execution
 */
async function main() {
  try {
    await cleanupDatabase();
    await resetSequences();
    
  } catch (error) {
    console.error('Script execution failed:', error);
    process.exit(1);
  } finally {
    rl.close();
    await sequelize.close();
    console.log('\n👋 Database connection closed. Goodbye!');
  }
}

// Handle script interruption
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Script interrupted by user');
  rl.close();
  await sequelize.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n⚠️  Script terminated');
  rl.close();
  await sequelize.close();
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  cleanupDatabase,
  getRecordCounts,
  deleteFromTable
};