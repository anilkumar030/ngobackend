const winston = require('winston');
const path = require('path');
const config = require('../config/environment');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Create transports array
const transports = [];

// Console transport (always enabled in development)
// Re-enabled for debugging - was causing issues when disabled
transports.push(
  new winston.transports.Console({
    format: consoleFormat,
    level: config.logging.level,
  })
);

// File transports (temporarily disabled for debugging)
// if (config.env !== 'test') {
//   // General log file
//   transports.push(
//     new winston.transports.File({
//       filename: path.resolve(config.logging.filePath),
//       format: logFormat,
//       level: config.logging.level,
//       maxsize: 5242880, // 5MB
//       maxFiles: 5,
//     })
//   );

//   // Error log file
//   transports.push(
//     new winston.transports.File({
//       filename: path.resolve(config.logging.errorFilePath),
//       format: logFormat,
//       level: 'error',
//       maxsize: 5242880, // 5MB
//       maxFiles: 5,
//     })
//   );
// }

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: {
    service: `${(process.env.PROJECT_NAME || 'Shiv Dhaam Foundation').toLowerCase().replace(/\s+/g, '-')}-backend`,
    environment: config.env,
  },
  transports,
  // exceptionHandlers: [
  //   new winston.transports.File({
  //     filename: path.resolve('logs/exceptions.log'),
  //     format: logFormat,
  //     maxsize: 5242880, // 5MB
  //     maxFiles: 3,
  //   })
  // ],
  // rejectionHandlers: [
  //   new winston.transports.File({
  //     filename: path.resolve('logs/rejections.log'),
  //     format: logFormat,
  //     maxsize: 5242880, // 5MB
  //     maxFiles: 3,
  //   })
  // ],
  exitOnError: false,
});

// Custom logging methods for different contexts
const contextLogger = {
  // HTTP request logging
  request: (req, res, responseTime) => {
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id,
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request Warning', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  },

  // Database operation logging
  database: (operation, model, data = {}) => {
    logger.info('Database Operation', {
      operation,
      model,
      ...data,
    });
  },

  // Authentication logging
  auth: (action, userId, data = {}) => {
    logger.info('Authentication Event', {
      action,
      userId,
      timestamp: new Date().toISOString(),
      ...data,
    });
  },

  // Payment logging
  payment: (action, paymentId, amount, data = {}) => {
    logger.info('Payment Event', {
      action,
      paymentId,
      amount,
      currency: config.app.currency,
      timestamp: new Date().toISOString(),
      ...data,
    });
  },

  // Email logging
  email: (action, recipient, subject, data = {}) => {
    logger.info('Email Event', {
      action,
      recipient,
      subject,
      timestamp: new Date().toISOString(),
      ...data,
    });
  },

  // File upload logging
  upload: (action, filename, size, data = {}) => {
    logger.info('File Upload Event', {
      action,
      filename,
      size: `${(size / 1024 / 1024).toFixed(2)}MB`,
      timestamp: new Date().toISOString(),
      ...data,
    });
  },

  // Security logging
  security: (event, level = 'warn', data = {}) => {
    logger[level]('Security Event', {
      event,
      timestamp: new Date().toISOString(),
      ...data,
    });
  },

  // Performance logging
  performance: (operation, duration, data = {}) => {
    const level = duration > 1000 ? 'warn' : 'info';
    logger[level]('Performance Metric', {
      operation,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...data,
    });
  },

  // Cache operation logging
  cache: (operation, key, hit = null, data = {}) => {
    logger.debug('Cache Operation', {
      operation,
      key,
      hit,
      timestamp: new Date().toISOString(),
      ...data,
    });
  },

  // Webhook logging
  webhook: (provider, event, data = {}) => {
    logger.info('Webhook Event', {
      provider,
      event,
      timestamp: new Date().toISOString(),
      ...data,
    });
  },
};

// Performance monitoring wrapper
const withPerformanceLogging = (fn, operationName) => {
  return async (...args) => {
    const startTime = Date.now();
    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      contextLogger.performance(operationName, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      contextLogger.performance(`${operationName}_ERROR`, duration);
      throw error;
    }
  };
};

// Error logging helper
const logError = (error, context = {}) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code,
    timestamp: new Date().toISOString(),
    ...context,
  });
};

// Success logging helper
const logSuccess = (message, context = {}) => {
  logger.info('Success', {
    message,
    timestamp: new Date().toISOString(),
    ...context,
  });
};

// Debug logging helper (only in development)
const logDebug = (message, context = {}) => {
  if (config.env === 'development') {
    logger.debug('Debug', {
      message,
      timestamp: new Date().toISOString(),
      ...context,
    });
  }
};

// Stream for Morgan HTTP logging middleware
const morganStream = {
  write: (message) => {
    logger.info(message.trim(), { source: 'morgan' });
  },
};

// Export logger with additional utilities - fix the spread issue
module.exports = Object.assign(logger, {
  contextLogger,
  withPerformanceLogging,
  logError,
  logSuccess,
  logDebug,
  morganStream,
});