const Razorpay = require('razorpay');
const crypto = require('crypto');
const config = require('./environment');
const logger = require('../utils/logger');

// Initialize Razorpay instance
const razorpayInstance = new Razorpay({
  key_id: config.razorpay.keyId,
  key_secret: config.razorpay.keySecret,
});

// Razorpay utilities
const razorpayUtils = {
  // Create order
  async createOrder(orderOptions) {
    try {
      const options = {
        amount: orderOptions.amount, // amount in smallest currency unit (paise)
        currency: orderOptions.currency || config.app.currency,
        receipt: orderOptions.receipt,
        notes: orderOptions.notes || {},
      };

      const order = await razorpayInstance.orders.create(options);
      logger.info(`Razorpay order created: ${order.id}`);
      
      return {
        success: true,
        order,
      };
    } catch (error) {
      logger.error('Razorpay create order error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Verify payment signature
  verifyPaymentSignature(paymentData) {
    try {
      const { 
        razorpay_order_id, 
        razorpay_payment_id, 
        razorpay_signature 
      } = paymentData;

      // Create expected signature
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', config.razorpay.keySecret)
        .update(body.toString())
        .digest('hex');

      // Compare signatures
      const isSignatureValid = expectedSignature === razorpay_signature;
      
      if (isSignatureValid) {
        logger.info(`Payment signature verified: ${razorpay_payment_id}`);
        return { success: true, verified: true };
      } else {
        logger.warn(`Payment signature verification failed: ${razorpay_payment_id}`);
        return { success: false, verified: false, error: 'Invalid signature' };
      }
    } catch (error) {
      logger.error('Payment signature verification error:', error);
      return { success: false, verified: false, error: error.message };
    }
  },

  // Verify webhook signature
  verifyWebhookSignature(body, signature) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', config.razorpay.webhookSecret)
        .update(JSON.stringify(body))
        .digest('hex');

      const isSignatureValid = expectedSignature === signature;
      
      if (isSignatureValid) {
        logger.info('Webhook signature verified');
        return { success: true, verified: true };
      } else {
        logger.warn('Webhook signature verification failed');
        return { success: false, verified: false, error: 'Invalid webhook signature' };
      }
    } catch (error) {
      logger.error('Webhook signature verification error:', error);
      return { success: false, verified: false, error: error.message };
    }
  },

  // Fetch payment details
  async fetchPayment(paymentId) {
    try {
      const payment = await razorpayInstance.payments.fetch(paymentId);
      logger.info(`Payment details fetched: ${paymentId}`);
      
      return {
        success: true,
        payment,
      };
    } catch (error) {
      logger.error(`Fetch payment error for ${paymentId}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Fetch order details
  async fetchOrder(orderId) {
    try {
      const order = await razorpayInstance.orders.fetch(orderId);
      logger.info(`Order details fetched: ${orderId}`);
      
      return {
        success: true,
        order,
      };
    } catch (error) {
      logger.error(`Fetch order error for ${orderId}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Capture payment
  async capturePayment(paymentId, amount, currency = config.app.currency) {
    try {
      const capturedPayment = await razorpayInstance.payments.capture(
        paymentId, 
        amount, 
        currency
      );
      
      logger.info(`Payment captured: ${paymentId}`);
      
      return {
        success: true,
        payment: capturedPayment,
      };
    } catch (error) {
      logger.error(`Capture payment error for ${paymentId}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Refund payment
  async createRefund(paymentId, amount, notes = {}) {
    try {
      const refundOptions = {
        amount, // amount in smallest currency unit (paise)
        notes,
      };

      const refund = await razorpayInstance.payments.refund(paymentId, refundOptions);
      logger.info(`Refund created: ${refund.id} for payment: ${paymentId}`);
      
      return {
        success: true,
        refund,
      };
    } catch (error) {
      logger.error(`Create refund error for payment ${paymentId}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Get refund details
  async fetchRefund(paymentId, refundId) {
    try {
      const refund = await razorpayInstance.refunds.fetch(refundId, {
        payment_id: paymentId,
      });
      
      logger.info(`Refund details fetched: ${refundId}`);
      
      return {
        success: true,
        refund,
      };
    } catch (error) {
      logger.error(`Fetch refund error for ${refundId}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Create customer
  async createCustomer(customerData) {
    try {
      const customer = await razorpayInstance.customers.create(customerData);
      logger.info(`Customer created: ${customer.id}`);
      
      return {
        success: true,
        customer,
      };
    } catch (error) {
      logger.error('Create customer error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Utility to convert amount to smallest currency unit
  convertToSmallestUnit(amount, currency = config.app.currency) {
    // For INR, convert rupees to paise
    if (currency === 'INR') {
      return Math.round(amount * 100);
    }
    // Add other currency conversions as needed
    return Math.round(amount * 100); // Default to 2 decimal places
  },

  // Utility to convert amount from smallest currency unit
  convertFromSmallestUnit(amount, currency = config.app.currency) {
    // For INR, convert paise to rupees
    if (currency === 'INR') {
      return amount / 100;
    }
    // Add other currency conversions as needed
    return amount / 100; // Default to 2 decimal places
  },

  // Generate receipt ID
  generateReceiptId(prefix = (process.env.PROJECT_NAME || 'Shiv Dhaam Foundation').toUpperCase().replace(/\s+/g, '_')) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  },
};

// Payment status constants
const PAYMENT_STATUS = {
  CREATED: 'created',
  AUTHORIZED: 'authorized',
  CAPTURED: 'captured',
  REFUNDED: 'refunded',
  FAILED: 'failed',
};

// Order status constants
const ORDER_STATUS = {
  CREATED: 'created',
  ATTEMPTED: 'attempted',
  PAID: 'paid',
};

// Webhook events
const WEBHOOK_EVENTS = {
  ORDER_PAID: 'order.paid',
  PAYMENT_AUTHORIZED: 'payment.authorized',
  PAYMENT_CAPTURED: 'payment.captured',
  PAYMENT_FAILED: 'payment.failed',
  REFUND_CREATED: 'refund.created',
  REFUND_PROCESSED: 'refund.processed',
};

module.exports = {
  razorpayInstance,
  razorpayUtils,
  PAYMENT_STATUS,
  ORDER_STATUS,
  WEBHOOK_EVENTS,
};