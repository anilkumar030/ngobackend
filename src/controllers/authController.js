const authService = require('../services/authService');
const emailService = require('../services/emailService');
const { User } = require('../models');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { redisUtils, CACHE_KEYS } = require('../config/redis');

/**
 * Register new user
 */
const register = catchAsync(async (req, res) => {
  const userData = req.body;
  
  const user = await authService.register(userData);
  
  // Send welcome email if verification email was sent successfully
  setTimeout(async () => {
    try {
      await emailService.sendWelcomeEmail(user.email, {
        first_name: user.first_name,
        isEmailVerified: user.is_email_verified,
      });
    } catch (error) {
      logger.logError(error, { context: 'welcome_email', userId: user.id });
    }
  }, 1000);

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please check your email to verify your account.',
    data: {
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone_number: user.phone_number,
        is_email_verified: user.is_email_verified,
        is_phone_verified: user.is_phone_verified,
        created_at: user.created_at,
      },
    },
  });
});

/**
 * Login user
 */
const login = catchAsync(async (req, res) => {
  const { email, password, remember_me } = req.body;

  const result = await authService.login(email, password, remember_me);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: `${result.user.first_name} ${result.user.last_name}`,
        role: result.user.role,
        permissions: (result.user.role === 'admin' || result.user.role === 'super_admin') ? ['*'] : []
      },
      expiresIn: 3600
    },
  });
});

/**
 * Refresh access token
 */
const refreshToken = catchAsync(async (req, res) => {
  // Support both refresh_token and refreshToken field names
  const token = req.body.refresh_token || req.body.refreshToken;

  const tokens = await authService.refreshToken(token);

  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    },
  });
});

/**
 * Logout user
 */
const logout = catchAsync(async (req, res) => {
  await authService.logout(req.user.id, req.token);

  res.status(200).json({
    success: true,
    message: 'Logout successful',
  });
});

/**
 * Verify email address
 */
const verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.body;

  const user = await authService.verifyEmail(token);

  res.status(200).json({
    success: true,
    message: 'Email verified successfully',
    data: {
      user: {
        id: user.id,
        email: user.email,
        is_email_verified: user.is_email_verified,
        email_verified_at: user.email_verified_at,
      },
    },
  });
});

/**
 * Resend email verification
 */
const resendEmailVerification = catchAsync(async (req, res) => {
  const { email } = req.body;

  await authService.resendEmailVerification(email);

  res.status(200).json({
    success: true,
    message: 'Verification email sent successfully',
  });
});

/**
 * Send password reset email
 */
const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  await authService.sendPasswordReset(email);

  res.status(200).json({
    success: true,
    message: 'If an account with this email exists, you will receive a password reset link shortly.',
  });
});

/**
 * Reset password with token
 */
const resetPassword = catchAsync(async (req, res) => {
  const { token, password } = req.body;

  await authService.resetPassword(token, password);

  res.status(200).json({
    success: true,
    message: 'Password reset successful. You can now login with your new password.',
  });
});

/**
 * Change password (authenticated user)
 */
const changePassword = catchAsync(async (req, res) => {
  const { current_password, new_password } = req.body;
  const userId = req.user.id;

  await authService.changePassword(userId, current_password, new_password);

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
  });
});

/**
 * Get current user data for /api/auth/me endpoint
 */
const getMe = catchAsync(async (req, res) => {
  const user = req.user;

  res.status(200).json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      role: user.role,
      status: user.is_active ? 'active' : 'inactive',
      permissions: (user.role === 'admin' || user.role === 'super_admin') ? ['*'] : [],
      emailVerified: user.is_email_verified,
      createdAt: user.created_at,
      lastLogin: user.last_login
    },
  });
});

/**
 * Get current user profile
 */
const getProfile = catchAsync(async (req, res) => {
  const user = req.user;

  // Get additional user data with associations
  const fullUser = await User.findByPk(user.id, {
    attributes: { exclude: ['password', 'refresh_token', 'email_verification_token', 'password_reset_token'] },
    include: [
      {
        model: require('../models').UserAddress,
        as: 'addresses',
      },
    ],
  });

  if (!fullUser) {
    throw new AppError('User not found', 404, true, 'USER_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    data: {
      user: fullUser,
    },
  });
});

/**
 * Update user profile
 */
const updateProfile = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const updateData = req.body;

  // Remove sensitive fields that shouldn't be updated here
  delete updateData.email;
  delete updateData.password;
  delete updateData.role;
  delete updateData.is_active;
  delete updateData.is_email_verified;
  delete updateData.is_phone_verified;

  const user = await User.findByPk(userId);
  if (!user) {
    throw new AppError('User not found', 404, true, 'USER_NOT_FOUND');
  }

  await user.update(updateData);

  // Clear cached user profile
  await redisUtils.del(CACHE_KEYS.USER_PROFILE(userId));

  // Return updated user data
  const updatedUser = await User.findByPk(userId, {
    attributes: { exclude: ['password', 'refresh_token', 'email_verification_token', 'password_reset_token'] },
  });

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: updatedUser,
    },
  });
});

/**
 * Deactivate account
 */
const deactivateAccount = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const user = await User.findByPk(userId);
  if (!user) {
    throw new AppError('User not found', 404, true, 'USER_NOT_FOUND');
  }

  await user.update({ is_active: false });

  // Logout user (invalidate tokens)
  await authService.logout(userId, req.token);

  logger.contextLogger.auth('Account deactivated', userId, { email: user.email });

  res.status(200).json({
    success: true,
    message: 'Account deactivated successfully',
  });
});

/**
 * Delete account
 */
const deleteAccount = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const user = await User.findByPk(userId);
  if (!user) {
    throw new AppError('User not found', 404, true, 'USER_NOT_FOUND');
  }

  // Instead of hard delete, we'll soft delete or mark as deleted
  await user.update({ 
    is_active: false,
    email: `deleted_${Date.now()}_${user.email}`,
    deleted_at: new Date(),
  });

  // Logout user (invalidate tokens)
  await authService.logout(userId, req.token);

  // Clear cached data
  await redisUtils.del(CACHE_KEYS.USER_PROFILE(userId));
  await redisUtils.del(CACHE_KEYS.USER_SESSION(userId));

  logger.contextLogger.auth('Account deleted', userId, { email: user.email });

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully',
  });
});

/**
 * Get authentication status
 */
const getAuthStatus = catchAsync(async (req, res) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated',
      data: {
        isAuthenticated: false,
      },
    });
  }

  res.status(200).json({
    success: true,
    data: {
      isAuthenticated: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_email_verified: user.is_email_verified,
        is_phone_verified: user.is_phone_verified,
      },
    },
  });
});

/**
 * Send OTP for phone verification
 */
const sendOTP = catchAsync(async (req, res) => {
  const { phone } = req.body;

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Cache OTP for 10 minutes
  await redisUtils.set(CACHE_KEYS.OTP(phone), {
    otp,
    attempts: 0,
    createdAt: new Date().toISOString(),
  }, 600); // 10 minutes

  // TODO: Integrate with SMS service to send actual OTP
  // For now, we'll log it (remove in production)
  if (process.env.NODE_ENV === 'development') {
    logger.info(`OTP for ${phone}: ${otp}`);
  }

  logger.contextLogger.auth('OTP sent', req.user?.id, { phone });

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully',
    data: {
      phone,
      expiresIn: 600, // 10 minutes
    },
  });
});

/**
 * Verify OTP for phone verification
 */
const verifyOTP = catchAsync(async (req, res) => {
  const { phone, otp } = req.body;
  const userId = req.user?.id;

  // Get cached OTP data
  const otpData = await redisUtils.get(CACHE_KEYS.OTP(phone));
  
  if (!otpData) {
    throw new AppError('OTP expired or invalid', 400, true, 'OTP_EXPIRED');
  }

  // Check attempts
  if (otpData.attempts >= 3) {
    await redisUtils.del(CACHE_KEYS.OTP(phone));
    throw new AppError('Too many attempts. Please request a new OTP.', 429, true, 'TOO_MANY_ATTEMPTS');
  }

  // Verify OTP
  if (otpData.otp !== otp) {
    // Increment attempts
    otpData.attempts += 1;
    await redisUtils.set(CACHE_KEYS.OTP(phone), otpData, 600);
    
    throw new AppError('Invalid OTP', 400, true, 'INVALID_OTP');
  }

  // OTP is valid - update user phone verification if user is logged in
  if (userId) {
    const user = await User.findByPk(userId);
    if (user) {
      await user.update({
        phone,
        is_phone_verified: true,
        phone_verified_at: new Date(),
      });
      
      // Clear cached user profile
      await redisUtils.del(CACHE_KEYS.USER_PROFILE(userId));
    }
  }

  // Clear OTP
  await redisUtils.del(CACHE_KEYS.OTP(phone));

  logger.contextLogger.auth('Phone verified', userId, { phone });

  res.status(200).json({
    success: true,
    message: 'Phone number verified successfully',
    data: {
      phone,
      verified: true,
    },
  });
});

/**
 * Check if email is available
 */
const checkEmailAvailability = catchAsync(async (req, res) => {
  const { email } = req.query;

  if (!email) {
    throw new AppError('Email is required', 400, true, 'EMAIL_REQUIRED');
  }

  const existingUser = await User.findOne({
    where: { email: email.toLowerCase() },
  });

  const isAvailable = !existingUser;

  res.status(200).json({
    success: true,
    data: {
      email,
      available: isAvailable,
    },
  });
});

/**
 * Admin: Get all users with pagination and filters
 */
const getAllUsers = catchAsync(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    search = '', 
    role = '', 
    is_active = '', 
    is_email_verified = '',
    sort_by = 'created_at',
    sort_order = 'desc'
  } = req.query;

  const offset = (page - 1) * limit;

  // Build where conditions
  const whereConditions = {};
  
  if (search) {
    whereConditions[require('sequelize').Op.or] = [
      { first_name: { [require('sequelize').Op.iLike]: `%${search}%` } },
      { last_name: { [require('sequelize').Op.iLike]: `%${search}%` } },
      { email: { [require('sequelize').Op.iLike]: `%${search}%` } },
    ];
  }

  if (role) {
    whereConditions.role = role;
  }

  if (is_active !== '') {
    whereConditions.is_active = is_active === 'true';
  }

  if (is_email_verified !== '') {
    whereConditions.is_email_verified = is_email_verified === 'true';
  }

  // Get users with pagination
  const { count, rows: users } = await User.findAndCountAll({
    where: whereConditions,
    attributes: { exclude: ['password', 'refresh_token', 'email_verification_token', 'password_reset_token'] },
    order: [[sort_by, sort_order.toUpperCase()]],
    limit: parseInt(limit),
    offset: offset,
    include: [
      {
        model: require('../models').UserAddress,
        as: 'addresses',
      },
    ],
  });

  const totalPages = Math.ceil(count / limit);

  res.status(200).json({
    success: true,
    data: {
      users,
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
 * Admin: Get single user by ID
 */
const getUserById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const user = await User.findByPk(id, {
    attributes: { exclude: ['password', 'refresh_token', 'email_verification_token', 'password_reset_token'] },
    include: [
      {
        model: require('../models').UserAddress,
        as: 'addresses',
      },
      {
        model: require('../models').Donation,
        as: 'donations',
        include: [
          {
            model: require('../models').Campaign,
            as: 'campaign',
            attributes: ['id', 'title', 'slug'],
          },
        ],
      },
      {
        model: require('../models').Order,
        as: 'orders',
      },
    ],
  });

  if (!user) {
    throw new AppError('User not found', 404, true, 'USER_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    data: {
      user,
    },
  });
});

/**
 * Admin: Update user
 */
const updateUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const user = await User.findByPk(id);
  if (!user) {
    throw new AppError('User not found', 404, true, 'USER_NOT_FOUND');
  }

  // Hash password if it's being updated
  if (updateData.password) {
    updateData.password = await authService.hashPassword(updateData.password);
  }

  await user.update(updateData);

  // Clear cached user profile
  await redisUtils.del(CACHE_KEYS.USER_PROFILE(id));

  // Return updated user data
  const updatedUser = await User.findByPk(id, {
    attributes: { exclude: ['password', 'refresh_token', 'email_verification_token', 'password_reset_token'] },
  });

  logger.contextLogger.auth('User updated by admin', id, { 
    adminId: req.user.id,
    updatedFields: Object.keys(updateData),
  });

  res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: {
      user: updatedUser,
    },
  });
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  verifyEmail,
  resendEmailVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  getProfile,
  updateProfile,
  deactivateAccount,
  deleteAccount,
  getAuthStatus,
  sendOTP,
  verifyOTP,
  checkEmailAvailability,
  getAllUsers,
  getUserById,
  updateUser,
};