/**
 * Redis utility functions
 * Simple cache implementation - can be replaced with actual Redis client later
 */

class RedisUtils {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Set a value with expiration
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @param {string} value - Value to cache
   */
  async setex(key, ttl, value) {
    this.cache.set(key, {
      value,
      expires: Date.now() + (ttl * 1000)
    });
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {string|null} - Cached value or null
   */
  async get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  /**
   * Delete a key from cache
   * @param {string} key - Cache key
   */
  async del(key) {
    this.cache.delete(key);
  }

  /**
   * Delete keys matching a pattern
   * @param {string} pattern - Pattern to match (simplified)
   */
  async deletePattern(pattern) {
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  async flushall() {
    this.cache.clear();
  }

  /**
   * Ping to check if Redis is alive
   * @returns {string} - Returns 'PONG'
   */
  async ping() {
    return 'PONG';
  }
}

module.exports = new RedisUtils();