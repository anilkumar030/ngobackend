/**
 * Utility functions for common operations
 */

/**
 * Generate SEO-friendly slug from text
 */
const generateSlug = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading and trailing hyphens
};

/**
 * Format currency for display
 */
const formatCurrency = (amount, currency = 'INR') => {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  });
  return formatter.format(amount);
};

/**
 * Generate random string
 */
const generateRandomString = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generate random numeric code
 */
const generateRandomCode = (length = 6) => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
};

/**
 * Calculate pagination offset
 */
const getPaginationOffset = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  return (pageNum - 1) * limitNum;
};

/**
 * Get pagination metadata
 */
const getPaginationMeta = (page, limit, totalCount) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const totalPages = Math.ceil(totalCount / limitNum);
  
  return {
    currentPage: pageNum,
    totalPages: totalPages,
    totalCount: totalCount,
    hasNext: pageNum < totalPages,
    hasPrevious: pageNum > 1,
    itemsPerPage: limitNum
  };
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format (Indian)
 */
const isValidIndianPhone = (phone) => {
  const phoneRegex = /^[+]?[1-9][\d\s-()]+$/;
  const cleanPhone = phone.replace(/[\s-()]/g, '');
  return phoneRegex.test(phone) && cleanPhone.length >= 10;
};

/**
 * Sanitize HTML content
 */
const sanitizeHtml = (html) => {
  // Basic HTML sanitization - in production, use a library like DOMPurify
  return html
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+="[^"]*"/gi, '');
};

/**
 * Extract text from HTML
 */
const extractTextFromHtml = (html) => {
  return html.replace(/<[^>]*>/g, '').trim();
};

/**
 * Truncate text with ellipsis
 */
const truncateText = (text, maxLength = 150) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

/**
 * Convert bytes to human readable format
 */
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
};

/**
 * Check if string is valid UUID
 */
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Deep clone object
 */
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Remove empty properties from object
 */
const removeEmptyProperties = (obj) => {
  const cleaned = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== null && obj[key] !== undefined && obj[key] !== '') {
      cleaned[key] = obj[key];
    }
  });
  return cleaned;
};

/**
 * Calculate time difference in human readable format
 */
const getTimeAgo = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);

  if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
};

module.exports = {
  generateSlug,
  formatCurrency,
  generateRandomString,
  generateRandomCode,
  getPaginationOffset,
  getPaginationMeta,
  isValidEmail,
  isValidIndianPhone,
  sanitizeHtml,
  extractTextFromHtml,
  truncateText,
  formatBytes,
  isValidUUID,
  deepClone,
  removeEmptyProperties,
  getTimeAgo
};