const express = require('express');
const paymentController = require('../controllers/paymentController');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const { validate, commonValidations } = require('../middleware/validation');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const createDonationOrderValidation = {
  body: Joi.object({
    campaignId: Joi.number().integer().positive().required(),
    amount: Joi.number().positive().min(1).required(),
    isAnonymous: Joi.boolean().optional().default(false),
    message: Joi.string().trim().max(500).optional(),
  }),
};

const createProductOrderValidation = {
  body: Joi.object({
    items: Joi.array().items(
      Joi.object({
        productId: Joi.number().integer().positive().required(),
        quantity: Joi.number().integer().positive().required(),
      })
    ).min(1).required(),
    shippingAddress: Joi.object({
      address_line_1: Joi.string().required(),
      address_line_2: Joi.string().optional(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      postal_code: Joi.string().required(),
      country: Joi.string().required(),
    }).required(),
    billingAddress: Joi.object({
      address_line_1: Joi.string().required(),
      address_line_2: Joi.string().optional(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      postal_code: Joi.string().required(),
      country: Joi.string().required(),
    }).optional(),
  }),
};

const verifyPaymentValidation = {
  body: Joi.object({
    razorpay_payment_id: Joi.string().required(),
    razorpay_order_id: Joi.string().required(),
    razorpay_signature: Joi.string().required(),
  }),
};

const createRefundValidation = {
  body: Joi.object({
    payment_id: Joi.string().required(),
    amount: Joi.number().positive().required(),
    reason: Joi.string().min(10).max(500).required(),
  }),
};

const paginationValidation = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().optional(),
    campaign_id: Joi.number().integer().positive().optional(),
    payment_status: Joi.string().optional(),
    sort_by: Joi.string().valid('created_at', 'updated_at', 'amount', 'status', 'payment_status').default('created_at'),
    sort_order: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC'),
  }),
};

const statisticsValidation = {
  query: Joi.object({
    start_date: Joi.date().iso().optional(),
    end_date: Joi.date().iso().min(Joi.ref('start_date')).optional(),
    campaign_id: Joi.number().integer().positive().optional(),
    user_id: Joi.number().integer().positive().optional(),
  }),
};

const donationStatisticsValidation = {
  query: Joi.object({
    start_date: Joi.date().iso().optional(),
    end_date: Joi.date().iso().min(Joi.ref('start_date')).optional(),
    campaign_id: Joi.number().integer().positive().optional(),
    user_id: Joi.number().integer().positive().optional(),
  }),
};

// Public routes
router.get('/config', paymentController.getPaymentConfig);

// Webhook route (no authentication required, signature verified internally)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

// Protected routes with optional authentication (for guest donations)
router.post('/donations/create-order', 
  optionalAuth, 
  validate(createDonationOrderValidation), 
  paymentController.createDonationOrder
);

router.post('/verify', 
  optionalAuth, 
  validate(verifyPaymentValidation), 
  paymentController.verifyPayment
);

// Protected routes (require authentication)
router.use(authenticateToken);

// Product order creation (requires authentication)
router.post('/orders/create-order', 
  validate(createProductOrderValidation), 
  paymentController.createProductOrder
);

// User's payment history
router.get('/donations', 
  validate(paginationValidation), 
  paymentController.getDonationHistory
);

// Donation statistics endpoint - must come before /:id route
router.get('/donations/statistics', 
  validate(donationStatisticsValidation), 
  paymentController.getDonationStatistics
);

router.get('/donations/:id', 
  validate(commonValidations.uuidParam), 
  paymentController.getDonation
);

router.get('/orders', 
  validate(paginationValidation), 
  paymentController.getOrderHistory
);

router.get('/orders/:id', 
  validate(commonValidations.uuidParam), 
  paymentController.getOrder
);

// Payment statistics
router.get('/statistics', 
  validate(statisticsValidation), 
  paymentController.getPaymentStatistics
);

// Admin routes
router.post('/refunds', 
  requireAdmin, 
  validate(createRefundValidation), 
  paymentController.createRefund
);

module.exports = router;