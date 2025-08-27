const jwt = require('jsonwebtoken');
const { User } = require('../models');
const config = require('../config/environment');
const { redisUtils, CACHE_KEYS } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Middleware to authenticate JWT tokens
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      logger.contextLogger.security('Missing authentication token', 'warn', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });
      
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Check if token is blacklisted (logout/refresh scenarios)
    const isBlacklisted = await redisUtils.exists(`blacklisted_token:${token}`);
    if (isBlacklisted) {
      logger.contextLogger.security('Attempted use of blacklisted token', 'warn', {
        userId: decoded.userId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked',
      });
    }

    // Try to get user from cache first
    let user = await redisUtils.get(CACHE_KEYS.USER_PROFILE(decoded.userId));
    
    if (!user) {
      // If not in cache, fetch from database
      user = await User.findByPk(decoded.userId, {
        attributes: { exclude: ['password', 'refresh_token'] },
      });

      if (!user) {
        logger.contextLogger.security('Token for non-existent user', 'warn', {
          userId: decoded.userId,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });
        
        return res.status(401).json({
          success: false,
          message: 'User not found',
        });
      }

      // Cache user profile for future requests
      await redisUtils.set(CACHE_KEYS.USER_PROFILE(user.id), user, 3600); // 1 hour
    }

    // Check if user is active
    if (!user.is_active) {
      logger.contextLogger.security('Inactive user attempted access', 'warn', {
        userId: user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated',
      });
    }

    // Attach user to request
    req.user = user;
    req.token = token;

    logger.contextLogger.auth('Token authenticated', user.id, {
      email: user.email,
      role: user.role,
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.contextLogger.security('Invalid JWT token', 'warn', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    if (error.name === 'TokenExpiredError') {
      logger.contextLogger.security('Expired JWT token', 'info', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    logger.logError(error, {
      middleware: 'authenticateToken',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};

/**
 * Middleware to check if user has required role
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      logger.contextLogger.security('Unauthorized role access attempt', 'warn', {
        userId: req.user.id,
        userRole,
        requiredRoles: allowedRoles,
        path: req.path,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }

    next();
  };
};

/**
 * Middleware for admin-only routes
 */
const requireAdmin = requireRole(['admin', 'super_admin']);

/**
 * Middleware for super admin-only routes
 */
const requireSuperAdmin = requireRole(['super_admin']);

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(); // Continue without user
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Check if token is blacklisted
    const isBlacklisted = await redisUtils.exists(`blacklisted_token:${token}`);
    if (isBlacklisted) {
      return next(); // Continue without user
    }

    // Try to get user from cache first
    let user = await redisUtils.get(CACHE_KEYS.USER_PROFILE(decoded.userId));
    
    if (!user) {
      user = await User.findByPk(decoded.userId, {
        attributes: { exclude: ['password', 'refresh_token'] },
      });

      if (user && user.is_active) {
        await redisUtils.set(CACHE_KEYS.USER_PROFILE(user.id), user, 3600);
        req.user = user;
        req.token = token;
      }
    } else if (user.is_active) {
      req.user = user;
      req.token = token;
    }

    next();
  } catch (error) {
    // For optional auth, we don't return errors, just continue without user
    next();
  }
};

/**
 * Middleware to check resource ownership
 */
const requireOwnership = (resourceField = 'user_id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Admin and super admin can access any resource
    if (['admin', 'super_admin'].includes(req.user.role)) {
      return next();
    }

    // For regular users, check if they own the resource
    // This will be used with middleware that sets req.resource
    if (req.resource && req.resource[resourceField] !== req.user.id) {
      logger.contextLogger.security('Unauthorized resource access attempt', 'warn', {
        userId: req.user.id,
        resourceOwnerId: req.resource[resourceField],
        path: req.path,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied: not resource owner',
      });
    }

    next();
  };
};

/**
 * Middleware to blacklist token (for logout)
 */
const blacklistToken = async (req, res, next) => {
  if (req.token) {
    try {
      // Get token expiry
      const decoded = jwt.decode(req.token);
      const expiryTime = decoded.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const ttl = Math.floor((expiryTime - currentTime) / 1000); // TTL in seconds

      if (ttl > 0) {
        // Blacklist token until its natural expiry
        await redisUtils.set(`blacklisted_token:${req.token}`, true, ttl);
      }

      logger.contextLogger.auth('Token blacklisted', req.user?.id, {
        tokenExp: new Date(expiryTime).toISOString(),
      });
    } catch (error) {
      logger.logError(error, {
        middleware: 'blacklistToken',
        userId: req.user?.id,
      });
    }
  }
  next();
};

/**
 * Middleware to check if user is verified
 */
const requireVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (!req.user.is_email_verified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }

  next();
};

/**
 * Middleware to rate limit per user
 */
const userRateLimit = (maxRequests = 60, windowMs = 60000) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next();
    }

    try {
      const key = `user_rate_limit:${req.user.id}`;
      const current = await redisUtils.incr(key);

      if (current === 1) {
        // First request in window, set expiry
        await redisUtils.expire(key, Math.floor(windowMs / 1000));
      }

      if (current > maxRequests) {
        logger.contextLogger.security('User rate limit exceeded', 'warn', {
          userId: req.user.id,
          requests: current,
          maxRequests,
          windowMs,
        });

        return res.status(429).json({
          success: false,
          message: 'Too many requests, please slow down',
        });
      }

      next();
    } catch (error) {
      logger.logError(error, {
        middleware: 'userRateLimit',
        userId: req.user?.id,
      });
      next(); // Continue on Redis errors
    }
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireSuperAdmin,
  optionalAuth,
  requireOwnership,
  blacklistToken,
  requireVerification,
  userRateLimit,
};