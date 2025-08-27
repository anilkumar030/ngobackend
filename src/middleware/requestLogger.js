const logger = require('../utils/logger');
const config = require('../config/environment');

// Get project name from environment variable with fallback
const PROJECT_NAME = process.env.PROJECT_NAME || 'Shiv Dhaam Foundation';

/**
 * Request logging middleware
 * Logs HTTP requests with timing and response information
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const { method, url, ip } = req;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  // Generate unique request ID for tracing
  const requestId = generateRequestId();
  req.requestId = requestId;
  
  // Add request ID to response headers
  res.set('X-Request-ID', requestId);
  
  // Log request start (only in development or debug mode)
  if (config.env === 'development' || config.logging.level === 'debug') {
    logger.info('HTTP Request Started', {
      requestId,
      method,
      url,
      ip,
      userAgent,
      contentLength: req.get('Content-Length') || 0,
      userId: req.user?.id,
    });
  }
  
  // Capture response data
  const originalSend = res.send;
  let responseBody = '';
  let responseSent = false;
  
  res.send = function(data) {
    responseBody = data;
    responseSent = true;
    return originalSend.call(this, data);
  };
  
  // Log response when finished
  res.on('finish', () => {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const { statusCode } = res;
    const contentLength = res.get('Content-Length') || 0;
    
    // Determine log level based on status code and response time
    let logLevel = 'info';
    if (statusCode >= 500) {
      logLevel = 'error';
    } else if (statusCode >= 400) {
      logLevel = 'warn';
    } else if (responseTime > 2000) {
      logLevel = 'warn'; // Slow response
    }
    
    // Prepare log data
    const logData = {
      requestId,
      method,
      url,
      statusCode,
      responseTime: `${responseTime}ms`,
      ip,
      userAgent,
      contentLength,
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
    };
    
    // Add performance flag for slow requests
    if (responseTime > 1000) {
      logData.slow = true;
    }
    
    // Add error information for failed requests
    if (statusCode >= 400) {
      logData.error = true;
      
      // Try to parse error message from response (only for non-sensitive routes)
      if (!isSensitiveRoute(url) && responseBody) {
        try {
          const parsedBody = JSON.parse(responseBody);
          if (parsedBody.message) {
            logData.errorMessage = parsedBody.message;
          }
          if (parsedBody.code) {
            logData.errorCode = parsedBody.code;
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    }
    
    // Log the request
    logger[logLevel]('HTTP Request Completed', logData);
    
    // Log to context logger for structured logging
    logger.contextLogger.request(req, res, responseTime);
    
    // Performance monitoring for slow requests
    if (responseTime > 2000) {
      logger.contextLogger.performance(`HTTP ${method} ${url}`, responseTime, {
        statusCode,
        userId: req.user?.id,
      });
    }
  });
  
  // Handle cases where response is not properly finished
  res.on('close', () => {
    if (!responseSent) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      logger.warn('HTTP Request Closed Unexpectedly', {
        requestId,
        method,
        url,
        responseTime: `${responseTime}ms`,
        ip,
        userAgent,
        userId: req.user?.id,
      });
    }
  });
  
  next();
};

/**
 * Generate unique request ID
 */
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
};

/**
 * Check if route contains sensitive information
 */
const isSensitiveRoute = (url) => {
  const sensitivePatterns = [
    '/auth/',
    '/payment/',
    '/admin/',
    'password',
    'token',
    'secret',
    'key',
  ];
  
  return sensitivePatterns.some(pattern => 
    url.toLowerCase().includes(pattern.toLowerCase())
  );
};

/**
 * Enhanced request logger with additional metadata
 */
const enhancedRequestLogger = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  const requestId = generateRequestId();
  
  req.requestId = requestId;
  req.startTime = startTime;
  
  // Add request metadata
  const metadata = {
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    path: req.path,
    ip: req.ip,
    protocol: req.protocol,
    secure: req.secure,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    acceptLanguage: req.get('Accept-Language'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    host: req.get('Host'),
  };
  
  // Add session info if available
  if (req.user) {
    metadata.user = {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
    };
  }
  
  // Store metadata for later use
  req.metadata = metadata;
  
  // Set response headers
  res.set('X-Request-ID', requestId);
  res.set('X-Powered-By', `${PROJECT_NAME} API`);
  
  next();
};

/**
 * API rate limiting logger
 */
const rateLimitLogger = (req, res, next) => {
  const originalRateLimit = res.rateLimit;
  
  if (originalRateLimit) {
    const { limit, current, remaining, resetTime } = originalRateLimit;
    
    // Log rate limiting information
    logger.debug('Rate Limit Info', {
      requestId: req.requestId,
      ip: req.ip,
      limit,
      current,
      remaining,
      resetTime: new Date(resetTime).toISOString(),
      userId: req.user?.id,
    });
    
    // Warn when approaching rate limit
    if (remaining <= 5) {
      logger.warn('Rate Limit Warning', {
        requestId: req.requestId,
        ip: req.ip,
        remaining,
        resetTime: new Date(resetTime).toISOString(),
        userId: req.user?.id,
      });
    }
  }
  
  next();
};

/**
 * Security event logger
 */
const securityLogger = (event, severity = 'info') => {
  return (req, res, next) => {
    logger.contextLogger.security(event, severity, {
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
      userId: req.user?.id,
      timestamp: new Date().toISOString(),
    });
    
    next();
  };
};

/**
 * Skip logging for certain routes (health checks, static files, etc.)
 */
const shouldSkipLogging = (req) => {
  const skipRoutes = [
    '/health',
    '/favicon.ico',
    '/robots.txt',
  ];
  
  const skipPatterns = [
    /^\/static\//,
    /^\/assets\//,
    /\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/,
  ];
  
  return skipRoutes.includes(req.url) || 
         skipPatterns.some(pattern => pattern.test(req.url));
};

/**
 * Conditional request logger
 */
const conditionalRequestLogger = (req, res, next) => {
  if (shouldSkipLogging(req)) {
    return next();
  }
  
  return requestLogger(req, res, next);
};

module.exports = {
  requestLogger,
  enhancedRequestLogger,
  rateLimitLogger,
  securityLogger,
  conditionalRequestLogger,
  generateRequestId,
};