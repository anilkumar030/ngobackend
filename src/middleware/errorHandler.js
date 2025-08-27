const logger = require('../utils/logger');
const config = require('../config/environment');

/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true, code = null) {
    super(message);
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = isOperational;
    this.code = code;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle Sequelize validation errors
 */
const handleSequelizeValidationError = (error) => {
  const errors = error.errors?.map(err => ({
    field: err.path,
    message: err.message,
    value: err.value,
    type: err.validatorKey || err.type,
  })) || [];

  return new AppError(
    'Validation failed',
    400,
    true,
    'VALIDATION_ERROR',
    errors
  );
};

/**
 * Handle Sequelize unique constraint error
 */
const handleSequelizeUniqueError = (error) => {
  const field = error.errors?.[0]?.path || 'field';
  const value = error.errors?.[0]?.value || '';
  
  return new AppError(
    `${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' already exists`,
    409,
    true,
    'DUPLICATE_ENTRY'
  );
};

/**
 * Handle Sequelize foreign key constraint error
 */
const handleSequelizeForeignKeyError = (error) => {
  return new AppError(
    'Referenced resource does not exist',
    400,
    true,
    'FOREIGN_KEY_CONSTRAINT'
  );
};

/**
 * Handle Sequelize database connection error
 */
const handleSequelizeDatabaseError = (error) => {
  logger.logError(error, { context: 'database_connection' });
  
  return new AppError(
    'Database connection failed',
    503,
    true,
    'DATABASE_CONNECTION_ERROR'
  );
};

/**
 * Handle JWT errors
 */
const handleJWTError = (error) => {
  if (error.name === 'JsonWebTokenError') {
    return new AppError('Invalid token', 401, true, 'INVALID_TOKEN');
  }
  
  if (error.name === 'TokenExpiredError') {
    return new AppError('Token expired', 401, true, 'TOKEN_EXPIRED');
  }
  
  return new AppError('Authentication failed', 401, true, 'AUTH_ERROR');
};

/**
 * Handle Multer errors (file upload)
 */
const handleMulterError = (error) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new AppError(
      'File size too large',
      400,
      true,
      'FILE_TOO_LARGE'
    );
  }
  
  if (error.code === 'LIMIT_FILE_COUNT') {
    return new AppError(
      'Too many files uploaded',
      400,
      true,
      'TOO_MANY_FILES'
    );
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError(
      'Unexpected file field',
      400,
      true,
      'UNEXPECTED_FILE'
    );
  }
  
  return new AppError(
    'File upload error',
    400,
    true,
    'UPLOAD_ERROR'
  );
};

/**
 * Handle Razorpay errors
 */
const handleRazorpayError = (error) => {
  if (error.statusCode) {
    return new AppError(
      error.error?.description || 'Payment processing failed',
      error.statusCode,
      true,
      'PAYMENT_ERROR'
    );
  }
  
  return new AppError(
    'Payment service unavailable',
    503,
    true,
    'PAYMENT_SERVICE_ERROR'
  );
};

/**
 * Handle Cloudinary errors
 */
const handleCloudinaryError = (error) => {
  return new AppError(
    'Image upload failed',
    400,
    true,
    'IMAGE_UPLOAD_ERROR'
  );
};

/**
 * Send error response in development
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    success: false,
    error: {
      status: err.status,
      message: err.message,
      code: err.code,
      stack: err.stack,
      errors: err.errors,
    },
    timestamp: new Date().toISOString(),
  });
};

/**
 * Send error response in production
 */
const sendErrorProd = (err, res) => {
  // Operational errors: send message to client
  if (err.isOperational) {
    const response = {
      success: false,
      message: err.message,
      timestamp: new Date().toISOString(),
    };
    
    // Include code if present
    if (err.code) {
      response.code = err.code;
    }
    
    // Include validation errors if present
    if (err.errors) {
      response.errors = err.errors;
    }
    
    res.status(err.statusCode).json(response);
  } else {
    // Programming errors: log error and send generic message
    logger.logError(err, { context: 'unhandled_error' });
    
    res.status(500).json({
      success: false,
      message: 'Something went wrong',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Global error handling middleware
 */
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log the error
  logger.logError(err, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  let error = { ...err };
  error.message = err.message;

  // Handle specific error types
  if (error.name === 'SequelizeValidationError') {
    error = handleSequelizeValidationError(error);
  } else if (error.name === 'SequelizeUniqueConstraintError') {
    error = handleSequelizeUniqueError(error);
  } else if (error.name === 'SequelizeForeignKeyConstraintError') {
    error = handleSequelizeForeignKeyError(error);
  } else if (error.name === 'SequelizeDatabaseError' || error.name === 'SequelizeConnectionError') {
    error = handleSequelizeDatabaseError(error);
  } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    error = handleJWTError(error);
  } else if (error.code && error.code.startsWith('LIMIT_')) {
    error = handleMulterError(error);
  } else if (error.source === 'razorpay') {
    error = handleRazorpayError(error);
  } else if (error.name === 'CloudinaryError') {
    error = handleCloudinaryError(error);
  } else if (error.type === 'entity.parse.failed') {
    error = new AppError('Invalid JSON format', 400, true, 'INVALID_JSON');
  } else if (error.type === 'entity.too.large') {
    error = new AppError('Request payload too large', 413, true, 'PAYLOAD_TOO_LARGE');
  } else if (!error.isOperational) {
    // Convert non-operational errors to operational
    error = new AppError(
      config.env === 'production' ? 'Something went wrong' : error.message,
      500,
      true,
      'INTERNAL_SERVER_ERROR'
    );
  }

  // Send error response
  if (config.env === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

/**
 * Handle async errors wrapper
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

/**
 * Handle 404 errors
 */
const handleNotFound = (req, res, next) => {
  const err = new AppError(
    `Can't find ${req.originalUrl} on this server`,
    404,
    true,
    'ROUTE_NOT_FOUND'
  );
  next(err);
};

/**
 * Validation error helper
 */
const createValidationError = (message, errors = null) => {
  const error = new AppError(message, 400, true, 'VALIDATION_ERROR');
  if (errors) {
    error.errors = errors;
  }
  return error;
};

/**
 * Authorization error helper
 */
const createAuthError = (message = 'Access denied') => {
  return new AppError(message, 403, true, 'ACCESS_DENIED');
};

/**
 * Not found error helper
 */
const createNotFoundError = (resource = 'Resource') => {
  return new AppError(`${resource} not found`, 404, true, 'NOT_FOUND');
};

/**
 * Conflict error helper
 */
const createConflictError = (message) => {
  return new AppError(message, 409, true, 'CONFLICT');
};

/**
 * Service unavailable error helper
 */
const createServiceUnavailableError = (service = 'Service') => {
  return new AppError(`${service} is currently unavailable`, 503, true, 'SERVICE_UNAVAILABLE');
};

module.exports = {
  AppError,
  globalErrorHandler,
  catchAsync,
  handleNotFound,
  createValidationError,
  createAuthError,
  createNotFoundError,
  createConflictError,
  createServiceUnavailableError,
};