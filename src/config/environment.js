const Joi = require('joi');

// Environment validation schema
const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(5000),
  PROJECT_NAME: Joi.string().default('BDRF'),
  
  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_POOL_MIN: Joi.number().min(1).default(2),
  DB_POOL_MAX: Joi.number().min(1).default(10),
  DB_IDLE_TIMEOUT: Joi.number().min(1000).default(30000),
  DB_ACQUIRE_TIMEOUT: Joi.number().min(1000).default(60000),
  
  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().min(0).max(15).default(0),
  REDIS_TTL: Joi.number().min(60).default(3600),
  
  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRE: Joi.string().default('24h'),
  JWT_REFRESH_EXPIRE: Joi.string().default('7d'),
  
  // Razorpay
  RAZORPAY_KEY_ID: Joi.string().required(),
  RAZORPAY_KEY_SECRET: Joi.string().required(),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().required(),
  
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),
  
  // Email
  EMAIL_SERVICE: Joi.string().default('gmail'),
  EMAIL_USER: Joi.string().email().required(),
  EMAIL_PASSWORD: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().required(),
  
  // URLs
  FRONTEND_URL: Joi.string().uri().required(),
  ADMIN_URL: Joi.string().uri().required(),
  BACKEND_URL: Joi.string().uri().default('http://localhost:5000'),
  ALLOWED_ORIGINS: Joi.string().required(),
  
  // File Upload
  MAX_FILE_SIZE: Joi.number().min(1024).default(10485760), // 10MB
  ALLOWED_FILE_TYPES: Joi.string().default('image/jpeg,image/png,image/gif,image/webp'),
  
  // Security
  BCRYPT_ROUNDS: Joi.number().min(10).max(15).default(12),
  SESSION_SECRET: Joi.string().min(32).required(),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().min(60000).default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().min(1).default(100),
  AUTH_RATE_LIMIT_MAX: Joi.number().min(1).default(5),
  PAYMENT_RATE_LIMIT_MAX: Joi.number().min(1).default(10),
  
  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
  LOG_FILE_PATH: Joi.string().default('logs/app.log'),
  LOG_ERROR_FILE_PATH: Joi.string().default('logs/error.log'),
  
  // Application
  DEFAULT_CURRENCY: Joi.string().length(3).default('INR'),
  DEFAULT_LANGUAGE: Joi.string().length(2).default('en'),
  TIMEZONE: Joi.string().default('Asia/Kolkata'),
}).unknown();

// Validate environment variables
const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  projectName: envVars.PROJECT_NAME,
  
  database: {
    host: envVars.DB_HOST,
    port: envVars.DB_PORT,
    name: envVars.DB_NAME,
    username: envVars.DB_USER,
    password: envVars.DB_PASSWORD,
    pool: {
      min: envVars.DB_POOL_MIN,
      max: envVars.DB_POOL_MAX,
      idle: envVars.DB_IDLE_TIMEOUT,
      acquire: envVars.DB_ACQUIRE_TIMEOUT,
    },
  },
  
  redis: {
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD,
    db: envVars.REDIS_DB,
    ttl: envVars.REDIS_TTL,
  },
  
  jwt: {
    secret: envVars.JWT_SECRET,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    expire: envVars.JWT_EXPIRE,
    refreshExpire: envVars.JWT_REFRESH_EXPIRE,
  },
  
  razorpay: {
    keyId: envVars.RAZORPAY_KEY_ID,
    keySecret: envVars.RAZORPAY_KEY_SECRET,
    webhookSecret: envVars.RAZORPAY_WEBHOOK_SECRET,
  },
  
  cloudinary: {
    cloudName: envVars.CLOUDINARY_CLOUD_NAME,
    apiKey: envVars.CLOUDINARY_API_KEY,
    apiSecret: envVars.CLOUDINARY_API_SECRET,
  },
  
  email: {
    service: envVars.EMAIL_SERVICE,
    user: envVars.EMAIL_USER,
    password: envVars.EMAIL_PASSWORD,
    from: envVars.EMAIL_FROM,
  },
  
  urls: {
    frontend: envVars.FRONTEND_URL,
    admin: envVars.ADMIN_URL,
    backend: envVars.BACKEND_URL,
    allowedOrigins: envVars.ALLOWED_ORIGINS.split(','),
  },
  
  upload: {
    maxFileSize: envVars.MAX_FILE_SIZE,
    allowedTypes: envVars.ALLOWED_FILE_TYPES.split(','),
  },
  
  security: {
    bcryptRounds: envVars.BCRYPT_ROUNDS,
    sessionSecret: envVars.SESSION_SECRET,
  },
  
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
    authMax: envVars.AUTH_RATE_LIMIT_MAX,
    paymentMax: envVars.PAYMENT_RATE_LIMIT_MAX,
  },
  
  logging: {
    level: envVars.LOG_LEVEL,
    filePath: envVars.LOG_FILE_PATH,
    errorFilePath: envVars.LOG_ERROR_FILE_PATH,
  },
  
  app: {
    currency: envVars.DEFAULT_CURRENCY,
    language: envVars.DEFAULT_LANGUAGE,
    timezone: envVars.TIMEZONE,
  },
};

module.exports = config;