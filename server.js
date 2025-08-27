console.log('🔄 Loading dependencies...');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

console.log('🔄 Loading application modules...');
const logger = require('./src/utils/logger');
const { sequelize } = require('./src/config/database');
const redisClient = require('./src/config/redis');
const { globalErrorHandler } = require('./src/middleware/errorHandler');
const { requestLogger } = require('./src/middleware/requestLogger');
const routes = require('./src/routes');

console.log('✅ All dependencies loaded successfully');

console.log('🚀 Creating Express app...');
const app = express();
const PORT = process.env.PORT || 5000;
console.log('📊 Setting up Express configuration...');

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);
console.log('✅ Proxy trust set');

// Security middleware
console.log('🔒 Setting up security middleware...');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
console.log('✅ Helmet security configured');

// CORS configuration
console.log('🌐 Setting up CORS...');
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004'];
    
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 5 authentication requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
  },
  skipSuccessfulRequests: true,
});

// Strict rate limiter for payment creation/processing
const paymentCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 payment creation requests per windowMs
  message: {
    error: 'Too many payment creation requests, please try again later.',
  },
});

// More lenient rate limiter for donation history and queries
const donationQueryLimiter = rateLimit({
  windowMs: 15 * 60 * 10000, // 15 minutes
  max: 50, // Limit each IP to 50 donation query requests per windowMs
  message: {
    error: 'Too many donation queries, please try again later.',
  },
  skip: (req) => {
    // Skip this limiter entirely, let it be handled by the specific routes
    return false;
  },
});

// General payment limiter for other payment endpoints
const generalPaymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // Limit each IP to 25 general payment requests per windowMs
  message: {
    error: 'Too many payment requests, please try again later.',
  },
  skip: (req) => {
    // Skip general payment limiter for donations, orders, and statistics endpoints
    return req.path.includes('/donations') || req.path.includes('/orders') || req.path.includes('/statistics');
  },
});

// Apply specific rate limits to payment endpoints FIRST (order matters!)
// More specific paths first, then general paths
app.use('/api/payment/donations/create-order', paymentCreationLimiter);
app.use('/api/payment/orders/create-order', paymentCreationLimiter);
app.use('/api/payment/verify', paymentCreationLimiter);
app.use('/api/payment/refunds', paymentCreationLimiter);
app.use('/api/payment/donations', donationQueryLimiter);
app.use('/api/payment/orders', donationQueryLimiter); // Also apply to order history
app.use('/api/payment/statistics', donationQueryLimiter); // Apply to payment statistics
app.use('/api/payment/', generalPaymentLimiter);

// Apply general rate limiting to other API endpoints
app.use('/api/auth/', authLimiter);
app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Static file serving for uploads
console.log('📁 Setting up static file serving...');
// Serve from both /uploads (existing) and /upload (new) for backward compatibility
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1h', // Cache for 1 hour
  etag: true,
  setHeaders: (res, filePath) => {
    // Set appropriate headers for images
    if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
    }
  }
}));

// Serve files from new upload directory structure
app.use('/upload', express.static(path.join(__dirname, 'upload'), {
  maxAge: '1h', // Cache for 1 hour
  etag: true,
  setHeaders: (res, filePath) => {
    // Security headers
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    
    // Set appropriate headers for images
    if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
      res.set('Content-Type', filePath.match(/\.png$/i) ? 'image/png' : 
                            filePath.match(/\.(jpg|jpeg)$/i) ? 'image/jpeg' :
                            filePath.match(/\.gif$/i) ? 'image/gif' :
                            filePath.match(/\.webp$/i) ? 'image/webp' : 'application/octet-stream');
    }
  }
}));

// Serve receipt PDFs with appropriate headers
app.use('/receipts', express.static(path.join(__dirname, 'public/receipts'), {
  maxAge: '24h', // Cache for 24 hours since receipts don't change
  etag: true,
  setHeaders: (res, filePath) => {
    // Security headers
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    
    // Set appropriate headers for PDFs
    if (filePath.match(/\.pdf$/i)) {
      res.set('Content-Type', 'application/pdf');
      res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
      // Allow inline viewing or download
      res.set('Content-Disposition', 'inline');
    }
  }
}));
console.log('✅ Static file serving configured');

// Serve test files for debugging
app.get('/test-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-campaign-form.html'));
});

app.get('/frontend-troubleshooting-script.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend-troubleshooting-script.js'));
});

// API routes
console.log('🛣️ Setting up API routes...');
app.use('/api', routes);
console.log('✅ API routes configured');

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl,
  });
});

// Error handling middleware (must be last)
app.use(globalErrorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close Redis connection
    if (redisClient && redisClient.isReady) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }

    // Close database connection
    await sequelize.close();
    logger.info('Database connection closed');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promises and exceptions
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start server
const startServer = async () => {
  try {
    console.log('📝 Starting server initialization...');
    
    // Test database connection
    console.log('🔗 Testing database connection...');
    try {
      await sequelize.authenticate();
      console.log('✅ Database connection successful');
      logger.info('Database connection established successfully');
    } catch (dbError) {
      console.log('⚠️ Database connection failed:', dbError.message);
      logger.warn('Database connection failed, continuing without DB:', dbError.message);
    }

    // Test Redis connection
    console.log('🔗 Testing Redis connection...');
    if (redisClient) {
      try {
        const result = await redisClient.ping();
        console.log('✅ Redis connection successful');
        logger.info('Redis connection established successfully');
      } catch (redisError) {
        console.log('⚠️ Redis connection failed:', redisError.message);
        logger.warn('Redis ping failed:', redisError.message);
      }
    } else {
      console.log('⚠️ Redis client not available');
    }

    // Start HTTP server
    console.log(`🚀 Starting HTTP server on port ${PORT}...`);
    const server = app.listen(PORT, () => {
      const environment = process.env.NODE_ENV || 'development';
      
      console.log('\n🚀 Server Started Successfully!');
      console.log('='.repeat(50));
      console.log(`📡 Port: ${PORT}`);
      console.log(`🌍 Environment: ${environment}`);
      console.log(`🔗 Local URL: http://localhost:${PORT}`);
      console.log(`📊 Health Check: http://localhost:${PORT}/health`);
      console.log(`🛡️  API Base: http://localhost:${PORT}/api`);
      console.log('='.repeat(50));
      
      logger.info(`Server running on port ${PORT} in ${environment} mode`);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      switch (error.code) {
        case 'EACCES':
          logger.error(`Port ${PORT} requires elevated privileges`);
          process.exit(1);
        case 'EADDRINUSE':
          logger.error(`Port ${PORT} is already in use`);
          process.exit(1);
        default:
          throw error;
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
console.log('🔄 Attempting to start server...');
console.log('⚡ About to call startServer function...');
startServer().catch(error => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
});

module.exports = app;