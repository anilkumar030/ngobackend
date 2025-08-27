#!/usr/bin/env node
/**
 * Campaign Progress Update Script
 * 
 * This script updates the raised_amount and donor_count values for campaigns
 * based on their successful donations. It can be used to:
 * - Recalculate campaign progress from actual donation data
 * - Update specific campaigns or all campaigns
 * - Set manual values for testing or corrections
 * - Audit and fix data inconsistencies
 * 
 * Usage Examples:
 * 
 * # Update specific campaign by ID (calculates from donations)
 * node scripts/update-campaign-progress.js --campaign-id <uuid>
 * 
 * # Update all active campaigns
 * node scripts/update-campaign-progress.js --all-active
 * 
 * # Update all campaigns
 * node scripts/update-campaign-progress.js --all
 * 
 * # Set manual values for a campaign
 * node scripts/update-campaign-progress.js --campaign-id <uuid> --manual --amount 50000 --donors 25
 * 
 * # Dry run to see what would be updated
 * node scripts/update-campaign-progress.js --campaign-id <uuid> --dry-run
 * 
 * # Update with different environment
 * NODE_ENV=production node scripts/update-campaign-progress.js --campaign-id <uuid>
 */

const { Campaign, Donation, sequelize } = require('../src/models');
const { Op } = require('sequelize');

class CampaignProgressUpdater {
  constructor(options = {}) {
    this.options = {
      dryRun: false,
      verbose: false,
      transaction: true,
      batchSize: 50,
      ...options
    };
    this.results = {
      processed: 0,
      updated: 0,
      errors: 0,
      skipped: 0,
      details: []
    };
  }

  /**
   * Log messages with proper formatting
   */
  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m',   // Red
      reset: '\x1b[0m'     // Reset
    };
    
    const color = colors[type] || colors.info;
    const prefix = {
      info: 'ℹ',
      success: '✓',
      warning: '⚠',
      error: '✗'
    }[type] || 'ℹ';
    
    console.log(`${color}[${timestamp}] ${prefix} ${message}${colors.reset}`);
  }

  /**
   * Calculate campaign statistics from donations
   */
  async calculateCampaignStats(campaignId) {
    try {
      this.log(`Calculating statistics for campaign ${campaignId}`, 'info');
      
      // Get successful donations for the campaign
      const donations = await Donation.findAll({
        where: {
          campaign_id: campaignId,
          status: 'completed',
          payment_status: 'completed'
        },
        attributes: ['donation_amount', 'user_id', 'donor_email', 'created_at'],
        order: [['created_at', 'ASC']]
      });

      if (donations.length === 0) {
        this.log(`No successful donations found for campaign ${campaignId}`, 'warning');
        return {
          totalAmount: 0,
          donorCount: 0,
          donationCount: 0
        };
      }

      // Calculate total amount (convert from paise to rupees)
      const totalAmountPaise = donations.reduce((sum, donation) => {
        return sum + (donation.donation_amount || 0);
      }, 0);
      const totalAmount = Math.round(totalAmountPaise / 100 * 100) / 100; // Round to 2 decimal places

      // Calculate unique donors
      // Consider both registered users and email-based anonymous donors
      const uniqueDonors = new Set();
      donations.forEach(donation => {
        if (donation.user_id) {
          uniqueDonors.add(`user_${donation.user_id}`);
        } else if (donation.donor_email) {
          uniqueDonors.add(`email_${donation.donor_email.toLowerCase()}`);
        } else {
          // Anonymous donation without email - count as unique
          uniqueDonors.add(`anonymous_${donation.created_at.getTime()}`);
        }
      });

      const donorCount = uniqueDonors.size;

      this.log(`Campaign ${campaignId}: ${donations.length} donations, ₹${totalAmount.toFixed(2)}, ${donorCount} unique donors`, 'info');

      return {
        totalAmount,
        donorCount,
        donationCount: donations.length
      };
    } catch (error) {
      this.log(`Error calculating stats for campaign ${campaignId}: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Update a single campaign's progress
   */
  async updateCampaignProgress(campaignId, manualValues = null) {
    const result = {
      campaignId,
      success: false,
      error: null,
      changes: {},
      skipped: false
    };

    try {
      // Fetch the campaign
      const campaign = await Campaign.findByPk(campaignId);
      if (!campaign) {
        result.error = 'Campaign not found';
        result.skipped = true;
        return result;
      }

      this.log(`Processing campaign: ${campaign.title} (${campaignId})`, 'info');

      // Get current values
      const currentRaisedAmount = parseFloat(campaign.raised_amount) || 0;
      const currentDonorCount = campaign.donor_count || 0;

      let newRaisedAmount, newDonorCount;

      if (manualValues) {
        // Use manually provided values
        newRaisedAmount = parseFloat(manualValues.amount) || 0;
        newDonorCount = parseInt(manualValues.donors) || 0;
        this.log(`Using manual values: ₹${newRaisedAmount.toFixed(2)}, ${newDonorCount} donors`, 'info');
      } else {
        // Calculate from donations
        const stats = await this.calculateCampaignStats(campaignId);
        newRaisedAmount = stats.totalAmount;
        newDonorCount = stats.donorCount;
      }

      // Check if update is needed
      const amountChanged = Math.abs(currentRaisedAmount - newRaisedAmount) > 0.01; // Account for floating point precision
      const donorCountChanged = currentDonorCount !== newDonorCount;

      if (!amountChanged && !donorCountChanged) {
        this.log(`Campaign ${campaignId} already has correct values, skipping`, 'info');
        result.skipped = true;
        return result;
      }

      // Record changes
      if (amountChanged) {
        result.changes.raised_amount = {
          from: currentRaisedAmount,
          to: newRaisedAmount
        };
      }
      if (donorCountChanged) {
        result.changes.donor_count = {
          from: currentDonorCount,
          to: newDonorCount
        };
      }

      if (this.options.dryRun) {
        this.log(`[DRY RUN] Would update campaign ${campaignId}:`, 'warning');
        if (amountChanged) {
          this.log(`  Raised amount: ₹${currentRaisedAmount.toFixed(2)} → ₹${newRaisedAmount.toFixed(2)}`, 'warning');
        }
        if (donorCountChanged) {
          this.log(`  Donor count: ${currentDonorCount} → ${newDonorCount}`, 'warning');
        }
        result.success = true;
        return result;
      }

      // Update the campaign
      const updateData = {};
      if (amountChanged) {
        updateData.raised_amount = newRaisedAmount;
      }
      if (donorCountChanged) {
        updateData.donor_count = newDonorCount;
      }

      await campaign.update(updateData);

      this.log(`Successfully updated campaign ${campaignId}:`, 'success');
      if (amountChanged) {
        this.log(`  Raised amount: ₹${currentRaisedAmount.toFixed(2)} → ₹${newRaisedAmount.toFixed(2)}`, 'success');
      }
      if (donorCountChanged) {
        this.log(`  Donor count: ${currentDonorCount} → ${newDonorCount}`, 'success');
      }

      result.success = true;
      return result;

    } catch (error) {
      this.log(`Error updating campaign ${campaignId}: ${error.message}`, 'error');
      result.error = error.message;
      return result;
    }
  }

  /**
   * Update multiple campaigns
   */
  async updateMultipleCampaigns(campaignIds, manualValues = null) {
    this.log(`Starting batch update for ${campaignIds.length} campaigns`, 'info');
    
    let transaction = null;
    
    try {
      if (this.options.transaction && !this.options.dryRun) {
        transaction = await sequelize.transaction();
      }

      const results = [];
      const batchSize = this.options.batchSize;

      // Process campaigns in batches
      for (let i = 0; i < campaignIds.length; i += batchSize) {
        const batch = campaignIds.slice(i, i + batchSize);
        this.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(campaignIds.length / batchSize)} (${batch.length} campaigns)`, 'info');

        const batchPromises = batch.map(campaignId => 
          this.updateCampaignProgress(campaignId, manualValues)
        );

        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          const campaignId = batch[index];
          if (result.status === 'fulfilled') {
            results.push(result.value);
            this.results.processed++;
            
            if (result.value.success && !result.value.skipped) {
              this.results.updated++;
            } else if (result.value.skipped) {
              this.results.skipped++;
            } else {
              this.results.errors++;
            }
          } else {
            this.results.errors++;
            this.results.processed++;
            results.push({
              campaignId,
              success: false,
              error: result.reason.message,
              skipped: false
            });
          }
        });

        // Small delay between batches to avoid overwhelming the database
        if (i + batchSize < campaignIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (transaction && !this.options.dryRun) {
        await transaction.commit();
        this.log('Transaction committed successfully', 'success');
      }

      this.results.details = results;
      return results;

    } catch (error) {
      if (transaction) {
        await transaction.rollback();
        this.log('Transaction rolled back due to error', 'error');
      }
      throw error;
    }
  }

  /**
   * Get campaigns to update based on criteria
   */
  async getCampaignsToUpdate(criteria) {
    try {
      let whereClause = {};
      let orderClause = [['created_at', 'DESC']];

      switch (criteria.type) {
        case 'single':
          whereClause.id = criteria.campaignId;
          break;
          
        case 'all-active':
          whereClause.status = 'active';
          break;
          
        case 'all':
          // No additional where clause
          break;
          
        case 'by-status':
          whereClause.status = criteria.status;
          break;
          
        case 'featured':
          whereClause.featured = true;
          whereClause.status = 'active';
          break;
          
        default:
          throw new Error(`Unknown criteria type: ${criteria.type}`);
      }

      const campaigns = await Campaign.findAll({
        where: whereClause,
        attributes: ['id', 'title', 'status', 'raised_amount', 'donor_count', 'target_amount'],
        order: orderClause
      });

      this.log(`Found ${campaigns.length} campaigns matching criteria`, 'info');
      return campaigns;

    } catch (error) {
      this.log(`Error fetching campaigns: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Display summary of results
   */
  displaySummary() {
    console.log('\n' + '='.repeat(80));
    console.log('UPDATE SUMMARY');
    console.log('='.repeat(80));
    
    this.log(`Total processed: ${this.results.processed}`, 'info');
    this.log(`Successfully updated: ${this.results.updated}`, 'success');
    this.log(`Skipped (no changes needed): ${this.results.skipped}`, 'warning');
    this.log(`Errors: ${this.results.errors}`, this.results.errors > 0 ? 'error' : 'info');

    if (this.options.verbose && this.results.details.length > 0) {
      console.log('\nDETAILS:');
      this.results.details.forEach(detail => {
        const status = detail.success ? (detail.skipped ? 'SKIPPED' : 'UPDATED') : 'ERROR';
        console.log(`${detail.campaignId}: ${status}`);
        
        if (detail.changes && Object.keys(detail.changes).length > 0) {
          Object.entries(detail.changes).forEach(([field, change]) => {
            console.log(`  ${field}: ${change.from} → ${change.to}`);
          });
        }
        
        if (detail.error) {
          console.log(`  Error: ${detail.error}`);
        }
      });
    }

    console.log('='.repeat(80) + '\n');
  }

  /**
   * Validate UUID format
   */
  isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Main execution method
   */
  async execute(args) {
    try {
      this.log('Starting Campaign Progress Update Script', 'info');
      this.log(`Environment: ${process.env.NODE_ENV || 'development'}`, 'info');
      
      if (this.options.dryRun) {
        this.log('DRY RUN MODE - No changes will be made', 'warning');
      }

      // Parse arguments
      const campaignId = args.campaignId;
      const manualValues = args.manual ? {
        amount: args.amount,
        donors: args.donors
      } : null;

      let campaigns;
      
      if (campaignId) {
        // Validate UUID format
        if (!this.isValidUUID(campaignId)) {
          throw new Error(`Invalid campaign ID format: ${campaignId}`);
        }
        
        campaigns = await this.getCampaignsToUpdate({
          type: 'single',
          campaignId
        });
        
        if (campaigns.length === 0) {
          throw new Error(`Campaign not found: ${campaignId}`);
        }
      } else if (args.allActive) {
        campaigns = await this.getCampaignsToUpdate({
          type: 'all-active'
        });
      } else if (args.all) {
        campaigns = await this.getCampaignsToUpdate({
          type: 'all'
        });
      } else if (args.featured) {
        campaigns = await this.getCampaignsToUpdate({
          type: 'featured'
        });
      } else {
        throw new Error('Please specify --campaign-id, --all-active, --all, or --featured');
      }

      if (campaigns.length === 0) {
        this.log('No campaigns found matching the criteria', 'warning');
        return;
      }

      // Validate manual values if provided
      if (manualValues) {
        if (typeof manualValues.amount !== 'number' || manualValues.amount < 0) {
          throw new Error('Manual amount must be a non-negative number');
        }
        if (!Number.isInteger(manualValues.donors) || manualValues.donors < 0) {
          throw new Error('Manual donor count must be a non-negative integer');
        }
      }

      const campaignIds = campaigns.map(c => c.id);
      
      if (campaignIds.length === 1) {
        const result = await this.updateCampaignProgress(campaignIds[0], manualValues);
        this.results.processed = 1;
        this.results.updated = result.success && !result.skipped ? 1 : 0;
        this.results.skipped = result.skipped ? 1 : 0;
        this.results.errors = result.success ? 0 : 1;
        this.results.details = [result];
      } else {
        await this.updateMultipleCampaigns(campaignIds, manualValues);
      }

      this.displaySummary();

      // Exit with appropriate code
      const exitCode = this.results.errors > 0 ? 1 : 0;
      process.exit(exitCode);

    } catch (error) {
      this.log(`Script execution failed: ${error.message}`, 'error');
      if (this.options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    } finally {
      // Ensure database connection is closed
      try {
        await sequelize.close();
        this.log('Database connection closed', 'info');
      } catch (error) {
        this.log(`Error closing database connection: ${error.message}`, 'error');
      }
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const parsed = {
    campaignId: null,
    allActive: false,
    all: false,
    featured: false,
    manual: false,
    amount: null,
    donors: null,
    dryRun: false,
    verbose: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--campaign-id':
        parsed.campaignId = args[++i];
        break;
      case '--all-active':
        parsed.allActive = true;
        break;
      case '--all':
        parsed.all = true;
        break;
      case '--featured':
        parsed.featured = true;
        break;
      case '--manual':
        parsed.manual = true;
        break;
      case '--amount':
        parsed.amount = parseFloat(args[++i]);
        break;
      case '--donors':
        parsed.donors = parseInt(args[++i]);
        break;
      case '--dry-run':
        parsed.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        parsed.verbose = true;
        break;
      case '--help':
      case '-h':
        parsed.help = true;
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        process.exit(1);
    }
  }

  return parsed;
}

/**
 * Display help information
 */
function displayHelp() {
  console.log(`
Campaign Progress Update Script

DESCRIPTION:
  Updates raised_amount and donor_count values for campaigns based on
  successful donations or manual input.

USAGE:
  node scripts/update-campaign-progress.js [OPTIONS]

OPTIONS:
  --campaign-id <uuid>    Update specific campaign by ID
  --all-active           Update all active campaigns
  --all                  Update all campaigns
  --featured             Update all featured campaigns
  
  --manual               Use manual values instead of calculating from donations
  --amount <number>      Manual raised amount (requires --manual)
  --donors <number>      Manual donor count (requires --manual)
  
  --dry-run              Show what would be updated without making changes
  --verbose, -v          Show detailed output
  --help, -h             Show this help message

EXAMPLES:
  # Update specific campaign (calculate from donations)
  node scripts/update-campaign-progress.js --campaign-id 123e4567-e89b-12d3-a456-426614174000
  
  # Update all active campaigns
  node scripts/update-campaign-progress.js --all-active
  
  # Set manual values for a campaign
  node scripts/update-campaign-progress.js --campaign-id 123e4567-e89b-12d3-a456-426614174000 --manual --amount 50000.50 --donors 25
  
  # Dry run to see what would be updated
  node scripts/update-campaign-progress.js --all-active --dry-run --verbose
  
  # Production environment
  NODE_ENV=production node scripts/update-campaign-progress.js --campaign-id 123e4567-e89b-12d3-a456-426614174000

NOTES:
  - The script calculates values from successful donations (status='completed' AND payment_status='completed')
  - Unique donors are identified by user_id or email address
  - Amounts are stored in rupees (converted from paise in donation records)
  - Use --dry-run to preview changes before applying them
  - Large batch operations use transactions for data integrity
`);
}

/**
 * Main entry point
 */
async function main() {
  const args = parseArguments();
  
  if (args.help) {
    displayHelp();
    process.exit(0);
  }

  // Validate arguments
  const targets = [args.campaignId, args.allActive, args.all, args.featured].filter(Boolean);
  if (targets.length === 0) {
    console.error('Error: Please specify one of --campaign-id, --all-active, --all, or --featured');
    console.error('Use --help for usage information');
    process.exit(1);
  }
  if (targets.length > 1) {
    console.error('Error: Please specify only one update target');
    process.exit(1);
  }

  if (args.manual && ((args.amount === null || args.amount === undefined) || (args.donors === null || args.donors === undefined))) {
    console.error('Error: --manual requires both --amount and --donors');
    process.exit(1);
  }

  if (((args.amount !== null && args.amount !== undefined) || (args.donors !== null && args.donors !== undefined)) && !args.manual) {
    console.error('Error: --amount and --donors require --manual flag');
    process.exit(1);
  }

  const updater = new CampaignProgressUpdater({
    dryRun: args.dryRun,
    verbose: args.verbose,
    transaction: true
  });

  await updater.execute(args);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(`\n❌ Script failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { CampaignProgressUpdater };