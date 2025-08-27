const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Validation middleware factory
 * @param {Object} schema - Object containing validation schemas for different parts of the request
 * @param {Object} schema.body - Joi schema for request body
 * @param {Object} schema.params - Joi schema for request parameters
 * @param {Object} schema.query - Joi schema for query parameters
 * @param {Object} schema.headers - Joi schema for request headers
 * @param {Object} options - Validation options
 */
const validate = (schema, options = {}) => {
  const defaultOptions = {
    abortEarly: false, // Return all validation errors, not just the first one
    allowUnknown: false, // Don't allow unknown keys
    stripUnknown: true, // Remove unknown keys from validated data
    errors: {
      wrap: {
        label: '', // Don't wrap field names in quotes
      },
    },
  };

  const validationOptions = { ...defaultOptions, ...options };

  return (req, res, next) => {
    const validationErrors = {};
    let hasErrors = false;

    // Validate request body
    if (schema.body) {
      const { error, value } = schema.body.validate(req.body, validationOptions);
      if (error) {
        validationErrors.body = formatJoiError(error);
        hasErrors = true;
      } else {
        req.body = value; // Replace with sanitized/validated data
      }
    }

    // Validate request parameters
    if (schema.params) {
      const { error, value } = schema.params.validate(req.params, validationOptions);
      if (error) {
        validationErrors.params = formatJoiError(error);
        hasErrors = true;
      } else {
        req.params = value;
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error, value } = schema.query.validate(req.query, validationOptions);
      if (error) {
        validationErrors.query = formatJoiError(error);
        hasErrors = true;
      } else {
        req.query = value;
      }
    }

    // Validate request headers
    if (schema.headers) {
      const { error, value } = schema.headers.validate(req.headers, validationOptions);
      if (error) {
        validationErrors.headers = formatJoiError(error);
        hasErrors = true;
      }
    }

    // If there are validation errors, return them
    if (hasErrors) {
      logger.contextLogger.security('Validation failed', 'warn', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        errors: validationErrors,
      });

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors,
      });
    }

    next();
  };
};

/**
 * Format Joi validation error into a more user-friendly format
 * @param {Object} error - Joi validation error
 * @returns {Array} Array of formatted error messages
 */
const formatJoiError = (error) => {
  return error.details.map(detail => ({
    field: detail.path.join('.'),
    message: detail.message,
    type: detail.type,
    value: detail.context?.value,
  }));
};

/**
 * Middleware to validate file uploads
 * @param {Object} options - Upload validation options
 * @param {Array} options.allowedTypes - Array of allowed MIME types
 * @param {Number} options.maxSize - Maximum file size in bytes
 * @param {Number} options.maxFiles - Maximum number of files
 * @param {Boolean} options.required - Whether file upload is required
 */
const validateFileUpload = (options = {}) => {
  const {
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize = 10 * 1024 * 1024, // 10MB
    maxFiles = 1,
    required = false,
  } = options;

  return (req, res, next) => {
    const files = req.files || (req.file ? [req.file] : []);
    
    // Check if file is required
    if (required && files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'File upload is required',
        errors: {
          files: [{
            field: 'files',
            message: 'At least one file must be uploaded',
            type: 'required',
          }],
        },
      });
    }

    // Check number of files
    if (files.length > maxFiles) {
      return res.status(400).json({
        success: false,
        message: `Cannot upload more than ${maxFiles} file(s)`,
        errors: {
          files: [{
            field: 'files',
            message: `Maximum ${maxFiles} file(s) allowed`,
            type: 'max_files',
          }],
        },
      });
    }

    // Validate each file
    const fileErrors = [];
    files.forEach((file, index) => {
      // Check file type
      if (!allowedTypes.includes(file.mimetype)) {
        fileErrors.push({
          field: `files[${index}]`,
          message: `File type ${file.mimetype} is not allowed`,
          type: 'invalid_type',
          allowedTypes,
        });
      }

      // Check file size
      if (file.size > maxSize) {
        fileErrors.push({
          field: `files[${index}]`,
          message: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum ${(maxSize / 1024 / 1024).toFixed(2)}MB`,
          type: 'max_size',
          maxSize,
        });
      }

      // Check if file buffer exists
      if (!file.buffer && !file.path) {
        fileErrors.push({
          field: `files[${index}]`,
          message: 'File data is missing or corrupted',
          type: 'missing_data',
        });
      }
    });

    // If there are file validation errors, return them
    if (fileErrors.length > 0) {
      logger.contextLogger.security('File validation failed', 'warn', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id,
        fileCount: files.length,
        errors: fileErrors,
      });

      return res.status(400).json({
        success: false,
        message: 'File validation failed',
        errors: {
          files: fileErrors,
        },
      });
    }

    next();
  };
};

/**
 * Middleware to validate JSON structure
 * @param {String} field - The field name to validate (e.g., 'body', 'query')
 */
const validateJSON = (field = 'body') => {
  return (req, res, next) => {
    try {
      const data = req[field];
      
      // Check if the field exists and is an object
      if (data && typeof data === 'object') {
        // Try to stringify and parse to validate JSON structure
        JSON.stringify(data);
        return next();
      }
      
      // If field doesn't exist or isn't an object, continue
      next();
    } catch (error) {
      logger.contextLogger.security('Invalid JSON structure', 'warn', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id,
        field,
        error: error.message,
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid JSON structure',
        errors: {
          [field]: [{
            field: field,
            message: 'Invalid JSON format',
            type: 'invalid_json',
          }],
        },
      });
    }
  };
};

/**
 * Middleware to sanitize input data
 */
const sanitizeInput = (req, res, next) => {
  // Sanitize strings in body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize strings in query
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * Recursively sanitize object properties
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Basic XSS protection - remove script tags and javascript: protocols
      sanitized[key] = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .trim();
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * Common validation schemas that can be reused
 */
const commonValidations = {
  // Pagination validation
  pagination: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      sort_by: Joi.string().optional(),
      sort_order: Joi.string().valid('asc', 'desc').default('desc'),
    }),
  },

  // ID parameter validation
  idParam: {
    params: Joi.object({
      id: Joi.number().integer().positive().required(),
    }),
  },

  // UUID parameter validation
  uuidParam: {
    params: Joi.object({
      id: Joi.string().uuid().required().messages({
        'string.guid': 'Invalid ID format. Expected UUID format.',
        'any.required': 'ID parameter is required',
        'string.base': 'ID must be a string'
      }),
    }),
  },

  // Search validation
  search: {
    query: Joi.object({
      q: Joi.string().trim().min(1).max(100).optional(),
      search: Joi.string().trim().min(1).max(100).optional(),
    }),
  },

  // Date range validation
  dateRange: {
    query: Joi.object({
      start_date: Joi.date().optional(),
      end_date: Joi.date().min(Joi.ref('start_date')).optional(),
    }),
  },
};

module.exports = {
  validate,
  validateFileUpload,
  validateJSON,
  sanitizeInput,
  formatJoiError,
  commonValidations,
};