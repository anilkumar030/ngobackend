const { CampaignUpdate, Campaign, User } = require('../models');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { redisUtils, CACHE_KEYS } = require('../config/redis');
const localFileUploadService = require('../services/localFileUploadService');
const logger = require('../utils/logger');
const { sanitizeInput, sanitizeUrl } = require('../utils/sanitizer');

/**
 * Create a new campaign update
 * POST /api/campaigns/:campaignId/updates
 */
const createCampaignUpdate = catchAsync(async (req, res) => {
  const { campaignId } = req.params;
  const { title, description, images = [] } = req.body;
  const uploadedFiles = req.files || [];

  // Verify campaign exists and user has permission
  const campaign = await Campaign.findByPk(campaignId);
  if (!campaign) {
    throw new AppError('Campaign not found', 404, true, 'CAMPAIGN_NOT_FOUND');
  }

  // Check permissions - only campaign owners or admins can create updates
  if (campaign.created_by !== req.user.id && 
      !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to create updates for this campaign', 403, true, 'NOT_AUTHORIZED');
  }

  // Handle uploaded files and existing image URLs
  let allImageUrls = [];

  // Process uploaded files if any
  if (uploadedFiles.length > 0) {
    try {
      // Save files to local storage
      const uploadResult = await localFileUploadService.saveMultipleFiles(
        uploadedFiles.map(file => ({
          originalname: file.originalname,
          buffer: file.buffer || require('fs').readFileSync(file.path),
          size: file.size,
          mimetype: file.mimetype
        }))
      );

      if (uploadResult.success && uploadResult.images.length > 0) {
        const newImageUrls = uploadResult.images.map(img => img.url);
        allImageUrls.push(...newImageUrls);

        logger.info(`Uploaded ${uploadResult.uploaded} images for campaign update`, {
          campaignId,
          uploadedCount: uploadResult.uploaded,
          failedCount: uploadResult.failed
        });
      }

      // Log any upload errors
      if (uploadResult.errors && uploadResult.errors.length > 0) {
        logger.warn('Some files failed to upload', {
          errors: uploadResult.errors
        });
      }
    } catch (error) {
      logger.logError(error, { 
        service: 'CampaignUpdateController', 
        method: 'createCampaignUpdate',
        context: 'file upload' 
      });
      throw new AppError('Failed to upload images', 500, true, 'UPLOAD_FAILED');
    }
  }

  // Parse existing images if provided as URLs
  let parsedImages = images;
  if (typeof images === 'string') {
    try {
      parsedImages = JSON.parse(images);
    } catch (error) {
      throw new AppError('Invalid images format', 400, true, 'INVALID_IMAGES_FORMAT');
    }
  }

  // Validate images array
  if (!Array.isArray(parsedImages)) {
    throw new AppError('Images must be an array', 400, true, 'INVALID_IMAGES_FORMAT');
  }

  // Add existing image URLs
  const sanitizedExistingImages = parsedImages.map(img => sanitizeUrl(img)).filter(Boolean);
  allImageUrls.push(...sanitizedExistingImages);
  
  // Create campaign update with sanitized data
  const updateData = {
    campaign_id: campaignId,
    title: sanitizeInput(title.trim()),
    description: sanitizeInput(description.trim()),
    images: allImageUrls
  };

  const campaignUpdate = await CampaignUpdate.create(updateData);

  // Clear relevant caches
  await redisUtils.del(CACHE_KEYS.CAMPAIGN(campaignId));
  await redisUtils.del(CACHE_KEYS.CAMPAIGN(campaign.slug));

  logger.contextLogger.database('Campaign update created', 'CampaignUpdate', {
    updateId: campaignUpdate.id,
    campaignId: campaignId,
    createdBy: req.user.id,
    hasImages: campaignUpdate.images.length > 0,
    imageCount: campaignUpdate.images.length,
    uploadedFiles: uploadedFiles.length
  });

  res.status(201).json({
    success: true,
    message: 'Campaign update created successfully',
    data: {
      update: campaignUpdate.getPublicData()
    }
  });
});

/**
 * Get all updates for a campaign
 * GET /api/campaigns/:campaignId/updates
 */
const getCampaignUpdates = catchAsync(async (req, res) => {
  const { campaignId } = req.params;
  const {
    page = 1,
    limit = 10,
    sort_by = 'created_at',
    sort_order = 'desc'
  } = req.query;

  // Verify campaign exists
  const campaign = await Campaign.findByPk(campaignId);
  if (!campaign) {
    throw new AppError('Campaign not found', 404, true, 'CAMPAIGN_NOT_FOUND');
  }

  // Check if campaign is accessible by user (only check for draft campaigns)
  if (campaign.status === 'draft') {
    // For draft campaigns, only allow access to owner or admins
    if (!req.user || 
        (req.user.id !== campaign.created_by && 
         !['admin', 'super_admin'].includes(req.user.role))) {
      throw new AppError('Campaign not found', 404, true, 'CAMPAIGN_NOT_FOUND');
    }
  }
  // For non-draft campaigns, allow public access

  const offset = (page - 1) * limit;

  // Get updates with pagination
  const { count, rows: updates } = await CampaignUpdate.findAndCountAll({
    where: { campaign_id: campaignId },
    order: [[sort_by, sort_order.toUpperCase()]],
    limit: parseInt(limit),
    offset: offset
  });

  const totalPages = Math.ceil(count / limit);

  res.status(200).json({
    success: true,
    data: {
      updates: updates.map(update => update.getPublicData()),
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: count,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    }
  });
});

/**
 * Get a specific campaign update
 * GET /api/campaign-updates/:id
 */
const getCampaignUpdate = catchAsync(async (req, res) => {
  const { id } = req.params;

  const campaignUpdate = await CampaignUpdate.findByPk(id, {
    include: [
      {
        model: Campaign,
        as: 'campaign',
        attributes: ['id', 'title', 'slug', 'status', 'created_by'],
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'first_name', 'last_name']
          }
        ]
      }
    ]
  });

  if (!campaignUpdate) {
    throw new AppError('Campaign update not found', 404, true, 'UPDATE_NOT_FOUND');
  }

  // Check if campaign is accessible
  if (campaignUpdate.campaign.status === 'draft' && 
      (!req.user || 
       (req.user.id !== campaignUpdate.campaign.created_by && 
        !['admin', 'super_admin'].includes(req.user.role)))) {
    throw new AppError('Campaign update not found', 404, true, 'UPDATE_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    data: {
      update: {
        ...campaignUpdate.getPublicData(),
        campaign: {
          id: campaignUpdate.campaign.id,
          title: campaignUpdate.campaign.title,
          slug: campaignUpdate.campaign.slug,
          creator: campaignUpdate.campaign.creator
        }
      }
    }
  });
});

/**
 * Update a campaign update
 * PUT /api/campaign-updates/:id
 */
const updateCampaignUpdate = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { title, description, images } = req.body;
  const uploadedFiles = req.files || [];

  const campaignUpdate = await CampaignUpdate.findByPk(id, {
    include: [
      {
        model: Campaign,
        as: 'campaign',
        attributes: ['id', 'created_by', 'slug']
      }
    ]
  });

  if (!campaignUpdate) {
    throw new AppError('Campaign update not found', 404, true, 'UPDATE_NOT_FOUND');
  }

  // Check permissions - only campaign owners or admins can update
  if (campaignUpdate.campaign.created_by !== req.user.id && 
      !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to update this campaign update', 403, true, 'NOT_AUTHORIZED');
  }

  // Build update data with sanitization
  const updateData = {};
  
  if (title !== undefined) updateData.title = sanitizeInput(title.trim());
  if (description !== undefined) updateData.description = sanitizeInput(description.trim());
  
  // Handle image updates
  if (images !== undefined || uploadedFiles.length > 0) {
    let allImageUrls = [];

    // Get current images
    const currentImages = campaignUpdate.images || [];

    // Process uploaded files if any
    if (uploadedFiles.length > 0) {
      try {
        // Save files to local storage
        const uploadResult = await localFileUploadService.saveMultipleFiles(
          uploadedFiles.map(file => ({
            originalname: file.originalname,
            buffer: file.buffer || require('fs').readFileSync(file.path),
            size: file.size,
            mimetype: file.mimetype
          }))
        );

        if (uploadResult.success && uploadResult.images.length > 0) {
          const newImageUrls = uploadResult.images.map(img => img.url);
          allImageUrls.push(...newImageUrls);

          logger.info(`Uploaded ${uploadResult.uploaded} new images for campaign update`, {
            updateId: id,
            uploadedCount: uploadResult.uploaded,
            failedCount: uploadResult.failed
          });
        }

        // Log any upload errors
        if (uploadResult.errors && uploadResult.errors.length > 0) {
          logger.warn('Some files failed to upload during update', {
            errors: uploadResult.errors
          });
        }
      } catch (error) {
        logger.logError(error, { 
          service: 'CampaignUpdateController', 
          method: 'updateCampaignUpdate',
          context: 'file upload' 
        });
        throw new AppError('Failed to upload new images', 500, true, 'UPLOAD_FAILED');
      }
    }

    // Process existing images if provided
    if (images !== undefined) {
      let parsedImages = images;
      if (typeof images === 'string') {
        try {
          parsedImages = JSON.parse(images);
        } catch (error) {
          throw new AppError('Invalid images format', 400, true, 'INVALID_IMAGES_FORMAT');
        }
      }
      
      if (!Array.isArray(parsedImages)) {
        throw new AppError('Images must be an array', 400, true, 'INVALID_IMAGES_FORMAT');
      }
      
      // Sanitize image URLs
      const sanitizedImages = parsedImages.map(img => sanitizeUrl(img)).filter(Boolean);
      
      // If images array is provided, it replaces current images
      // Combined with new uploads
      allImageUrls = [...sanitizedImages, ...allImageUrls];
    } else {
      // If no images array provided, keep current images and add new uploads
      allImageUrls = [...currentImages, ...allImageUrls];
    }

    updateData.images = allImageUrls;
  }

  // Update the campaign update
  await campaignUpdate.update(updateData);

  // Clear relevant caches
  await redisUtils.del(CACHE_KEYS.CAMPAIGN(campaignUpdate.campaign_id));
  await redisUtils.del(CACHE_KEYS.CAMPAIGN(campaignUpdate.campaign.slug));

  logger.contextLogger.database('Campaign update updated', 'CampaignUpdate', {
    updateId: campaignUpdate.id,
    campaignId: campaignUpdate.campaign_id,
    updatedBy: req.user.id,
    updatedFields: Object.keys(updateData),
    uploadedFiles: uploadedFiles.length
  });

  res.status(200).json({
    success: true,
    message: 'Campaign update updated successfully',
    data: {
      update: campaignUpdate.getPublicData()
    }
  });
});

/**
 * Delete a campaign update
 * DELETE /api/campaign-updates/:id
 */
const deleteCampaignUpdate = catchAsync(async (req, res) => {
  const { id } = req.params;

  const campaignUpdate = await CampaignUpdate.findByPk(id, {
    include: [
      {
        model: Campaign,
        as: 'campaign',
        attributes: ['id', 'created_by', 'slug']
      }
    ]
  });

  if (!campaignUpdate) {
    throw new AppError('Campaign update not found', 404, true, 'UPDATE_NOT_FOUND');
  }

  // Check permissions - only campaign owners or admins can delete
  if (campaignUpdate.campaign.created_by !== req.user.id && 
      !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to delete this campaign update', 403, true, 'NOT_AUTHORIZED');
  }

  const campaignId = campaignUpdate.campaign_id;
  const campaignSlug = campaignUpdate.campaign.slug;

  // Delete the campaign update
  await campaignUpdate.destroy();

  // Clear relevant caches
  await redisUtils.del(CACHE_KEYS.CAMPAIGN(campaignId));
  await redisUtils.del(CACHE_KEYS.CAMPAIGN(campaignSlug));

  logger.contextLogger.database('Campaign update deleted', 'CampaignUpdate', {
    updateId: id,
    campaignId: campaignId,
    deletedBy: req.user.id
  });

  res.status(200).json({
    success: true,
    message: 'Campaign update deleted successfully'
  });
});

/**
 * Upload images for a campaign update
 * POST /api/campaign-updates/:id/images
 */
const uploadUpdateImages = catchAsync(async (req, res) => {
  const { id } = req.params;
  const files = req.files;

  if (!files || files.length === 0) {
    throw new AppError('No images provided', 400, true, 'NO_IMAGES');
  }

  const campaignUpdate = await CampaignUpdate.findByPk(id, {
    include: [
      {
        model: Campaign,
        as: 'campaign',
        attributes: ['id', 'created_by', 'slug']
      }
    ]
  });

  if (!campaignUpdate) {
    throw new AppError('Campaign update not found', 404, true, 'UPDATE_NOT_FOUND');
  }

  // Check permissions
  if (campaignUpdate.campaign.created_by !== req.user.id && 
      !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to upload images for this update', 403, true, 'NOT_AUTHORIZED');
  }

  // Upload images to local storage
  const uploadResult = await localFileUploadService.saveMultipleFiles(
    files.map(file => ({
      originalname: file.originalname,
      buffer: file.buffer || require('fs').readFileSync(file.path),
      size: file.size,
      mimetype: file.mimetype
    }))
  );

  if (!uploadResult.success) {
    throw new AppError('Image upload failed', 500, true, 'UPLOAD_FAILED');
  }

  // Update campaign update with new image URLs
  const currentImages = campaignUpdate.images || [];
  const newImageUrls = uploadResult.images.map(img => img.url);
  const updatedImages = [...currentImages, ...newImageUrls];

  await campaignUpdate.update({
    images: updatedImages
  });

  // Clear caches
  await redisUtils.del(CACHE_KEYS.CAMPAIGN(campaignUpdate.campaign_id));
  await redisUtils.del(CACHE_KEYS.CAMPAIGN(campaignUpdate.campaign.slug));

  logger.contextLogger.database('Campaign update images uploaded', 'CampaignUpdate', {
    updateId: campaignUpdate.id,
    campaignId: campaignUpdate.campaign_id,
    uploadedBy: req.user.id,
    uploadedCount: uploadResult.uploaded,
    failedCount: uploadResult.failed
  });

  res.status(200).json({
    success: true,
    message: `${uploadResult.uploaded} images uploaded successfully`,
    data: {
      uploaded: uploadResult.uploaded,
      failed: uploadResult.failed,
      images: uploadResult.images,
      errors: uploadResult.errors,
      update: campaignUpdate.getPublicData()
    }
  });
});

module.exports = {
  createCampaignUpdate,
  getCampaignUpdates,
  getCampaignUpdate,
  updateCampaignUpdate,
  deleteCampaignUpdate,
  uploadUpdateImages
};