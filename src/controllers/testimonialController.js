const { Testimonial, Project, Campaign, User } = require('../models');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { redisUtils, CACHE_KEYS } = require('../config/redis');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const fileUploadService = require('../services/fileUploadService');

const PROJECT_NAME = process.env.PROJECT_NAME || 'Shiv Dhaam Foundation';

/**
 * Get all testimonials with filters and pagination
 */
const getTestimonials = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    category,
    is_featured,
    project_id,
    campaign_id,
    sort_by = 'approved_at',
    sort_order = 'desc'
  } = req.query;

  // Check cache for public testimonial listings
  const cacheKey = CACHE_KEYS.TESTIMONIALS_LIST(page, limit, req.query);
  const cachedResult = await redisUtils.get(cacheKey);
  
  if (cachedResult) {
    return res.status(200).json(cachedResult);
  }

  const offset = (page - 1) * limit;

  // Build where conditions - only show approved testimonials publicly
  const whereConditions = { status: 'approved' };

  if (category) {
    whereConditions.category = category;
  }

  if (is_featured !== undefined) {
    whereConditions.is_featured = is_featured === 'true';
  }

  if (project_id) {
    whereConditions.project_id = project_id;
  }

  if (campaign_id) {
    whereConditions.campaign_id = campaign_id;
  }

  // Get testimonials with pagination
  const { count, rows: testimonials } = await Testimonial.findAndCountAll({
    where: whereConditions,
    include: [
      {
        model: Project,
        as: 'project',
        attributes: ['id', 'title', 'slug', 'category'],
        required: false,
      },
      {
        model: Campaign,
        as: 'campaign',
        attributes: ['id', 'title', 'slug', 'category'],
        required: false,
      }
    ],
    order: [[sort_by, sort_order.toUpperCase()]],
    limit: parseInt(limit),
    offset: offset,
  });

  // Process testimonials for public display
  const processedTestimonials = testimonials.map(testimonial => {
    const testimonialData = testimonial.getPublicData();
    
    // Add related entity information if available
    if (testimonial.project) {
      testimonialData.related_project = {
        id: testimonial.project.id,
        title: testimonial.project.title,
        slug: testimonial.project.slug,
        category: testimonial.project.category
      };
    }

    if (testimonial.campaign) {
      testimonialData.related_campaign = {
        id: testimonial.campaign.id,
        title: testimonial.campaign.title,
        slug: testimonial.campaign.slug,
        category: testimonial.campaign.category
      };
    }

    return testimonialData;
  }).filter(Boolean); // Filter out null results from getPublicData()

  const totalPages = Math.ceil(count / limit);

  const response = {
    success: true,
    data: {
      testimonials: processedTestimonials,
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

  // Cache testimonial listings for 15 minutes
  await redisUtils.set(cacheKey, response, 900);

  res.status(200).json(response);
});

/**
 * Submit a new testimonial
 */
const submitTestimonial = catchAsync(async (req, res) => {
  const {
    content,
    rating,
    project_id,
    campaign_id,
    category = 'beneficiary'
  } = req.body;

  const userId = req.user.id;

  // Validate required fields
  if (!content || !rating) {
    throw new AppError('Content and rating are required', 400, true, 'MISSING_REQUIRED_FIELDS');
  }

  // Validate rating
  if (rating < 1 || rating > 5) {
    throw new AppError('Rating must be between 1 and 5', 400, true, 'INVALID_RATING');
  }

  // Validate that either project_id or campaign_id is provided
  if (!project_id && !campaign_id) {
    throw new AppError('Either project_id or campaign_id must be provided', 400, true, 'MISSING_REFERENCE');
  }

  // Verify project exists if project_id is provided
  if (project_id) {
    const project = await Project.findByPk(project_id);
    if (!project) {
      throw new AppError('Project not found', 404, true, 'PROJECT_NOT_FOUND');
    }
  }

  // Verify campaign exists if campaign_id is provided
  if (campaign_id) {
    const campaign = await Campaign.findByPk(campaign_id);
    if (!campaign) {
      throw new AppError('Campaign not found', 404, true, 'CAMPAIGN_NOT_FOUND');
    }
  }

  // Check if user has already submitted a testimonial for this project/campaign
  const existingTestimonial = await Testimonial.findOne({
    where: {
      user_id: userId,
      [Op.or]: [
        project_id ? { project_id } : {},
        campaign_id ? { campaign_id } : {}
      ]
    }
  });

  if (existingTestimonial) {
    throw new AppError(
      'You have already submitted a testimonial for this project/campaign', 
      400, 
      true, 
      'TESTIMONIAL_EXISTS'
    );
  }

  // Get user information for the testimonial
  const user = await User.findByPk(userId, {
    attributes: ['first_name', 'last_name', 'email', 'profile_image']
  });

  // Prepare testimonial data
  const testimonialData = {
    user_id: userId,
    author_name: `${user.first_name} ${user.last_name}`,
    author_email: user.email,
    content,
    rating,
    category,
    status: 'pending', // All testimonials need approval
    image_url: user.profile_image,
    is_verified: true, // Since it's from a registered user
  };

  if (project_id) {
    testimonialData.project_id = project_id;
  }

  if (campaign_id) {
    testimonialData.campaign_id = campaign_id;
  }

  // Create the testimonial
  const testimonial = await Testimonial.create(testimonialData);

  // Cache related entity information
  if (project_id) {
    const project = await Project.findByPk(project_id, {
      attributes: ['id', 'title', 'slug', 'category']
    });
    testimonial.related_project = project.toJSON();
    await testimonial.save();
  }

  if (campaign_id) {
    const campaign = await Campaign.findByPk(campaign_id, {
      attributes: ['id', 'title', 'slug', 'category']
    });
    testimonial.related_campaign = campaign.toJSON();
    await testimonial.save();
  }

  // Clear testimonials cache
  await redisUtils.del(CACHE_KEYS.TESTIMONIALS_LIST('*'));

  logger.contextLogger.database('Testimonial submitted', 'Testimonial', {
    testimonialId: testimonial.id,
    userId: userId,
    projectId: project_id,
    campaignId: campaign_id,
    rating: rating
  });

  res.status(201).json({
    success: true,
    message: 'Testimonial submitted successfully. It will be reviewed before publication.',
    data: {
      testimonial: {
        id: testimonial.id,
        content: testimonial.content,
        rating: testimonial.rating,
        category: testimonial.category,
        status: testimonial.status,
        created_at: testimonial.created_at
      },
    },
  });
});

/**
 * Get a specific testimonial by ID
 */
const getTestimonialById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const testimonial = await Testimonial.findByPk(id, {
    include: [
      {
        model: Project,
        as: 'project',
        attributes: ['id', 'title', 'slug', 'category'],
        required: false,
      },
      {
        model: Campaign,
        as: 'campaign',
        attributes: ['id', 'title', 'slug', 'category'],
        required: false,
      }
    ]
  });

  if (!testimonial) {
    throw new AppError('Testimonial not found', 404, true, 'TESTIMONIAL_NOT_FOUND');
  }

  // Check if user can view this testimonial
  const isAdmin = req.user && ['admin', 'super_admin'].includes(req.user.role);
  const isOwner = req.user && req.user.id === testimonial.user_id;

  // Non-approved testimonials can only be viewed by admin or owner
  if (testimonial.status !== 'approved' && !isAdmin && !isOwner) {
    throw new AppError('Testimonial not found', 404, true, 'TESTIMONIAL_NOT_FOUND');
  }

  let testimonialData;
  if (isAdmin) {
    testimonialData = testimonial.getAdminData();
  } else {
    testimonialData = testimonial.getPublicData();
    if (!testimonialData) {
      throw new AppError('Testimonial not found', 404, true, 'TESTIMONIAL_NOT_FOUND');
    }
  }

  // Add related entity information
  if (testimonial.project) {
    testimonialData.related_project = {
      id: testimonial.project.id,
      title: testimonial.project.title,
      slug: testimonial.project.slug,
      category: testimonial.project.category
    };
  }

  if (testimonial.campaign) {
    testimonialData.related_campaign = {
      id: testimonial.campaign.id,
      title: testimonial.campaign.title,
      slug: testimonial.campaign.slug,
      category: testimonial.campaign.category
    };
  }

  res.status(200).json({
    success: true,
    data: {
      testimonial: testimonialData
    }
  });
});

/**
 * Get testimonials for the authenticated user
 */
const getUserTestimonials = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    category,
    project_id,
    campaign_id
  } = req.query;

  const userId = req.user.id;
  const offset = (page - 1) * limit;

  // Build where conditions for user's testimonials
  const whereConditions = { user_id: userId };

  if (status) {
    whereConditions.status = status;
  }

  if (category) {
    whereConditions.category = category;
  }

  if (project_id) {
    whereConditions.project_id = project_id;
  }

  if (campaign_id) {
    whereConditions.campaign_id = campaign_id;
  }

  const { count, rows: testimonials } = await Testimonial.findAndCountAll({
    where: whereConditions,
    include: [
      {
        model: Project,
        as: 'project',
        attributes: ['id', 'title', 'slug', 'category'],
        required: false,
      },
      {
        model: Campaign,
        as: 'campaign',
        attributes: ['id', 'title', 'slug', 'category'],
        required: false,
      }
    ],
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset: offset,
  });

  // Process testimonials for user display
  const processedTestimonials = testimonials.map(testimonial => {
    const testimonialData = testimonial.getAdminData(); // User can see all their data
    
    // Add related entity information
    if (testimonial.project) {
      testimonialData.related_project = {
        id: testimonial.project.id,
        title: testimonial.project.title,
        slug: testimonial.project.slug,
        category: testimonial.project.category
      };
    }

    if (testimonial.campaign) {
      testimonialData.related_campaign = {
        id: testimonial.campaign.id,
        title: testimonial.campaign.title,
        slug: testimonial.campaign.slug,
        category: testimonial.campaign.category
      };
    }

    return testimonialData;
  });

  const totalPages = Math.ceil(count / limit);

  res.status(200).json({
    success: true,
    data: {
      testimonials: processedTestimonials,
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

/**
 * Update user's own testimonial
 */
const updateTestimonial = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { content, rating } = req.body;
  const userId = req.user.id;

  const testimonial = await Testimonial.findByPk(id);

  if (!testimonial) {
    throw new AppError('Testimonial not found', 404, true, 'TESTIMONIAL_NOT_FOUND');
  }

  // Check ownership - users can only update their own testimonials
  const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
  if (!isAdmin && testimonial.user_id !== userId) {
    throw new AppError('Access denied: not testimonial owner', 403, true, 'ACCESS_DENIED');
  }

  // Don't allow updates to approved testimonials by regular users
  if (!isAdmin && testimonial.status === 'approved') {
    throw new AppError('Cannot update approved testimonials', 400, true, 'TESTIMONIAL_APPROVED');
  }

  // Validate rating if provided
  if (rating && (rating < 1 || rating > 5)) {
    throw new AppError('Rating must be between 1 and 5', 400, true, 'INVALID_RATING');
  }

  // Update fields
  const updateData = {};
  if (content) updateData.content = content;
  if (rating) updateData.rating = rating;
  
  // Reset status to pending if content changed for non-admin users
  if (!isAdmin && content && testimonial.status === 'approved') {
    updateData.status = 'pending';
  }

  await testimonial.update(updateData);

  // Clear testimonials cache
  await redisUtils.del(CACHE_KEYS.TESTIMONIALS_LIST('*'));

  logger.contextLogger.database('Testimonial updated', 'Testimonial', {
    testimonialId: testimonial.id,
    userId: userId,
    updatedFields: Object.keys(updateData)
  });

  res.status(200).json({
    success: true,
    message: 'Testimonial updated successfully',
    data: {
      testimonial: {
        id: testimonial.id,
        content: testimonial.content,
        rating: testimonial.rating,
        status: testimonial.status,
        updated_at: testimonial.updated_at
      }
    }
  });
});

/**
 * Delete user's own testimonial
 */
const deleteTestimonial = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const testimonial = await Testimonial.findByPk(id);

  if (!testimonial) {
    throw new AppError('Testimonial not found', 404, true, 'TESTIMONIAL_NOT_FOUND');
  }

  // Check ownership - users can only delete their own testimonials
  const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
  if (!isAdmin && testimonial.user_id !== userId) {
    throw new AppError('Access denied: not testimonial owner', 403, true, 'ACCESS_DENIED');
  }

  await testimonial.destroy();

  // Clear testimonials cache
  await redisUtils.del(CACHE_KEYS.TESTIMONIALS_LIST('*'));

  logger.contextLogger.database('Testimonial deleted', 'Testimonial', {
    testimonialId: testimonial.id,
    userId: userId
  });

  res.status(200).json({
    success: true,
    message: 'Testimonial deleted successfully'
  });
});

/**
 * Admin: Get all testimonials (including pending ones)
 */
const getAdminTestimonials = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    category,
    is_featured,
    project_id,
    campaign_id,
    sort_by = 'created_at',
    sort_order = 'desc'
  } = req.query;

  const offset = (page - 1) * limit;

  // Build where conditions - admin can see all testimonials
  const whereConditions = {};

  if (status) {
    whereConditions.status = status;
  }

  if (category) {
    whereConditions.category = category;
  }

  if (is_featured !== undefined) {
    whereConditions.is_featured = is_featured === 'true';
  }

  if (project_id) {
    whereConditions.project_id = project_id;
  }

  if (campaign_id) {
    whereConditions.campaign_id = campaign_id;
  }

  const { count, rows: testimonials } = await Testimonial.findAndCountAll({
    where: whereConditions,
    include: [
      {
        model: Project,
        as: 'project',
        attributes: ['id', 'title', 'slug', 'category'],
        required: false,
      },
      {
        model: Campaign,
        as: 'campaign',
        attributes: ['id', 'title', 'slug', 'category'],
        required: false,
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name', 'email'],
        required: false,
      }
    ],
    order: [[sort_by, sort_order.toUpperCase()]],
    limit: parseInt(limit),
    offset: offset,
  });

  // Process testimonials for admin display
  const processedTestimonials = testimonials.map(testimonial => {
    const testimonialData = testimonial.getAdminData();
    
    // Add related entity information
    if (testimonial.project) {
      testimonialData.related_project = {
        id: testimonial.project.id,
        title: testimonial.project.title,
        slug: testimonial.project.slug,
        category: testimonial.project.category
      };
    }

    if (testimonial.campaign) {
      testimonialData.related_campaign = {
        id: testimonial.campaign.id,
        title: testimonial.campaign.title,
        slug: testimonial.campaign.slug,
        category: testimonial.campaign.category
      };
    }

    // Add user information
    if (testimonial.user) {
      testimonialData.user_info = {
        id: testimonial.user.id,
        name: `${testimonial.user.first_name} ${testimonial.user.last_name}`,
        email: testimonial.user.email
      };
    }

    return testimonialData;
  });

  const totalPages = Math.ceil(count / limit);

  res.status(200).json({
    success: true,
    data: {
      testimonials: processedTestimonials,
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

/**
 * Admin: Approve a testimonial
 */
const approveTestimonial = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { is_featured = false } = req.body;
  const adminId = req.user.id;

  const testimonial = await Testimonial.findByPk(id);

  if (!testimonial) {
    throw new AppError('Testimonial not found', 404, true, 'TESTIMONIAL_NOT_FOUND');
  }

  if (testimonial.status === 'approved') {
    throw new AppError('Testimonial is already approved', 400, true, 'ALREADY_APPROVED');
  }

  await testimonial.approve(adminId);

  // Set featured status if requested
  if (is_featured) {
    await testimonial.update({ is_featured: true });
  }

  // Clear testimonials cache
  await redisUtils.del(CACHE_KEYS.TESTIMONIALS_LIST('*'));

  logger.contextLogger.database('Testimonial approved', 'Testimonial', {
    testimonialId: testimonial.id,
    approvedBy: adminId,
    isFeatured: is_featured
  });

  res.status(200).json({
    success: true,
    message: 'Testimonial approved successfully',
    data: {
      testimonial: {
        id: testimonial.id,
        status: testimonial.status,
        is_featured: testimonial.is_featured,
        approved_at: testimonial.approved_at,
        approved_by: testimonial.approved_by
      }
    }
  });
});

/**
 * Admin: Reject a testimonial
 */
const rejectTestimonial = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const adminId = req.user.id;

  const testimonial = await Testimonial.findByPk(id);

  if (!testimonial) {
    throw new AppError('Testimonial not found', 404, true, 'TESTIMONIAL_NOT_FOUND');
  }

  if (testimonial.status === 'rejected') {
    throw new AppError('Testimonial is already rejected', 400, true, 'ALREADY_REJECTED');
  }

  await testimonial.reject(reason);

  // Clear testimonials cache
  await redisUtils.del(CACHE_KEYS.TESTIMONIALS_LIST('*'));

  logger.contextLogger.database('Testimonial rejected', 'Testimonial', {
    testimonialId: testimonial.id,
    rejectedBy: adminId,
    reason: reason
  });

  res.status(200).json({
    success: true,
    message: 'Testimonial rejected successfully',
    data: {
      testimonial: {
        id: testimonial.id,
        status: testimonial.status,
        rejection_reason: reason
      }
    }
  });
});

/**
 * Admin: Toggle featured status of a testimonial
 */
const toggleFeaturedStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;

  const testimonial = await Testimonial.findByPk(id);

  if (!testimonial) {
    throw new AppError('Testimonial not found', 404, true, 'TESTIMONIAL_NOT_FOUND');
  }

  if (testimonial.status !== 'approved') {
    throw new AppError('Only approved testimonials can be featured', 400, true, 'NOT_APPROVED');
  }

  const newFeaturedStatus = !testimonial.is_featured;
  await testimonial.update({ is_featured: newFeaturedStatus });

  // Clear testimonials cache
  await redisUtils.del(CACHE_KEYS.TESTIMONIALS_LIST('*'));

  logger.contextLogger.database('Testimonial featured status toggled', 'Testimonial', {
    testimonialId: testimonial.id,
    toggledBy: adminId,
    isFeatured: newFeaturedStatus
  });

  res.status(200).json({
    success: true,
    message: `Testimonial ${newFeaturedStatus ? 'featured' : 'unfeatured'} successfully`,
    data: {
      testimonial: {
        id: testimonial.id,
        is_featured: testimonial.is_featured
      }
    }
  });
});

/**
 * Upload image for testimonial
 */
const uploadTestimonialImage = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  if (!req.file) {
    throw new AppError('No image file provided', 400, true, 'NO_FILE');
  }

  // Get testimonial and check ownership
  const testimonial = await Testimonial.findByPk(id);

  if (!testimonial) {
    throw new AppError('Testimonial not found', 404, true, 'TESTIMONIAL_NOT_FOUND');
  }

  // Check ownership - users can only upload images for their own testimonials
  const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
  if (!isAdmin && testimonial.user_id !== userId) {
    throw new AppError('Access denied: not testimonial owner', 403, true, 'ACCESS_DENIED');
  }

  try {
    // Upload image
    const uploadResult = await fileUploadService.uploadTestimonialImage(req.file, id);

    // Delete old image if exists
    if (testimonial.image_url && testimonial.image_url.includes('cloudinary')) {
      try {
        // Extract public_id from URL
        const urlParts = testimonial.image_url.split('/');
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExtension.split('.')[0];
        const folderPath = `${PROJECT_NAME.toLowerCase().replace(/\\s+/g, '-')}/testimonials/${id}/${publicId}`;
        await fileUploadService.deleteImage(folderPath);
      } catch (error) {
        // Log but don't fail the upload
        logger.logError(error, { context: 'delete_old_testimonial_image', testimonialId: id });
      }
    }

    // Update testimonial with new image URL
    await testimonial.update({ 
      image_url: uploadResult.url,
      images: [uploadResult] // Store full image data in images array
    });

    // Clear testimonials cache
    await redisUtils.del(CACHE_KEYS.TESTIMONIALS_LIST('*'));

    logger.contextLogger.upload('Testimonial image uploaded', req.file.originalname, req.file.size, {
      testimonialId: id,
      userId: userId,
      imageUrl: uploadResult.url
    });

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        image: {
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          width: uploadResult.width,
          height: uploadResult.height
        }
      }
    });

  } catch (error) {
    logger.logError(error, {
      context: 'testimonial_image_upload',
      testimonialId: id,
      userId: userId,
      fileName: req.file.originalname
    });

    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Image upload failed', 500, true, 'UPLOAD_FAILED');
  }
});

/**
 * Delete testimonial image
 */
const deleteTestimonialImage = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Get testimonial and check ownership
  const testimonial = await Testimonial.findByPk(id);

  if (!testimonial) {
    throw new AppError('Testimonial not found', 404, true, 'TESTIMONIAL_NOT_FOUND');
  }

  // Check ownership - users can only delete images from their own testimonials
  const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
  if (!isAdmin && testimonial.user_id !== userId) {
    throw new AppError('Access denied: not testimonial owner', 403, true, 'ACCESS_DENIED');
  }

  if (!testimonial.image_url) {
    throw new AppError('No image to delete', 400, true, 'NO_IMAGE');
  }

  try {
    // Delete image from Cloudinary
    if (testimonial.image_url.includes('cloudinary')) {
      const urlParts = testimonial.image_url.split('/');
      const publicIdWithExtension = urlParts[urlParts.length - 1];
      const publicId = publicIdWithExtension.split('.')[0];
      const folderPath = `${PROJECT_NAME.toLowerCase().replace(/\\s+/g, '-')}/testimonials/${id}/${publicId}`;
      
      await fileUploadService.deleteImage(folderPath);
    }

    // Update testimonial to remove image
    await testimonial.update({ 
      image_url: null,
      images: []
    });

    // Clear testimonials cache
    await redisUtils.del(CACHE_KEYS.TESTIMONIALS_LIST('*'));

    logger.contextLogger.database('Testimonial image deleted', 'Testimonial', {
      testimonialId: id,
      userId: userId
    });

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    logger.logError(error, {
      context: 'testimonial_image_delete',
      testimonialId: id,
      userId: userId
    });

    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Image deletion failed', 500, true, 'DELETE_FAILED');
  }
});

module.exports = {
  getTestimonials,
  submitTestimonial,
  getTestimonialById,
  getUserTestimonials,
  updateTestimonial,
  deleteTestimonial,
  getAdminTestimonials,
  approveTestimonial,
  rejectTestimonial,
  toggleFeaturedStatus,
  uploadTestimonialImage,
  deleteTestimonialImage,
};