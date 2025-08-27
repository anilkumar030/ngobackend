const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uuid = require('uuid');
const logger = require('../utils/logger');

// Ensure upload directory exists
const createUploadDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created upload directory: ${dir}`);
  }
};

// Configure local storage
const createLocalStorage = (subfolder = '') => {
  const uploadDir = path.join(process.cwd(), 'upload', subfolder);
  createUploadDir(uploadDir);

  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename: timestamp-uuid-original_extension
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `${Date.now()}-${uuid.v4()}${ext}`;
      cb(null, filename);
    }
  });
};

// File filter for images
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/gif', 
    'image/webp'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(`Invalid file type: ${file.mimetype}. Only image files are allowed.`);
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

// Create local upload middleware
const createLocalUpload = (options = {}) => {
  const {
    subfolder = '',
    maxFileSize = 10 * 1024 * 1024, // 10MB
    maxFiles = 10
  } = options;

  return multer({
    storage: createLocalStorage(subfolder),
    fileFilter: imageFileFilter,
    limits: {
      fileSize: maxFileSize,
      files: maxFiles
    }
  });
};

// Generate local file URL
const generateLocalFileUrl = (filename, subfolder = '') => {
  // Generate URL in format: http://localhost:PORT/upload/subfolder/filename
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  const urlPath = subfolder ? `/upload/${subfolder}/${filename}` : `/upload/${filename}`;
  return `${baseUrl}${urlPath}`;
};

// Middleware to handle mixed JSON and FormData
const handleMixedData = (req, res, next) => {
  // Parse JSON fields from FormData
  if (req.body) {
    // Fields that should be parsed as JSON arrays
    const jsonArrayFields = ['tags', 'meta_keywords', 'images', 'gallery_images'];
    // Fields that should be parsed as JSON objects
    const jsonObjectFields = ['metadata', 'location'];

    // Parse JSON array fields
    jsonArrayFields.forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        try {
          req.body[field] = JSON.parse(req.body[field]);
        } catch (error) {
          logger.warn(`Failed to parse ${field} as JSON:`, error.message);
          // Keep original value if parsing fails
        }
      }
    });

    // Parse JSON object fields
    jsonObjectFields.forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        try {
          req.body[field] = JSON.parse(req.body[field]);
        } catch (error) {
          logger.warn(`Failed to parse ${field} as JSON:`, error.message);
          // Keep original value if parsing fails
        }
      }
    });

    // Convert boolean strings to actual booleans
    const booleanFields = ['featured', 'is_featured', 'is_urgent'];
    booleanFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] === 'string') {
          req.body[field] = req.body[field].toLowerCase() === 'true';
        }
      }
    });

    // Convert numeric strings to numbers
    const numericFields = ['target_amount', 'min_donation'];
    numericFields.forEach(field => {
      if (req.body[field] !== undefined && typeof req.body[field] === 'string') {
        const numValue = parseFloat(req.body[field]);
        if (!isNaN(numValue)) {
          req.body[field] = numValue;
        }
      }
    });
  }

  next();
};

// Process uploaded files and generate URLs
const processUploadedFiles = (req, res, next) => {
  if (req.files) {
    const fileUrls = {};
    
    // Handle different field types
    Object.keys(req.files).forEach(fieldName => {
      const files = Array.isArray(req.files[fieldName]) ? req.files[fieldName] : [req.files[fieldName]];
      
      fileUrls[fieldName] = files.map(file => {
        // Extract subfolder from file path
        const uploadDir = path.join(process.cwd(), 'upload');
        const relativePath = path.relative(uploadDir, file.path);
        const subfolder = path.dirname(relativePath) !== '.' ? path.dirname(relativePath) : '';
        
        return {
          filename: file.filename,
          url: generateLocalFileUrl(file.filename, subfolder),
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path
        };
      });

      // For single file fields, return the first URL only
      if (fieldName === 'featured_image') {
        req.body[fieldName] = fileUrls[fieldName][0]?.url;
      } else {
        // For multiple file fields, return array of URLs
        const urls = fileUrls[fieldName].map(file => file.url);
        if (req.body[fieldName]) {
          // Merge with existing URLs if any
          const existing = Array.isArray(req.body[fieldName]) ? req.body[fieldName] : [];
          req.body[fieldName] = [...existing, ...urls];
        } else {
          req.body[fieldName] = urls;
        }
      }
    });

    // Store file info for later use
    req.uploadedFiles = fileUrls;
    
    logger.info('Processed uploaded files:', {
      fields: Object.keys(fileUrls),
      totalFiles: Object.values(fileUrls).reduce((sum, files) => sum + files.length, 0)
    });
  }

  next();
};

// Error handler for upload errors
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let message = 'File upload error';
    let statusCode = 400;

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = `File too large. Maximum size allowed is ${(10 * 1024 * 1024) / (1024 * 1024)}MB`;
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Maximum 10 files allowed';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      default:
        message = error.message;
    }

    logger.error('Multer upload error:', {
      code: error.code,
      message: error.message,
      field: error.field
    });

    return res.status(statusCode).json({
      success: false,
      message,
      error: 'UPLOAD_ERROR'
    });
  }

  if (error.code === 'INVALID_FILE_TYPE') {
    logger.error('Invalid file type error:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message,
      error: 'INVALID_FILE_TYPE'
    });
  }

  next(error);
};

// Configure campaign upload middleware
const campaignUpload = createLocalUpload({ subfolder: 'campaigns' });

// Define upload fields for campaigns
const campaignUploadFields = campaignUpload.fields([
  { name: 'featured_image', maxCount: 1 },
  { name: 'gallery_images', maxCount: 10 },
  { name: 'images', maxCount: 20 }
]);

module.exports = {
  createLocalUpload,
  createLocalStorage,
  generateLocalFileUrl,
  handleMixedData,
  processUploadedFiles,
  handleUploadError,
  campaignUpload,
  campaignUploadFields,
  imageFileFilter
};