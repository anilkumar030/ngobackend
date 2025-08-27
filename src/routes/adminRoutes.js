const express = require('express');
const { authenticateToken, requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const { validate, validateFileUpload, commonValidations } = require('../middleware/validation');
const { User, Campaign, Donation, Order, Product, BlogPost, Gallery } = require('../models');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { redisUtils } = require('../config/redis');
const logger = require('../utils/logger');
const Joi = require('joi');
const multer = require('multer');
const authController = require('../controllers/authController');
const blogController = require('../controllers/blogController');
const blogValidators = require('../validators/blogValidators');
const adminGalleryController = require('../controllers/adminGalleryController');
const galleryValidators = require('../validators/galleryValidators');
const statisticsController = require('../controllers/statisticsController');
const projectController = require('../controllers/projectController');
const projectValidators = require('../validators/projectValidators');
const donationController = require('../controllers/donationController');
const {
  loginValidation,
  refreshTokenValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} = require('../validators/authValidators');
const { 
  uploadSingle, 
  uploadMultiple, 
  handleUploadError, 
  processUploadedFile, 
  cleanupOnError 
} = require('../middleware/galleryUpload');

const router = express.Router();

// Public admin authentication routes (no auth required)
// These routes should be accessible without authentication tokens
router.post('/auth/login', validate(loginValidation), authController.login);
router.post('/auth/refresh', validate(refreshTokenValidation), authController.refreshToken);
router.post('/auth/forgot-password', validate(forgotPasswordValidation), authController.forgotPassword);
router.post('/auth/reset-password', validate(resetPasswordValidation), authController.resetPassword);

// All other admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * Get admin dashboard statistics
 */
const getDashboardStats = catchAsync(async (req, res) => {
  const { period = '30d' } = req.query;

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
    case '1y':
      startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  // Get comprehensive statistics
  const [
    // User statistics
    totalUsers,
    newUsers,
    activeUsers,
    
    // Campaign statistics
    totalCampaigns,
    activeCampaigns,
    completedCampaigns,
    
    // Donation statistics
    totalDonations,
    completedDonations,
    totalDonationAmount,
    recentDonations,
    
    // Order statistics
    totalOrders,
    completedOrders,
    totalOrderAmount,
    recentOrders,
    
    // Product statistics
    totalProducts,
    activeProducts,
    
    // Blog statistics
    totalBlogPosts,
    publishedPosts,
    
    // Gallery statistics
    totalGalleryImages,
  ] = await Promise.all([
    // Users
    User.count(),
    User.count({ where: { created_at: { [require('sequelize').Op.gte]: startDate } } }),
    User.count({ where: { is_active: true } }),
    
    // Campaigns
    Campaign.count(),
    Campaign.count({ where: { status: 'active' } }),
    Campaign.count({ where: { status: 'completed' } }),
    
    // Donations
    Donation.count(),
    Donation.count({ where: { payment_status: 'completed' } }),
    Donation.sum('amount', { where: { payment_status: 'completed' } }) || 0,
    Donation.findAll({
      where: { created_at: { [require('sequelize').Op.gte]: startDate } },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['first_name', 'last_name'],
        },
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['title'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: 10,
    }),
    
    // Orders
    Order.count(),
    Order.count({ where: { payment_status: 'paid' } }),
    Order.sum('total_amount', { where: { payment_status: 'paid' } }) || 0,
    Order.findAll({
      where: { created_at: { [require('sequelize').Op.gte]: startDate } },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['first_name', 'last_name'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: 5,
    }),
    
    // Products
    Product.count(),
    Product.count({ where: { is_available: true } }),
    
    // Blog
    BlogPost.count(),
    BlogPost.count({ where: { status: 'published' } }),
    
    // Gallery
    Gallery.count({ where: { status: 'active' } }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      period,
      date_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      statistics: {
        users: {
          total: totalUsers,
          new: newUsers,
          active: activeUsers,
        },
        campaigns: {
          total: totalCampaigns,
          active: activeCampaigns,
          completed: completedCampaigns,
        },
        donations: {
          total: totalDonations,
          completed: completedDonations,
          total_amount: totalDonationAmount,
        },
        orders: {
          total: totalOrders,
          completed: completedOrders,
          total_amount: totalOrderAmount,
        },
        products: {
          total: totalProducts,
          active: activeProducts,
        },
        blog: {
          total: totalBlogPosts,
          published: publishedPosts,
        },
        gallery: {
          total: totalGalleryImages,
        },
      },
      recent_activity: {
        donations: recentDonations,
        orders: recentOrders,
      },
    },
  });
});

/**
 * Get system health information
 */
const getSystemHealth = catchAsync(async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {},
  };

  // Check database connection
  try {
    await require('../models').sequelize.authenticate();
    health.services.database = { status: 'connected', latency: null };
  } catch (error) {
    health.services.database = { status: 'disconnected', error: error.message };
    health.status = 'unhealthy';
  }

  // Check Redis connection
  try {
    const start = Date.now();
    await redisUtils.ping();
    const latency = Date.now() - start;
    health.services.redis = { status: 'connected', latency: `${latency}ms` };
  } catch (error) {
    health.services.redis = { status: 'disconnected', error: error.message };
    health.status = 'degraded';
  }

  // Add system information
  health.system = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu_usage: process.cpuUsage(),
    node_version: process.version,
    environment: process.env.NODE_ENV,
  };

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 206 : 503;

  res.status(statusCode).json({
    success: health.status !== 'unhealthy',
    data: health,
  });
});

/**
 * Clear cache (specific keys or all)
 */
const clearCache = catchAsync(async (req, res) => {
  const { keys, all = false } = req.body;

  let clearedCount = 0;

  if (all) {
    // Clear all cache
    const result = await redisUtils.flushdb();
    if (result) {
      clearedCount = 'all';
      logger.contextLogger.security('All cache cleared by admin', 'info', {
        adminId: req.user.id,
      });
    }
  } else if (keys && Array.isArray(keys)) {
    // Clear specific keys
    for (const key of keys) {
      const result = await redisUtils.del(key);
      if (result) clearedCount++;
    }
    
    logger.contextLogger.security('Specific cache keys cleared by admin', 'info', {
      adminId: req.user.id,
      keys,
      clearedCount,
    });
  } else {
    throw new AppError('Please specify keys to clear or set all=true', 400, true, 'INVALID_CACHE_CLEAR_REQUEST');
  }

  res.status(200).json({
    success: true,
    message: 'Cache cleared successfully',
    data: {
      cleared: clearedCount,
    },
  });
});

/**
 * Get recent user activity
 */
const getRecentActivity = catchAsync(async (req, res) => {
  const { limit = 50, type } = req.query;

  const activities = [];

  // Get recent users
  if (!type || type === 'users') {
    const recentUsers = await User.findAll({
      order: [['created_at', 'DESC']],
      limit: parseInt(limit) / 4,
      attributes: ['id', 'first_name', 'last_name', 'email', 'created_at'],
    });

    recentUsers.forEach(user => {
      activities.push({
        type: 'user_registered',
        timestamp: user.created_at,
        data: {
          user_id: user.id,
          user_name: `${user.first_name} ${user.last_name}`,
          user_email: user.email,
        },
      });
    });
  }

  // Get recent donations
  if (!type || type === 'donations') {
    const recentDonations = await Donation.findAll({
      where: { payment_status: 'completed' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['first_name', 'last_name'],
        },
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['title'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit) / 4,
    });

    recentDonations.forEach(donation => {
      activities.push({
        type: 'donation_completed',
        timestamp: donation.created_at,
        data: {
          donation_id: donation.id,
          amount: donation.amount,
          campaign_title: donation.campaign.title,
          donor_name: donation.is_anonymous ? 'Anonymous' : `${donation.user.first_name} ${donation.user.last_name}`,
        },
      });
    });
  }

  // Get recent campaigns
  if (!type || type === 'campaigns') {
    const recentCampaigns = await Campaign.findAll({
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['first_name', 'last_name'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit) / 4,
    });

    recentCampaigns.forEach(campaign => {
      activities.push({
        type: 'campaign_created',
        timestamp: campaign.created_at,
        data: {
          campaign_id: campaign.id,
          campaign_title: campaign.title,
          creator_name: `${campaign.creator.first_name} ${campaign.creator.last_name}`,
          status: campaign.status,
        },
      });
    });
  }

  // Sort all activities by timestamp
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.status(200).json({
    success: true,
    data: {
      activities: activities.slice(0, parseInt(limit)),
    },
  });
});

/**
 * Update user status (admin only)
 */
const updateUserStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { is_active, role } = req.body;

  if (!is_active !== undefined && !role) {
    throw new AppError('Either is_active or role must be provided', 400, true, 'MISSING_UPDATE_DATA');
  }

  const user = await User.findByPk(id);
  if (!user) {
    throw new AppError('User not found', 404, true, 'USER_NOT_FOUND');
  }

  // Only super admins can change roles
  if (role && req.user.role !== 'super_admin') {
    throw new AppError('Only super admins can change user roles', 403, true, 'INSUFFICIENT_PERMISSIONS');
  }

  // Prevent self-deactivation or role change
  if (user.id === req.user.id) {
    throw new AppError('Cannot modify your own account', 400, true, 'SELF_MODIFICATION_NOT_ALLOWED');
  }

  const updateData = {};
  if (is_active !== undefined) updateData.is_active = is_active;
  if (role) updateData.role = role;

  await user.update(updateData);

  logger.contextLogger.security('User status updated by admin', 'warn', {
    adminId: req.user.id,
    targetUserId: user.id,
    changes: updateData,
  });

  res.status(200).json({
    success: true,
    message: 'User status updated successfully',
    data: {
      user: {
        id: user.id,
        email: user.email,
        is_active: user.is_active,
        role: user.role,
      },
    },
  });
});

/**
 * Get admin project statistics
 * 
 * Endpoint: GET /api/admin/projects/statistics
 * 
 * Returns comprehensive project statistics for admin dashboard including:
 * - Overview: total, active, completed, upcoming projects
 * - Budget information: total budget, spent amounts, utilization rates
 * - Category breakdown: projects grouped by category with budget details
 * - Time series data: monthly project trends and budget tracking
 * - Impact metrics: project-related achievements and outcomes
 * 
 * Query parameters (optional):
 * - start_date: ISO date string to filter from specific date
 * - end_date: ISO date string to filter to specific date
 * 
 * Authentication: Requires admin role
 * Caching: Results cached for 15 minutes
 */
const getProjectStatistics = catchAsync(async (req, res) => {
  // Set the category to 'projects' to filter for project-specific statistics
  req.query.category = 'projects';
  
  // Call the existing detailed statistics function which handles all the logic
  await statisticsController.getDetailedStatistics(req, res);
});

// Validation schemas
const clearCacheValidation = {
  body: Joi.object({
    keys: Joi.array().items(Joi.string()).optional(),
    all: Joi.boolean().optional().default(false),
  }),
};

const updateUserStatusValidation = {
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
  body: Joi.object({
    is_active: Joi.boolean().optional(),
    role: Joi.string().valid('user', 'admin', 'super_admin').optional(),
  }),
};

// Donation validation schemas
const createManualDonationValidation = {
  body: Joi.object({
    campaign_id: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid campaign ID format. Must be a valid UUID',
      'any.required': 'Campaign ID is required'
    }),
    user_id: Joi.string().uuid().optional().messages({
      'string.guid': 'Invalid user ID format. Must be a valid UUID'
    }),
    donation_amount: Joi.number().min(1).max(1000000).required().messages({
      'number.min': 'Donation amount must be at least ₹1',
      'number.max': 'Donation amount cannot exceed ₹10,00,000',
      'any.required': 'Donation amount is required'
    }),
    tip_amount: Joi.number().min(0).max(100000).optional().default(0).messages({
      'number.min': 'Tip amount cannot be negative',
      'number.max': 'Tip amount cannot exceed ₹1,00,000'
    }),
    donor_name: Joi.string().trim().min(2).max(255).required().messages({
      'string.min': 'Donor name must be at least 2 characters',
      'string.max': 'Donor name cannot exceed 255 characters',
      'any.required': 'Donor name is required'
    }),
    donor_email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Donor email is required'
    }),
    donor_phone: Joi.string().pattern(/^[0-9]{10}$/).optional().messages({
      'string.pattern.base': 'Please provide a valid 10-digit phone number'
    }),
    donor_pan: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i).optional().messages({
      'string.pattern.base': 'Please provide a valid PAN number (format: ABCDE1234F)'
    }),
    donor_address: Joi.string().trim().max(500).optional().messages({
      'string.max': 'Address cannot exceed 500 characters'
    }),
    donation_towards: Joi.string().trim().min(3).max(255).required().messages({
      'string.min': 'Donation purpose must be at least 3 characters',
      'string.max': 'Donation purpose cannot exceed 255 characters',
      'any.required': 'Please specify what the donation is for'
    }),
    message: Joi.string().trim().max(1000).optional().messages({
      'string.max': 'Message cannot exceed 1000 characters'
    }),
    show_name_publicly: Joi.boolean().optional().default(false),
    receive_whatsapp_updates: Joi.boolean().optional().default(false),
    payment_method: Joi.string().valid('manual', 'cash', 'cheque', 'bank_transfer', 'other').optional().default('manual'),
    transaction_id: Joi.string().trim().max(255).optional().messages({
      'string.max': 'Transaction ID cannot exceed 255 characters'
    }),
    receipt_number: Joi.string().trim().max(100).optional().messages({
      'string.max': 'Receipt number cannot exceed 100 characters'
    }),
    howYouCanHelp: Joi.object({
      title: Joi.string().trim().min(1).max(255).required(),
      amount: Joi.number().min(1).max(1000000).required()
    }).optional()
  })
};

const updateDonationValidation = {
  params: Joi.object({
    id: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid donation ID format',
      'any.required': 'Donation ID is required'
    })
  }),
  body: Joi.object({
    donation_amount: Joi.number().min(1).max(1000000).optional(),
    tip_amount: Joi.number().min(0).max(100000).optional(),
    donor_name: Joi.string().trim().min(2).max(255).optional(),
    donor_email: Joi.string().email().optional(),
    donor_phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
    donor_pan: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i).optional(),
    donor_address: Joi.string().trim().max(500).optional(),
    donation_towards: Joi.string().trim().min(3).max(255).optional(),
    message: Joi.string().trim().max(1000).optional(),
    show_name_publicly: Joi.boolean().optional(),
    receive_whatsapp_updates: Joi.boolean().optional(),
    status: Joi.string().valid('pending', 'completed', 'failed', 'refunded', 'cancelled').optional(),
    payment_status: Joi.string().valid('pending', 'processing', 'completed', 'failed', 'refunded').optional(),
    payment_method: Joi.string().max(50).optional(),
    transaction_id: Joi.string().trim().max(255).optional(),
    receipt_number: Joi.string().trim().max(100).optional(),
    failure_reason: Joi.string().trim().max(500).optional(),
    update_reason: Joi.string().trim().max(500).optional(),
    howYouCanHelp: Joi.object({
      title: Joi.string().trim().min(1).max(255).required(),
      amount: Joi.number().min(1).max(1000000).required()
    }).optional()
  })
};

const topDonorsValidation = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional().default(20),
    period: Joi.string().valid('30d', '3m', '6m', '1y', 'all').optional().default('1y'),
    campaign_id: Joi.string().uuid().optional(),
    min_amount: Joi.number().min(1).optional()
  })
};

const recurringDonationsValidation = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(100).optional().default(20),
    status: Joi.string().valid('all', 'active', 'inactive').optional().default('all'),
    min_frequency: Joi.number().integer().min(2).optional().default(2)
  })
};

const exportDonationsValidation = {
  body: Joi.object({
    format: Joi.string().valid('csv', 'json').optional().default('csv'),
    start_date: Joi.date().iso().optional(),
    end_date: Joi.date().iso().min(Joi.ref('start_date')).optional(),
    campaign_id: Joi.string().uuid().optional(),
    status: Joi.string().valid('all', 'completed', 'pending', 'failed').optional().default('completed'),
    include_fields: Joi.array().items(
      Joi.string().valid('all', 'basic', 'contact', 'payment', 'campaign', 'metadata')
    ).optional().default(['all'])
  })
};

const donationAnalyticsValidation = {
  query: Joi.object({
    period: Joi.string().valid('7d', '30d', '3m', '6m', '1y').optional().default('30d'),
    campaign_id: Joi.string().uuid().optional(),
    group_by: Joi.string().valid('hour', 'day', 'week', 'month').optional().default('day')
  })
};


// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Admin API Routes
router.get('/dashboard', getDashboardStats);                    // General dashboard statistics
router.get('/health', getSystemHealth);                         // System health monitoring
router.get('/activity', getRecentActivity);                     // Recent user activities
router.get('/projects/statistics', getProjectStatistics);       // Project-specific statistics

router.post('/cache/clear', validate(clearCacheValidation), clearCache);
router.put('/users/:id/status', validate(updateUserStatusValidation), updateUserStatus);

/**
 * Project Management Routes
 * 
 * Complete admin API for project management with the following features:
 * - Full CRUD operations (Create, Read, Update, Delete)
 * - Status management (upcoming, active, completed, on-hold, cancelled)
 * - Progress tracking and milestone management
 * - File upload support for project images and documents
 * - Advanced permission controls (admin, project creator, project manager)
 * - Comprehensive audit logging and cache management
 * - Transaction-based operations for data consistency
 */

/**
 * POST /admin/projects - Create new project with optional file uploads
 * 
 * Supports multipart/form-data for file uploads:
 * - featured_image: Single image file (max 10MB)
 * - images: Up to 10 image files (max 10MB each)
 * 
 * Required fields:
 * - title: Project title (3-500 chars)
 * - category: Project category from predefined enum
 * - location: Project location (1-500 chars)
 * - start_date: Project start date (ISO format)
 * - total_budget: Total project budget (0-1000000000)
 * 
 * Optional fields:
 * - description, long_description, status, priority, geographic_scope
 * - estimated_completion_date, funding_sources, beneficiaries_count
 * - progress_percentage, implementation_strategy, impact_metrics
 * - stakeholders, risks_and_mitigation, sustainability_plan
 * - is_featured, is_public, tags, managed_by
 * 
 * Response: Created project with generated slug and metadata
 * Authentication: Requires admin role
 */
router.post('/projects',
  upload.fields([
    { name: 'featured_image', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]),
  validateFileUpload({
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize: 10 * 1024 * 1024,
    maxFiles: 11,
    required: false
  }),
  validate(projectValidators.createProjectValidation),
  projectController.createProject
);

/**
 * PUT /admin/projects/:id - Update existing project with optional file uploads
 * 
 * Same file upload support as POST /admin/projects
 * All fields are optional - only provided fields will be updated
 * 
 * Permissions: Admin role OR project creator OR project manager
 * 
 * Special behaviors:
 * - New images are added to existing gallery (not replaced)
 * - Slug is auto-updated if title changes
 * - Progress/status changes trigger automatic updates
 */
router.put('/projects/:id',
  upload.fields([
    { name: 'featured_image', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]),
  validateFileUpload({
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize: 10 * 1024 * 1024,
    maxFiles: 11,
    required: false
  }),
  validate(projectValidators.updateProjectValidation),
  projectController.updateProject
);

/**
 * DELETE /admin/projects/:id - Delete or archive project
 * 
 * Query parameters:
 * - permanent: Boolean (default: false) - Only super_admin can permanently delete
 * 
 * Behavior:
 * - Default: Soft delete (sets status to 'cancelled' and is_public to false)
 * - permanent=true: Hard delete from database including related updates
 * 
 * Permissions: Admin role only
 * Super admin required for permanent deletion
 */
router.delete('/projects/:id', 
  validate(projectValidators.deleteProjectValidation), 
  projectController.deleteProject
);

/**
 * PATCH /admin/projects/:id/status - Update project status
 * 
 * Body parameters:
 * - status: Required (upcoming, active, completed, on-hold, cancelled)
 * - actual_completion_date: Optional ISO date (for completed status)
 * - completion_notes: Optional string (creates project update entry)
 * 
 * Special behaviors:
 * - Completing project auto-sets progress to 100%
 * - Completion notes create published project update
 * - Status changes are logged and cached
 * 
 * Permissions: Admin role OR project creator OR project manager
 */
router.patch('/projects/:id/status',
  validate(projectValidators.updateProjectStatusValidation),
  projectController.updateProjectStatus
);

/**
 * PATCH /admin/projects/:id/progress - Update project progress
 * 
 * Body parameters:
 * - progress_percentage: Required (0-100)
 * - progress_notes: Optional string (creates project update entry)
 * - milestone_reached: Optional string (milestone description)
 * 
 * Special behaviors:
 * - Progress 100% auto-completes project if status is active
 * - Progress notes create published project update
 * - Milestone updates get special update type
 * 
 * Permissions: Admin role OR project creator OR project manager
 */
router.patch('/projects/:id/progress',
  validate(projectValidators.updateProjectProgressValidation),
  projectController.updateProjectProgress
);

/**
 * Blog Management Routes
 * 
 * Complete admin API for blog post management with the following features:
 * - Full CRUD operations (Create, Read, Update, Delete)
 * - Advanced filtering, searching, and pagination
 * - Status management (draft, published, archived, scheduled)
 * - Featured post management
 * - Image uploads (featured image and gallery)
 * - SEO and social media optimization fields
 * - Bulk operations for managing multiple posts
 * - Rich metadata and analytics support
 */

/**
 * GET /admin/blogs - Get all blog posts with advanced filtering
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 * - status: Filter by status (draft, published, archived, scheduled)
 * - category: Filter by category
 * - is_featured: Filter featured posts (true/false)
 * - author_id: Filter by author UUID
 * - search: Full-text search in title, content, excerpt
 * - sort_by: Sort field (created_at, updated_at, title, status, view_count, like_count, published_at)
 * - sort_order: Sort direction (asc, desc)
 * - date_from: Filter posts from date
 * - date_to: Filter posts to date
 * 
 * Response: Paginated list with statistics and filter metadata
 */
router.get('/blogs', validate(blogValidators.getAllBlogsAdminValidation), blogController.getAllBlogsAdmin);

/**
 * GET /admin/blogs/metadata - Get metadata for dropdown/filter options
 * 
 * Returns:
 * - categories: List of available categories with count
 * - tags: List of all tags used in posts
 * - authors: List of authors who have created posts
 */
router.get('/blogs/metadata', blogController.getBlogMetadata);

/**
 * GET /admin/blogs/:id - Get single blog post by UUID for editing
 * 
 * Returns complete blog post data including:
 * - All content fields (title, content, excerpt, etc.)
 * - SEO metadata (title, description, keywords, canonical URL)
 * - Social media fields (Open Graph, Twitter Card)
 * - Author information and creation metadata
 */
router.get('/blogs/:id', validate(blogValidators.blogParamsValidation), blogController.getBlogByIdAdmin);

/**
 * POST /admin/blogs - Create new blog post with optional image uploads
 * 
 * Supports multipart/form-data for file uploads:
 * - featured_image: Single image file (max 10MB)
 * - gallery_images: Up to 5 image files (max 10MB each)
 * 
 * Content fields:
 * - title: Required string (1-500 chars)
 * - content: Optional HTML content (max 100KB)
 * - custom_excerpt: Optional excerpt (max 1000 chars)
 * - category: Optional category name (max 100 chars)
 * - tags: Optional array of tag strings (max 20 tags, 50 chars each)
 * - author_name: Optional author override (max 255 chars)
 * - status: draft|published|archived|scheduled (default: draft)
 * - is_featured: Boolean (default: false)
 * - allow_comments: Boolean (default: true)
 * - published_at: ISO date string (required for scheduled posts)
 * 
 * SEO fields:
 * - seo_title, seo_description, seo_keywords, canonical_url
 * 
 * Social media fields:
 * - og_title, og_description, og_image (Open Graph)
 * - twitter_title, twitter_description, twitter_image (Twitter Card)
 * 
 * Response: Created post with generated slug and metadata
 */
router.post('/blogs', 
  upload.fields([
    { name: 'featured_image', maxCount: 1 },
    { name: 'gallery_images', maxCount: 5 }
  ]),
  validateFileUpload({ 
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize: 10 * 1024 * 1024,
    maxFiles: 6,
    required: false 
  }),
  validate(blogValidators.createBlogValidation),
  blogController.createBlogPost
);

/**
 * PUT /admin/blogs/:id - Update existing blog post with optional image uploads
 * 
 * Same parameters as POST /admin/blogs but all fields are optional
 * Only provided fields will be updated (partial update support)
 * 
 * Special behaviors:
 * - Changing status to 'published' sets published_at if not already set
 * - New images are added to existing gallery (not replaced)
 * - Slug is auto-updated if title changes
 */
router.put('/blogs/:id',
  upload.fields([
    { name: 'featured_image', maxCount: 1 },
    { name: 'gallery_images', maxCount: 5 }
  ]),
  validateFileUpload({ 
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize: 10 * 1024 * 1024,
    maxFiles: 6,
    required: false 
  }),
  validate(blogValidators.updateBlogValidation),
  blogController.updateBlogPost
);

/**
 * DELETE /admin/blogs/:id - Delete or archive blog post
 * 
 * Query parameters:
 * - permanent: Boolean (default: false) - Only super_admin can permanently delete
 * 
 * Behavior:
 * - Default: Soft delete (sets status to 'archived')
 * - permanent=true: Hard delete from database (super_admin only)
 */
router.delete('/blogs/:id', validate(blogValidators.blogParamsValidation), blogController.deleteBlogPost);

/**
 * PATCH /admin/blogs/:id/status - Change blog post status
 * 
 * Body parameters:
 * - status: Required (draft|published|archived|scheduled)
 * 
 * Special behaviors:
 * - Publishing sets published_at if not already set
 * - Proper logging and audit trail
 */
router.patch('/blogs/:id/status', validate(blogValidators.toggleBlogStatusValidation), blogController.toggleBlogStatus);

/**
 * PATCH /admin/blogs/:id/featured - Toggle featured status
 * 
 * Toggles the is_featured flag between true/false
 * No body parameters required
 */
router.patch('/blogs/:id/featured', validate(blogValidators.blogParamsValidation), blogController.toggleFeatured);

/**
 * POST /admin/blogs/bulk - Perform bulk operations on multiple posts
 * 
 * Body parameters:
 * - operation: Required (delete|archive|publish|feature|unfeature|update_category)
 * - post_ids: Required array of UUIDs (max 50 posts)
 * - data: Optional operation-specific data (e.g., category for update_category)
 * 
 * Operations:
 * - delete: Permanently delete posts (super_admin only)
 * - archive: Set status to archived
 * - publish: Set status to published and published_at
 * - feature/unfeature: Toggle featured status
 * - update_category: Change category for all selected posts
 */
router.post('/blogs/bulk', validate(blogValidators.bulkOperationsValidation), blogController.bulkOperations);

/**
 * Gallery Management Routes
 * 
 * Complete admin API for gallery management with the following features:
 * - Full CRUD operations (Create, Read, Update, Delete)
 * - Image upload with secure filename generation
 * - Advanced filtering, searching, and pagination
 * - Status management (active, inactive, archived)
 * - Featured gallery management
 * - Category and tag management
 * - Bulk operations for managing multiple items
 * - Rich metadata and SEO support
 */

/**
 * GET /admin/gallery - Get all gallery items with advanced filtering
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - status: Filter by status (active, inactive, archived, all)
 * - category: Filter by category
 * - subcategory: Filter by subcategory
 * - featured: Filter featured items (true/false)
 * - search: Search in title, description, tags, photographer, location
 * - sort_by: Sort field (created_at, updated_at, title, view_count, like_count, sort_order)
 * - sort_order: Sort order (asc, desc, default: desc)
 * - uploaded_by: Filter by uploader user ID
 * 
 * Returns: Paginated gallery items with uploader info and statistics
 */
router.get('/gallery', validate(galleryValidators.adminGalleryListValidation), adminGalleryController.getAllGalleryItems);

/**
 * GET /admin/gallery/statistics - Get gallery statistics
 * Query parameters:
 * - period: Time period (7d, 30d, 3m, 6m, 1y, all, default: 30d)
 * - category: Filter by specific category
 * - group_by: Group statistics by (category, status, month, week, day)
 * 
 * Returns: Overview statistics and grouped data
 */
router.get('/gallery/statistics', validate(galleryValidators.galleryStatsValidation), adminGalleryController.getGalleryStatistics);

/**
 * GET /admin/gallery/:id - Get specific gallery item by ID
 * 
 * Returns: Complete gallery item data with uploader information
 */
router.get('/gallery/:id', validate(galleryValidators.getGalleryByIdValidation), adminGalleryController.getGalleryItemById);

/**
 * POST /admin/gallery - Create new gallery item with image upload
 * 
 * File upload: Required 'image' field (single file, max 5MB)
 * Supported formats: JPEG, PNG, GIF, WebP
 * 
 * Body parameters:
 * - title: Optional string (max 500 chars)
 * - description: Optional text (max 2000 chars)
 * - category: Required string (max 100 chars)
 * - subcategory: Optional string (max 100 chars)
 * - tags: Optional array of strings (max 10 tags, 50 chars each)
 * - alt_text: Optional string (max 255 chars)
 * - caption: Optional text (max 1000 chars)
 * - photographer: Optional string (max 255 chars)
 * - location: Optional string (max 255 chars)
 * - taken_at: Optional ISO date
 * - status: Optional (active, inactive, archived, default: active)
 * - featured: Optional boolean (default: false)
 * - sort_order: Optional integer (default: 0)
 * - allow_download: Optional boolean (default: false)
 * - copyright_info: Optional string (max 500 chars)
 * - license: Optional string (max 100 chars)
 * - seo_title: Optional string (max 255 chars)
 * - seo_description: Optional text
 * - seo_keywords: Optional array of strings
 * 
 * Response: Created gallery item with generated URL
 */
router.post('/gallery',
  uploadSingle,
  handleUploadError,
  processUploadedFile,
  cleanupOnError,
  validate(galleryValidators.createGalleryValidation),
  adminGalleryController.createGalleryItem
);

/**
 * PUT /admin/gallery/:id - Update existing gallery item with optional image replacement
 * 
 * File upload: Optional 'image' field (single file, max 5MB)
 * Same parameters as POST /admin/gallery but all fields are optional
 * Only provided fields will be updated (partial update support)
 * 
 * Special behaviors:
 * - New image replaces existing image
 * - Old image file is automatically deleted
 * - Slug is auto-updated if title changes
 */
router.put('/gallery/:id',
  uploadSingle,
  handleUploadError,
  processUploadedFile,
  cleanupOnError,
  validate(galleryValidators.updateGalleryValidation),
  adminGalleryController.updateGalleryItem
);

/**
 * DELETE /admin/gallery/:id - Delete or archive gallery item
 * 
 * Query parameters:
 * - permanent: Boolean (default: false) - Only super_admin can permanently delete
 * 
 * Behavior:
 * - Default: Soft delete (sets status to 'archived')
 * - permanent=true: Hard delete from database and removes image file
 */
router.delete('/gallery/:id', validate(galleryValidators.deleteGalleryValidation), adminGalleryController.deleteGalleryItem);

/**
 * POST /admin/gallery/bulk/update - Bulk update multiple gallery items
 * 
 * Body parameters:
 * - ids: Required array of UUIDs (max 50 items)
 * - updates: Required object with fields to update
 *   - status: Optional (active, inactive, archived)
 *   - category: Optional string
 *   - subcategory: Optional string
 *   - featured: Optional boolean
 *   - allow_download: Optional boolean
 * 
 * Returns: Number of updated items and applied changes
 */
router.post('/gallery/bulk/update', validate(galleryValidators.bulkUpdateValidation), adminGalleryController.bulkUpdateGalleryItems);

/**
 * POST /admin/gallery/bulk/delete - Bulk delete multiple gallery items
 * 
 * Body parameters:
 * - ids: Required array of UUIDs (max 50 items)
 * - permanent: Optional boolean (default: false) - Only super_admin can permanently delete
 * 
 * Behavior:
 * - Default: Soft delete (sets status to 'archived')
 * - permanent=true: Hard delete from database and removes image files
 */
router.post('/gallery/bulk/delete', validate(galleryValidators.bulkDeleteValidation), adminGalleryController.bulkDeleteGalleryItems);

/**
 * Donation Management Routes
 * 
 * Complete admin API for donation management with the following features:
 * - Manual donation creation for offline/cash donations
 * - Donation updates and status management
 * - Top donors analytics and reporting
 * - Recurring donor identification and management
 * - Donation data export in CSV and JSON formats
 * - Comprehensive donation analytics and insights
 * - All endpoints require admin authentication
 */

/**
 * POST /admin/donations - Create manual donation entry
 * 
 * For recording offline donations (cash, cheque, bank transfer, etc.)
 * 
 * Required fields:
 * - campaign_id: UUID of the campaign
 * - donation_amount: Amount in rupees (1-1000000)
 * - donor_name: Full name of the donor
 * - donor_email: Valid email address
 * - donation_towards: Purpose/description of donation
 * 
 * Optional fields:
 * - user_id: Link to existing user account
 * - tip_amount: Additional tip amount
 * - donor_phone, donor_pan, donor_address: Contact details
 * - payment_method: manual, cash, cheque, bank_transfer, other
 * - transaction_id, receipt_number: Payment reference
 * - show_name_publicly, receive_whatsapp_updates: Donor preferences
 * - message: Optional message from donor
 * - howYouCanHelp: Structured help option data
 * 
 * Response: Created donation with generated receipt number
 */
router.post('/donations', 
  validate(createManualDonationValidation), 
  donationController.createManualDonation
);

/**
 * PUT /admin/donations/:id - Update existing donation
 * 
 * Allows updating donation details, amounts, status, and metadata
 * All fields are optional - only provided fields will be updated
 * 
 * Special behaviors:
 * - Changing donation_amount updates campaign progress
 * - Status changes are logged with admin details
 * - Update reason can be provided for audit trail
 * 
 * Permissions: Admin role required
 */
router.put('/donations/:id',
  validate(commonValidations.uuidParam),
  validate(updateDonationValidation),
  donationController.updateDonation
);

/**
 * GET /admin/donations/top-donors - Get top donors analysis
 * 
 * Query parameters:
 * - limit: Number of donors to return (1-100, default: 20)
 * - period: Time period (30d, 3m, 6m, 1y, all, default: 1y)
 * - campaign_id: Filter by specific campaign
 * - min_amount: Minimum donation amount filter
 * 
 * Returns: Ranked list of donors with statistics:
 * - Total donated amount and donation count
 * - Average and largest donation amounts
 * - First and latest donation dates
 * - Contact information for outreach
 */
router.get('/donations/top-donors',
  validate(topDonorsValidation),
  donationController.getTopDonors
);

/**
 * GET /admin/donations/recurring - Get recurring donors analysis
 * 
 * Identifies donors who have made multiple donations
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (1-100, default: 20)
 * - min_frequency: Minimum number of donations (default: 2)
 * 
 * Returns: Paginated list of recurring donors with:
 * - Donation frequency analysis and patterns
 * - Total contribution and average amounts
 * - Estimated donation frequency in days
 * - Donor lifetime and engagement metrics
 */
router.get('/donations/recurring',
  validate(recurringDonationsValidation),
  donationController.getRecurringDonations
);

/**
 * POST /admin/donations/export - Export donations data
 * 
 * Export donation data in CSV or JSON format with flexible filtering
 * 
 * Body parameters:
 * - format: Export format (csv, json, default: csv)
 * - start_date, end_date: Date range filters
 * - campaign_id: Filter by specific campaign
 * - status: Filter by donation status (all, completed, pending, failed)
 * - include_fields: Field groups to include (all, basic, contact, payment, campaign, metadata)
 * 
 * CSV Response: File download with appropriate headers
 * JSON Response: Structured data with export metadata
 */
router.post('/donations/export',
  validate(exportDonationsValidation),
  donationController.exportDonations
);

/**
 * GET /admin/donations/analytics - Get donation analytics dashboard
 * 
 * Comprehensive analytics for donation insights and reporting
 * 
 * Query parameters:
 * - period: Analysis period (7d, 30d, 3m, 6m, 1y, default: 30d)
 * - campaign_id: Filter by specific campaign
 * - group_by: Time grouping (hour, day, week, month, default: day)
 * 
 * Returns: Multi-dimensional analytics including:
 * - Overall statistics (total, average, min/max amounts)
 * - Time series data for trend analysis
 * - Payment method breakdown with percentages
 * - Donation amount distribution analysis
 * - All amounts in rupees with proper formatting
 */
router.get('/donations/analytics',
  validate(donationAnalyticsValidation),
  donationController.getDonationAnalytics
);

module.exports = router;