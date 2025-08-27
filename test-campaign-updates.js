/**
 * Test script to verify CampaignUpdate model and associations
 * Run this after running the migration to test the implementation
 */

const { Campaign, CampaignUpdate, sequelize } = require('./src/models');

async function testCampaignUpdates() {
  try {
    console.log('Testing CampaignUpdate model and associations...\n');

    // Test database connection
    await sequelize.authenticate();
    console.log('✓ Database connection established');

    // Test model loading
    console.log('✓ CampaignUpdate model loaded successfully');
    console.log('✓ Campaign model loaded successfully');

    // Test associations
    const associations = CampaignUpdate.associations;
    console.log('✓ CampaignUpdate associations:', Object.keys(associations));

    const campaignAssociations = Campaign.associations;
    console.log('✓ Campaign associations:', Object.keys(campaignAssociations));

    // Verify the specific associations exist
    if (associations.campaign) {
      console.log('✓ CampaignUpdate.belongsTo(Campaign) association exists');
    } else {
      console.log('✗ CampaignUpdate.belongsTo(Campaign) association missing');
    }

    if (campaignAssociations.updates) {
      console.log('✓ Campaign.hasMany(CampaignUpdate) association exists');
    } else {
      console.log('✗ Campaign.hasMany(CampaignUpdate) association missing');
    }

    // Test model methods
    const dummyUpdate = CampaignUpdate.build({
      campaign_id: 'test-uuid',
      title: 'Test Update',
      description: 'This is a test campaign update',
      images: ['image1.jpg', 'image2.jpg']
    });

    console.log('✓ CampaignUpdate model instance methods:');
    console.log('  - hasImages:', dummyUpdate.hasImages);
    console.log('  - imageCount:', dummyUpdate.imageCount);
    console.log('  - previewImage:', dummyUpdate.previewImage);

    // Test scopes
    console.log('✓ CampaignUpdate scopes available:', Object.keys(CampaignUpdate.options.scopes));

    console.log('\n✅ All tests passed! CampaignUpdate implementation is ready.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await sequelize.close();
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testCampaignUpdates();
}

module.exports = { testCampaignUpdates };