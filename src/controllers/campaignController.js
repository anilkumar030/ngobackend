const { Campaign, Donation, User, CampaignUpdate } = require('../models');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { redisUtils, CACHE_KEYS } = require('../config/redis');
const fileUploadService = require('../services/fileUploadService');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Convert decimal string fields to numbers for proper JSON serialization
 * @param {Object} campaignData - Campaign data object
 * @returns {Object} Campaign data with numeric decimal fields
 */
const convertDecimalFields = (campaignData) => {
  if (!campaignData) return campaignData;
  
  return {
    ...campaignData,
    target_amount: campaignData.target_amount ? parseFloat(campaignData.target_amount) : null,
    raised_amount: campaignData.raised_amount ? parseFloat(campaignData.raised_amount) : null,
    total_raised: campaignData.total_raised ? parseFloat(campaignData.total_raised) : null,
    remaining_amount: campaignData.remaining_amount ? parseFloat(campaignData.remaining_amount) : null,
    average_donation: campaignData.average_donation ? parseFloat(campaignData.average_donation) : null,
    goal_amount: campaignData.goal_amount ? parseFloat(campaignData.goal_amount) : null,
    top_donation: campaignData.top_donation ? parseFloat(campaignData.top_donation) : null
  };
};

/**
 * Get all campaigns with filters and pagination
 */
const getCampaigns = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 30,
    category,
    status,
    featured,
    sort_by = 'created_at',
    sort_order = 'desc',
    search,
    min_goal,
    max_goal,
    city,
    state,
    country,
    created_by,
    start_date_from,
    start_date_to,
    end_date_from,
    end_date_to,
  } = req.query;

  // Check cache for public campaign listings
  const isPublicListing = !created_by && !req.user;
  const cacheKey = isPublicListing ? CACHE_KEYS.CAMPAIGNS_LIST(page, limit, req.query) : null;
  
  if (cacheKey) {
    const cachedResult = await redisUtils.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json(cachedResult);
    }
  }

  const offset = (page - 1) * limit;

  // Build where conditions
  const whereConditions = {};

  // Only show public campaigns for non-authenticated users or specific status
  if (!req.user || req.user.role === 'user') {
    whereConditions.status = 'active';
  } else if (status) {
    whereConditions.status = status;
  }

  if (category) {
    whereConditions.category = category;
  }

  if (featured !== undefined) {
    whereConditions.featured = featured === 'true';
  }

  if (created_by) {
    whereConditions.created_by = created_by;
  }

  if (search) {
    whereConditions[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { short_description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (min_goal || max_goal) {
    whereConditions.target_amount = {};
    if (min_goal) whereConditions.target_amount[Op.gte] = parseFloat(min_goal);
    if (max_goal) whereConditions.target_amount[Op.lte] = parseFloat(max_goal);
  }

  // Location filters
  if (city || state || country) {
    const locationConditions = {};
    if (city) locationConditions['location.city'] = { [Op.iLike]: `%${city}%` };
    if (state) locationConditions['location.state'] = { [Op.iLike]: `%${state}%` };
    if (country) locationConditions['location.country'] = { [Op.iLike]: `%${country}%` };
    Object.assign(whereConditions, locationConditions);
  }

  // Date range filters
  if (start_date_from || start_date_to) {
    whereConditions.start_date = {};
    if (start_date_from) whereConditions.start_date[Op.gte] = new Date(start_date_from);
    if (start_date_to) whereConditions.start_date[Op.lte] = new Date(start_date_to);
  }

  if (end_date_from || end_date_to) {
    whereConditions.end_date = {};
    if (end_date_from) whereConditions.end_date[Op.gte] = new Date(end_date_from);
    if (end_date_to) whereConditions.end_date[Op.lte] = new Date(end_date_to);
  }

  // Get campaigns with pagination
  const { count, rows: campaigns } = await Campaign.findAndCountAll({
    where: whereConditions,
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'first_name', 'last_name', 'email'],
      },
    ],
    order: [[sort_by, sort_order.toUpperCase()]],
    limit: parseInt(limit),
    offset: offset,
  });

  //make this campaign at top which id is a2481553-8f7c-41ed-b72b-0f3256dcff21
  const campaign = campaigns.find(campaign => campaign.id === 'a2481553-8f7c-41ed-b72b-0f3256dcff21');
  if (campaign) {
    campaigns.unshift(campaign);
  }
  console.log(campaigns);

  // Calculate progress percentage for each campaign using existing raised_amount
  const campaignsWithProgress = campaigns.map(campaign => {
    const campaignData = campaign.toJSON();
    const totalRaised = parseFloat(campaignData.raised_amount) || 0;
    const targetAmount = parseFloat(campaignData.target_amount) || 0;
    
    campaignData.progress_percentage = targetAmount > 0 
      ? Math.min((totalRaised / targetAmount) * 100, 100) 
      : 0;
    
    campaignData.days_left = campaignData.end_date 
      ? Math.max(Math.ceil((new Date(campaignData.end_date) - new Date()) / (1000 * 60 * 60 * 24)), 0)
      : null;
    
    campaignData.is_ended = campaignData.end_date ? new Date() > new Date(campaignData.end_date) : false;
    campaignData.is_goal_reached = totalRaised >= targetAmount;
    
    // Add donation statistics from model data
    campaignData.donation_count = campaignData.donor_count || 0;
    campaignData.total_raised = totalRaised;

    // Convert decimal fields to numbers
    return convertDecimalFields(campaignData);
  });

  const totalPages = Math.ceil(count / limit);

  const response = {
    success: true,
    data: {
      campaigns: campaignsWithProgress,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: count,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    },
  };

  // Cache public campaign listings for 5 minutes
  if (cacheKey) {
    await redisUtils.set(cacheKey, response, 300);
  }

  res.status(200).json(response);
});

/**
 * Get single campaign by ID or slug
 */
const getCampaign = catchAsync(async (req, res) => {
  const { identifier } = req.params;
  
  // Check if identifier is UUID, numeric ID, or slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  const isNumeric = /^\d+$/.test(identifier);
  
  let whereCondition;
  if (isUuid) {
    whereCondition = { id: identifier };
  } else if (isNumeric) {
    whereCondition = { id: parseInt(identifier) };
  } else {
    whereCondition = { slug: identifier };
  }

  // Check cache first
  const cacheKey = CACHE_KEYS.CAMPAIGN(identifier);
  const cachedCampaign = await redisUtils.get(cacheKey);
  
  if (cachedCampaign) {
    return res.status(200).json({
      success: true,
      data: cachedCampaign,
    });
  }

  const campaign = await Campaign.findOne({
    where: whereCondition,
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'first_name', 'last_name', 'email', 'profile_image'],
      },
      {
        model: Donation,
        as: 'donations',
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'first_name', 'last_name'],
            required: false,
          },
        ],
        where: { 
          payment_status: 'completed',
          is_anonymous: false  // Move is_anonymous check to Donation model where it exists
        },
        required: false,
        order: [['created_at', 'DESC']],
        limit: 10, // Latest 10 donations
      },
    ],
  });

  if (!campaign) {
    throw new AppError('Campaign not found', 404, true, 'CAMPAIGN_NOT_FOUND');
  }

  // Check status permissions
  if (campaign.status === 'draft' && 
      (!req.user || 
       (req.user.id !== campaign.created_by && 
        !['admin', 'super_admin'].includes(req.user.role)))) {
    throw new AppError('Campaign not found', 404, true, 'CAMPAIGN_NOT_FOUND');
  }

  // Fetch campaign updates with enhanced debugging and fallback strategies
  let campaignUpdates = [];
  let updatesFetchMethod = 'none';
  
  try {
    // Strategy 1: Direct query (current implementation)
    logger.info('Fetching campaign updates', { campaignId: campaign.id });
    
    campaignUpdates = await CampaignUpdate.findAll({
      where: { campaign_id: campaign.id },
      order: [['created_at', 'DESC']],
      limit: 5,
    });
    
    updatesFetchMethod = 'direct_query';
    logger.info('Campaign updates fetched', { 
      campaignId: campaign.id, 
      updatesFound: campaignUpdates.length,
      method: updatesFetchMethod
    });

    // Strategy 2: Use association if direct query returns no results
    if (campaignUpdates.length === 0) {
      logger.info('Trying association-based query for updates', { campaignId: campaign.id });
      
      try {
        const campaignWithUpdates = await Campaign.findByPk(campaign.id, {
          include: [{
            model: CampaignUpdate,
            as: 'updates',
            order: [['created_at', 'DESC']],
            limit: 5
          }]
        });
        
        if (campaignWithUpdates && campaignWithUpdates.updates) {
          campaignUpdates = campaignWithUpdates.updates;
          updatesFetchMethod = 'association_include';
          logger.info('Association query successful', { 
            campaignId: campaign.id, 
            updatesFound: campaignUpdates.length 
          });
        }
      } catch (associationError) {
        logger.error('Association query failed', { 
          campaignId: campaign.id, 
          error: associationError.message 
        });
      }
    }

  } catch (updatesError) {
    logger.error('Error fetching campaign updates', { 
      campaignId: campaign.id, 
      error: updatesError.message,
      stack: updatesError.stack
    });
    // Don't throw error, just log it and continue with empty updates
    campaignUpdates = [];
    updatesFetchMethod = 'error_fallback';
  }

  // Calculate campaign statistics
  const stats = await Donation.findOne({
    where: {
      campaign_id: campaign.id,
      payment_status: 'completed',
    },
    attributes: [
      [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'donation_count'],
      [require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').col('amount')), 0), 'total_raised'],
      [require('sequelize').fn('AVG', require('sequelize').col('amount')), 'average_donation'],
    ],
    raw: true,
  });

  const campaignData = campaign.toJSON();
  
  // Add calculated fields
  campaignData.statistics = {
    donation_count: parseInt(stats.donation_count) || 0,
    total_raised: parseFloat(stats.total_raised) || 0,
    average_donation: parseFloat(stats.average_donation) || 0,
  };

  const targetAmount = parseFloat(campaignData.target_amount) || 0;
  campaignData.progress_percentage = targetAmount > 0 
    ? Math.min((campaignData.statistics.total_raised / targetAmount) * 100, 100)
    : 0;

  campaignData.days_left = Math.max(
    Math.ceil((new Date(campaignData.end_date) - new Date()) / (1000 * 60 * 60 * 24)),
    0
  );

  campaignData.is_ended = new Date() > new Date(campaignData.end_date);
  campaignData.is_goal_reached = campaignData.statistics.total_raised >= targetAmount;
  campaignData.can_donate = campaignData.status === 'active' && 
                           !campaignData.is_ended;

  // Process campaign updates
  const processedUpdates = campaignUpdates.map(update => ({
    id: update.id,
    title: update.title,
    description: update.description,
    images: update.images || [],
    created_at: update.created_at,
    updated_at: update.updated_at,
    hasImages: update.images && Array.isArray(update.images) && update.images.length > 0,
    imageCount: update.images && Array.isArray(update.images) ? update.images.length : 0,
    previewImage: update.images && Array.isArray(update.images) && update.images.length > 0 ? update.images[0] : null
  }));
  
  // Add updates summary to campaign data
  campaignData.updates_summary = {
    total_updates: processedUpdates.length,
    has_updates: processedUpdates.length > 0,
    latest_update: processedUpdates.length > 0 ? processedUpdates[0].created_at : null,
    fetch_method: updatesFetchMethod // Include debugging info
  };

  // Convert decimal fields to numbers
  const processedCampaignData = convertDecimalFields(campaignData);

  // Cache the campaign data and updates for 10 minutes
  const cacheData = {
    campaign: processedCampaignData,
    campaign_updates: processedUpdates,
  };
  await redisUtils.set(cacheKey, cacheData, 600);

  res.status(200).json({
    success: true,
    data: cacheData,
  });
});

/**
 * Create new campaign
 */
const createCampaign = catchAsync(async (req, res) => {
  // Log upload information for debugging
  if (req.uploadedFiles) {
    logger.info('Files uploaded for campaign:', {
      fieldsWithFiles: Object.keys(req.uploadedFiles),
      totalFiles: Object.values(req.uploadedFiles).reduce((sum, files) => sum + files.length, 0)
    });
  }

  // Explicitly extract and validate campaign data from request body
  const {
    title,
    slug,
    description,
    short_description,
    long_description,
    location,
    target_amount,
    category,
    contact_phone,
    contact_email,
    beneficiary_details,
    visibility = 'public',
    tags = [],
    seo_title,
    seo_description,
    meta_keywords = [],
    start_date,
    end_date,
    status,
    featured = false,
    featured_image, // Will contain URL if uploaded via FormData
    gallery_images = [], // Will contain URLs if uploaded via FormData
    images = [],
    howyoucanhelp = [],
    metadata = {}
  } = req.body;

  // Ensure required fields are present
  if (!short_description) {
    throw new AppError('Short description is required', 400, true, 'MISSING_SHORT_DESCRIPTION');
  }

  // Parse JSON fields if they come as strings
  let parsedTags = tags;
  let parsedMetaKeywords = meta_keywords;
  let parsedHowYouCanHelp = howyoucanhelp;

  
  if (typeof tags === 'string') {
    try {
      parsedTags = JSON.parse(tags);
    } catch (error) {
      throw new AppError('Invalid tags format', 400, true, 'INVALID_TAGS_FORMAT');
    }
  }
  
  if (typeof meta_keywords === 'string') {
    try {
      parsedMetaKeywords = JSON.parse(meta_keywords);
    } catch (error) {
      throw new AppError('Invalid meta_keywords format', 400, true, 'INVALID_META_KEYWORDS_FORMAT');
    }
  }

  if (typeof howyoucanhelp === 'string') {
    try {
      parsedHowYouCanHelp = JSON.parse(howyoucanhelp);
    } catch (error) {
      throw new AppError('Invalid howyoucanhelp format', 400, true, 'INVALID_HOWYOUCANHELP_FORMAT');
    }
  }

  // Validate howyoucanhelp structure
  if (parsedHowYouCanHelp && Array.isArray(parsedHowYouCanHelp)) {
    parsedHowYouCanHelp.forEach((item, index) => {
      if (!item.title || !item.amount || typeof item.title !== 'string' || typeof item.amount !== 'number') {
        throw new AppError(`Invalid howyoucanhelp item at index ${index}. Each item must have title (string) and amount (number)`, 400, true, 'INVALID_HOWYOUCANHELP_ITEM');
      }
      if (item.amount <= 0) {
        throw new AppError(`Invalid amount in howyoucanhelp item at index ${index}. Amount must be greater than 0`, 400, true, 'INVALID_HOWYOUCANHELP_AMOUNT');
      }
    });
  }

  // Build campaign data object
  const campaignData = {
    title,
    slug,
    description,
    short_description,
    long_description,
    location,
    target_amount,
    category,
    contact_phone,
    contact_email,
    beneficiary_details,
    visibility,
    tags: Array.isArray(parsedTags) ? parsedTags : [],
    seo_title,
    seo_description,
    meta_keywords: Array.isArray(parsedMetaKeywords) ? parsedMetaKeywords : [],
    start_date,
    end_date,
    status: status || 'draft', // Respect frontend status or default to draft
    featured,
    images: Array.isArray(images) ? images : [],
    howyoucanhelp: Array.isArray(parsedHowYouCanHelp) ? parsedHowYouCanHelp : [],
    metadata: typeof metadata === 'object' ? metadata : {},
    created_by: req.user.id
  };

  // Process images from FormData uploads
  let allImages = Array.isArray(images) ? [...images] : [];
  
  // Add featured image as the first image if provided
  if (featured_image) {
    // If it's not already in the images array, add it at the beginning
    if (!allImages.includes(featured_image)) {
      allImages.unshift(featured_image);
    }
  }
  
  // Add gallery images to the images array
  if (gallery_images && Array.isArray(gallery_images)) {
    gallery_images.forEach(imageUrl => {
      if (!allImages.includes(imageUrl)) {
        allImages.push(imageUrl);
      }
    });
  }
  
  // Update campaign data with consolidated images
  campaignData.images = allImages;

  // Log final campaign data for debugging (excluding sensitive info)
  logger.info('Creating campaign with data:', {
    title: campaignData.title,
    slug: campaignData.slug,
    category: campaignData.category,
    status: campaignData.status,
    hasImages: !!campaignData.images?.length,
    imageCount: campaignData.images?.length || 0,
    featuredImageFromFormData: !!featured_image,
    galleryImagesFromFormData: gallery_images?.length || 0,
    howyoucanhelpCount: campaignData.howyoucanhelp?.length || 0,
    createdBy: campaignData.created_by
  });

  // Check if slug is unique
  if (slug) {
    const existingCampaign = await Campaign.findOne({
      where: { slug: campaignData.slug },
    });

    if (existingCampaign) {
      throw new AppError('Campaign slug already exists', 409, true, 'SLUG_EXISTS');
    }
  }

  // Create campaign
  const campaign = await Campaign.create(campaignData);

  logger.contextLogger.database('Campaign created', 'Campaign', {
    campaignId: campaign.id,
    title: campaign.title,
    createdBy: req.user.id,
    status: campaign.status,
    hasShortDescription: !!campaign.short_description,
    tagsCount: campaign.tags?.length || 0,
    metaKeywordsCount: campaign.meta_keywords?.length || 0
  });

  // Clear campaigns list cache
  await redisUtils.del(CACHE_KEYS.CAMPAIGNS_LIST('*'));

  // Return campaign with all fields using getPublicData method
  const publicData = campaign.getPublicData();
  res.status(201).json({
    success: true,
    message: 'Campaign created successfully',
    data: {
      campaign: convertDecimalFields(publicData),
    },
  });
});

/**
 * Update campaign
 */
const updateCampaign = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Explicitly extract fields that can be updated
  const {
    title,
    slug,
    description,
    short_description,
    long_description,
    location,
    target_amount,
    category,
    contact_phone,
    contact_email,
    beneficiary_details,
    visibility,
    tags,
    seo_title,
    seo_description,
    meta_keywords,
    start_date,
    end_date,
    status,
    featured,
    featured_image, // Will contain URL if uploaded via FormData
    gallery_images = [], // Will contain URLs if uploaded via FormData
    images = [],
    howyoucanhelp,
    metadata
  } = req.body;

  const campaign = await Campaign.findByPk(id);
  if (!campaign) {
    throw new AppError('Campaign not found', 404, true, 'CAMPAIGN_NOT_FOUND');
  }

  // Check permissions
  if (campaign.created_by !== req.user.id && 
      !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to update this campaign', 403, true, 'NOT_AUTHORIZED');
  }

  // Check if slug is unique (if being updated)
  if (slug && slug !== campaign.slug) {
    const existingCampaign = await Campaign.findOne({
      where: { 
        slug: slug,
        id: { [Op.ne]: id },
      },
    });

    if (existingCampaign) {
      throw new AppError('Campaign slug already exists', 409, true, 'SLUG_EXISTS');
    }
  }

  // Build update data object with only defined fields
  const updateData = {};
  
  if (title !== undefined) updateData.title = title;
  if (slug !== undefined) updateData.slug = slug;
  if (description !== undefined) updateData.description = description;
  if (short_description !== undefined) updateData.short_description = short_description;
  if (long_description !== undefined) updateData.long_description = long_description;
  if (location !== undefined) updateData.location = location;
  if (target_amount !== undefined) updateData.target_amount = target_amount;
  if (category !== undefined) updateData.category = category;
  if (contact_phone !== undefined) updateData.contact_phone = contact_phone;
  if (contact_email !== undefined) updateData.contact_email = contact_email;
  if (beneficiary_details !== undefined) updateData.beneficiary_details = beneficiary_details;
  if (visibility !== undefined) updateData.visibility = visibility;
  if (seo_title !== undefined) updateData.seo_title = seo_title;
  if (seo_description !== undefined) updateData.seo_description = seo_description;
  if (start_date !== undefined) updateData.start_date = start_date;
  if (end_date !== undefined) updateData.end_date = end_date;
  if (status !== undefined) updateData.status = status;
  if (featured !== undefined) updateData.featured = featured;
  if (metadata !== undefined) updateData.metadata = typeof metadata === 'object' ? metadata : {};

  // Handle array fields with proper parsing
  if (tags !== undefined) {
    if (typeof tags === 'string') {
      try {
        updateData.tags = JSON.parse(tags);
      } catch (error) {
        throw new AppError('Invalid tags format', 400, true, 'INVALID_TAGS_FORMAT');
      }
    } else {
      updateData.tags = Array.isArray(tags) ? tags : [];
    }
  }

  if (meta_keywords !== undefined) {
    if (typeof meta_keywords === 'string') {
      try {
        updateData.meta_keywords = JSON.parse(meta_keywords);
      } catch (error) {
        throw new AppError('Invalid meta_keywords format', 400, true, 'INVALID_META_KEYWORDS_FORMAT');
      }
    } else {
      updateData.meta_keywords = Array.isArray(meta_keywords) ? meta_keywords : [];
    }
  }

  if (images !== undefined || featured_image !== undefined || gallery_images !== undefined) {
    // Process images from FormData uploads - preserve existing images like createCampaign
    // Start with existing images from the campaign (preserve them)
    const currentImages = campaign.images || [];
    let allImages = Array.isArray(images) ? [...images] : [];
    
    // Add featured image as the first image if provided
    if (featured_image) {
      // If it's not already in the images array, add it at the beginning
      if (!allImages.includes(featured_image)) {
        allImages.unshift(featured_image);
      }
    }
    
    // Add gallery images to the images array
    if (gallery_images && Array.isArray(gallery_images)) {
      gallery_images.forEach(imageUrl => {
        if (!allImages.includes(imageUrl)) {
          allImages.push(imageUrl);
        }
      });
    }
    
    // Combine existing images with new images, avoiding duplicates
    const combinedImages = [...currentImages];
    allImages.forEach(imageUrl => {
      if (!combinedImages.includes(imageUrl)) {
        combinedImages.push(imageUrl);
      }
    });
    
    updateData.images = combinedImages;
  }

  if (howyoucanhelp !== undefined) {
    let parsedHowYouCanHelp = howyoucanhelp;
    
    if (typeof howyoucanhelp === 'string') {
      try {
        parsedHowYouCanHelp = JSON.parse(howyoucanhelp);
      } catch (error) {
        throw new AppError('Invalid howyoucanhelp format', 400, true, 'INVALID_HOWYOUCANHELP_FORMAT');
      }
    }

    // Validate howyoucanhelp structure
    if (parsedHowYouCanHelp && Array.isArray(parsedHowYouCanHelp)) {
      parsedHowYouCanHelp.forEach((item, index) => {
        if (!item.title || !item.amount || typeof item.title !== 'string' || typeof item.amount !== 'number') {
          throw new AppError(`Invalid howyoucanhelp item at index ${index}. Each item must have title (string) and amount (number)`, 400, true, 'INVALID_HOWYOUCANHELP_ITEM');
        }
        if (item.amount <= 0) {
          throw new AppError(`Invalid amount in howyoucanhelp item at index ${index}. Amount must be greater than 0`, 400, true, 'INVALID_HOWYOUCANHELP_AMOUNT');
        }
      });
    }

    updateData.howyoucanhelp = Array.isArray(parsedHowYouCanHelp) ? parsedHowYouCanHelp : [];
  }

  // Log update information for debugging (similar to createCampaign)
  logger.info('Updating campaign with data:', {
    campaignId: id,
    title: updateData.title,
    hasImages: !!updateData.images?.length,
    imageCount: updateData.images?.length || 0,
    existingImageCount: campaign.images?.length || 0,
    featuredImageFromFormData: !!featured_image,
    galleryImagesFromFormData: gallery_images?.length || 0,
    imagesPreserved: !!(updateData.images && campaign.images?.length),
    updatedFields: Object.keys(updateData),
    updatedBy: req.user.id
  });

  // Update campaign with validated data
  await campaign.update(updateData);

  // Reload campaign to get updated data
  await campaign.reload();

  // Clear relevant caches
  await redisUtils.del(CACHE_KEYS.CAMPAIGN(id));
  await redisUtils.del(CACHE_KEYS.CAMPAIGN(campaign.slug));
  await redisUtils.del(CACHE_KEYS.CAMPAIGNS_LIST('*'));

  logger.contextLogger.database('Campaign updated', 'Campaign', {
    campaignId: campaign.id,
    updatedBy: req.user.id,
    updatedFields: Object.keys(updateData),
    hasShortDescription: !!campaign.short_description,
    tagsCount: campaign.tags?.length || 0,
    metaKeywordsCount: campaign.meta_keywords?.length || 0
  });

  // Return updated campaign with all fields using getPublicData method
  const publicData = campaign.getPublicData();
  res.status(200).json({
    success: true,
    message: 'Campaign updated successfully',
    data: {
      campaign: convertDecimalFields(publicData),
    },
  });
});

/**
 * Delete campaign
 */
const deleteCampaign = catchAsync(async (req, res) => {
  const { id } = req.params;

  const campaign = await Campaign.findByPk(id, {
    include: [
      {
        model: Donation,
        as: 'donations',
        where: { payment_status: 'completed' },
        required: false,
      },
    ],
  });

  if (!campaign) {
    throw new AppError('Campaign not found', 404, true, 'CAMPAIGN_NOT_FOUND');
  }

  // Check permissions
  if (campaign.created_by !== req.user.id && 
      !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to delete this campaign', 403, true, 'NOT_AUTHORIZED');
  }

  // Check if campaign has donations
  if (campaign.donations && campaign.donations.length > 0) {
    throw new AppError(
      'Cannot delete campaign with existing donations. Please cancel the campaign instead.',
      400,
      true,
      'HAS_DONATIONS'
    );
  }

  await campaign.destroy();

  // Clear caches
  await redisUtils.del(CACHE_KEYS.CAMPAIGN(id));
  await redisUtils.del(CACHE_KEYS.CAMPAIGN(campaign.slug));
  await redisUtils.del(CACHE_KEYS.CAMPAIGNS_LIST('*'));

  logger.contextLogger.database('Campaign deleted', 'Campaign', {
    campaignId: id,
    deletedBy: req.user.id,
  });

  res.status(200).json({
    success: true,
    message: 'Campaign deleted successfully',
  });
});

/**
 * Update campaign status
 */
const updateCampaignStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  const campaign = await Campaign.findByPk(id);
  if (!campaign) {
    throw new AppError('Campaign not found', 404, true, 'CAMPAIGN_NOT_FOUND');
  }

  // Check permissions
  if (campaign.created_by !== req.user.id && 
      !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to update campaign status', 403, true, 'NOT_AUTHORIZED');
  }

  await campaign.update({ 
    status,
    status_reason: reason || null,
    status_updated_at: new Date(),
    status_updated_by: req.user.id,
  });

  // Clear caches
  await redisUtils.del(CACHE_KEYS.CAMPAIGN(id));
  await redisUtils.del(CACHE_KEYS.CAMPAIGN(campaign.slug));
  await redisUtils.del(CACHE_KEYS.CAMPAIGNS_LIST('*'));

  logger.contextLogger.database('Campaign status updated', 'Campaign', {
    campaignId: id,
    newStatus: status,
    reason,
    updatedBy: req.user.id,
  });

  res.status(200).json({
    success: true,
    message: `Campaign ${status} successfully`,
    data: {
      campaign: {
        id: campaign.id,
        status: campaign.status,
        status_reason: campaign.status_reason,
        status_updated_at: campaign.status_updated_at,
      },
    },
  });
});

/**
 * Upload campaign images
 */
const uploadCampaignImages = catchAsync(async (req, res) => {
  const { id } = req.params;
  const files = req.files;

  if (!files || files.length === 0) {
    throw new AppError('No images provided', 400, true, 'NO_IMAGES');
  }

  const campaign = await Campaign.findByPk(id);
  if (!campaign) {
    throw new AppError('Campaign not found', 404, true, 'CAMPAIGN_NOT_FOUND');
  }

  // Check permissions
  if (campaign.created_by !== req.user.id && 
      !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to upload images for this campaign', 403, true, 'NOT_AUTHORIZED');
  }

  // Upload images
  const uploadResult = await fileUploadService.uploadCampaignImages(files, id);

  if (!uploadResult.success) {
    throw new AppError('Image upload failed', 500, true, 'UPLOAD_FAILED');
  }

  // Update campaign with new image URLs
  const currentImages = campaign.images || [];
  const newImageUrls = uploadResult.images.map(img => img.url);
  const updatedImages = [...currentImages, ...newImageUrls];

  await campaign.update({
    images: updatedImages,
  });

  // Clear cache
  await redisUtils.del(CACHE_KEYS.CAMPAIGN(id));
  await redisUtils.del(CACHE_KEYS.CAMPAIGN(campaign.slug));

  res.status(200).json({
    success: true,
    message: `${uploadResult.uploaded} images uploaded successfully`,
    data: {
      uploaded: uploadResult.uploaded,
      failed: uploadResult.failed,
      images: uploadResult.images,
      errors: uploadResult.errors,
    },
  });
});

/**
 * Get campaign analytics
 */
const getCampaignAnalytics = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { period = '30d', metrics = ['donations', 'amount', 'donors'] } = req.query;

  const campaign = await Campaign.findByPk(id);
  if (!campaign) {
    throw new AppError('Campaign not found', 404, true, 'CAMPAIGN_NOT_FOUND');
  }

  // Check permissions
  if (campaign.created_by !== req.user.id && 
      !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to view campaign analytics', 403, true, 'NOT_AUTHORIZED');
  }

  // Calculate date range
  let startDate;
  const endDate = new Date();

  switch (period) {
    case '7d':
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '3m':
      startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '6m':
      startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = campaign.created_at;
  }

  const analytics = {};

  // Get donation analytics
  if (metrics.includes('donations') || metrics.includes('amount') || metrics.includes('donors')) {
    const donationStats = await Donation.findAll({
      where: {
        campaign_id: id,
        payment_status: 'completed',
        created_at: {
          [Op.between]: [startDate, endDate],
        },
      },
      attributes: [
        [require('sequelize').fn('DATE', require('sequelize').col('created_at')), 'date'],
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
        [require('sequelize').fn('SUM', require('sequelize').col('amount')), 'total'],
        [require('sequelize').fn('COUNT', require('sequelize').fn('DISTINCT', require('sequelize').col('user_id'))), 'unique_donors'],
      ],
      group: [require('sequelize').fn('DATE', require('sequelize').col('created_at'))],
      order: [[require('sequelize').fn('DATE', require('sequelize').col('created_at')), 'ASC']],
      raw: true,
    });

    analytics.donations_over_time = donationStats.map(stat => ({
      date: stat.date,
      donations: parseInt(stat.count),
      amount: parseFloat(stat.total),
      unique_donors: parseInt(stat.unique_donors),
    }));

    // Overall statistics
    const overallStats = await Donation.findOne({
      where: {
        campaign_id: id,
        payment_status: 'completed',
      },
      attributes: [
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'total_donations'],
        [require('sequelize').fn('SUM', require('sequelize').col('amount')), 'total_amount'],
        [require('sequelize').fn('AVG', require('sequelize').col('amount')), 'average_donation'],
        [require('sequelize').fn('COUNT', require('sequelize').fn('DISTINCT', require('sequelize').col('user_id'))), 'unique_donors'],
      ],
      raw: true,
    });

    const goalAmount = parseFloat(campaign.target_amount) || 0;
    const totalAmount = parseFloat(overallStats.total_amount) || 0;
    
    analytics.overall = {
      total_donations: parseInt(overallStats.total_donations) || 0,
      total_amount: totalAmount,
      average_donation: parseFloat(overallStats.average_donation) || 0,
      unique_donors: parseInt(overallStats.unique_donors) || 0,
      goal_amount: goalAmount,
      progress_percentage: goalAmount > 0 
        ? Math.min((totalAmount / goalAmount) * 100, 100) 
        : 0,
    };
  }

  res.status(200).json({
    success: true,
    data: {
      campaign_id: id,
      period,
      analytics,
    },
  });
});

/**
 * Get campaign donors
 */
const getCampaignDonors = catchAsync(async (req, res) => {
  const { id } = req.params;
  const {
    page = 1,
    limit = 10,
    show_anonymous = false
  } = req.query;

  // Support both UUID and numeric IDs
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const isNumeric = /^\d+$/.test(id);
  
  let whereCondition;
  if (isUuid) {
    whereCondition = { id: id };
  } else if (isNumeric) {
    whereCondition = { id: parseInt(id) };
  } else {
    // Invalid ID format
    throw new AppError('Invalid campaign ID format', 400, true, 'INVALID_ID_FORMAT');
  }

  const campaign = await Campaign.findOne({ where: whereCondition });
  if (!campaign) {
    throw new AppError('Campaign not found', 404, true, 'CAMPAIGN_NOT_FOUND');
  }

  // Check if campaign is active or user has access
  if (campaign.status !== 'active' && 
      (!req.user || 
       (req.user.id !== campaign.created_by && 
        !['admin', 'super_admin'].includes(req.user.role)))) {
    throw new AppError('Campaign not found', 404, true, 'CAMPAIGN_NOT_FOUND');
  }

  const offset = (page - 1) * limit;

  // Build where conditions for donations
  const whereConditions = {
    campaign_id: campaign.id,
    payment_status: 'completed' // Only show successful/completed donations
  };

  // Filter anonymous donations based on show_anonymous parameter
  if (show_anonymous !== 'true') {
    whereConditions.is_anonymous = false;
  }

  // Get donations with pagination - sorted by amount DESC, then by date DESC
  const { count, rows: donations } = await Donation.findAndCountAll({
    where: whereConditions,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        required: false,
      }
    ],
    order: [
      ['amount', 'DESC'], // Primary sort: highest donation first
      ['created_at', 'DESC'] // Secondary sort: most recent first
    ],
    limit: parseInt(limit),
    offset: offset,
  });

  // Process donors for response
  const donors = donations.map(donation => {
    const donorData = {
      id: donation.id,
      amount: parseFloat(donation.amount),
      message: donation.message || null,
      is_anonymous: donation.is_anonymous,
      donated_at: donation.created_at
    };

    // Handle privacy settings - respect donor anonymity preferences
    if (donation.is_anonymous || !donation.user) {
      donorData.name = 'Anonymous Donor';
    } else {
      donorData.name = `${donation.user.first_name} ${donation.user.last_name}`.trim();
      // Only include profile image if not anonymous
      if (donation.user.profile_image) {
        donorData.profile_image = donation.user.profile_image;
      }
    }

    return donorData;
  });

  // Calculate summary statistics
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // Get overall statistics for the campaign
  const summaryStats = await Donation.findOne({
    where: {
      campaign_id: campaign.id,
      payment_status: 'completed'
    },
    attributes: [
      // Total unique donors (count distinct user_id and donor_email for anonymous)
      [
        require('sequelize').fn('COUNT', 
          require('sequelize').fn('DISTINCT', 
            require('sequelize').fn('COALESCE', 
              require('sequelize').col('user_id'), 
              require('sequelize').col('donor_email')
            )
          )
        ), 
        'total_donors'
      ],
      // Top donation amount
      [require('sequelize').fn('MAX', require('sequelize').col('amount')), 'top_donation']
    ],
    raw: true,
  });

  // Get recent donations count (last 30 days)
  const recentDonationsStats = await Donation.findOne({
    where: {
      campaign_id: campaign.id,
      payment_status: 'completed',
      created_at: {
        [Op.gte]: thirtyDaysAgo
      }
    },
    attributes: [
      [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'recent_donations']
    ],
    raw: true,
  });

  const summary = {
    total_donors: parseInt(summaryStats.total_donors) || 0,
    top_donation: parseFloat(summaryStats.top_donation) || 0,
    recent_donations: parseInt(recentDonationsStats.recent_donations) || 0
  };

  const totalPages = Math.ceil(count / limit);

  logger.contextLogger.api(`${process.env.PROJECT_NAME || 'BDRF'} Campaign donors retrieved`, 'Campaign', {
    campaignId: campaign.id,
    totalDonors: count,
    page: parseInt(page),
    limit: parseInt(limit),
    showAnonymous: show_anonymous === 'true',
    requestedBy: req.user?.id || 'anonymous'
  });

  res.status(200).json({
    success: true,
    data: {
      donors,
      summary,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: count,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    },
  });
});

module.exports = {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  updateCampaignStatus,
  uploadCampaignImages,
  getCampaignAnalytics,
  getCampaignDonors,
};