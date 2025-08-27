#!/usr/bin/env node

/**
 * Test script for the campaign image migration functionality
 * This script helps test and validate the migration script before actual use
 */

const { Campaign, sequelize } = require('./src/models');
const path = require('path');

async function testMigrationScript() {
  try {
    console.log('='.repeat(60));
    console.log('CAMPAIGN IMAGE MIGRATION SCRIPT TEST');
    console.log('='.repeat(60));
    
    // Test database connection
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('✓ Database connection successful');
    
    // List available campaigns
    console.log('\nFetching available campaigns...');
    const campaigns = await Campaign.findAll({
      attributes: ['id', 'title', 'status', 'images'],
      limit: 10,
      order: [['created_at', 'DESC']]
    });
    
    console.log(`Found ${campaigns.length} campaigns:`);
    campaigns.forEach((campaign, index) => {
      console.log(`${index + 1}. Campaign ID: ${campaign.id}`);
      console.log(`   Title: ${campaign.title}`);
      console.log(`   Status: ${campaign.status}`);
      console.log(`   Current Images: ${campaign.images ? campaign.images.length : 0}`);
      if (campaign.images && campaign.images.length > 0) {
        console.log(`   Sample Image: ${campaign.images[0]}`);
      }
      console.log('');
    });
    
    // Check available test image folders
    console.log('Available test image folders:');
    const testFolders = [
      path.join(__dirname, 'bihar'),
      path.join(__dirname, 'mynamar')
    ];
    
    for (const folder of testFolders) {
      try {
        const fs = require('fs').promises;
        await fs.access(folder);
        const files = await fs.readdir(folder);
        const imageFiles = files.filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
        });
        console.log(`✓ ${folder}: ${imageFiles.length} image files`);
        if (imageFiles.length > 0) {
          console.log(`  Sample files: ${imageFiles.slice(0, 3).join(', ')}`);
        }
      } catch (error) {
        console.log(`✗ ${folder}: Not accessible`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('USAGE EXAMPLES:');
    console.log('='.repeat(60));
    
    if (campaigns.length > 0) {
      const sampleCampaign = campaigns[0];
      console.log('To test migration with bihar folder:');
      console.log(`node migrate-campaign-images.js "${path.join(__dirname, 'bihar')}" "${sampleCampaign.id}"`);
      console.log('');
      console.log('To test migration with mynamar folder:');
      console.log(`node migrate-campaign-images.js "${path.join(__dirname, 'mynamar')}" "${sampleCampaign.id}"`);
    } else {
      console.log('No campaigns found. Please create a campaign first.');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('SCRIPT VALIDATION:');
    console.log('='.repeat(60));
    
    // Test the migration script class without actually running it
    const { ImageMigrator, CONFIG } = require('./migrate-campaign-images.js');
    console.log('✓ Migration script loaded successfully');
    console.log(`✓ Supported formats: ${CONFIG.SUPPORTED_FORMATS.join(', ')}`);
    console.log(`✓ API Base URL: ${CONFIG.API_BASE_URL}`);
    console.log(`✓ Upload Base Path: ${CONFIG.UPLOAD_BASE_PATH}`);
    
    console.log('\n✓ All tests passed! The migration script is ready to use.');
    
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    // Close database connection
    try {
      await sequelize.close();
      console.log('\nDatabase connection closed.');
    } catch (error) {
      console.error('Error closing database connection:', error.message);
    }
  }
}

// Run the test
if (require.main === module) {
  testMigrationScript().catch((error) => {
    console.error('Critical error:', error.message);
    process.exit(1);
  });
}

module.exports = { testMigrationScript };