#!/usr/bin/env node
/**
 * Quick Campaign Update Script
 * 
 * A simplified script for quick manual updates to campaign progress.
 * This is useful for immediate corrections or testing purposes.
 * 
 * Usage Examples:
 * 
 * # Quick update with manual values
 * node scripts/quick-campaign-update.js <campaign-id> <raised-amount> <donor-count>
 * 
 * # Example
 * node scripts/quick-campaign-update.js 123e4567-e89b-12d3-a456-426614174000 50000.50 25
 */

const { Campaign, sequelize } = require('../src/models');

async function quickUpdate(campaignId, raisedAmount, donorCount) {
  try {
    console.log(`🚀 Quick Campaign Update`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Campaign ID: ${campaignId}`);
    console.log(`New Raised Amount: ₹${raisedAmount}`);
    console.log(`New Donor Count: ${donorCount}`);
    
    // Validate inputs
    if (!campaignId || !raisedAmount || !donorCount) {
      throw new Error('Usage: node quick-campaign-update.js <campaign-id> <raised-amount> <donor-count>');
    }

    const amount = parseFloat(raisedAmount);
    const count = parseInt(donorCount);

    if (isNaN(amount) || amount < 0) {
      throw new Error('Raised amount must be a non-negative number');
    }

    if (isNaN(count) || count < 0 || !Number.isInteger(count)) {
      throw new Error('Donor count must be a non-negative integer');
    }

    // Find campaign
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    console.log(`\n📋 Current Campaign: ${campaign.title}`);
    console.log(`Current Raised Amount: ₹${campaign.raised_amount || 0}`);
    console.log(`Current Donor Count: ${campaign.donor_count || 0}`);

    // Update campaign
    await campaign.update({
      raised_amount: amount,
      donor_count: count
    });

    console.log(`\n✅ Campaign updated successfully!`);
    console.log(`New Raised Amount: ₹${amount.toFixed(2)}`);
    console.log(`New Donor Count: ${count}`);
    
    // Calculate progress
    if (campaign.target_amount) {
      const progress = (amount / parseFloat(campaign.target_amount)) * 100;
      console.log(`Progress: ${Math.min(progress, 100).toFixed(2)}%`);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 3) {
  console.error(`
Quick Campaign Update Script

Usage: node scripts/quick-campaign-update.js <campaign-id> <raised-amount> <donor-count>

Example:
  node scripts/quick-campaign-update.js 123e4567-e89b-12d3-a456-426614174000 50000.50 25

Arguments:
  campaign-id     UUID of the campaign to update
  raised-amount   New raised amount (in rupees)
  donor-count     New donor count (integer)
`);
  process.exit(1);
}

const [campaignId, raisedAmount, donorCount] = args;

// Run the update
quickUpdate(campaignId, raisedAmount, donorCount).catch(error => {
  console.error(`Script failed: ${error.message}`);
  process.exit(1);
});