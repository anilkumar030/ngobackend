const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * Sanitize HTML/text input to prevent XSS attacks
 * @param {string} input - The input string to sanitize
 * @param {object} options - Sanitization options
 * @returns {string} - Sanitized string
 */
const sanitizeInput = (input, options = {}) => {
  if (!input) return input;
  if (typeof input !== 'string') return input;

  const defaultOptions = {
    ALLOWED_TAGS: [], // No HTML tags allowed by default
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false,
    RETURN_TRUSTED_TYPE: false,
    FORCE_BODY: false,
    SANITIZE_DOM: true,
    IN_PLACE: false,
    USE_PROFILES: false,
    WHOLE_DOCUMENT: false,
    ...options
  };

  // Strip all HTML tags and return plain text
  return DOMPurify.sanitize(input, defaultOptions);
};

/**
 * Sanitize an object's string properties
 * @param {object} obj - Object to sanitize
 * @param {array} fields - Fields to sanitize (optional, defaults to all string fields)
 * @param {object} options - Sanitization options
 * @returns {object} - Object with sanitized fields
 */
const sanitizeObject = (obj, fields = null, options = {}) => {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = { ...obj };
  const fieldsToSanitize = fields || Object.keys(obj);

  fieldsToSanitize.forEach(field => {
    if (sanitized[field] && typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeInput(sanitized[field], options);
    }
  });

  return sanitized;
};

/**
 * Sanitize array of strings
 * @param {array} arr - Array to sanitize
 * @param {object} options - Sanitization options
 * @returns {array} - Array with sanitized strings
 */
const sanitizeArray = (arr, options = {}) => {
  if (!Array.isArray(arr)) return arr;
  
  return arr.map(item => {
    if (typeof item === 'string') {
      return sanitizeInput(item, options);
    }
    return item;
  });
};

/**
 * Validate and sanitize URL
 * @param {string} url - URL to validate and sanitize
 * @returns {string|null} - Sanitized URL or null if invalid
 */
const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return null;

  try {
    const urlObj = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return null;
    }
    return urlObj.href;
  } catch (error) {
    // Try with https prefix if no protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return sanitizeUrl(`https://${url}`);
    }
    return null;
  }
};

module.exports = {
  sanitizeInput,
  sanitizeObject,
  sanitizeArray,
  sanitizeUrl
};