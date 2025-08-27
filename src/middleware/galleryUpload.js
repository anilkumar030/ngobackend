const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { AppError } = require('./errorHandler');
const config = require('../config/environment');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads', 'gallery');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate secure filename using crypto
    const uniqueSuffix = crypto.randomUUID();
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const secureFilename = `${timestamp}-${uniqueSuffix}${extension}`;
    cb(null, secureFilename);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Check if file is an image
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only image files are allowed (JPEG, PNG, GIF, WebP)', 400), false);
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload?.maxFileSize || 5 * 1024 * 1024, // 5MB default
    files: 10 // Maximum 10 files at once
  }
});

/**
 * Middleware for single gallery image upload
 */
const uploadSingle = upload.single('image');

/**
 * Middleware for multiple gallery image uploads
 */
const uploadMultiple = upload.array('images', 10);

/**
 * Generate full URL for uploaded image
 */
const generateImageUrl = (filename) => {
  const baseUrl = process.env.BASE_URL || `http://localhost:${config.port || 5000}`;
  return `${baseUrl}/uploads/gallery/${filename}`;
};

/**
 * Middleware to handle upload errors
 */
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('File too large. Maximum size is 5MB', 400));
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return next(new AppError('Too many files. Maximum is 10 files', 400));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new AppError('Unexpected field name for file upload', 400));
    }
  }
  
  if (err) {
    return next(err);
  }
  
  next();
};

/**
 * Middleware to process uploaded file and generate full URL
 */
const processUploadedFile = (req, res, next) => {
  if (req.file) {
    // Single file upload
    req.file.fullUrl = generateImageUrl(req.file.filename);
    req.uploadedImageUrl = req.file.fullUrl;
  } else if (req.files && req.files.length > 0) {
    // Multiple file upload
    req.files.forEach(file => {
      file.fullUrl = generateImageUrl(file.filename);
    });
    req.uploadedImageUrls = req.files.map(file => file.fullUrl);
  }
  
  next();
};

/**
 * Delete uploaded file (used for cleanup on errors)
 */
const deleteUploadedFile = (filename) => {
  const filePath = path.join(uploadsDir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

/**
 * Clean up uploaded files in case of errors
 */
const cleanupOnError = (req, res, next) => {
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function to cleanup on error
  res.end = function(...args) {
    if (res.statusCode >= 400) {
      // Error occurred, cleanup uploaded files
      if (req.file && req.file.filename) {
        deleteUploadedFile(req.file.filename);
      }
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          if (file.filename) {
            deleteUploadedFile(file.filename);
          }
        });
      }
    }
    
    // Call original end function
    originalEnd.apply(this, args);
  };
  
  next();
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  handleUploadError,
  processUploadedFile,
  generateImageUrl,
  deleteUploadedFile,
  cleanupOnError
};