const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const config = require('./environment');
const logger = require('../utils/logger');

// Get project name from environment variable with fallback
const PROJECT_NAME = process.env.PROJECT_NAME || 'Shiv Dhaam Foundation';
const PROJECT_FOLDER = PROJECT_NAME.toLowerCase().replace(/\s+/g, '-');

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

// Cloudinary utilities
const cloudinaryUtils = {
  // Upload single image
  async uploadImage(file, options = {}) {
    try {
      const defaultOptions = {
        folder: PROJECT_FOLDER,
        resource_type: 'image',
        transformation: [
          { quality: 'auto', fetch_format: 'auto' },
          { width: 1200, height: 800, crop: 'limit' },
        ],
      };

      const uploadOptions = { ...defaultOptions, ...options };
      const result = await cloudinary.uploader.upload(file.path, uploadOptions);
      
      logger.info(`Image uploaded to Cloudinary: ${result.public_id}`);
      
      return {
        success: true,
        result: {
          public_id: result.public_id,
          secure_url: result.secure_url,
          url: result.url,
          width: result.width,
          height: result.height,
          format: result.format,
          resource_type: result.resource_type,
          bytes: result.bytes,
        },
      };
    } catch (error) {
      logger.error('Cloudinary upload error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Upload from buffer
  async uploadFromBuffer(buffer, options = {}) {
    return new Promise((resolve, reject) => {
      const defaultOptions = {
        folder: PROJECT_FOLDER,
        resource_type: 'image',
        transformation: [
          { quality: 'auto', fetch_format: 'auto' },
          { width: 1200, height: 800, crop: 'limit' },
        ],
      };

      const uploadOptions = { ...defaultOptions, ...options };

      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            logger.error('Cloudinary buffer upload error:', error);
            resolve({
              success: false,
              error: error.message,
            });
          } else {
            logger.info(`Image uploaded from buffer to Cloudinary: ${result.public_id}`);
            resolve({
              success: true,
              result: {
                public_id: result.public_id,
                secure_url: result.secure_url,
                url: result.url,
                width: result.width,
                height: result.height,
                format: result.format,
                resource_type: result.resource_type,
                bytes: result.bytes,
              },
            });
          }
        }
      ).end(buffer);
    });
  },

  // Delete image
  async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      logger.info(`Image deleted from Cloudinary: ${publicId}`);
      
      return {
        success: true,
        result: result.result,
      };
    } catch (error) {
      logger.error(`Cloudinary delete error for ${publicId}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Get image details
  async getImageDetails(publicId) {
    try {
      const result = await cloudinary.api.resource(publicId);
      
      return {
        success: true,
        result: {
          public_id: result.public_id,
          secure_url: result.secure_url,
          url: result.url,
          width: result.width,
          height: result.height,
          format: result.format,
          resource_type: result.resource_type,
          bytes: result.bytes,
          created_at: result.created_at,
        },
      };
    } catch (error) {
      logger.error(`Cloudinary get details error for ${publicId}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Generate transformation URL
  generateUrl(publicId, transformations = []) {
    try {
      const url = cloudinary.url(publicId, {
        transformation: transformations,
        secure: true,
      });
      
      return {
        success: true,
        url,
      };
    } catch (error) {
      logger.error('Cloudinary URL generation error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Resize image
  generateResizedUrl(publicId, width, height, crop = 'fill') {
    return this.generateUrl(publicId, [
      { width, height, crop, quality: 'auto', fetch_format: 'auto' }
    ]);
  },

  // Generate thumbnail
  generateThumbnail(publicId, size = 200) {
    return this.generateUrl(publicId, [
      { width: size, height: size, crop: 'fill', quality: 'auto', fetch_format: 'auto' }
    ]);
  },

  // Get folder resources
  async getFolderResources(folder = PROJECT_FOLDER, options = {}) {
    try {
      const defaultOptions = {
        type: 'upload',
        max_results: 100,
      };

      const searchOptions = { ...defaultOptions, ...options, prefix: folder };
      const result = await cloudinary.search
        .expression(`folder:${folder}`)
        .with_field('context')
        .with_field('tags')
        .max_results(searchOptions.max_results)
        .execute();
      
      return {
        success: true,
        resources: result.resources,
        total_count: result.total_count,
      };
    } catch (error) {
      logger.error(`Cloudinary folder resources error for ${folder}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

// Multer configuration with memory storage (for buffer upload to Cloudinary)
const createMulterUpload = (folder = PROJECT_FOLDER) => {
  return multer({
    storage: multer.memoryStorage(), // Store files in memory
    limits: {
      fileSize: config.upload.maxFileSize, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      // Check file type
      if (!config.upload.allowedTypes.includes(file.mimetype)) {
        const error = new Error('Invalid file type. Only images are allowed.');
        error.code = 'INVALID_FILE_TYPE';
        return cb(error, false);
      }

      cb(null, true);
    },
  });
};

// Pre-configured upload middleware
const uploadMiddleware = {
  // Single image upload
  single: (fieldName, folder = PROJECT_FOLDER) => 
    createMulterUpload(folder).single(fieldName),
  
  // Multiple images upload
  array: (fieldName, maxCount = 10, folder = PROJECT_FOLDER) => 
    createMulterUpload(folder).array(fieldName, maxCount),
  
  // Multiple fields upload
  fields: (fields, folder = PROJECT_FOLDER) => 
    createMulterUpload(folder).fields(fields),
};

// Common transformations
const TRANSFORMATIONS = {
  THUMBNAIL: [
    { width: 200, height: 200, crop: 'fill', quality: 'auto', fetch_format: 'auto' }
  ],
  SMALL: [
    { width: 400, height: 300, crop: 'fill', quality: 'auto', fetch_format: 'auto' }
  ],
  MEDIUM: [
    { width: 800, height: 600, crop: 'fill', quality: 'auto', fetch_format: 'auto' }
  ],
  LARGE: [
    { width: 1200, height: 900, crop: 'fill', quality: 'auto', fetch_format: 'auto' }
  ],
  HERO: [
    { width: 1920, height: 1080, crop: 'fill', quality: 'auto', fetch_format: 'auto' }
  ],
};

// Folder constants
const FOLDERS = {
  CAMPAIGNS: `${PROJECT_FOLDER}/campaigns`,
  PRODUCTS: `${PROJECT_FOLDER}/products`,
  GALLERY: `${PROJECT_FOLDER}/gallery`,
  BLOG: `${PROJECT_FOLDER}/blog`,
  PROFILES: `${PROJECT_FOLDER}/profiles`,
  HERO: `${PROJECT_FOLDER}/hero`,
  TESTIMONIALS: `${PROJECT_FOLDER}/testimonials`,
  TEMP: `${PROJECT_FOLDER}/temp`,
};

module.exports = {
  cloudinary,
  cloudinaryUtils,
  uploadMiddleware,
  createMulterUpload,
  TRANSFORMATIONS,
  FOLDERS,
};