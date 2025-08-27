/**
 * Middleware to process uploaded files and set full URL
 */
const config = require('../config/environment');

/**
 * Process uploaded file and set full URL for gallery images
 */
const processUploadedFile = (req, res, next) => {
  if (req.file) {
    // Build full URL for the uploaded file
    const baseUrl = config.app?.baseUrl || `${req.protocol}://${req.get('host')}`;
    const relativePath = req.file.path.replace(/\\/g, '/'); // Normalize path separators
    
    // Extract the path after 'uploads'
    const uploadsIndex = relativePath.indexOf('uploads');
    if (uploadsIndex !== -1) {
      const publicPath = relativePath.substring(uploadsIndex);
      req.uploadedImageUrl = `${baseUrl}/${publicPath}`;
    } else {
      // Fallback: use filename with expected path
      req.uploadedImageUrl = `${baseUrl}/uploads/gallery/${req.file.filename}`;
    }
    
    console.log('Processed uploaded file:', {
      originalname: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      uploadedImageUrl: req.uploadedImageUrl
    });
  }
  
  next();
};

module.exports = processUploadedFile;