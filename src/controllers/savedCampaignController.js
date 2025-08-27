const { SavedCampaign, Campaign, User } = require('../models');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { redisUtils, CACHE_KEYS } = require('../config/redis');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Get user's saved campaigns
 */
const getSavedCampaigns = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    priority,
    sort_by = 'created_at',
    sort_order = 'desc'
  } = req.query;

  const userId = req.user.id;
  const offset = (page - 1) * limit;

  // Build where conditions
  const whereConditions = { user_id: userId };

  if (priority) {
    whereConditions.priority = priority;
  }

  // Get saved campaigns with pagination, ordered by saved_at (created_at) desc by default
  const { count, rows: savedCampaigns } = await SavedCampaign.findAndCountAll({
    where: whereConditions,
    include: [
      {
        model: Campaign,
        as: 'campaign',
        attributes: [
          'id', 'title', 'slug', 'description', 'category', 'status', 
          'target_amount', 'images', 'end_date', 'location', 'created_at'
        ],
        required: false // Allow saved campaigns even if campaign is deleted
      }
    ],
    order: [['created_at', 'DESC']], // Most recent saved first
    limit: parseInt(limit),
    offset: offset,
  });

  // Process saved campaigns for response
  const processedSavedCampaigns = await Promise.all(
    savedCampaigns.map(async (savedCampaign) => {
      let campaignData = null;
      
      // If campaign still exists, build campaign data
      if (savedCampaign.campaign) {
        const campaign = savedCampaign.campaign;
        
        // Calculate campaign statistics
        const stats = await require('../models').Donation.findOne({
          where: {
            campaign_id: campaign.id,
            payment_status: 'completed'
          },
          attributes: [
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'donation_count'],
            [require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').col('amount')), 0), 'total_raised']
          ],
          raw: true,
        });

        const raisedAmount = parseFloat(stats?.total_raised || 0);
        const targetAmount = parseFloat(campaign.target_amount || 0);

        campaignData = {
          id: campaign.id,
          title: campaign.title,
          slug: campaign.slug,
          description: campaign.description,
          target_amount: targetAmount,
          raised_amount: raisedAmount,
          featured_image: campaign.images && campaign.images.length > 0 ? campaign.images[0] : null,
          status: campaign.status,
          end_date: campaign.end_date
        };
      }

      return {
        id: savedCampaign.id,
        campaign: campaignData,
        saved_at: savedCampaign.created_at
      };
    })
  );

  res.status(200).json({
    success: true,
    data: {
      saved_campaigns: processedSavedCampaigns
    }
  });
});

/**
 * Save a campaign
 */
const saveCampaign = catchAsync(async (req, res) => {
  const { campaign_id } = req.body;
  const userId = req.user.id;

  // Validate required fields
  if (!campaign_id) {
    throw new AppError('Campaign ID is required', 400, true, 'MISSING_CAMPAIGN_ID');
  }

  // Check if campaign exists (support both UUID and numeric IDs)
  const campaign = await Campaign.findByPk(campaign_id);
  
  if (!campaign) {
    throw new AppError('Campaign not found', 404, true, 'CAMPAIGN_NOT_FOUND');
  }

  // Check if already saved
  const existingSaved = await SavedCampaign.findOne({
    where: {
      user_id: userId,
      campaign_id: campaign_id
    }
  });

  if (existingSaved) {
    throw new AppError('Campaign is already in your saved list', 400, true, 'ALREADY_SAVED');
  }

  // Create saved campaign record
  const savedCampaign = await SavedCampaign.create({
    user_id: userId,
    campaign_id: campaign_id,
    priority: 'medium',
    saved_from: req.headers.referer ? new URL(req.headers.referer).pathname : 'api'
  });

  logger.contextLogger.database(`Campaign saved - ${process.env.PROJECT_NAME || 'BDRF'}`, 'SavedCampaign', {
    userId: userId,
    campaignId: campaign_id,
    savedCampaignId: savedCampaign.id
  });

  res.status(201).json({
    success: true,
    message: 'Campaign saved successfully',
    data: {
      saved_campaign: {
        id: savedCampaign.id,
        campaign_id: campaign_id,
        saved_at: savedCampaign.created_at
      }
    }
  });
});

/**
 * Remove saved campaign
 */
const removeSavedCampaign = catchAsync(async (req, res) => {
  const { campaign_id } = req.params;
  const userId = req.user.id;

  // Find the saved campaign record
  const savedCampaign = await SavedCampaign.findOne({
    where: {
      user_id: userId,
      campaign_id: campaign_id
    }
  });

  if (!savedCampaign) {
    throw new AppError('Saved campaign not found', 404, true, 'SAVED_CAMPAIGN_NOT_FOUND');
  }

  await savedCampaign.destroy();

  logger.contextLogger.database(`Saved campaign removed - ${process.env.PROJECT_NAME || 'BDRF'}`, 'SavedCampaign', {
    userId: userId,
    campaignId: campaign_id,
    savedCampaignId: savedCampaign.id
  });

  res.status(200).json({
    success: true,
    message: 'Campaign removed from saved list'
  });
});

/**
 * Update saved campaign (notes, priority, etc.)
 */
const updateSavedCampaign = catchAsync(async (req, res) => {
  const { campaign_id } = req.params;
  const { notes, priority, is_notification_enabled } = req.body;
  const userId = req.user.id;

  // Find the saved campaign record
  const savedCampaign = await SavedCampaign.findOne({
    where: {
      user_id: userId,
      campaign_id: campaign_id
    },
    include: [
      {
        model: Campaign,
        as: 'campaign',
        attributes: ['id', 'title', 'slug', 'status']
      }
    ]
  });

  if (!savedCampaign) {
    throw new AppError('Saved campaign not found', 404, true, 'SAVED_CAMPAIGN_NOT_FOUND');
  }

  // Update fields if provided
  const updateData = {};
  if (notes !== undefined) updateData.notes = notes;
  if (priority !== undefined) updateData.priority = priority;
  if (is_notification_enabled !== undefined) updateData.is_notification_enabled = is_notification_enabled;

  await savedCampaign.update(updateData);

  logger.contextLogger.database('Saved campaign updated', 'SavedCampaign', {
    userId: userId,
    campaignId: campaign_id,
    savedCampaignId: savedCampaign.id,
    updatedFields: Object.keys(updateData)
  });

  res.status(200).json({
    success: true,
    message: 'Saved campaign updated successfully',
    data: {
      saved_campaign: savedCampaign.getDisplayData()
    }
  });
});

/**
 * Check if specific campaign is saved by user
 */
const checkCampaignSaved = catchAsync(async (req, res) => {
  const { campaign_id } = req.params;
  const userId = req.user.id;

  // Find the saved campaign record
  const savedCampaign = await SavedCampaign.findOne({
    where: {
      user_id: userId,
      campaign_id: campaign_id
    }
  });

  const isSaved = !!savedCampaign;

  res.status(200).json({
    success: true,
    data: {
      is_saved: isSaved,
      saved_at: savedCampaign ? savedCampaign.created_at : null
    }
  });
});

/**
 * Toggle notifications for saved campaign
 */
const toggleNotifications = catchAsync(async (req, res) => {
  const { campaign_id } = req.params;
  const userId = req.user.id;

  // Find the saved campaign record
  const savedCampaign = await SavedCampaign.findOne({
    where: {
      user_id: userId,
      campaign_id: campaign_id
    }
  });

  if (!savedCampaign) {
    throw new AppError('Saved campaign not found', 404, true, 'SAVED_CAMPAIGN_NOT_FOUND');
  }

  await savedCampaign.toggleNotifications();

  logger.contextLogger.database(`Saved campaign notifications toggled - ${process.env.PROJECT_NAME || 'BDRF'}`, 'SavedCampaign', {
    userId: userId,
    campaignId: campaign_id,
    notificationsEnabled: savedCampaign.is_notification_enabled
  });

  res.status(200).json({
    success: true,
    message: `Notifications ${savedCampaign.is_notification_enabled ? 'enabled' : 'disabled'} for saved campaign`,
    data: {
      is_notification_enabled: savedCampaign.is_notification_enabled
    }
  });
});

module.exports = {
  getSavedCampaigns,
  saveCampaign,
  removeSavedCampaign,
  checkCampaignSaved,
};