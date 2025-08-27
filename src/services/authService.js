const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const config = require('../config/environment');
const { redisUtils, CACHE_KEYS } = require('../config/redis');
const emailService = require('./emailService');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class AuthService {
  /**
   * Hash password using bcrypt
   */
  async hashPassword(password) {
    try {
      const saltRounds = config.security.bcryptRounds;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      logger.logError(error, { service: 'AuthService', method: 'hashPassword' });
      throw new AppError('Password hashing failed', 500);
    }
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.logError(error, { service: 'AuthService', method: 'comparePassword' });
      throw new AppError('Password comparison failed', 500);
    }
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(userId, email, role) {
    try {
      const payload = {
        userId,
        email,
        role,
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
      };

      return jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expire,
      });
    } catch (error) {
      logger.logError(error, { service: 'AuthService', method: 'generateAccessToken' });
      throw new AppError('Token generation failed', 500);
    }
  }

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(userId, email) {
    try {
      const payload = {
        userId,
        email,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
      };

      return jwt.sign(payload, config.jwt.refreshSecret, {
        expiresIn: config.jwt.refreshExpire,
      });
    } catch (error) {
      logger.logError(error, { service: 'AuthService', method: 'generateRefreshToken' });
      throw new AppError('Refresh token generation failed', 500);
    }
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(userId, email, role) {
    const accessToken = this.generateAccessToken(userId, email, role);
    const refreshToken = this.generateRefreshToken(userId, email);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: config.jwt.expire,
    };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token, isRefreshToken = false) {
    try {
      const secret = isRefreshToken ? config.jwt.refreshSecret : config.jwt.secret;
      return jwt.verify(token, secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError('Token has expired', 401, true, 'TOKEN_EXPIRED');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AppError('Invalid token', 401, true, 'INVALID_TOKEN');
      }
      logger.logError(error, { service: 'AuthService', method: 'verifyToken' });
      throw new AppError('Token verification failed', 401);
    }
  }

  /**
   * Register new user
   */
  async register(userData) {
    try {
      const {
        first_name,
        last_name,
        email,
        phone,
        password,
        terms_accepted,
        newsletter_subscribed = false,
      } = userData;

      // Check if user already exists
      const existingUser = await User.findOne({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        throw new AppError('User already exists with this email', 409, true, 'USER_EXISTS');
      }

      // Hash password
      const hashedPassword = await this.hashPassword(password);

      // Generate email verification token
      const emailVerificationToken = this.generateEmailVerificationToken();

      // Create user
      const user = await User.create({
        first_name,
        last_name,
        email: email.toLowerCase(),
        phone_number: phone,
        password_hash: hashedPassword,
        email_verification_token: emailVerificationToken,
        is_email_verified: false,
        is_active: true,
        role: 'user',
      });

      // Send verification email
      await emailService.sendVerificationEmail(user.email, emailVerificationToken, {
        first_name: user.first_name,
      });

      // Log successful registration
      logger.contextLogger.auth('User registered', user.id, {
        email: user.email,
        phone: user.phone,
      });

      // Return user data without password
      const { password: _, ...userWithoutPassword } = user.toJSON();
      return userWithoutPassword;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.logError(error, { service: 'AuthService', method: 'register' });
      throw new AppError('Registration failed', 500);
    }
  }

  /**
   * Login user
   */
  async login(email, password, rememberMe = false) {
    try {
      // Find user by email
      const user = await User.findOne({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        throw new AppError('Invalid email or password', 401, true, 'INVALID_CREDENTIALS');
      }

      // Check if user is active
      if (!user.is_active) {
        throw new AppError('Account is deactivated', 403, true, 'ACCOUNT_DEACTIVATED');
      }

      // Compare password
      const isPasswordValid = await this.comparePassword(password, user.password_hash);
      if (!isPasswordValid) {
        // Log failed login attempt
        logger.contextLogger.security('Failed login attempt', 'warn', {
          email,
          ip: this.currentIp,
        });
        throw new AppError('Invalid email or password', 401, true, 'INVALID_CREDENTIALS');
      }

      // Generate tokens
      const tokens = this.generateTokenPair(user.id, user.email, user.role);

      // Store refresh token in database
      await user.update({
        refresh_token: tokens.refreshToken,
        last_login: new Date(),
      });

      // Cache user session
      await redisUtils.set(
        CACHE_KEYS.USER_SESSION(user.id),
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          loginTime: new Date().toISOString(),
        },
        rememberMe ? 7 * 24 * 3600 : 24 * 3600 // 7 days if remember me, 1 day otherwise
      );

      // Log successful login
      logger.contextLogger.auth('User login', user.id, {
        email: user.email,
        rememberMe,
      });

      // Return user data and tokens
      const { password: _, refresh_token: __, ...userWithoutSensitiveData } = user.toJSON();
      
      return {
        user: userWithoutSensitiveData,
        tokens,
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.logError(error, { service: 'AuthService', method: 'login' });
      throw new AppError('Login failed', 500);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = this.verifyToken(refreshToken, true);

      // Find user and check if refresh token matches
      const user = await User.findOne({
        where: { 
          id: decoded.userId,
          refresh_token: refreshToken,
        },
      });

      if (!user) {
        throw new AppError('Invalid refresh token', 401, true, 'INVALID_REFRESH_TOKEN');
      }

      if (!user.is_active) {
        throw new AppError('Account is deactivated', 403, true, 'ACCOUNT_DEACTIVATED');
      }

      // Generate new tokens
      const tokens = this.generateTokenPair(user.id, user.email, user.role);

      // Update refresh token in database
      await user.update({
        refresh_token: tokens.refreshToken,
      });

      // Update cached session
      await redisUtils.set(
        CACHE_KEYS.USER_SESSION(user.id),
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          refreshTime: new Date().toISOString(),
        },
        24 * 3600 // 1 day
      );

      logger.contextLogger.auth('Token refreshed', user.id);

      return tokens;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.logError(error, { service: 'AuthService', method: 'refreshToken' });
      throw new AppError('Token refresh failed', 500);
    }
  }

  /**
   * Logout user
   */
  async logout(userId, token) {
    try {
      // Remove refresh token from database
      await User.update(
        { refresh_token: null },
        { where: { id: userId } }
      );

      // Remove cached session
      await redisUtils.del(CACHE_KEYS.USER_SESSION(userId));

      // Blacklist the access token
      const decoded = jwt.decode(token);
      if (decoded) {
        const ttl = decoded.exp * 1000 - Date.now();
        if (ttl > 0) {
          await redisUtils.set(`blacklisted_token:${token}`, true, Math.floor(ttl / 1000));
        }
      }

      logger.contextLogger.auth('User logout', userId);

    } catch (error) {
      logger.logError(error, { service: 'AuthService', method: 'logout' });
      throw new AppError('Logout failed', 500);
    }
  }

  /**
   * Generate email verification token
   */
  generateEmailVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate secure password for new users
   */
  generateSecurePassword(length = 12) {
    try {
      // Define character sets
      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
      const numbers = '0123456789';
      const symbols = '!@#$%^&*';
      
      // Ensure password has at least one character from each set
      const requiredChars = [
        uppercase[Math.floor(Math.random() * uppercase.length)],
        lowercase[Math.floor(Math.random() * lowercase.length)],
        numbers[Math.floor(Math.random() * numbers.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
      ];
      
      // Fill remaining characters randomly from all sets
      const allChars = uppercase + lowercase + numbers + symbols;
      const remainingLength = length - requiredChars.length;
      
      for (let i = 0; i < remainingLength; i++) {
        requiredChars.push(allChars[Math.floor(Math.random() * allChars.length)]);
      }
      
      // Shuffle the password characters
      for (let i = requiredChars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [requiredChars[i], requiredChars[j]] = [requiredChars[j], requiredChars[i]];
      }
      
      return requiredChars.join('');
    } catch (error) {
      logger.logError(error, { service: 'AuthService', method: 'generateSecurePassword' });
      throw new AppError('Password generation failed', 500);
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(token) {
    try {
      const user = await User.findOne({
        where: { email_verification_token: token },
      });

      if (!user) {
        throw new AppError('Invalid verification token', 400, true, 'INVALID_VERIFICATION_TOKEN');
      }

      if (user.is_email_verified) {
        throw new AppError('Email already verified', 400, true, 'EMAIL_ALREADY_VERIFIED');
      }

      // Update user
      await user.update({
        is_email_verified: true,
        email_verification_token: null,
        email_verified_at: new Date(),
      });

      logger.contextLogger.auth('Email verified', user.id, { email: user.email });

      return user;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.logError(error, { service: 'AuthService', method: 'verifyEmail' });
      throw new AppError('Email verification failed', 500);
    }
  }

  /**
   * Resend email verification
   */
  async resendEmailVerification(email) {
    try {
      const user = await User.findOne({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        throw new AppError('User not found', 404, true, 'USER_NOT_FOUND');
      }

      if (user.is_email_verified) {
        throw new AppError('Email already verified', 400, true, 'EMAIL_ALREADY_VERIFIED');
      }

      // Generate new verification token
      const emailVerificationToken = this.generateEmailVerificationToken();

      await user.update({
        email_verification_token: emailVerificationToken,
      });

      // Send verification email
      await emailService.sendVerificationEmail(user.email, emailVerificationToken, {
        first_name: user.first_name,
      });

      logger.contextLogger.auth('Verification email resent', user.id, { email: user.email });

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.logError(error, { service: 'AuthService', method: 'resendEmailVerification' });
      throw new AppError('Failed to resend verification email', 500);
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email) {
    try {
      const user = await User.findOne({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        // For security, don't reveal that user doesn't exist
        logger.contextLogger.security('Password reset requested for non-existent email', 'warn', {
          email,
        });
        return;
      }

      // Generate reset token
      const resetToken = this.generatePasswordResetToken();
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour

      await user.update({
        reset_password_token: resetToken,
        reset_password_expires: resetExpires,
      });

      // Cache reset token for additional validation
      await redisUtils.set(
        CACHE_KEYS.PASSWORD_RESET(resetToken),
        {
          userId: user.id,
          email: user.email,
          createdAt: new Date().toISOString(),
        },
        3600 // 1 hour
      );

      // Send reset email
      await emailService.sendPasswordResetEmail(user.email, resetToken, {
        first_name: user.first_name,
      });

      logger.contextLogger.auth('Password reset requested', user.id, { email: user.email });

    } catch (error) {
      logger.logError(error, { service: 'AuthService', method: 'sendPasswordReset' });
      throw new AppError('Failed to send password reset email', 500);
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword) {
    try {
      const user = await User.findOne({
        where: {
          reset_password_token: token,
          reset_password_expires: {
            [require('sequelize').Op.gt]: new Date(),
          },
        },
      });

      if (!user) {
        throw new AppError('Invalid or expired reset token', 400, true, 'INVALID_RESET_TOKEN');
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update user
      await user.update({
        password_hash: hashedPassword,
        reset_password_token: null,
        reset_password_expires: null,
      });

      // Remove from cache
      await redisUtils.del(CACHE_KEYS.PASSWORD_RESET(token));

      // Invalidate all user sessions
      await redisUtils.del(CACHE_KEYS.USER_SESSION(user.id));
      await user.update({ refresh_token: null });

      logger.contextLogger.auth('Password reset', user.id, { email: user.email });

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.logError(error, { service: 'AuthService', method: 'resetPassword' });
      throw new AppError('Password reset failed', 500);
    }
  }

  /**
   * Change user password (authenticated)
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new AppError('User not found', 404, true, 'USER_NOT_FOUND');
      }

      // Verify current password
      const isCurrentPasswordValid = await this.comparePassword(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        throw new AppError('Current password is incorrect', 400, true, 'INVALID_CURRENT_PASSWORD');
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update password
      await user.update({ password_hash: hashedPassword });

      // Invalidate all sessions except current (optional - for security)
      await redisUtils.del(CACHE_KEYS.USER_SESSION(user.id));

      logger.contextLogger.auth('Password changed', user.id);

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.logError(error, { service: 'AuthService', method: 'changePassword' });
      throw new AppError('Password change failed', 500);
    }
  }
}

module.exports = new AuthService();