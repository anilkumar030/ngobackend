const { razorpayUtils } = require('../config/razorpay');
const { Donation, Campaign, Order } = require('../models');
const config = require('../config/environment');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const emailService = require('./emailService');

class PaymentService {
  /**
   * Create order for donation
   */
  async createDonationOrder(donationData) {
    try {
      const { userId, campaignId, amount, isAnonymous, message } = donationData;

      // Validate campaign
      const campaign = await Campaign.findByPk(campaignId);
      if (!campaign) {
        throw new AppError('Campaign not found', 404, true, 'CAMPAIGN_NOT_FOUND');
      }

      if (campaign.status !== 'active') {
        throw new AppError('Campaign is not active', 400, true, 'CAMPAIGN_NOT_ACTIVE');
      }

      if (new Date() > campaign.end_date) {
        throw new AppError('Campaign has ended', 400, true, 'CAMPAIGN_ENDED');
      }

      // Check minimum donation amount
      if (amount < campaign.min_donation) {
        throw new AppError(
          `Minimum donation amount is ₹${campaign.min_donation}`,
          400,
          true,
          'AMOUNT_TOO_LOW'
        );
      }

      // Convert amount to smallest currency unit (paise)
      const amountInPaise = razorpayUtils.convertToSmallestUnit(amount);

      // Generate receipt ID
      const receiptId = razorpayUtils.generateReceiptId('DON');

      // Create Razorpay order
      const orderResult = await razorpayUtils.createOrder({
        amount: amountInPaise,
        currency: config.app.currency,
        receipt: receiptId,
        notes: {
          type: 'donation',
          campaignId: campaignId.toString(),
          userId: userId?.toString(),
          isAnonymous: isAnonymous.toString(),
        },
      });

      if (!orderResult.success) {
        throw new AppError('Failed to create payment order', 500, true, 'ORDER_CREATION_FAILED');
      }

      // Create donation record with pending status
      const donation = await Donation.create({
        user_id: userId,
        campaign_id: campaignId,
        amount: amount,
        is_anonymous: isAnonymous,
        message: message,
        payment_method: 'razorpay',
        payment_status: 'pending',
        razorpay_order_id: orderResult.order.id,
        receipt_id: receiptId,
        currency: config.app.currency,
      });

      logger.contextLogger.payment('Donation order created', orderResult.order.id, amount, {
        donationId: donation.id,
        campaignId,
        userId,
      });

      return {
        donation,
        razorpayOrder: orderResult.order,
        key: config.razorpay.keyId,
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.logError(error, { service: 'PaymentService', method: 'createDonationOrder' });
      throw new AppError('Failed to create donation order', 500);
    }
  }

  /**
   * Create order for product purchase
   */
  async createProductOrder(orderData) {
    try {
      const { userId, items, shippingAddress, billingAddress } = orderData;

      // Calculate total amount
      let totalAmount = 0;
      const orderItems = [];

      for (const item of items) {
        const product = await require('../models').Product.findByPk(item.productId);
        if (!product) {
          throw new AppError(`Product not found: ${item.productId}`, 404, true, 'PRODUCT_NOT_FOUND');
        }

        if (!product.is_available) {
          throw new AppError(`Product not available: ${product.name}`, 400, true, 'PRODUCT_NOT_AVAILABLE');
        }

        if (product.stock_quantity < item.quantity) {
          throw new AppError(
            `Insufficient stock for ${product.name}. Available: ${product.stock_quantity}`,
            400,
            true,
            'INSUFFICIENT_STOCK'
          );
        }

        const itemTotal = product.price * item.quantity;
        totalAmount += itemTotal;

        orderItems.push({
          product_id: product.id,
          quantity: item.quantity,
          price: product.price,
          total: itemTotal,
        });
      }

      // Convert amount to smallest currency unit (paise)
      const amountInPaise = razorpayUtils.convertToSmallestUnit(totalAmount);

      // Generate receipt ID
      const receiptId = razorpayUtils.generateReceiptId('ORD');

      // Create Razorpay order
      const orderResult = await razorpayUtils.createOrder({
        amount: amountInPaise,
        currency: config.app.currency,
        receipt: receiptId,
        notes: {
          type: 'product_order',
          userId: userId.toString(),
          itemCount: items.length.toString(),
        },
      });

      if (!orderResult.success) {
        throw new AppError('Failed to create payment order', 500, true, 'ORDER_CREATION_FAILED');
      }

      // Create order record
      const order = await Order.create({
        user_id: userId,
        total_amount: totalAmount,
        payment_method: 'razorpay',
        payment_status: 'pending',
        order_status: 'pending',
        razorpay_order_id: orderResult.order.id,
        receipt_id: receiptId,
        shipping_address: shippingAddress,
        billing_address: billingAddress,
        currency: config.app.currency,
      });

      // Create order items
      for (const item of orderItems) {
        await require('../models').OrderItem.create({
          order_id: order.id,
          ...item,
        });
      }

      logger.contextLogger.payment('Product order created', orderResult.order.id, totalAmount, {
        orderId: order.id,
        userId,
        itemCount: items.length,
      });

      return {
        order,
        razorpayOrder: orderResult.order,
        key: config.razorpay.keyId,
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.logError(error, { service: 'PaymentService', method: 'createProductOrder' });
      throw new AppError('Failed to create product order', 500);
    }
  }

  /**
   * Verify payment and update records
   */
  async verifyPayment(paymentData) {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = paymentData;

      // Verify payment signature
      const verificationResult = razorpayUtils.verifyPaymentSignature({
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
      });

      if (!verificationResult.success || !verificationResult.verified) {
        logger.contextLogger.security('Payment signature verification failed', 'error', {
          razorpay_payment_id,
          razorpay_order_id,
        });
        throw new AppError('Payment verification failed', 400, true, 'PAYMENT_VERIFICATION_FAILED');
      }

      // Fetch payment details from Razorpay
      const paymentResult = await razorpayUtils.fetchPayment(razorpay_payment_id);
      if (!paymentResult.success) {
        throw new AppError('Failed to fetch payment details', 500, true, 'PAYMENT_FETCH_FAILED');
      }

      const payment = paymentResult.payment;

      // Determine if this is a donation or order
      const orderType = payment.notes?.type;

      if (orderType === 'donation') {
        return await this.processDonationPayment(payment);
      } else if (orderType === 'product_order') {
        return await this.processProductOrderPayment(payment);
      } else {
        throw new AppError('Unknown payment type', 400, true, 'UNKNOWN_PAYMENT_TYPE');
      }

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.logError(error, { service: 'PaymentService', method: 'verifyPayment' });
      throw new AppError('Payment verification failed', 500);
    }
  }

  /**
   * Process donation payment
   */
  async processDonationPayment(payment) {
    try {
      // Find donation by Razorpay order ID
      const donation = await Donation.findOne({
        where: { razorpay_order_id: payment.order_id },
        include: [
          {
            model: Campaign,
            as: 'campaign',
          },
          {
            model: require('../models').User,
            as: 'user',
          },
        ],
      });

      if (!donation) {
        throw new AppError('Donation not found', 404, true, 'DONATION_NOT_FOUND');
      }

      if (donation.payment_status === 'completed') {
        return { donation, alreadyProcessed: true };
      }

      // Update donation record
      await donation.update({
        payment_status: 'completed',
        razorpay_payment_id: payment.id,
        paid_at: new Date(),
        payment_data: {
          method: payment.method,
          bank: payment.bank,
          wallet: payment.wallet,
          vpa: payment.vpa,
          card_id: payment.card_id,
        },
      });

      // Update campaign's current amount
      await Campaign.increment(
        'current_amount',
        {
          by: donation.amount,
          where: { id: donation.campaign_id },
        }
      );

      // Send confirmation email
      if (donation.user && !donation.is_anonymous) {
        await emailService.sendDonationConfirmation(
          donation.user.email,
          {
            donationId: donation.id,
            amount: donation.amount,
            campaignTitle: donation.campaign.title,
            donorName: `${donation.user.first_name} ${donation.user.last_name}`,
          }
        );
      }

      logger.contextLogger.payment('Donation payment processed', payment.id, donation.amount, {
        donationId: donation.id,
        campaignId: donation.campaign_id,
        userId: donation.user_id,
      });

      return { donation, alreadyProcessed: false };

    } catch (error) {
      logger.logError(error, { service: 'PaymentService', method: 'processDonationPayment' });
      throw error;
    }
  }

  /**
   * Process product order payment
   */
  async processProductOrderPayment(payment) {
    try {
      // Find order by Razorpay order ID
      const order = await Order.findOne({
        where: { razorpay_order_id: payment.order_id },
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
            model: require('../models').User,
            as: 'user',
          },
        ],
      });

      if (!order) {
        throw new AppError('Order not found', 404, true, 'ORDER_NOT_FOUND');
      }

      if (order.payment_status === 'paid') {
        return { order, alreadyProcessed: true };
      }

      // Update order record
      await order.update({
        payment_status: 'completed',
        order_status: 'confirmed',
        razorpay_payment_id: payment.id,
        paid_at: new Date(),
        payment_data: {
          method: payment.method,
          bank: payment.bank,
          wallet: payment.wallet,
          vpa: payment.vpa,
          card_id: payment.card_id,
        },
      });

      // Update product stock
      for (const item of order.items) {
        await item.product.decrement('stock_quantity', {
          by: item.quantity,
        });
      }

      // Send order confirmation email
      await emailService.sendOrderConfirmation(
        order.user.email,
        {
          orderId: order.id,
          totalAmount: order.total_amount,
          items: order.items,
          customerName: `${order.user.first_name} ${order.user.last_name}`,
        }
      );

      logger.contextLogger.payment('Product order payment processed', payment.id, order.total_amount, {
        orderId: order.id,
        userId: order.user_id,
        itemCount: order.items.length,
      });

      return { order, alreadyProcessed: false };

    } catch (error) {
      logger.logError(error, { service: 'PaymentService', method: 'processProductOrderPayment' });
      throw error;
    }
  }

  /**
   * Handle payment webhook
   */
  async handleWebhook(body, signature) {
    try {
      // Verify webhook signature
      const verificationResult = razorpayUtils.verifyWebhookSignature(body, signature);
      
      if (!verificationResult.success || !verificationResult.verified) {
        logger.contextLogger.security('Webhook signature verification failed', 'error', {
          signature,
        });
        throw new AppError('Webhook verification failed', 400, true, 'WEBHOOK_VERIFICATION_FAILED');
      }

      const event = body.event;
      const paymentEntity = body.payload?.payment?.entity;
      const orderEntity = body.payload?.order?.entity;

      logger.contextLogger.webhook('razorpay', event, {
        paymentId: paymentEntity?.id,
        orderId: orderEntity?.id,
      });

      switch (event) {
        case 'payment.captured':
          return await this.handlePaymentCaptured(paymentEntity);
        
        case 'payment.failed':
          return await this.handlePaymentFailed(paymentEntity);
        
        case 'order.paid':
          return await this.handleOrderPaid(orderEntity);
        
        default:
          logger.info(`Unhandled webhook event: ${event}`);
          return { handled: false, event };
      }

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.logError(error, { service: 'PaymentService', method: 'handleWebhook' });
      throw new AppError('Webhook processing failed', 500);
    }
  }

  /**
   * Handle payment captured webhook
   */
  async handlePaymentCaptured(paymentEntity) {
    try {
      if (!paymentEntity) {
        throw new AppError('Payment entity missing from webhook', 400);
      }

      // Process payment verification
      await this.verifyPayment({
        razorpay_payment_id: paymentEntity.id,
        razorpay_order_id: paymentEntity.order_id,
        razorpay_signature: 'webhook', // Mark as webhook processing
      });

      return { handled: true, paymentId: paymentEntity.id };

    } catch (error) {
      logger.logError(error, { 
        service: 'PaymentService', 
        method: 'handlePaymentCaptured',
        paymentId: paymentEntity?.id 
      });
      throw error;
    }
  }

  /**
   * Handle payment failed webhook
   */
  async handlePaymentFailed(paymentEntity) {
    try {
      if (!paymentEntity) {
        throw new AppError('Payment entity missing from webhook', 400);
      }

      // Find and update donation/order status
      const donation = await Donation.findOne({
        where: { razorpay_order_id: paymentEntity.order_id },
      });

      if (donation) {
        await donation.update({
          payment_status: 'failed',
          razorpay_payment_id: paymentEntity.id,
          failure_reason: paymentEntity.error_description,
        });

        logger.contextLogger.payment('Donation payment failed', paymentEntity.id, donation.amount, {
          donationId: donation.id,
          reason: paymentEntity.error_description,
        });
      }

      const order = await Order.findOne({
        where: { razorpay_order_id: paymentEntity.order_id },
      });

      if (order) {
        await order.update({
          payment_status: 'failed',
          order_status: 'cancelled',
          razorpay_payment_id: paymentEntity.id,
          failure_reason: paymentEntity.error_description,
        });

        logger.contextLogger.payment('Order payment failed', paymentEntity.id, order.total_amount, {
          orderId: order.id,
          reason: paymentEntity.error_description,
        });
      }

      return { handled: true, paymentId: paymentEntity.id };

    } catch (error) {
      logger.logError(error, { 
        service: 'PaymentService', 
        method: 'handlePaymentFailed',
        paymentId: paymentEntity?.id 
      });
      throw error;
    }
  }

  /**
   * Handle order paid webhook
   */
  async handleOrderPaid(orderEntity) {
    try {
      if (!orderEntity) {
        throw new AppError('Order entity missing from webhook', 400);
      }

      // This is typically handled by payment.captured event
      // But we can add additional logic here if needed

      logger.contextLogger.webhook('razorpay', 'order.paid', {
        orderId: orderEntity.id,
        amount: orderEntity.amount,
      });

      return { handled: true, orderId: orderEntity.id };

    } catch (error) {
      logger.logError(error, { 
        service: 'PaymentService', 
        method: 'handleOrderPaid',
        orderId: orderEntity?.id 
      });
      throw error;
    }
  }

  /**
   * Create refund
   */
  async createRefund(paymentId, amount, reason) {
    try {
      const amountInPaise = razorpayUtils.convertToSmallestUnit(amount);
      
      const refundResult = await razorpayUtils.createRefund(paymentId, amountInPaise, {
        reason,
        created_at: new Date().toISOString(),
      });

      if (!refundResult.success) {
        throw new AppError('Failed to create refund', 500, true, 'REFUND_CREATION_FAILED');
      }

      logger.contextLogger.payment('Refund created', refundResult.refund.id, amount, {
        paymentId,
        reason,
      });

      return refundResult.refund;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.logError(error, { service: 'PaymentService', method: 'createRefund' });
      throw new AppError('Refund creation failed', 500);
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStatistics(filters = {}) {
    try {
      const { startDate, endDate, campaignId, userId } = filters;
      const { sequelize } = require('../config/database');

      // Database queries will handle connection errors gracefully

      // Build where conditions
      const whereConditions = {
        payment_status: 'completed',
      };

      // Use completed_at instead of paid_at (which doesn't exist in the model)
      if (startDate && endDate) {
        whereConditions.completed_at = {
          [require('sequelize').Op.between]: [startDate, endDate],
        };
      }

      if (campaignId) {
        whereConditions.campaign_id = campaignId;
      }

      if (userId) {
        whereConditions.user_id = userId;
      }

      // Get donation statistics
      const donationStats = await Donation.findOne({
        where: whereConditions,
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalDonations'],
          [sequelize.fn('SUM', sequelize.col('donation_amount')), 'totalAmountPaise'],
          [sequelize.fn('AVG', sequelize.col('donation_amount')), 'averageAmountPaise'],
          [sequelize.fn('SUM', sequelize.col('tip_amount')), 'totalTipsPaise'],
          [sequelize.fn('SUM', sequelize.col('total_amount')), 'totalWithTipsPaise']
        ],
        raw: true,
      });

      // Get payment method breakdown
      const paymentMethodStats = await Donation.findAll({
        where: whereConditions,
        attributes: [
          'payment_method',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('donation_amount')), 'totalPaise']
        ],
        group: ['payment_method'],
        raw: true,
      });

      // Get time-based statistics (last 30 days)
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);
      
      const recentStats = await Donation.findAll({
        where: {
          ...whereConditions,
          completed_at: {
            [require('sequelize').Op.gte]: last30Days
          }
        },
        attributes: [
          [sequelize.fn('DATE', sequelize.col('completed_at')), 'date'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('donation_amount')), 'dailyTotalPaise']
        ],
        group: [sequelize.fn('DATE', sequelize.col('completed_at'))],
        order: [[sequelize.fn('DATE', sequelize.col('completed_at')), 'DESC']],
        raw: true,
      });

      // Format the response
      const stats = {
        donations: {
          totalDonations: parseInt(donationStats.totalDonations) || 0,
          totalAmount: Math.round((donationStats.totalAmountPaise || 0) / 100),
          averageAmount: Math.round((donationStats.averageAmountPaise || 0) / 100),
          totalTips: Math.round((donationStats.totalTipsPaise || 0) / 100),
          totalWithTips: Math.round((donationStats.totalWithTipsPaise || 0) / 100)
        },
        paymentMethods: paymentMethodStats.map(method => ({
          method: method.payment_method || 'unknown',
          count: parseInt(method.count),
          totalAmount: Math.round((method.totalPaise || 0) / 100)
        })),
        recentActivity: recentStats.map(day => ({
          date: day.date,
          count: parseInt(day.count),
          totalAmount: Math.round((day.dailyTotalPaise || 0) / 100)
        })),
        filters: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          campaignId,
          userId
        }
      };

      return stats;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      // Check if it's a database connection error
      if (error.name === 'SequelizeConnectionError' || 
          error.name === 'SequelizeHostNotFoundError' ||
          error.name === 'SequelizeAccessDeniedError') {
        logger.error('Database connection error in getPaymentStatistics:', error);
        throw new AppError('Database connection failed', 503, true, 'DATABASE_CONNECTION_ERROR');
      }
      
      logger.logError(error, { service: 'PaymentService', method: 'getPaymentStatistics' });
      throw new AppError('Failed to get payment statistics', 500, true, 'STATISTICS_FETCH_FAILED');
    }
  }

  /**
   * Get donation-specific statistics
   */
  async getDonationStatistics(filters = {}) {
    try {
      const { startDate, endDate, campaignId, userId } = filters;
      const { sequelize } = require('../config/database');
      
      // Build where conditions for donations only
      const whereConditions = {
        payment_status: 'completed',
      };

      if (startDate && endDate) {
        whereConditions.completed_at = {
          [require('sequelize').Op.between]: [startDate, endDate],
        };
      }

      if (campaignId) {
        whereConditions.campaign_id = campaignId;
      }

      if (userId) {
        whereConditions.user_id = userId;
      }

      // Get donation statistics
      const donationStats = await Donation.findOne({
        where: whereConditions,
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalDonations'],
          [sequelize.fn('SUM', sequelize.col('donation_amount')), 'totalAmountPaise'],
          [sequelize.fn('AVG', sequelize.col('donation_amount')), 'averageAmountPaise'],
          [sequelize.fn('MIN', sequelize.col('donation_amount')), 'minAmountPaise'],
          [sequelize.fn('MAX', sequelize.col('donation_amount')), 'maxAmountPaise'],
          [sequelize.fn('SUM', sequelize.col('tip_amount')), 'totalTipsPaise'],
          [sequelize.fn('SUM', sequelize.col('total_amount')), 'totalWithTipsPaise']
        ],
        raw: true,
      });

      // Get campaign-wise breakdown
      const campaignStats = await Donation.findAll({
        where: whereConditions,
        include: [
          {
            model: require('../models').Campaign,
            as: 'campaign',
            attributes: ['id', 'title', 'slug'],
          },
        ],
        attributes: [
          'campaign_id',
          [sequelize.fn('COUNT', sequelize.col('Donation.id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('donation_amount')), 'totalPaise'],
          [sequelize.fn('AVG', sequelize.col('donation_amount')), 'averagePaise']
        ],
        group: ['campaign_id', 'campaign.id', 'campaign.title', 'campaign.slug'],
        order: [[sequelize.fn('SUM', sequelize.col('donation_amount')), 'DESC']],
        raw: false,
      });

      // Get payment method breakdown for donations
      const paymentMethodStats = await Donation.findAll({
        where: whereConditions,
        attributes: [
          'payment_method',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('donation_amount')), 'totalPaise']
        ],
        group: ['payment_method'],
        order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
        raw: true,
      });

      // Get anonymous vs non-anonymous breakdown
      const anonymityStats = await Donation.findAll({
        where: whereConditions,
        attributes: [
          'is_anonymous',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('donation_amount')), 'totalPaise']
        ],
        group: ['is_anonymous'],
        raw: true,
      });

      // Get time-based statistics (last 30 days)
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);
      
      const recentStats = await Donation.findAll({
        where: {
          ...whereConditions,
          completed_at: {
            [require('sequelize').Op.gte]: last30Days
          }
        },
        attributes: [
          [sequelize.fn('DATE', sequelize.col('completed_at')), 'date'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('donation_amount')), 'dailyTotalPaise']
        ],
        group: [sequelize.fn('DATE', sequelize.col('completed_at'))],
        order: [[sequelize.fn('DATE', sequelize.col('completed_at')), 'DESC']],
        raw: true,
      });

      // Format the response
      const stats = {
        donations: {
          totalDonations: parseInt(donationStats.totalDonations) || 0,
          totalAmount: Math.round((donationStats.totalAmountPaise || 0) / 100),
          averageAmount: Math.round((donationStats.averageAmountPaise || 0) / 100),
          minAmount: Math.round((donationStats.minAmountPaise || 0) / 100),
          maxAmount: Math.round((donationStats.maxAmountPaise || 0) / 100),
          totalTips: Math.round((donationStats.totalTipsPaise || 0) / 100),
          totalWithTips: Math.round((donationStats.totalWithTipsPaise || 0) / 100)
        },
        campaigns: campaignStats.map(campaign => ({
          campaign_id: campaign.campaign_id,
          campaign_title: campaign.campaign?.title || 'Unknown Campaign',
          campaign_slug: campaign.campaign?.slug || null,
          count: parseInt(campaign.get('count')),
          totalAmount: Math.round((campaign.get('totalPaise') || 0) / 100),
          averageAmount: Math.round((campaign.get('averagePaise') || 0) / 100)
        })),
        paymentMethods: paymentMethodStats.map(method => ({
          method: method.payment_method || 'unknown',
          count: parseInt(method.count),
          totalAmount: Math.round((method.totalPaise || 0) / 100)
        })),
        anonymity: anonymityStats.map(stats => ({
          is_anonymous: Boolean(stats.is_anonymous),
          count: parseInt(stats.count),
          totalAmount: Math.round((stats.totalPaise || 0) / 100)
        })),
        recentActivity: recentStats.map(day => ({
          date: day.date,
          count: parseInt(day.count),
          totalAmount: Math.round((day.dailyTotalPaise || 0) / 100)
        })),
        filters: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          campaignId,
          userId
        }
      };

      return stats;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      // Check if it's a database connection error
      if (error.name === 'SequelizeConnectionError' || 
          error.name === 'SequelizeHostNotFoundError' ||
          error.name === 'SequelizeAccessDeniedError') {
        logger.error('Database connection error in getDonationStatistics:', error);
        throw new AppError('Database connection failed', 503, true, 'DATABASE_CONNECTION_ERROR');
      }
      
      logger.logError(error, { service: 'PaymentService', method: 'getDonationStatistics' });
      throw new AppError('Failed to get donation statistics', 500, true, 'DONATION_STATISTICS_FETCH_FAILED');
    }
  }
}

module.exports = new PaymentService();