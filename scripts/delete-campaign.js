#!/usr/bin/env node

/**
 * Safe Campaign Deletion Script
 * 
 * This script safely deletes a campaign from the database with thorough checks
 * to ensure no unintended data is deleted.
 * 
 * Usage: node scripts/delete-campaign.js <campaign_id>
 */

const { Campaign, Donation, SavedCampaign, Testimonial, CampaignUpdate, sequelize } = require('../src/models');
const readline = require('readline');
const { Op } = require('sequelize');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Helper function to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount || 0);
};

// Helper function to prompt user for confirmation
const promptConfirmation = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
};

// Helper function to validate UUID format
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Main deletion function
async function deleteCampaign(campaignId) {
  let transaction;
  
  try {
    console.log(`\n${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.bright}Campaign Deletion Script${colors.reset}`);
    console.log(`${colors.cyan}========================================${colors.reset}\n`);

    // Validate campaign ID format
    if (!campaignId) {
      console.error(`${colors.red}❌ Error: Campaign ID is required${colors.reset}`);
      console.log(`${colors.yellow}Usage: node scripts/delete-campaign.js <campaign_id>${colors.reset}`);
      process.exit(1);
    }

    // Validate UUID format
    if (!isValidUUID(campaignId)) {
      console.error(`${colors.red}❌ Error: Invalid campaign ID format${colors.reset}`);
      console.error(`${colors.yellow}   Campaign ID must be a valid UUID (e.g., 123e4567-e89b-12d3-a456-426614174000)${colors.reset}`);
      console.error(`${colors.yellow}   Provided: ${campaignId}${colors.reset}`);
      process.exit(1);
    }

    console.log(`${colors.blue}🔍 Searching for campaign with ID: ${colors.bright}${campaignId}${colors.reset}`);

    // Find the campaign
    const campaign = await Campaign.findByPk(campaignId, {
      include: [
        {
          model: Donation,
          as: 'donations',
          where: { payment_status: 'completed' },
          required: false
        }
      ]
    });

    if (!campaign) {
      console.error(`${colors.red}❌ Campaign not found with ID: ${campaignId}${colors.reset}`);
      process.exit(1);
    }

    // Display campaign details
    console.log(`\n${colors.green}✅ Campaign found!${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}Campaign Details:${colors.reset}`);
    console.log(`  • ID: ${campaign.id}`);
    console.log(`  • Title: ${colors.bright}${campaign.title}${colors.reset}`);
    console.log(`  • Slug: ${campaign.slug}`);
    console.log(`  • Status: ${campaign.status}`);
    console.log(`  • Category: ${campaign.category || 'N/A'}`);
    console.log(`  • Target Amount: ${formatCurrency(campaign.target_amount)}`);
    console.log(`  • Raised Amount: ${formatCurrency(campaign.raised_amount)}`);
    console.log(`  • Donor Count: ${campaign.donor_count || 0}`);
    console.log(`  • Created At: ${campaign.created_at}`);
    console.log(`  • Created By (User ID): ${campaign.created_by}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    // Check for completed donations
    if (campaign.donations && campaign.donations.length > 0) {
      console.error(`${colors.red}⚠️  WARNING: This campaign has ${campaign.donations.length} completed donations!${colors.reset}`);
      console.error(`${colors.red}   Total donated amount: ${formatCurrency(campaign.raised_amount)}${colors.reset}`);
      console.error(`${colors.red}   Deleting a campaign with donations is NOT recommended.${colors.reset}`);
      console.error(`${colors.yellow}   Consider marking the campaign as 'cancelled' instead.${colors.reset}\n`);
      
      const proceed = await promptConfirmation(
        `${colors.red}Are you ABSOLUTELY SURE you want to delete this campaign with donations? (yes/no): ${colors.reset}`
      );
      
      if (!proceed) {
        console.log(`${colors.green}✓ Deletion cancelled. Campaign remains unchanged.${colors.reset}`);
        process.exit(0);
      }
    }

    // Check for related data
    console.log(`${colors.blue}🔍 Checking for related data...${colors.reset}`);
    
    const [savedCount, testimonialCount, updateCount, allDonationsCount] = await Promise.all([
      SavedCampaign.count({ where: { campaign_id: campaignId } }),
      Testimonial.count({ where: { campaign_id: campaignId } }),
      CampaignUpdate.count({ where: { campaign_id: campaignId } }),
      Donation.count({ where: { campaign_id: campaignId } })
    ]);

    console.log(`\n${colors.bright}Related Data Summary:${colors.reset}`);
    console.log(`  • Saved Campaigns: ${savedCount}`);
    console.log(`  • Testimonials: ${testimonialCount}`);
    console.log(`  • Campaign Updates: ${updateCount}`);
    console.log(`  • All Donations (including pending): ${allDonationsCount}`);

    // Show what will be deleted
    console.log(`\n${colors.yellow}⚠️  The following data will be PERMANENTLY DELETED:${colors.reset}`);
    console.log(`${colors.red}  ✗ Campaign: "${campaign.title}"${colors.reset}`);
    if (savedCount > 0) console.log(`${colors.red}  ✗ ${savedCount} Saved Campaign records${colors.reset}`);
    if (testimonialCount > 0) console.log(`${colors.red}  ✗ ${testimonialCount} Testimonial records${colors.reset}`);
    if (updateCount > 0) console.log(`${colors.red}  ✗ ${updateCount} Campaign Update records${colors.reset}`);
    if (allDonationsCount > 0) console.log(`${colors.red}  ✗ ${allDonationsCount} Donation records${colors.reset}`);
    
    console.log(`\n${colors.bright}${colors.red}⚠️  THIS ACTION CANNOT BE UNDONE!${colors.reset}\n`);

    // Final confirmation
    const finalConfirm = await promptConfirmation(
      `${colors.yellow}Type 'yes' to confirm deletion of campaign "${campaign.title}": ${colors.reset}`
    );

    if (!finalConfirm) {
      console.log(`${colors.green}✓ Deletion cancelled. Campaign remains unchanged.${colors.reset}`);
      process.exit(0);
    }

    // Double confirmation for campaigns with donations
    if (allDonationsCount > 0) {
      console.log(`\n${colors.red}FINAL WARNING: This campaign has ${allDonationsCount} donation records.${colors.reset}`);
      const absolutelySure = await promptConfirmation(
        `${colors.red}This is your last chance to cancel. Proceed with deletion? (yes/no): ${colors.reset}`
      );
      
      if (!absolutelySure) {
        console.log(`${colors.green}✓ Deletion cancelled. Campaign remains unchanged.${colors.reset}`);
        process.exit(0);
      }
    }

    // Start transaction for safe deletion
    console.log(`\n${colors.blue}🗑️  Starting deletion process...${colors.reset}`);
    transaction = await sequelize.transaction();

    // Delete in correct order to avoid foreign key constraints
    // 1. Delete SavedCampaigns
    if (savedCount > 0) {
      console.log(`  Deleting ${savedCount} saved campaign records...`);
      await SavedCampaign.destroy({
        where: { campaign_id: campaignId },
        transaction
      });
    }

    // 2. Delete Testimonials
    if (testimonialCount > 0) {
      console.log(`  Deleting ${testimonialCount} testimonial records...`);
      await Testimonial.destroy({
        where: { campaign_id: campaignId },
        transaction
      });
    }

    // 3. Delete Campaign Updates
    if (updateCount > 0) {
      console.log(`  Deleting ${updateCount} campaign update records...`);
      await CampaignUpdate.destroy({
        where: { campaign_id: campaignId },
        transaction
      });
    }

    // 4. Delete Donations (if forced)
    if (allDonationsCount > 0) {
      console.log(`  Deleting ${allDonationsCount} donation records...`);
      await Donation.destroy({
        where: { campaign_id: campaignId },
        transaction
      });
    }

    // 5. Finally, delete the campaign
    console.log(`  Deleting campaign "${campaign.title}"...`);
    await Campaign.destroy({
      where: { id: campaignId },
      transaction
    });

    // Commit transaction
    await transaction.commit();

    console.log(`\n${colors.green}✅ SUCCESS: Campaign and all related data have been deleted.${colors.reset}`);
    console.log(`${colors.cyan}========================================${colors.reset}\n`);

  } catch (error) {
    // Rollback transaction on error
    if (transaction) {
      await transaction.rollback();
      console.log(`${colors.yellow}⚠️  Transaction rolled back due to error.${colors.reset}`);
    }

    console.error(`\n${colors.red}❌ Error during deletion:${colors.reset}`);
    console.error(`${colors.red}${error.message}${colors.reset}`);
    
    if (error.stack) {
      console.error(`\n${colors.red}Stack trace:${colors.reset}`);
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Script entry point
async function main() {
  const campaignId = process.argv[2];
  
  try {
    await deleteCampaign(campaignId);
    process.exit(0);
  } catch (error) {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);