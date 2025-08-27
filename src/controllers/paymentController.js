const paymentService = require('../services/paymentService');
const { Donation, Order, Campaign, User } = require('../models');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { razorpayUtils } = require('../config/razorpay');
const logger = require('../utils/logger');

/**
 * Create donation payment order
 */
const createDonationOrder = catchAsync(async (req, res) => {
  const { campaignId, amount, isAnonymous = false, message } = req.body;
  const userId = req.user?.id;

  if (!campaignId || !amount) {
    throw new AppError('Campaign ID and amount are required', 400, true, 'MISSING_REQUIRED_FIELDS');
  }

  if (amount <= 0) {
    throw new AppError('Amount must be greater than 0', 400, true, 'INVALID_AMOUNT');
  }

  const result = await paymentService.createDonationOrder({
    userId,
    campaignId,
    amount: parseFloat(amount),
    isAnonymous: Boolean(isAnonymous),
    message: message || null,
  });

  res.status(201).json({
    success: true,
    message: 'Donation order created successfully',
    data: {
      order: {
        id: result.razorpayOrder.id,
        amount: result.razorpayOrder.amount,
        currency: result.razorpayOrder.currency,
        receipt: result.razorpayOrder.receipt,
      },
      donation: {
        id: result.donation.id,
        amount: result.donation.amount,
        campaign_id: result.donation.campaign_id,
        is_anonymous: result.donation.is_anonymous,
      },
      payment_config: {
        key: result.key,
        order_id: result.razorpayOrder.id,
        currency: result.razorpayOrder.currency,
      },
    },
  });
});

/**
 * Create product order
 */
const createProductOrder = catchAsync(async (req, res) => {
  const { items, shippingAddress, billingAddress } = req.body;
  const userId = req.user.id;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError('Order items are required', 400, true, 'MISSING_ORDER_ITEMS');
  }

  if (!shippingAddress) {
    throw new AppError('Shipping address is required', 400, true, 'MISSING_SHIPPING_ADDRESS');
  }

  const result = await paymentService.createProductOrder({
    userId,
    items,
    shippingAddress,
    billingAddress: billingAddress || shippingAddress,
  });

  res.status(201).json({
    success: true,
    message: 'Product order created successfully',
    data: {
      order: {
        id: result.razorpayOrder.id,
        amount: result.razorpayOrder.amount,
        currency: result.razorpayOrder.currency,
        receipt: result.razorpayOrder.receipt,
      },
      order_details: {
        id: result.order.id,
        total_amount: result.order.total_amount,
        order_status: result.order.order_status,
      },
      payment_config: {
        key: result.key,
        order_id: result.razorpayOrder.id,
        currency: result.razorpayOrder.currency,
      },
    },
  });
});

/**
 * Verify payment
 */
const verifyPayment = catchAsync(async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    throw new AppError('Payment verification data is incomplete', 400, true, 'INCOMPLETE_PAYMENT_DATA');
  }

  const result = await paymentService.verifyPayment({
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
  });

  const responseData = {
    success: true,
    message: result.alreadyProcessed 
      ? 'Payment already processed' 
      : 'Payment verified successfully',
    data: {
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      verified: true,
      already_processed: result.alreadyProcessed,
    },
  };

  if (result.donation) {
    responseData.data.donation = {
      id: result.donation.id,
      amount: result.donation.amount,
      campaign_id: result.donation.campaign_id,
      status: result.donation.payment_status,
    };
  }

  if (result.order) {
    responseData.data.order = {
      id: result.order.id,
      total_amount: result.order.total_amount,
      order_status: result.order.order_status,
      payment_status: result.order.payment_status,
    };
  }

  res.status(200).json(responseData);
});

/**
 * Handle Razorpay webhook
 */
const handleWebhook = catchAsync(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const body = req.body;

  if (!signature) {
    throw new AppError('Webhook signature missing', 400, true, 'MISSING_SIGNATURE');
  }

  const result = await paymentService.handleWebhook(body, signature);

  res.status(200).json({
    success: true,
    message: 'Webhook processed successfully',
    data: result,
  });
});

/**
 * Get donation by ID
 */
const getDonation = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const donation = await Donation.findByPk(id, {
    include: [
      {
        model: Campaign,
        as: 'campaign',
        attributes: ['id', 'title', 'slug'],
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name', 'email'],
      },
    ],
  });

  if (!donation) {
    throw new AppError('Donation not found', 404, true, 'DONATION_NOT_FOUND');
  }

  // Check permissions (user can view their own donations, admins can view all)
  if (donation.user_id !== userId && 
      !req.user || 
      !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to view this donation', 403, true, 'NOT_AUTHORIZED');
  }

  res.status(200).json({
    success: true,
    data: {
      donation,
    },
  });
});

/**
 * Get user's donation history (or all donations for admin/super_admin)
 */
const getDonationHistory = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, status, campaign_id, sort_by = 'created_at', sort_order = 'DESC' } = req.query;
  const userId = req.user.id;
  const userRole = req.user.role;
  const offset = (page - 1) * limit;

  // Build where conditions
  const whereConditions = {};

  // Admin and super_admin can see all donations, regular users only see their own
  if (!['admin', 'super_admin'].includes(userRole)) {
    whereConditions.user_id = userId;
  }

  if (status) {
    whereConditions.payment_status = status;
  }

  if (campaign_id) {
    whereConditions.campaign_id = campaign_id;
  }

  // Validate sort parameters (additional validation since Joi handles most of this)
  const validSortFields = ['created_at', 'updated_at', 'amount', 'status', 'payment_status'];
  const validSortOrders = ['ASC', 'DESC'];
  
  const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
  const sortDirection = validSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'DESC';

  const { count, rows: donations } = await Donation.findAndCountAll({
    where: whereConditions,
    include: [
      {
        model: Campaign,
        as: 'campaign',
        attributes: ['id', 'title', 'slug'],
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name', 'email'],
      },
    ],
    order: [[sortField, sortDirection]],
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
      filters: {
        status,
        campaign_id,
        sort_by: sortField,
        sort_order: sortDirection,
        user_access_level: userRole === 'super_admin' || userRole === 'admin' ? 'all_donations' : 'own_donations'
      }
    },
  });
});

/**
 * Get order by ID
 */
const getOrder = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const order = await Order.findByPk(id, {
    include: [
      {
        model: require('../models').OrderItem,
        as: 'items',
        include: [
          {
            model: require('../models').Product,
            as: 'product',
          },
        ],
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name', 'email'],
      },
    ],
  });

  if (!order) {
    throw new AppError('Order not found', 404, true, 'ORDER_NOT_FOUND');
  }

  // Check permissions
  if (order.user_id !== userId && 
      !req.user || 
      !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to view this order', 403, true, 'NOT_AUTHORIZED');
  }

  res.status(200).json({
    success: true,
    data: {
      order,
    },
  });
});

/**
 * Get user's order history
 */
const getOrderHistory = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, status, payment_status } = req.query;
  const userId = req.user.id;
  const offset = (page - 1) * limit;

  // Build where conditions
  const whereConditions = { user_id: userId };

  if (status) {
    whereConditions.order_status = status;
  }

  if (payment_status) {
    whereConditions.payment_status = payment_status;
  }

  const { count, rows: orders } = await Order.findAndCountAll({
    where: whereConditions,
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
 * Create refund
 */
const createRefund = catchAsync(async (req, res) => {
  const { payment_id, amount, reason } = req.body;

  if (!payment_id || !amount || !reason) {
    throw new AppError('Payment ID, amount, and reason are required', 400, true, 'MISSING_REQUIRED_FIELDS');
  }

  // Find the donation or order associated with this payment
  const donation = await Donation.findOne({
    where: { razorpay_payment_id: payment_id },
  });

  const order = await Order.findOne({
    where: { razorpay_payment_id: payment_id },
  });

  if (!donation && !order) {
    throw new AppError('Payment not found', 404, true, 'PAYMENT_NOT_FOUND');
  }

  // Check permissions (only admins can create refunds for now)
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to create refunds', 403, true, 'NOT_AUTHORIZED');
  }

  const refund = await paymentService.createRefund(payment_id, amount, reason);

  // Update the donation/order status
  if (donation) {
    await donation.update({
      payment_status: 'refunded',
      refund_id: refund.id,
      refund_amount: razorpayUtils.convertFromSmallestUnit(refund.amount),
      refund_reason: reason,
      refunded_at: new Date(),
    });
  }

  if (order) {
    await order.update({
      payment_status: 'refunded',
      order_status: 'refunded',
      refund_id: refund.id,
      refund_amount: razorpayUtils.convertFromSmallestUnit(refund.amount),
      refund_reason: reason,
      refunded_at: new Date(),
    });
  }

  res.status(201).json({
    success: true,
    message: 'Refund created successfully',
    data: {
      refund: {
        id: refund.id,
        amount: razorpayUtils.convertFromSmallestUnit(refund.amount),
        status: refund.status,
        created_at: refund.created_at,
      },
    },
  });
});

/**
 * Get donation-specific statistics
 */
const getDonationStatistics = catchAsync(async (req, res) => {
  const { 
    start_date, 
    end_date, 
    campaign_id, 
    user_id 
  } = req.query;

  // Check permissions for user_id filter
  if (user_id && user_id != req.user.id && 
      !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to view other users statistics', 403, true, 'NOT_AUTHORIZED');
  }

  const filters = {};

  if (start_date && end_date) {
    filters.startDate = new Date(start_date);
    filters.endDate = new Date(end_date);
  }

  if (campaign_id) {
    filters.campaignId = campaign_id;
  }

  if (user_id) {
    filters.userId = user_id;
  } else if (req.user.role === 'user') {
    // Regular users can only see their own statistics
    filters.userId = req.user.id;
  }

  const statistics = await paymentService.getDonationStatistics(filters);

  res.status(200).json({
    success: true,
    data: {
      statistics,
      filters: {
        start_date: filters.startDate?.toISOString(),
        end_date: filters.endDate?.toISOString(),
        campaign_id: filters.campaignId,
        user_id: filters.userId,
      },
    },
  });
});

/**
 * Get payment statistics
 */
const getPaymentStatistics = catchAsync(async (req, res) => {
  const { 
    start_date, 
    end_date, 
    campaign_id, 
    user_id 
  } = req.query;

  // Check permissions for user_id filter
  if (user_id && user_id != req.user.id && 
      !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to view other users statistics', 403, true, 'NOT_AUTHORIZED');
  }

  const filters = {};

  if (start_date && end_date) {
    filters.startDate = new Date(start_date);
    filters.endDate = new Date(end_date);
  }

  if (campaign_id) {
    filters.campaignId = campaign_id;
  }

  if (user_id) {
    filters.userId = user_id;
  } else if (req.user.role === 'user') {
    // Regular users can only see their own statistics
    filters.userId = req.user.id;
  }

  const statistics = await paymentService.getPaymentStatistics(filters);

  res.status(200).json({
    success: true,
    data: {
      statistics,
      filters: {
        start_date: filters.startDate?.toISOString(),
        end_date: filters.endDate?.toISOString(),
        campaign_id: filters.campaignId,
        user_id: filters.userId,
      },
    },
  });
});

/**
 * Get Razorpay configuration for frontend
 */
const getPaymentConfig = catchAsync(async (_, res) => {
  res.status(200).json({
    success: true,
    data: {
      razorpay_key: razorpayUtils.razorpayInstance.key_id,
      currency: require('../config/environment').app.currency,
      supported_methods: [
        'card',
        'netbanking',
        'wallet',
        'upi',
      ],
    },
  });
});

module.exports = {
  createDonationOrder,
  createProductOrder,
  verifyPayment,
  handleWebhook,
  getDonation,
  getDonationHistory,
  getDonationStatistics,
  getOrder,
  getOrderHistory,
  createRefund,
  getPaymentStatistics,
  getPaymentConfig,
};