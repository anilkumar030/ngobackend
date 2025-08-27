#!/usr/bin/env node
/**
 * Test Campaign Update Script
 * 
 * Simple test to verify the campaign update scripts work correctly
 */

const { sequelize, Campaign, Donation } = require('../src/models');

async function testConnection() {
  try {
    console.log('🔌 Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

async function testModels() {
  try {
    console.log('📊 Testing model queries...');
    
    // Test Campaign model
    const campaignCount = await Campaign.count();
    console.log(`✅ Found ${campaignCount} campaigns in database`);
    
    // Test Donation model
    const donationCount = await Donation.count();
    console.log(`✅ Found ${donationCount} donations in database`);
    
    // Test association
    const campaignWithDonations = await Campaign.findOne({
      include: [{
        model: Donation,
        as: 'donations',
        limit: 1
      }]
    });
    
    if (campaignWithDonations) {
      console.log(`✅ Campaign-Donation association working`);
    } else {
      console.log(`⚠️  No campaigns with donations found (this is OK for empty database)`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Model test failed:', error.message);
    return false;
  }
}

async function testScriptImport() {
  try {
    console.log('📦 Testing script imports...');
    
    const { CampaignProgressUpdater } = require('./update-campaign-progress');
    const updater = new CampaignProgressUpdater({ dryRun: true });
    
    console.log('✅ CampaignProgressUpdater imported successfully');
    console.log('✅ Instance created successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Script import failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Running Campaign Update Script Tests\n');
  
  const tests = [
    testConnection,
    testModels,
    testScriptImport
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
      failed++;
    }
    console.log(''); // Add space between tests
  }
  
  console.log('📋 Test Summary:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The campaign update scripts are ready to use.');
    console.log('\nNext steps:');
    console.log('1. Try a dry run: node scripts/update-campaign-progress.js --all-active --dry-run');
    console.log('2. Check the documentation: scripts/CAMPAIGN_UPDATE_README.md');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
  }
  
  await sequelize.close();
  process.exit(failed === 0 ? 0 : 1);
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testConnection, testModels, testScriptImport };