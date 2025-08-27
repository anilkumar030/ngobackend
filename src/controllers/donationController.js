const { Donation, User, Campaign } = require('../models');
const { razorpayUtils } = require('../config/razorpay');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');
const authService = require('../services/authService');
const receiptService = require('../services/receiptService');
const Joi = require('joi');

/**
 * Validation schemas for donation endpoints
 */
const createOrderValidation = Joi.object({
  campaignId: Joi.string().uuid().optional().messages({
    'string.guid': 'Invalid campaign ID format. Must be a valid UUID',
    'string.base': 'Campaign ID must be a string'
  }),
  donationAmount: Joi.number().min(400).max(1000000).required().messages({
    'number.min': 'Donation amount must be at least ₹400',
    'number.max': 'Donation amount cannot exceed ₹10,00,000',
    'any.required': 'Donation amount is required'
  }),
  tipAmount: Joi.number().min(0).max(100000).required().messages({
    'number.min': 'Tip amount cannot be negative',
    'number.max': 'Tip amount cannot exceed ₹1,00,000',
    'any.required': 'Tip amount is required (can be 0)'
  }),
  totalAmount: Joi.number().min(400).max(1100000).required().messages({
    'number.min': 'Total amount must be at least ₹400',
    'number.max': 'Total amount cannot exceed ₹11,00,000',
    'any.required': 'Total amount is required'
  }),
  donationTowards: Joi.string().trim().min(3).max(255).required().messages({
    'string.min': 'Donation purpose must be at least 3 characters',
    'string.max': 'Donation purpose cannot exceed 255 characters',
    'any.required': 'Please specify what the donation is for'
  }),
  donorDetails: Joi.object({
    fullName: Joi.string().trim().min(2).max(255).required().messages({
      'string.min': 'Full name must be at least 2 characters',
      'string.max': 'Full name cannot exceed 255 characters',
      'any.required': 'Full name is required'
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    phone: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
      'string.pattern.base': 'Please provide a valid 10-digit phone number',
      'any.required': 'Phone number is required'
    }),
    panNumber: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i).optional().messages({
      'string.pattern.base': 'Please provide a valid PAN number (format: ABCDE1234F)'
    }),
    address: Joi.string().trim().max(500).optional().messages({
      'string.max': 'Address cannot exceed 500 characters'
    })
  }).required(),
  showNamePublicly: Joi.boolean().required().messages({
    'any.required': 'Please specify if you want your name displayed publicly'
  }),
  receiveWhatsAppUpdates: Joi.boolean().required().messages({
    'any.required': 'Please specify if you want to receive WhatsApp updates'
  }),
  howYouCanHelp: Joi.object({
    title: Joi.string().trim().min(1).max(255).required().messages({
      'string.min': 'Help option title must be at least 1 character',
      'string.max': 'Help option title cannot exceed 255 characters',
      'any.required': 'Help option title is required'
    }),
    amount: Joi.number().min(1).max(1000000).required().messages({
      'number.min': 'Help option amount must be at least ₹1',
      'number.max': 'Help option amount cannot exceed ₹10,00,000',
      'any.required': 'Help option amount is required'
    })
  }).optional().messages({
    'object.base': 'howYouCanHelp must be an object with title and amount'
  })
});

const confirmPaymentValidation = Joi.object({
  orderId: Joi.string().required().messages({
    'any.required': 'Order ID is required'
  }),
  paymentId: Joi.string().required().messages({
    'any.required': 'Payment ID is required'
  }),
  signature: Joi.string().required().messages({
    'any.required': 'Payment signature is required'
  }),
  donationId: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid donation ID format',
    'any.required': 'Donation ID is required'
  })
});

/**
 * Create donation order - Step 1 of donation process
 * POST /api/donations/create-order
 */
const createOrder = catchAsync(async (req, res) => {
  // Validate request body
  const { error, value } = createOrderValidation.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, true, 'VALIDATION_ERROR');
  }

  const {
    campaignId,
    donationAmount,
    tipAmount,
    totalAmount,
    donationTowards,
    donorDetails,
    showNamePublicly,
    receiveWhatsAppUpdates,
    howYouCanHelp
  } = value;

  // Verify total amount calculation
  const calculatedTotal = donationAmount + tipAmount;
  if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
    throw new AppError('Total amount does not match donation amount + tip amount', 400, true, 'AMOUNT_MISMATCH');
  }

  // Resolve campaign: use provided campaignId or fall back to default campaign
  let campaign;
  
  if (campaignId) {
    // Validate that the provided campaign exists and is accepting donations
    campaign = await Campaign.findOne({
      where: { 
        id: campaignId,
        status: 'active',
        visibility: 'public'
      }
    });
    
    if (!campaign) {
      throw new AppError('Campaign not found or not accepting donations', 400, true, 'CAMPAIGN_NOT_FOUND');
    }
    
    // Check if campaign is still active (not expired)
    // if (!campaign.isActive) {
    //   throw new AppError('Campaign is no longer accepting donations', 400, true, 'CAMPAIGN_INACTIVE');
    // }
  } else {
    // Fall back to default campaign logic for backward compatibility
    campaign = await Campaign.findOne({
      where: { status: 'active' },
      order: [['created_at', 'DESC']]
    });

    if (!campaign) {
      // Create a default campaign if none exists
      campaign = await Campaign.create({
        title: 'General Donations',
        slug: 'general-donations',
        short_description: 'General donations for various charitable activities',
        target_amount: 10000000, // ₹1 crore target
        raised_amount: 0,
        status: 'active',
        category: 'general',
        visibility: 'public',
        created_by: '00000000-0000-0000-0000-000000000000' // System-created campaign
      });
    }
  }

  try {
    // Convert amounts to paise for storage and Razorpay
    const donationAmountInPaise = Math.round(donationAmount * 100);
    const tipAmountInPaise = Math.round(tipAmount * 100);
    const totalAmountInPaise = Math.round(totalAmount * 100);

    // Generate receipt ID for Razorpay order
    const receiptId = razorpayUtils.generateReceiptId('DONATION');

    // Create Razorpay order
    const orderResult = await razorpayUtils.createOrder({
      amount: totalAmountInPaise, // Amount in paise
      currency: 'INR',
      receipt: receiptId,
      notes: {
        campaign_id: campaign.id,
        campaign_title: campaign.title,
        donation_towards: donationTowards,
        donor_name: donorDetails.fullName,
        donor_phone: donorDetails.phone,
        show_name_publicly: showNamePublicly
      }
    });

    if (!orderResult.success) {
      logger.error('Failed to create Razorpay order:', orderResult.error);
      throw new AppError('Failed to create payment order. Please try again.', 500, true, 'PAYMENT_ORDER_FAILED');
    }

    const razorpayOrder = orderResult.order;

    // Check if user exists by phone number, create if not exists
    let userId = null;
    let newUserCreated = false;
    let newUserPassword = null;

    try {
      // First, try to find user by phone number
      let existingUser = await User.findOne({
        where: { phone_number: donorDetails.phone }
      });

      if (existingUser) {
        // User exists, use their user_id
        userId = existingUser.id;
        logger.info(`Existing user found for donation: ${existingUser.id} (phone: ${donorDetails.phone})`);
      } else {
        // Check if email already exists (different phone number scenario)
        const userWithEmail = await User.findOne({
          where: { email: donorDetails.email.toLowerCase() }
        });

        if (userWithEmail) {
          // Email exists but different phone - use existing user and log the discrepancy
          userId = userWithEmail.id;
          logger.warn(`User with email ${donorDetails.email} exists but has different phone number. Using existing user ${userWithEmail.id}. Donation phone: ${donorDetails.phone}, User phone: ${userWithEmail.phone_number}`);
        } else {
          // User doesn't exist, create new user
          // Generate secure password
          newUserPassword = authService.generateSecurePassword(12);
          const hashedPassword = await authService.hashPassword(newUserPassword);

          // Parse full name into first and last name
          const nameParts = donorDetails.fullName.trim().split(' ');
          const firstName = nameParts[0] || 'User';
          const lastName = nameParts.slice(1).join(' ') || '';

          // Create new user
          const newUser = await User.create({
            email: donorDetails.email.toLowerCase(),
            password_hash: hashedPassword,
            first_name: firstName,
            last_name: lastName,
            phone_number: donorDetails.phone,
            is_email_verified: false, // Will be verified through email verification flow
            is_phone_verified: false,
            role: 'user',
            is_active: true,
            preferences: {
              receive_whatsapp_updates: receiveWhatsAppUpdates,
              created_via_donation: true,
              donation_campaign_id: campaign.id
            }
          });

          userId = newUser.id;
          newUserCreated = true;

          logger.info(`New user created from donation: ${newUser.id} for phone: ${donorDetails.phone}, email: ${donorDetails.email}`);

          // Send welcome email with password (async, don't wait for it)
          setImmediate(async () => {
            try {
              const emailResult = await emailService.sendWelcomeEmailWithPassword(donorDetails.email, {
                first_name: firstName,
                password: newUserPassword,
                donationAmount: donationAmount,
                campaignTitle: campaign.title
              });

              if (emailResult.success) {
                logger.info(`Welcome email with password sent successfully to ${donorDetails.email} for user ${newUser.id}`);
              } else {
                logger.error(`Failed to send welcome email with password to ${donorDetails.email} for user ${newUser.id}: ${emailResult.error}`);
              }
            } catch (emailError) {
              logger.error(`Error sending welcome email with password for user ${newUser.id}:`, emailError);
            }
          });
        }
      }
    } catch (userError) {
      // Log error but don't fail the donation process
      logger.error(`Error in user check/creation for donation (phone: ${donorDetails.phone}):`, userError);
      
      // Check if it's a unique constraint violation on email
      if (userError.name === 'SequelizeUniqueConstraintError' && userError.errors?.some(e => e.path === 'email')) {
        logger.warn(`Email uniqueness constraint violation during user creation for donation. Email: ${donorDetails.email}`);
        // Try to find the user with this email and use their ID
        try {
          const existingUserByEmail = await User.findOne({
            where: { email: donorDetails.email.toLowerCase() }
          });
          if (existingUserByEmail) {
            userId = existingUserByEmail.id;
            logger.info(`Found existing user by email for donation: ${existingUserByEmail.id}`);
          }
        } catch (findError) {
          logger.error('Error finding user by email after constraint violation:', findError);
        }
      }
      
      // Continue without user_id if we couldn't resolve it - donation can still be completed
      if (!userId) {
        logger.warn('Continuing donation creation without user_id due to user creation failure');
      }
    }

    // Create donation record
    const donation = await Donation.create({
      campaign_id: campaign.id,
      user_id: userId, // Set to found/created user ID or null
      donation_amount: donationAmountInPaise,
      tip_amount: tipAmountInPaise,
      total_amount: totalAmountInPaise,
      amount: donationAmount, // Backward compatibility field
      currency: 'INR',
      donor_name: donorDetails.fullName,
      donor_email: donorDetails.email,
      donor_phone: donorDetails.phone,
      donor_pan: donorDetails.panNumber || null,
      donor_address: donorDetails.address || null,
      donation_towards: donationTowards,
      show_name_publicly: showNamePublicly,
      receive_whatsapp_updates: receiveWhatsAppUpdates,
      howyoucanhelp: howYouCanHelp || null,
      status: 'pending',
      payment_status: 'pending',
      payment_gateway: 'razorpay',
      razorpay_order_id: razorpayOrder.id,
      metadata: {
        receipt_id: receiptId,
        created_via: 'donation_api',
        campaign_provided: !!campaignId,
        campaign_title: campaign.title,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        user_id_assigned: !!userId,
        new_user_created: newUserCreated,
        user_creation_source: newUserCreated ? 'donation_checkout' : (userId ? 'existing_user' : 'no_user')
      }
    });

    logger.info(`Donation order created: ${donation.id} for campaign: ${campaign.id} (${campaign.title}), Razorpay order: ${razorpayOrder.id}`);

    res.status(200).json({
      success: true,
      orderId: razorpayOrder.id,
      amount: totalAmountInPaise, // Amount in paise as required by Razorpay
      currency: 'INR',
      donationId: donation.id
    });

  } catch (error) {
    logger.error('Error creating donation order:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to create donation order. Please try again.', 500, true, 'DONATION_ORDER_FAILED');
  }
});

/**
 * Confirm payment - Step 2 of donation process
 * POST /api/donations/confirm-payment
 */
const confirmPayment = catchAsync(async (req, res) => {
  // Validate request body
  const { error, value } = confirmPaymentValidation.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, true, 'VALIDATION_ERROR');
  }

  const { orderId, paymentId, signature, donationId } = value;

  try {
    // Find the donation record
    const donation = await Donation.findByPk(donationId);
    if (!donation) {
      throw new AppError('Donation not found', 404, true, 'DONATION_NOT_FOUND');
    }

    // Verify the donation is in pending status
    if (donation.status !== 'pending') {
      throw new AppError('Donation has already been processed', 400, true, 'DONATION_ALREADY_PROCESSED');
    }

    // Verify the order ID matches
    if (donation.razorpay_order_id !== orderId) {
      throw new AppError('Order ID mismatch', 400, true, 'ORDER_ID_MISMATCH');
    }

    // Verify payment signature with Razorpay
    const signatureVerification = razorpayUtils.verifyPaymentSignature({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature
    });

    if (!signatureVerification.success || !signatureVerification.verified) {
      logger.warn(`Payment signature verification failed for donation ${donationId}:`, signatureVerification.error);
      throw new AppError('Payment verification failed', 400, true, 'PAYMENT_VERIFICATION_FAILED');
    }

    // Fetch payment details from Razorpay to get additional information
    const paymentResult = await razorpayUtils.fetchPayment(paymentId);
    let paymentDetails = {};
    
    if (paymentResult.success) {
      const payment = paymentResult.payment;
      paymentDetails = {
        payment_method: payment.method,
        transaction_id: payment.acquirer_data?.bank_transaction_id || payment.id
      };
    }

    // Check if user exists (either already linked to donation or find by phone)
    let user = null;
    try {
      if (donation.user_id) {
        // User was already created/found during order creation
        user = await User.findByPk(donation.user_id);
        if (user) {
          logger.info(`Using existing user from order creation: ${user.id} for donation: ${donationId}`);
        }
      } else {
        // Fallback: check if user exists with this mobile number (legacy flow)
        user = await User.findOne({
          where: { phone_number: donation.donor_phone }
        });

        if (!user && donation.donor_email && donation.donor_phone) {
          // Create a new user account (legacy fallback - should rarely happen now)
          const bcrypt = require('bcryptjs');
          const tempPassword = Math.random().toString(36).substring(2, 12); // Generate temporary password
          const hashedPassword = await bcrypt.hash(tempPassword, 12);

          user = await User.create({
            email: donation.donor_email,
            password_hash: hashedPassword,
            first_name: donation.donor_name.split(' ')[0] || 'Donor',
            last_name: donation.donor_name.split(' ').slice(1).join(' ') || '',
            phone_number: donation.donor_phone,
            is_email_verified: false, // Will be verified through email verification flow
            is_phone_verified: false,
            role: 'user',
            preferences: {
              receive_whatsapp_updates: donation.receive_whatsapp_updates,
              created_via_donation: true,
              created_at_payment_confirmation: true // Flag to indicate this was created during confirmation
            }
          });

          logger.info(`New user created during payment confirmation (fallback): ${user.id} for donation: ${donationId}`);
        }
      }
    } catch (userError) {
      logger.warn(`Failed to find/create user for donation ${donationId}:`, userError);
      // Continue without user - donation can still be completed
    }

    // Update donation with payment details and mark as completed
    await donation.update({
      user_id: user?.id || null,
      razorpay_payment_id: paymentId,
      status: 'completed',
      payment_status: 'completed',
      completed_at: new Date(),
      ...paymentDetails,
      metadata: {
        ...donation.metadata,
        payment_verified_at: new Date(),
        signature_verification: signatureVerification,
        user_created: !!user && user.preferences?.created_via_donation
      }
    });

    // Update campaign progress
    const campaign = await Campaign.findByPk(donation.campaign_id);
    if (campaign) {
      await campaign.updateProgress(donation.donationAmountInRupees, true);
    }

    // Update user donation stats if user exists
    if (user) {
      await user.updateDonationStats(donation.donationAmountInRupees);
    }

    logger.info(`Donation completed successfully: ${donationId}, Payment: ${paymentId}`);

    // Generate receipt PDF
    let receiptUrl = null;
    try {
      const receiptData = {
        donationId: donation.id,
        campaignId: campaign.id,
        campaignName: campaign.title,
        donorName: donation.donor_name,
        donorEmail: donation.donor_email,
        donorPhone: donation.donor_phone,
        donationAmount: Math.round(donation.donation_amount / 100), // Convert paise to rupees
        paymentMethod: paymentDetails.payment_method || 'razorpay',
        paymentId: paymentId,
        createdAt: donation.created_at
      };

      const receiptResult = await receiptService.generateReceipt(receiptData);
      if (receiptResult.success) {
        receiptUrl = receiptResult.receiptUrl;
        logger.info(`Receipt generated successfully for donation ${donationId}: ${receiptResult.fileName}`);
      } else {
        logger.error(`Failed to generate receipt for donation ${donationId}: ${receiptResult.error}`);
      }
    } catch (receiptError) {
      // Log receipt error but don't fail the donation
      logger.error(`Error generating receipt for donation ${donationId}:`, receiptError);
    }

    // Send donation confirmation email
    try {
      const emailResult = await emailService.sendDonationConfirmation(donation.donor_email, {
        donationId: donation.id,
        amount: Math.round(donation.donation_amount / 100), // Convert paise to rupees
        campaignTitle: campaign.title,
        donorName: donation.donor_name
      });

      if (emailResult.success) {
        logger.info(`Donation confirmation email sent successfully to ${donation.donor_email} for donation ${donationId}`);
      } else {
        logger.error(`Failed to send donation confirmation email to ${donation.donor_email} for donation ${donationId}: ${emailResult.error}`);
      }
    } catch (emailError) {
      // Log email error but don't fail the donation
      logger.error(`Error sending donation confirmation email for donation ${donationId}:`, emailError);
    }

    // Send receipt email with PDF attachment if receipt was generated successfully
    if (receiptUrl) {
      try {
        const receiptEmailResult = await receiptService.emailReceipt(null, donation.donor_email, donation.id);
        
        if (receiptEmailResult.success) {
          logger.info(`Receipt email sent successfully to ${donation.donor_email} for donation ${donationId}`);
        } else {
          logger.error(`Failed to send receipt email to ${donation.donor_email} for donation ${donationId}: ${receiptEmailResult.error}`);
        }
      } catch (receiptEmailError) {
        // Log receipt email error but don't fail the donation
        logger.error(`Error sending receipt email for donation ${donationId}:`, receiptEmailError);
      }
    }

    res.status(200).json({
      success: true,
      donationId: donation.id,
      receiptNumber: donation.receipt_number,
      receiptUrl: receiptUrl,
      message: 'Donation completed successfully. Thank you for your contribution!'
    });

  } catch (error) {
    logger.error('Error confirming payment:', error);
    
    // Try to mark donation as failed if it exists
    try {
      const donation = await Donation.findByPk(donationId);
      if (donation && donation.status === 'pending') {
        await donation.markFailed(error.message);
      }
    } catch (updateError) {
      logger.error('Error marking donation as failed:', updateError);
    }

    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to confirm payment. Please contact support.', 500, true, 'PAYMENT_CONFIRMATION_FAILED');
  }
});

/**
 * Get public donations for a specific campaign
 * GET /api/donations/campaign/:campaignId
 */
const getCampaignDonations = catchAsync(async (req, res) => {
  const { campaignId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  
  const offset = (page - 1) * limit;
  
  const donations = await Donation.scope('successful').findAndCountAll({
    where: {
      campaign_id: campaignId,
      show_name_publicly: true
    },
    include: [{
      model: Campaign,
      as: 'campaign',
      attributes: ['title', 'slug']
    }],
    attributes: [
      'id', 'donor_name', 'donation_amount', 'message', 
      'created_at', 'show_name_publicly'
    ],
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
  
  const donationsData = donations.rows.map(donation => ({
    id: donation.id,
    donor_name: donation.donorDisplayName,
    amount: donation.donationAmountInRupees,
    message: donation.message,
    date: donation.created_at,
    campaign_title: donation.campaign?.title
  }));
  
  res.status(200).json({
    success: true,
    data: donationsData,
    pagination: {
      current_page: parseInt(page),
      total_pages: Math.ceil(donations.count / limit),
      total_count: donations.count,
      per_page: parseInt(limit)
    }
  });
});

/**
 * Get recent public donations across all campaigns
 * GET /api/donations/recent
 */
const getRecentDonations = catchAsync(async (req, res) => {
  const { limit = 10 } = req.query;
  
  const donations = await Donation.scope('successful').findAll({
    where: {
      show_name_publicly: true
    },
    include: [{
      model: Campaign,
      as: 'campaign',
      attributes: ['title', 'slug']
    }],
    attributes: [
      'id', 'donor_name', 'donation_amount', 'message', 
      'created_at', 'show_name_publicly'
    ],
    order: [['created_at', 'DESC']],
    limit: parseInt(limit)
  });
  
  const donationsData = donations.map(donation => ({
    id: donation.id,
    donor_name: donation.donorDisplayName,
    amount: donation.donationAmountInRupees,
    message: donation.message,
    date: donation.created_at,
    campaign_title: donation.campaign?.title,
    campaign_slug: donation.campaign?.slug
  }));
  
  res.status(200).json({
    success: true,
    data: donationsData
  });
});

/**
 * Get donation receipt by ID
 * GET /api/donations/:id/receipt
 */
const getDonationReceipt = catchAsync(async (req, res) => {
  const { id } = req.params;
  
  const donation = await Donation.findByPk(id, {
    include: [{
      model: Campaign,
      as: 'campaign',
      attributes: ['title', 'slug']
    }]
  });
  
  if (!donation) {
    throw new AppError('Donation not found', 404, true, 'DONATION_NOT_FOUND');
  }
  
  if (!donation.isSuccessful) {
    throw new AppError('Receipt not available for incomplete donation', 400, true, 'RECEIPT_NOT_AVAILABLE');
  }
  
  const receiptData = donation.generateReceiptData();
  
  res.status(200).json({
    success: true,
    data: receiptData
  });
});

/**
 * Create manual donation (Admin endpoint)
 * POST /api/admin/donations
 */
const createManualDonation = catchAsync(async (req, res) => {
  const {
    campaign_id,
    user_id,
    donation_amount,
    tip_amount = 0,
    donor_name,
    donor_email,
    donor_phone,
    donor_pan,
    donor_address,
    donation_towards,
    message,
    show_name_publicly = false,
    receive_whatsapp_updates = false,
    payment_method = 'manual',
    transaction_id,
    receipt_number,
    howYouCanHelp
  } = req.body;

  // Validate required fields
  if (!campaign_id || !donation_amount || !donor_name || !donor_email || !donation_towards) {
    throw new AppError('Missing required fields: campaign_id, donation_amount, donor_name, donor_email, donation_towards', 400, true, 'VALIDATION_ERROR');
  }

  // Validate campaign exists
  const campaign = await Campaign.findByPk(campaign_id);
  if (!campaign) {
    throw new AppError('Campaign not found', 404, true, 'CAMPAIGN_NOT_FOUND');
  }

  // Validate user if provided
  let user = null;
  if (user_id) {
    user = await User.findByPk(user_id);
    if (!user) {
      throw new AppError('User not found', 404, true, 'USER_NOT_FOUND');
    }
  }

  try {
    // Convert amounts to paise for storage
    const donationAmountInPaise = Math.round(donation_amount * 100);
    const tipAmountInPaise = Math.round(tip_amount * 100);
    const totalAmountInPaise = donationAmountInPaise + tipAmountInPaise;

    // Create donation record
    const donation = await Donation.create({
      campaign_id,
      user_id,
      donation_amount: donationAmountInPaise,
      tip_amount: tipAmountInPaise,
      total_amount: totalAmountInPaise,
      amount: donation_amount, // Backward compatibility
      currency: 'INR',
      donor_name,
      donor_email,
      donor_phone,
      donor_pan,
      donor_address,
      donation_towards,
      message,
      show_name_publicly,
      receive_whatsapp_updates,
      howyoucanhelp: howYouCanHelp,
      status: 'completed',
      payment_status: 'completed',
      payment_method,
      payment_gateway: 'manual',
      transaction_id,
      receipt_number,
      completed_at: new Date(),
      metadata: {
        created_via: 'admin_manual_entry',
        created_by_admin: req.user.id,
        created_by_admin_email: req.user.email,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      }
    });

    // Update campaign progress
    await campaign.updateProgress(donation_amount, true);

    // Update user donation stats if user exists
    if (user) {
      await user.updateDonationStats(donation_amount);
    }

    logger.info(`Manual donation created by admin: ${donation.id}, Campaign: ${campaign_id}, Amount: ₹${donation_amount}`, {
      adminId: req.user.id,
      donationId: donation.id,
      campaignId: campaign_id,
      amount: donation_amount
    });

    res.status(201).json({
      success: true,
      message: 'Manual donation created successfully',
      data: {
        id: donation.id,
        campaign_id: donation.campaign_id,
        user_id: donation.user_id,
        donor_name: donation.donor_name,
        donation_amount: donation.donationAmountInRupees,
        tip_amount: donation.tipAmountInRupees,
        total_amount: donation.totalAmountInRupees,
        status: donation.status,
        payment_status: donation.payment_status,
        receipt_number: donation.receipt_number,
        created_at: donation.created_at
      }
    });

  } catch (error) {
    logger.error('Error creating manual donation:', error);
    throw new AppError('Failed to create manual donation', 500, true, 'DONATION_CREATION_FAILED');
  }
});

/**
 * Update donation (Admin endpoint)
 * PUT /api/admin/donations/:id
 */
const updateDonation = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const donation = await Donation.findByPk(id);
  if (!donation) {
    throw new AppError('Donation not found', 404, true, 'DONATION_NOT_FOUND');
  }

  // Store original amounts for campaign update calculation
  const originalAmount = donation.donationAmountInRupees;
  
  // Prepare update data
  const updates = {};
  
  // Convert amounts to paise if provided
  if (updateData.donation_amount !== undefined) {
    updates.donation_amount = Math.round(updateData.donation_amount * 100);
    updates.amount = updateData.donation_amount; // Backward compatibility
  }
  
  if (updateData.tip_amount !== undefined) {
    updates.tip_amount = Math.round(updateData.tip_amount * 100);
  }
  
  // Calculate total amount if either component changed
  if (updates.donation_amount !== undefined || updates.tip_amount !== undefined) {
    const newDonationAmount = updates.donation_amount || donation.donation_amount;
    const newTipAmount = updates.tip_amount || donation.tip_amount;
    updates.total_amount = newDonationAmount + newTipAmount;
  }

  // Update other fields
  const allowedFields = [
    'donor_name', 'donor_email', 'donor_phone', 'donor_pan', 'donor_address',
    'donation_towards', 'message', 'show_name_publicly', 'receive_whatsapp_updates',
    'status', 'payment_status', 'payment_method', 'transaction_id', 
    'receipt_number', 'failure_reason', 'howyoucanhelp'
  ];
  
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) {
      updates[field] = updateData[field];
    }
  });

  // Add metadata about the update
  updates.metadata = {
    ...donation.metadata,
    last_updated_by_admin: req.user.id,
    last_updated_by_admin_email: req.user.email,
    last_updated_at: new Date(),
    update_reason: updateData.update_reason || 'Admin update'
  };

  try {
    await donation.update(updates);

    // Update campaign progress if donation amount changed
    if (updates.donation_amount !== undefined) {
      const campaign = await Campaign.findByPk(donation.campaign_id);
      if (campaign) {
        const newAmount = updates.donation_amount / 100; // Convert back to rupees
        const amountDifference = newAmount - originalAmount;
        await campaign.updateProgress(amountDifference, true);
      }
    }

    logger.info(`Donation updated by admin: ${donation.id}`, {
      adminId: req.user.id,
      donationId: donation.id,
      updatedFields: Object.keys(updates),
      updateReason: updateData.update_reason
    });

    res.status(200).json({
      success: true,
      message: 'Donation updated successfully',
      data: {
        id: donation.id,
        donation_amount: donation.donationAmountInRupees,
        tip_amount: donation.tipAmountInRupees,
        total_amount: donation.totalAmountInRupees,
        status: donation.status,
        payment_status: donation.payment_status,
        updated_at: donation.updated_at
      }
    });

  } catch (error) {
    logger.error('Error updating donation:', error);
    throw new AppError('Failed to update donation', 500, true, 'DONATION_UPDATE_FAILED');
  }
});

/**
 * Get top donors (Admin endpoint)
 * GET /api/admin/donations/top-donors
 */
const getTopDonors = catchAsync(async (req, res) => {
  const { 
    limit = 20, 
    period = '1y',
    campaign_id,
    min_amount
  } = req.query;

  // Calculate date range
  let startDate;
  const endDate = new Date();

  switch (period) {
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
    case 'all':
    default:
      startDate = new Date('2020-01-01'); // Far back date
      break;
  }

  const whereClause = {
    payment_status: 'completed',
    created_at: {
      [require('sequelize').Op.gte]: startDate,
      [require('sequelize').Op.lte]: endDate
    }
  };

  if (campaign_id) {
    whereClause.campaign_id = campaign_id;
  }

  if (min_amount) {
    whereClause.donation_amount = {
      [require('sequelize').Op.gte]: Math.round(parseFloat(min_amount) * 100)
    };
  }

  try {
    const { sequelize } = require('../config/database');
    
    const topDonors = await Donation.findAll({
      where: whereClause,
      attributes: [
        'donor_name',
        'donor_email',
        'donor_phone',
        [sequelize.fn('COUNT', sequelize.col('id')), 'donation_count'],
        [sequelize.fn('SUM', sequelize.col('donation_amount')), 'total_donated_paise'],
        [sequelize.fn('AVG', sequelize.col('donation_amount')), 'avg_donation_paise'],
        [sequelize.fn('MAX', sequelize.col('donation_amount')), 'largest_donation_paise'],
        [sequelize.fn('MIN', sequelize.col('created_at')), 'first_donation_date'],
        [sequelize.fn('MAX', sequelize.col('created_at')), 'latest_donation_date']
      ],
      group: ['donor_email', 'donor_name', 'donor_phone'],
      order: [[sequelize.fn('SUM', sequelize.col('donation_amount')), 'DESC']],
      limit: parseInt(limit),
      raw: true
    });

    const formattedDonors = topDonors.map(donor => ({
      donor_name: donor.donor_name,
      donor_email: donor.donor_email,
      donor_phone: donor.donor_phone,
      donation_count: parseInt(donor.donation_count),
      total_donated: Math.round(donor.total_donated_paise / 100),
      average_donation: Math.round(donor.avg_donation_paise / 100),
      largest_donation: Math.round(donor.largest_donation_paise / 100),
      first_donation_date: donor.first_donation_date,
      latest_donation_date: donor.latest_donation_date
    }));

    res.status(200).json({
      success: true,
      data: {
        period,
        date_range: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        filters: {
          campaign_id: campaign_id || null,
          min_amount: min_amount || null
        },
        top_donors: formattedDonors,
        total_donors: formattedDonors.length
      }
    });

  } catch (error) {
    logger.error('Error fetching top donors:', error);
    throw new AppError('Failed to fetch top donors', 500, true, 'TOP_DONORS_FETCH_FAILED');
  }
});

/**
 * Get recurring donations (Admin endpoint)
 * GET /api/admin/donations/recurring
 */
const getRecurringDonations = catchAsync(async (req, res) => {
  const { 
    page = 1, 
    limit = 20,
    min_frequency = 2
  } = req.query;

  const offset = (page - 1) * limit;

  try {
    const { sequelize } = require('../config/database');
    
    // Find donors who have made multiple donations (recurring pattern)
    const recurringDonors = await Donation.findAll({
      where: {
        payment_status: 'completed'
      },
      attributes: [
        'donor_email',
        'donor_name',
        'donor_phone',
        [sequelize.fn('COUNT', sequelize.col('id')), 'donation_count'],
        [sequelize.fn('SUM', sequelize.col('donation_amount')), 'total_donated_paise'],
        [sequelize.fn('AVG', sequelize.col('donation_amount')), 'avg_donation_paise'],
        [sequelize.fn('MIN', sequelize.col('created_at')), 'first_donation'],
        [sequelize.fn('MAX', sequelize.col('created_at')), 'latest_donation'],
        [sequelize.literal(`
          CASE 
            WHEN COUNT(id) >= 12 THEN 'monthly'
            WHEN COUNT(id) >= 4 THEN 'quarterly'
            WHEN COUNT(id) >= 2 THEN 'occasional'
            ELSE 'single'
          END
        `), 'frequency_category']
      ],
      group: ['donor_email', 'donor_name', 'donor_phone'],
      having: sequelize.where(
        sequelize.fn('COUNT', sequelize.col('id')), 
        '>=', 
        parseInt(min_frequency)
      ),
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      raw: true
    });

    // Get total count for pagination
    const totalCountResult = await Donation.findAll({
      where: {
        payment_status: 'completed'
      },
      attributes: [
        'donor_email',
        [sequelize.fn('COUNT', sequelize.col('id')), 'donation_count']
      ],
      group: ['donor_email'],
      having: sequelize.where(
        sequelize.fn('COUNT', sequelize.col('id')), 
        '>=', 
        parseInt(min_frequency)
      ),
      raw: true
    });

    const totalCount = totalCountResult.length;

    const formattedRecurringDonors = recurringDonors.map(donor => {
      const daysBetween = Math.floor(
        (new Date(donor.latest_donation) - new Date(donor.first_donation)) / 
        (1000 * 60 * 60 * 24)
      );
      const averageDaysBetweenDonations = daysBetween / (donor.donation_count - 1) || 0;
      
      return {
        donor_name: donor.donor_name,
        donor_email: donor.donor_email,
        donor_phone: donor.donor_phone,
        donation_count: parseInt(donor.donation_count),
        total_donated: Math.round(donor.total_donated_paise / 100),
        average_donation: Math.round(donor.avg_donation_paise / 100),
        first_donation: donor.first_donation,
        latest_donation: donor.latest_donation,
        frequency_category: donor.frequency_category,
        estimated_frequency_days: Math.round(averageDaysBetweenDonations),
        donor_lifetime_days: daysBetween
      };
    });

    res.status(200).json({
      success: true,
      data: {
        recurring_donors: formattedRecurringDonors,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalCount / limit),
          total_count: totalCount,
          per_page: parseInt(limit)
        },
        filters: {
          min_frequency: parseInt(min_frequency)
        },
        summary: {
          total_recurring_donors: totalCount,
          avg_donations_per_donor: formattedRecurringDonors.length > 0 ? 
            Math.round(formattedRecurringDonors.reduce((sum, donor) => sum + donor.donation_count, 0) / formattedRecurringDonors.length) : 0
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching recurring donations:', error);
    throw new AppError('Failed to fetch recurring donations', 500, true, 'RECURRING_DONATIONS_FETCH_FAILED');
  }
});

/**
 * Export donations (Admin endpoint)
 * POST /api/admin/donations/export
 */
const exportDonations = catchAsync(async (req, res) => {
  const {
    format = 'csv',
    start_date,
    end_date,
    campaign_id,
    status = 'completed',
    include_fields = ['all']
  } = req.body;

  if (!['csv', 'json'].includes(format)) {
    throw new AppError('Invalid export format. Supported formats: csv, json', 400, true, 'INVALID_FORMAT');
  }

  const whereClause = {};
  
  if (status !== 'all') {
    whereClause.payment_status = status;
  }
  
  if (campaign_id) {
    whereClause.campaign_id = campaign_id;
  }
  
  if (start_date) {
    whereClause.created_at = {
      ...whereClause.created_at,
      [require('sequelize').Op.gte]: new Date(start_date)
    };
  }
  
  if (end_date) {
    whereClause.created_at = {
      ...whereClause.created_at,
      [require('sequelize').Op.lte]: new Date(end_date)
    };
  }

  try {
    const donations = await Donation.findAll({
      where: whereClause,
      include: [
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['title', 'slug']
        },
        {
          model: User,
          as: 'user',
          attributes: ['first_name', 'last_name', 'email'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Define available fields for export
    const availableFields = {
      basic: ['id', 'donor_name', 'donor_email', 'donation_amount', 'created_at', 'status'],
      contact: ['donor_phone', 'donor_address', 'donor_pan'],
      payment: ['payment_method', 'payment_status', 'transaction_id', 'receipt_number'],
      campaign: ['campaign_title', 'donation_towards'],
      metadata: ['show_name_publicly', 'receive_whatsapp_updates', 'message', 'tip_amount', 'total_amount']
    };

    let fieldsToInclude = [];
    if (include_fields.includes('all')) {
      fieldsToInclude = Object.values(availableFields).flat();
    } else {
      include_fields.forEach(fieldGroup => {
        if (availableFields[fieldGroup]) {
          fieldsToInclude.push(...availableFields[fieldGroup]);
        }
      });
    }

    // Format data for export
    const exportData = donations.map(donation => {
      const data = {};
      
      if (fieldsToInclude.includes('id')) data.id = donation.id;
      if (fieldsToInclude.includes('donor_name')) data.donor_name = donation.donor_name;
      if (fieldsToInclude.includes('donor_email')) data.donor_email = donation.donor_email;
      if (fieldsToInclude.includes('donor_phone')) data.donor_phone = donation.donor_phone;
      if (fieldsToInclude.includes('donor_address')) data.donor_address = donation.donor_address;
      if (fieldsToInclude.includes('donor_pan')) data.donor_pan = donation.donor_pan;
      if (fieldsToInclude.includes('donation_amount')) data.donation_amount = donation.donationAmountInRupees;
      if (fieldsToInclude.includes('tip_amount')) data.tip_amount = donation.tipAmountInRupees;
      if (fieldsToInclude.includes('total_amount')) data.total_amount = donation.totalAmountInRupees;
      if (fieldsToInclude.includes('donation_towards')) data.donation_towards = donation.donation_towards;
      if (fieldsToInclude.includes('message')) data.message = donation.message;
      if (fieldsToInclude.includes('status')) data.status = donation.status;
      if (fieldsToInclude.includes('payment_status')) data.payment_status = donation.payment_status;
      if (fieldsToInclude.includes('payment_method')) data.payment_method = donation.payment_method;
      if (fieldsToInclude.includes('transaction_id')) data.transaction_id = donation.transaction_id;
      if (fieldsToInclude.includes('receipt_number')) data.receipt_number = donation.receipt_number;
      if (fieldsToInclude.includes('show_name_publicly')) data.show_name_publicly = donation.show_name_publicly;
      if (fieldsToInclude.includes('receive_whatsapp_updates')) data.receive_whatsapp_updates = donation.receive_whatsapp_updates;
      if (fieldsToInclude.includes('campaign_title')) data.campaign_title = donation.campaign?.title;
      if (fieldsToInclude.includes('created_at')) data.created_at = donation.created_at;
      
      return data;
    });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `donations_export_${timestamp}.${format}`;

    if (format === 'csv') {
      // Convert to CSV format
      if (exportData.length === 0) {
        res.status(200).json({
          success: true,
          message: 'No donations found for export',
          data: { filename, records_count: 0 }
        });
        return;
      }

      const headers = Object.keys(exportData[0]);
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => {
            const value = row[header] || '';
            // Escape CSV values that contain commas or quotes
            return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
              ? `"${value.replace(/"/g, '""')}"` 
              : value;
          }).join(',')
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvContent);
    } else {
      // JSON format
      res.status(200).json({
        success: true,
        message: 'Donations exported successfully',
        data: {
          filename,
          export_info: {
            total_records: exportData.length,
            fields_included: fieldsToInclude,
            filters_applied: {
              start_date: start_date || null,
              end_date: end_date || null,
              campaign_id: campaign_id || null,
              status
            },
            exported_at: new Date().toISOString(),
            exported_by: req.user.email
          },
          donations: exportData
        }
      });
    }

    logger.info(`Donations exported by admin: ${exportData.length} records in ${format} format`, {
      adminId: req.user.id,
      recordCount: exportData.length,
      format,
      filters: { start_date, end_date, campaign_id, status }
    });

  } catch (error) {
    logger.error('Error exporting donations:', error);
    throw new AppError('Failed to export donations', 500, true, 'DONATION_EXPORT_FAILED');
  }
});

/**
 * Download receipt PDF
 * GET /api/receipts/:campaignId.pdf?donationid=123
 * Supports both campaign ID and donation ID lookup
 */
const downloadReceipt = catchAsync(async (req, res) => {
  const { campaignId } = req.params;
  const { donationid } = req.query;

  try {
    let receiptResult;
    let lookupMethod = 'campaignId';

    // Priority: If donationId is provided in query parameter, use it for lookup
    if (donationid) {
      lookupMethod = 'donationId';
      receiptResult = await receiptService.getReceiptPathByDonationId(donationid);
      
      if (!receiptResult.success) {
        // If donation ID lookup fails, fall back to campaign ID
        logger.warn(`Donation ID lookup failed for ${donationid}, falling back to campaign ID: ${campaignId}`);
        lookupMethod = 'campaignId (fallback)';
        receiptResult = await receiptService.getReceiptPath(campaignId);
      }
    } else {
      // Use campaign ID directly
      receiptResult = await receiptService.getReceiptPath(campaignId);
    }
    
    // If receipt not found, try to generate it on-demand
    if (!receiptResult.success && donationid) {
      logger.info(`Receipt not found, attempting to generate on-demand for donation ${donationid}`);
      
      // Get donation details
      const donationResult = await receiptService.getDonationDetails(donationid);
      if (donationResult.success) {
        const donationDetails = donationResult.donation;
        
        // Generate receipt
        const generateResult = await receiptService.generateReceipt({
          donationId: donationDetails.id,
          campaignId: donationResult.campaignId,
          campaignName: donationResult.campaignName,
          donorName: donationDetails.donor_name,
          donorEmail: donationDetails.donor_email,
          donorPhone: donationDetails.donor_phone,
          donationAmount: Math.round((donationDetails.donation_amount || 0) / 100),
          paymentMethod: donationDetails.payment_method || 'razorpay',
          paymentId: donationDetails.razorpay_payment_id || donationDetails.transaction_id,
          createdAt: donationDetails.created_at
        });
        
        if (generateResult.success) {
          // Try to get receipt path again
          receiptResult = await receiptService.getReceiptPath(donationResult.campaignId);
          lookupMethod = 'generated on-demand';
          logger.info(`Receipt generated on-demand for donation ${donationid}`);
        }
      }
    }

    if (!receiptResult.success) {
      throw new AppError('Receipt not found and could not be generated', 404, true, 'RECEIPT_NOT_FOUND');
    }

    const fs = require('fs');
    
    // Verify file exists before attempting to serve
    try {
      const stat = fs.statSync(receiptResult.filePath);
      
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': stat.size,
        'Content-Disposition': `attachment; filename="${receiptResult.fileName}"`
      });

      const readStream = fs.createReadStream(receiptResult.filePath);
      readStream.pipe(res);
      
      logger.info(`Receipt downloaded via ${lookupMethod}: ${receiptResult.fileName}`, {
        campaignId,
        donationId: donationid || null,
        lookupMethod,
        fileName: receiptResult.fileName
      });
    } catch (fileError) {
      logger.error(`Receipt file not accessible: ${receiptResult.filePath}`, fileError);
      throw new AppError('Receipt file is not accessible', 500, true, 'RECEIPT_FILE_ERROR');
    }

  } catch (error) {
    logger.error('Error downloading receipt:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to download receipt', 500, true, 'RECEIPT_DOWNLOAD_FAILED');
  }
});

/**
 * Send receipt via email
 * POST /api/receipts/email
 * Body: { campaignId?, donationId?, email }
 */
const emailReceipt = catchAsync(async (req, res) => {
  const { campaignId, donationId, email } = req.body;

  // Validation
  if (!email) {
    throw new AppError('Email address is required', 400, true, 'VALIDATION_ERROR');
  }

  if (!campaignId && !donationId) {
    throw new AppError('Either campaignId or donationId is required', 400, true, 'VALIDATION_ERROR');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError('Invalid email format', 400, true, 'VALIDATION_ERROR');
  }

  try {
    let emailResult;

    if (donationId) {
      // Use donation ID for lookup
      emailResult = await receiptService.emailReceipt(null, email, donationId);
    } else {
      // Use campaign ID
      emailResult = await receiptService.emailReceipt(campaignId, email);
    }

    if (!emailResult.success) {
      if (emailResult.error.includes('not found')) {
        throw new AppError(emailResult.error, 404, true, 'RECEIPT_NOT_FOUND');
      } else {
        throw new AppError(emailResult.error, 500, true, 'EMAIL_SEND_FAILED');
      }
    }

    logger.info('Receipt emailed successfully', {
      email,
      campaignId: campaignId || null,
      donationId: donationId || null,
      method: donationId ? 'donationId' : 'campaignId'
    });

    res.status(200).json({
      success: true,
      message: 'Receipt sent via email successfully'
    });

  } catch (error) {
    logger.error('Error sending receipt via email:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to send receipt via email', 500, true, 'EMAIL_RECEIPT_FAILED');
  }
});

/**
 * Get donation analytics (Admin endpoint)
 * GET /api/admin/donations/analytics
 */
const getDonationAnalytics = catchAsync(async (req, res) => {
  const {
    period = '30d',
    campaign_id
  } = req.query;

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
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  const whereClause = {
    payment_status: 'completed',
    created_at: {
      [require('sequelize').Op.gte]: startDate,
      [require('sequelize').Op.lte]: endDate
    }
  };

  if (campaign_id) {
    whereClause.campaign_id = campaign_id;
  }

  try {
    const { sequelize } = require('../config/database');
    
    // Overall statistics
    const overallStats = await Donation.findOne({
      where: whereClause,
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_donations'],
        [sequelize.fn('SUM', sequelize.col('donation_amount')), 'total_amount_paise'],
        [sequelize.fn('AVG', sequelize.col('donation_amount')), 'avg_amount_paise'],
        [sequelize.fn('MAX', sequelize.col('donation_amount')), 'max_amount_paise'],
        [sequelize.fn('MIN', sequelize.col('donation_amount')), 'min_amount_paise']
      ],
      raw: true
    });

    // Time series data - simplified approach that works across databases
    const timeSeriesData = await Donation.findAll({
      where: whereClause,
      attributes: [
        [sequelize.fn('DATE', sequelize.col('created_at')), 'period'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'donation_count'],
        [sequelize.fn('SUM', sequelize.col('donation_amount')), 'amount_paise']
      ],
      group: [sequelize.fn('DATE', sequelize.col('created_at'))],
      order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
      raw: true
    });

    // Payment method breakdown
    const paymentMethodStats = await Donation.findAll({
      where: whereClause,
      attributes: [
        'payment_method',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('donation_amount')), 'total_paise']
      ],
      group: ['payment_method'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      raw: true
    });

    // Donation amount distribution
    const amountDistribution = await Donation.findAll({
      where: whereClause,
      attributes: [
        [sequelize.literal(`
          CASE 
            WHEN donation_amount < 50000 THEN 'Under ₹500'
            WHEN donation_amount < 100000 THEN '₹500 - ₹1000'
            WHEN donation_amount < 250000 THEN '₹1000 - ₹2500'
            WHEN donation_amount < 500000 THEN '₹2500 - ₹5000'
            WHEN donation_amount < 1000000 THEN '₹5000 - ₹10000'
            ELSE 'Above ₹10000'
          END
        `), 'amount_range'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('donation_amount')), 'total_paise']
      ],
      group: [sequelize.literal(`
        CASE 
          WHEN donation_amount < 50000 THEN 'Under ₹500'
          WHEN donation_amount < 100000 THEN '₹500 - ₹1000'
          WHEN donation_amount < 250000 THEN '₹1000 - ₹2500'
          WHEN donation_amount < 500000 THEN '₹2500 - ₹5000'
          WHEN donation_amount < 1000000 THEN '₹5000 - ₹10000'
          ELSE 'Above ₹10000'
        END
      `)],
      raw: true
    });

    // Format response data
    const analytics = {
      period,
      date_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      overall_statistics: {
        total_donations: parseInt(overallStats.total_donations) || 0,
        total_amount: Math.round((overallStats.total_amount_paise || 0) / 100),
        average_amount: Math.round((overallStats.avg_amount_paise || 0) / 100),
        maximum_amount: Math.round((overallStats.max_amount_paise || 0) / 100),
        minimum_amount: Math.round((overallStats.min_amount_paise || 0) / 100)
      },
      time_series: timeSeriesData.map(item => ({
        period: item.period,
        donation_count: parseInt(item.donation_count),
        total_amount: Math.round(item.amount_paise / 100)
      })),
      payment_methods: paymentMethodStats.map(item => ({
        method: item.payment_method || 'Unknown',
        count: parseInt(item.count),
        total_amount: Math.round(item.total_paise / 100),
        percentage: ((parseInt(item.count) / (parseInt(overallStats.total_donations) || 1)) * 100).toFixed(2)
      })),
      amount_distribution: amountDistribution.map(item => ({
        range: item.amount_range,
        count: parseInt(item.count),
        total_amount: Math.round(item.total_paise / 100),
        percentage: ((parseInt(item.count) / (parseInt(overallStats.total_donations) || 1)) * 100).toFixed(2)
      }))
    };

    res.status(200).json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error('Error fetching donation analytics:', error);
    throw new AppError('Failed to fetch donation analytics', 500, true, 'ANALYTICS_FETCH_FAILED');
  }
});

module.exports = {
  createOrder,
  confirmPayment,
  getCampaignDonations,
  getRecentDonations,
  getDonationReceipt,
  downloadReceipt,
  emailReceipt,
  // Admin endpoints
  createManualDonation,
  updateDonation,
  getTopDonors,
  getRecurringDonations,
  exportDonations,
  getDonationAnalytics
};