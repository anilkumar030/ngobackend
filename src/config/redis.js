const Redis = require('redis');
const config = require('./environment');

let redisClient = null;

const createRedisClient = async () => {
  try {
    const options = {
      host: config.redis.host,
      port: config.redis.port,
      db: config.redis.db,
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 300,
      retryDelayOnReconnect: 50,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };

    // Add password if provided
    if (config.redis.password) {
      options.password = config.redis.password;
    }

    redisClient = Redis.createClient(options);

    // Handle Redis events
    redisClient.on('connect', () => {
      console.log('Redis connection established');
    });

    redisClient.on('ready', () => {
      console.log('Redis client ready');
    });

    redisClient.on('error', (err) => {
      console.error('Redis error:', err);
    });

    redisClient.on('end', () => {
      console.warn('Redis connection ended');
    });

    redisClient.on('reconnecting', (delay, attempt) => {
      console.log(`Redis reconnecting in ${delay}ms (attempt ${attempt})`);
    });

    // Connect to Redis
    await redisClient.connect();
    
    return redisClient;
  } catch (error) {
    console.error('Failed to create Redis client:', error);
    throw error;
  }
};

// Redis utility functions
const redisUtils = {
  // Set key with expiration
  async set(key, value, ttlSeconds = config.redis.ttl) {
    try {
      if (!redisClient || !redisClient.isReady) {
        console.warn('Redis client not ready, skipping set operation');
        return false;
      }

      const serializedValue = JSON.stringify(value);
      await redisClient.setEx(key, ttlSeconds, serializedValue);
      return true;
    } catch (error) {
      console.error(`Redis set error for key ${key}:`, error);
      return false;
    }
  },

  // Set key with expiration (alias for set)
  async setex(key, ttlSeconds, value) {
    return await this.set(key, value, ttlSeconds);
  },

  // Get key value
  async get(key) {
    try {
      if (!redisClient || !redisClient.isReady) {
        console.warn('Redis client not ready, skipping get operation');
        return null;
      }

      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Redis get error for key ${key}:`, error);
      return null;
    }
  },

  // Delete key
  async del(key) {
    try {
      if (!redisClient || !redisClient.isReady) {
        console.warn('Redis client not ready, skipping delete operation');
        return false;
      }

      const result = await redisClient.del(key);
      return result > 0;
    } catch (error) {
      console.error(`Redis delete error for key ${key}:`, error);
      return false;
    }
  },

  // Check if key exists
  async exists(key) {
    try {
      if (!redisClient || !redisClient.isReady) {
        console.warn('Redis client not ready, skipping exists operation');
        return false;
      }

      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Redis exists error for key ${key}:`, error);
      return false;
    }
  },

  // Increment key
  async incr(key) {
    try {
      if (!redisClient || !redisClient.isReady) {
        console.warn('Redis client not ready, skipping incr operation');
        return 0;
      }

      return await redisClient.incr(key);
    } catch (error) {
      console.error(`Redis incr error for key ${key}:`, error);
      return 0;
    }
  },

  // Set expiration for key
  async expire(key, seconds) {
    try {
      if (!redisClient || !redisClient.isReady) {
        console.warn('Redis client not ready, skipping expire operation');
        return false;
      }

      const result = await redisClient.expire(key, seconds);
      return result === 1;
    } catch (error) {
      console.error(`Redis expire error for key ${key}:`, error);
      return false;
    }
  },

  // Get keys by pattern
  async keys(pattern) {
    try {
      if (!redisClient || !redisClient.isReady) {
        console.warn('Redis client not ready, skipping keys operation');
        return [];
      }

      return await redisClient.keys(pattern);
    } catch (error) {
      console.error(`Redis keys error for pattern ${pattern}:`, error);
      return [];
    }
  },

  // Clear all cache
  async flushdb() {
    try {
      if (!redisClient || !redisClient.isReady) {
        console.warn('Redis client not ready, skipping flushdb operation');
        return false;
      }

      await redisClient.flushDb();
      return true;
    } catch (error) {
      console.error('Redis flushdb error:', error);
      return false;
    }
  },

  // Delete keys matching pattern
  async deletePattern(pattern) {
    try {
      if (!redisClient || !redisClient.isReady) {
        console.warn('Redis client not ready, skipping deletePattern operation');
        return false;
      }

      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return true;
    } catch (error) {
      console.error(`Redis deletePattern error for pattern ${pattern}:`, error);
      return false;
    }
  },
};

// Cache keys constants
const CACHE_KEYS = {
  USER_SESSION: (userId) => `user:session:${userId}`,
  USER_PROFILE: (userId) => `user:profile:${userId}`,
  CAMPAIGN: (campaignId) => `campaign:${campaignId}`,
  CAMPAIGNS_LIST: (page, limit, filters) => `campaigns:list:${page}:${limit}:${JSON.stringify(filters)}`,
  EVENTS_LIST: (page, limit, filters) => `events:list:${page}:${limit}:${JSON.stringify(filters)}`,
  PROJECTS_LIST: (page, limit, filters) => `projects:list:${page}:${limit}:${JSON.stringify(filters)}`,
  PROJECT_CATEGORIES: 'projects:categories',
  TESTIMONIALS_LIST: (page, limit, filters) => `testimonials:list:${page}:${limit}:${JSON.stringify(filters)}`,
  PUBLIC_STATISTICS: 'statistics:public',
  HOME_DATA: 'home:latest_data',
  PRODUCT: (productId) => `product:${productId}`,
  PRODUCTS_LIST: (page, limit, filters) => `products:list:${page}:${limit}:${JSON.stringify(filters)}`,
  BLOG_POST: (slug) => `blog:${slug}`,
  BLOG_POSTS_LIST: (page, limit, filters) => `blog:list:${page}:${limit}:${JSON.stringify(filters)}`,
  CONTENT_SECTION: (sectionType) => `content:${sectionType}`,
  GALLERY_IMAGES: (category) => `gallery:${category || 'all'}`,
  GALLERY_LIST: 'gallery:list',
  GALLERY_DETAIL: 'gallery:detail',
  GALLERY_CATEGORIES: 'gallery:categories',
  GALLERY_RELATED: 'gallery:related',
  OTP: (identifier) => `otp:${identifier}`,
  PASSWORD_RESET: (token) => `password_reset:${token}`,
  EMAIL_VERIFICATION: (token) => `email_verification:${token}`,
  RATE_LIMIT: (ip, endpoint) => `rate_limit:${ip}:${endpoint}`,
};

// Initialize Redis client
if (config.env !== 'test') {
  createRedisClient().catch(error => {
    console.error('Failed to initialize Redis client:', error);
  });
}

module.exports = {
  redisClient,
  redisUtils,
  CACHE_KEYS,
  createRedisClient,
};