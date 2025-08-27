const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { User, UserAddress, Donation, Order, Campaign } = require('../models');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { uploadMiddleware } = require('../config/cloudinary');
const fileUploadService = require('../services/fileUploadService');
const savedCampaignController = require('../controllers/savedCampaignController');
const {
  getSavedCampaignsValidation,
  saveCampaignValidation,
  removeSavedCampaignValidation,
  updateSavedCampaignValidation,
  toggleNotificationsValidation,
} = require('../validators/savedCampaignValidators');
const Joi = require('joi');

const router = express.Router();

// All profile routes require authentication
router.use(authenticateToken);

// Address validation schemas
const createAddressValidation = {
  body: Joi.object({
    type: Joi.string().valid('home', 'work', 'billing', 'shipping').required(),
    address_line_1: Joi.string().min(5).max(200).required(),
    address_line_2: Joi.string().max(200).optional(),
    city: Joi.string().min(2).max(100).required(),
    state: Joi.string().min(2).max(100).required(),
    postal_code: Joi.string().min(3).max(20).required(),
    country: Joi.string().min(2).max(100).required(),
    is_default: Joi.boolean().optional().default(false),
  }),
};

const updateAddressValidation = {
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
  body: Joi.object({
    type: Joi.string().valid('home', 'work', 'billing', 'shipping').optional(),
    address_line_1: Joi.string().min(5).max(200).optional(),
    address_line_2: Joi.string().max(200).optional(),
    city: Joi.string().min(2).max(100).optional(),
    state: Joi.string().min(2).max(100).optional(),
    postal_code: Joi.string().min(3).max(20).optional(),
    country: Joi.string().min(2).max(100).optional(),
    is_default: Joi.boolean().optional(),
  }),
};

/**
 * Get user addresses
 */
const getAddresses = catchAsync(async (req, res) => {
  const addresses = await UserAddress.findAll({
    where: { user_id: req.user.id },
    order: [['is_default', 'DESC'], ['created_at', 'DESC']],
  });

  res.status(200).json({
    success: true,
    data: {
      addresses,
    },
  });
});

/**
 * Create new address
 */
const createAddress = catchAsync(async (req, res) => {
  const addressData = {
    ...req.body,
    user_id: req.user.id,
  };

  // If this is set as default, update other addresses
  if (addressData.is_default) {
    await UserAddress.update(
      { is_default: false },
      { where: { user_id: req.user.id } }
    );
  }

  const address = await UserAddress.create(addressData);

  res.status(201).json({
    success: true,
    message: 'Address created successfully',
    data: {
      address,
    },
  });
});

/**
 * Update address
 */
const updateAddress = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const address = await UserAddress.findOne({
    where: { id, user_id: req.user.id },
  });

  if (!address) {
    throw new AppError('Address not found', 404, true, 'ADDRESS_NOT_FOUND');
  }

  // If setting as default, update other addresses
  if (updateData.is_default) {
    await UserAddress.update(
      { is_default: false },
      { where: { user_id: req.user.id, id: { [require('sequelize').Op.ne]: id } } }
    );
  }

  await address.update(updateData);

  res.status(200).json({
    success: true,
    message: 'Address updated successfully',
    data: {
      address,
    },
  });
});

/**
 * Delete address
 */
const deleteAddress = catchAsync(async (req, res) => {
  const { id } = req.params;

  const address = await UserAddress.findOne({
    where: { id, user_id: req.user.id },
  });

  if (!address) {
    throw new AppError('Address not found', 404, true, 'ADDRESS_NOT_FOUND');
  }

  await address.destroy();

  res.status(200).json({
    success: true,
    message: 'Address deleted successfully',
  });
});

/**
 * Upload profile picture
 */
const uploadProfilePicture = catchAsync(async (req, res) => {
  const file = req.file;

  if (!file) {
    throw new AppError('Profile picture is required', 400, true, 'NO_IMAGE_FILE');
  }

  // Upload image
  const uploadResult = await fileUploadService.uploadProfileImage(file, req.user.id);

  // Update user profile
  await User.update(
    { profile_image: uploadResult.url },
    { where: { id: req.user.id } }
  );

  res.status(200).json({
    success: true,
    message: 'Profile picture uploaded successfully',
    data: {
      profile_image: uploadResult.url,
    },
  });
});

/**
 * Get donation history
 */
const getDonationHistory = catchAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const { count, rows: donations } = await Donation.findAndCountAll({
    where: { user_id: req.user.id },
    include: [
      {
        model: Campaign,
        as: 'campaign',
        attributes: ['id', 'title', 'slug', 'featured_image'],
      },
    ],
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset: offset,
  });

  const totalPages = Math.ceil(count / limit);

  res.status(200).json({
    success: true,
    data: {
      donations,
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
 * Get order history
 */
const getOrderHistory = catchAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const { count, rows: orders } = await Order.findAndCountAll({
    where: { user_id: req.user.id },
    include: [
      {
        model: require('../models').OrderItem,
        as: 'items',
        include: [
          {
            model: require('../models').Product,
            as: 'product',
            attributes: ['id', 'name', 'featured_image'],
          },
        ],
      },
    ],
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset: offset,
  });

  const totalPages = Math.ceil(count / limit);

  res.status(200).json({
    success: true,
    data: {
      orders,
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
 * Get profile dashboard summary
 */
const getDashboard = catchAsync(async (req, res) => {
  const userId = req.user.id;

  // Get user statistics
  const [
    totalDonations,
    totalDonationAmount,
    totalOrders,
    totalOrderAmount,
    recentDonations,
    recentOrders,
  ] = await Promise.all([
    Donation.count({
      where: { user_id: userId, payment_status: 'completed' },
    }),
    Donation.sum('amount', {
      where: { user_id: userId, payment_status: 'completed' },
    }) || 0,
    Order.count({
      where: { user_id: userId, payment_status: 'completed' },
    }),
    Order.sum('total_amount', {
      where: { user_id: userId, payment_status: 'completed' },
    }) || 0,
    Donation.findAll({
      where: { user_id: userId, payment_status: 'completed' },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'title', 'slug'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: 5,
    }),
    Order.findAll({
      where: { user_id: userId, payment_status: 'completed' },
      order: [['created_at', 'DESC']],
      limit: 3,
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      summary: {
        donations: {
          count: totalDonations,
          total_amount: totalDonationAmount,
        },
        orders: {
          count: totalOrders,
          total_amount: totalOrderAmount,
        },
      },
      recent_activity: {
        donations: recentDonations,
        orders: recentOrders,
      },
    },
  });
});

// Routes
router.get('/dashboard', getDashboard);
router.get('/donations', getDonationHistory);
router.get('/orders', getOrderHistory);

router.get('/addresses', getAddresses);
router.post('/addresses', validate(createAddressValidation), createAddress);
router.put('/addresses/:id', validate(updateAddressValidation), updateAddress);
router.delete('/addresses/:id', deleteAddress);

router.post('/profile-picture',
  uploadMiddleware.single('profile_picture'),
  uploadProfilePicture
);

// Saved campaigns routes - Core bookmarking functionality
router.get('/saved-campaigns', validate(getSavedCampaignsValidation), savedCampaignController.getSavedCampaigns);
router.post('/saved-campaigns', validate(saveCampaignValidation), savedCampaignController.saveCampaign);
router.get('/saved-campaigns/:campaign_id', validate(removeSavedCampaignValidation), savedCampaignController.checkCampaignSaved);
router.delete('/saved-campaigns/:campaign_id', validate(removeSavedCampaignValidation), savedCampaignController.removeSavedCampaign);

module.exports = router;