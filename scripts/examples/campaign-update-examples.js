6633/**
 * Campaign Update Examples
 * 
 * This file demonstrates how to use the CampaignProgressUpdater programmatically
 * in your own scripts or as part of automated processes.
 */

const { CampaignProgressUpdater } = require('../update-campaign-progress');
const { Campaign, Donation } = require('../../src/models');
const { Op } = require('sequelize');

/**
 * Example 1: Update a single campaign with calculated values
 */
async function updateSingleCampaign() {
  console.log('Example 1: Updating single campaign with calculated values');
  
  const updater = new CampaignProgressUpdater({
    verbose: true,
    dryRun: false // Set to true for testing
  });

  try {
    // Replace with actual campaign ID
    const campaignId = '123e4567-e89b-12d3-a456-426614174000';
    
    const result = await updater.updateCampaignProgress(campaignId);
    
    if (result.success) {
      console.log('✅ Campaign updated successfully');
      console.log('Changes:', result.changes);
    } else {
      console.log('❌ Update failed:', result.error);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Example 2: Batch update all active campaigns
 */
async function updateAllActiveCampaigns() {
  console.log('Example 2: Batch updating all active campaigns');
  
  const updater = new CampaignProgressUpdater({
    verbose: false,
    dryRun: true, // Safe dry run
    batchSize: 25 // Smaller batch size
  });

  try {
    const campaigns = await updater.getCampaignsToUpdate({
      type: 'all-active'
    });
    
    const campaignIds = campaigns.map(c => c.id);
    console.log(`Found ${campaignIds.length} active campaigns`);
    
    const results = await updater.updateMultipleCampaigns(campaignIds);
    updater.displaySummary();
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Example 3: Set manual values for testing
 */
async function setManualValues() {
  console.log('Example 3: Setting manual values for a campaign');
  
  const updater = new CampaignProgressUpdater({
    verbose: true,
    dryRun: false
  });

  try {
    const campaignId = '123e4567-e89b-12d3-a456-426614174000';
    const manualValues = {
      amount: 50000.50,
      donors: 25
    };
    
    const result = await updater.updateCampaignProgress(campaignId, manualValues);
    
    if (result.success) {
      console.log('✅ Manual values set successfully');
    } else {
      console.log('❌ Failed to set values:', result.error);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Example 4: Audit campaign data (find discrepancies)
 */
async function auditCampaignData() {
  console.log('Example 4: Auditing campaign data for discrepancies');
  
  const updater = new CampaignProgressUpdater({
    verbose: true,
    dryRun: true // Always dry run for audits
  });

  try {
    // Get all campaigns
    const campaigns = await Campaign.findAll({
      attributes: ['id', 'title', 'raised_amount', 'donor_count'],
      where: { status: 'active' }
    });

    const discrepancies = [];

    for (const campaign of campaigns) {
      // Calculate actual values
      const stats = await updater.calculateCampaignStats(campaign.id);
      
      const currentAmount = parseFloat(campaign.raised_amount) || 0;
      const currentDonors = campaign.donor_count || 0;
      
      const amountDiff = Math.abs(currentAmount - stats.totalAmount);
      const donorDiff = Math.abs(currentDonors - stats.donorCount);
      
      if (amountDiff > 0.01 || donorDiff > 0) {
        discrepancies.push({
          id: campaign.id,
          title: campaign.title,
          currentAmount,
          calculatedAmount: stats.totalAmount,
          amountDiff,
          currentDonors,
          calculatedDonors: stats.donorCount,
          donorDiff
        });
      }
    }

    console.log(`\n📊 Audit Results: ${discrepancies.length} discrepancies found`);
    
    discrepancies.forEach(item => {
      console.log(`\n🔍 ${item.title} (${item.id})`);
      console.log(`  Amount: ₹${item.currentAmount} → ₹${item.calculatedAmount} (diff: ₹${item.amountDiff})`);
      console.log(`  Donors: ${item.currentDonors} → ${item.calculatedDonors} (diff: ${item.donorDiff})`);
    });

  } catch (error) {
    console.error('Error during audit:', error.message);
  }
}

/**
 * Example 5: Update campaigns that received donations today
 */
async function updateCampaignsWithRecentDonations() {
  console.log('Example 5: Updating campaigns with donations from today');
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find campaigns that received donations today
    const recentDonations = await Donation.findAll({
      where: {
        created_at: {
          [Op.gte]: today
        },
        status: 'completed',
        payment_status: 'completed'
      },
      attributes: ['campaign_id'],
      group: ['campaign_id']
    });

    const campaignIds = [...new Set(recentDonations.map(d => d.campaign_id))];
    
    if (campaignIds.length === 0) {
      console.log('No campaigns with donations today');
      return;
    }

    console.log(`Found ${campaignIds.length} campaigns with donations today`);
    
    const updater = new CampaignProgressUpdater({
      verbose: true,
      dryRun: false
    });

    const results = await updater.updateMultipleCampaigns(campaignIds);
    updater.displaySummary();

  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Example 6: Scheduled maintenance function
 */
async function scheduledMaintenance() {
  console.log('Example 6: Running scheduled maintenance');
  
  const updater = new CampaignProgressUpdater({
    verbose: false,
    dryRun: false,
    transaction: true
  });

  try {
    // Update all active campaigns
    const campaigns = await updater.getCampaignsToUpdate({
      type: 'all-active'
    });
    
    if (campaigns.length === 0) {
      console.log('No active campaigns to update');
      return;
    }

    const campaignIds = campaigns.map(c => c.id);
    console.log(`Starting maintenance for ${campaignIds.length} campaigns`);
    
    const results = await updater.updateMultipleCampaigns(campaignIds);
    
    // Log summary to application logs
    console.log(`Maintenance completed: ${updater.results.updated} updated, ${updater.results.skipped} skipped, ${updater.results.errors} errors`);
    
    return updater.results;

  } catch (error) {
    console.error('Scheduled maintenance failed:', error.message);
    throw error;
  }
}

// Export functions for use in other scripts
module.exports = {
  updateSingleCampaign,
  updateAllActiveCampaigns,
  setManualValues,
  auditCampaignData,
  updateCampaignsWithRecentDonations,
  scheduledMaintenance
};

// Run examples if called directly
if (require.main === module) {
  console.log('🚀 Campaign Update Examples\n');
  
  // Uncomment the example you want to run:
  
  // updateSingleCampaign();
  // updateAllActiveCampaigns();
  // setManualValues();
  // auditCampaignData();
  // updateCampaignsWithRecentDonations();
  // scheduledMaintenance();
  
  console.log('Uncomment an example function to run it');
}