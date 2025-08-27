const { cloudinaryUtils, FOLDERS } = require('../config/cloudinary');
const config = require('../config/environment');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class FileUploadService {
  /**
   * Upload single image
   */
  async uploadImage(file, options = {}) {
    try {
      const {
        folder = FOLDERS.TEMP,
        width = null,
        height = null,
        crop = 'fill',
        quality = 'auto',
        format = 'auto',
      } = options;

      // Validate file
      this.validateFile(file);

      // Prepare transformation options
      const transformations = [
        { quality, fetch_format: format },
      ];

      if (width || height) {
        transformations.push({
          width,
          height,
          crop,
        });
      }

      // Upload to Cloudinary
      const uploadOptions = {
        folder,
        transformation: transformations,
        resource_type: 'image',
      };

      const result = await cloudinaryUtils.uploadFromBuffer(file.buffer, uploadOptions);

      if (!result.success) {
        throw new AppError('Image upload failed', 500, true, 'UPLOAD_FAILED');
      }

      logger.contextLogger.upload('Image uploaded', file.originalname, file.size, {
        publicId: result.result.public_id,
        url: result.result.secure_url,
      });

      return {
        success: true,
        image: {
          publicId: result.result.public_id,
          url: result.result.secure_url,
          width: result.result.width,
          height: result.result.height,
          format: result.result.format,
          bytes: result.result.bytes,
        },
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.logError(error, { service: 'FileUploadService', method: 'uploadImage' });
      throw new AppError('Image upload failed', 500);
    }
  }

  /**
   * Upload multiple images
   */
  async uploadMultipleImages(files, options = {}) {
    try {
      const results = [];
      const errors = [];

      for (const file of files) {
        try {
          const result = await this.uploadImage(file, options);
          results.push(result.image);
        } catch (error) {
          errors.push({
            filename: file.originalname,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        images: results,
        errors: errors.length > 0 ? errors : null,
        uploaded: results.length,
        failed: errors.length,
      };

    } catch (error) {
      logger.logError(error, { service: 'FileUploadService', method: 'uploadMultipleImages' });
      throw new AppError('Multiple image upload failed', 500);
    }
  }

  /**
   * Upload campaign images
   */
  async uploadCampaignImages(files, campaignId) {
    const folder = `${FOLDERS.CAMPAIGNS}/${campaignId}`;
    
    return await this.uploadMultipleImages(files, {
      folder,
      width: 1200,
      height: 800,
      crop: 'limit',
    });
  }

  /**
   * Upload campaign featured image
   */
  async uploadCampaignFeaturedImage(file, campaignId) {
    const folder = `${FOLDERS.CAMPAIGNS}/${campaignId}`;
    
    const result = await this.uploadImage(file, {
      folder,
      width: 1200,
      height: 800,
      crop: 'fill',
    });

    return result.image;
  }

  /**
   * Upload product images
   */
  async uploadProductImages(files, productId) {
    const folder = `${FOLDERS.PRODUCTS}/${productId}`;
    
    return await this.uploadMultipleImages(files, {
      folder,
      width: 800,
      height: 600,
      crop: 'fill',
    });
  }

  /**
   * Upload gallery image
   */
  async uploadGalleryImage(file, category = 'general') {
    const folder = `${FOLDERS.GALLERY}/${category}`;
    
    const result = await this.uploadImage(file, {
      folder,
      width: 1000,
      height: 750,
      crop: 'fill',
    });

    return result.image;
  }

  /**
   * Upload blog post image
   */
  async uploadBlogImage(file, postId) {
    const folder = `${FOLDERS.BLOG}/${postId}`;
    
    const result = await this.uploadImage(file, {
      folder,
      width: 1200,
      height: 630,
      crop: 'fill',
    });

    return result.image;
  }

  /**
   * Upload profile image
   */
  async uploadProfileImage(file, userId) {
    const folder = `${FOLDERS.PROFILES}/${userId}`;
    
    const result = await this.uploadImage(file, {
      folder,
      width: 300,
      height: 300,
      crop: 'fill',
    });

    return result.image;
  }

  /**
   * Upload testimonial image
   */
  async uploadTestimonialImage(file, testimonialId) {
    const folder = `${FOLDERS.TESTIMONIALS}/${testimonialId}`;
    
    const result = await this.uploadImage(file, {
      folder,
      width: 800,
      height: 600,
      crop: 'fill',
    });

    return result.image;
  }

  /**
   * Upload hero section image
   */
  async uploadHeroImage(file) {
    const result = await this.uploadImage(file, {
      folder: FOLDERS.HERO,
      width: 1920,
      height: 1080,
      crop: 'fill',
    });

    return result.image;
  }

  /**
   * Delete image
   */
  async deleteImage(publicId) {
    try {
      const result = await cloudinaryUtils.deleteImage(publicId);

      if (!result.success) {
        throw new AppError('Image deletion failed', 500, true, 'DELETE_FAILED');
      }

      logger.contextLogger.upload('Image deleted', publicId, 0, {
        result: result.result,
      });

      return {
        success: true,
        result: result.result,
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.logError(error, { service: 'FileUploadService', method: 'deleteImage' });
      throw new AppError('Image deletion failed', 500);
    }
  }

  /**
   * Delete multiple images
   */
  async deleteMultipleImages(publicIds) {
    try {
      const results = [];
      const errors = [];

      for (const publicId of publicIds) {
        try {
          const result = await this.deleteImage(publicId);
          results.push({
            publicId,
            success: result.success,
            result: result.result,
          });
        } catch (error) {
          errors.push({
            publicId,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        results,
        errors: errors.length > 0 ? errors : null,
        deleted: results.length,
        failed: errors.length,
      };

    } catch (error) {
      logger.logError(error, { service: 'FileUploadService', method: 'deleteMultipleImages' });
      throw new AppError('Multiple image deletion failed', 500);
    }
  }

  /**
   * Generate image variants
   */
  async generateImageVariants(publicId) {
    try {
      const variants = {
        thumbnail: cloudinaryUtils.generateThumbnail(publicId, 200),
        small: cloudinaryUtils.generateResizedUrl(publicId, 400, 300),
        medium: cloudinaryUtils.generateResizedUrl(publicId, 800, 600),
        large: cloudinaryUtils.generateResizedUrl(publicId, 1200, 900),
      };

      const result = {};
      for (const [size, urlResult] of Object.entries(variants)) {
        if (urlResult.success) {
          result[size] = urlResult.url;
        }
      }

      return {
        success: true,
        variants: result,
      };

    } catch (error) {
      logger.logError(error, { service: 'FileUploadService', method: 'generateImageVariants' });
      throw new AppError('Failed to generate image variants', 500);
    }
  }

  /**
   * Get optimized image URL
   */
  getOptimizedImageUrl(publicId, options = {}) {
    const {
      width = null,
      height = null,
      crop = 'fill',
      quality = 'auto',
      format = 'auto',
    } = options;

    const transformations = [
      { quality, fetch_format: format },
    ];

    if (width || height) {
      transformations.push({
        width,
        height,
        crop,
      });
    }

    const result = cloudinaryUtils.generateUrl(publicId, transformations);
    return result.success ? result.url : null;
  }

  /**
   * Validate uploaded file
   */
  validateFile(file) {
    if (!file) {
      throw new AppError('No file provided', 400, true, 'NO_FILE');
    }

    if (!file.buffer && !file.path) {
      throw new AppError('File data is missing', 400, true, 'MISSING_FILE_DATA');
    }

    // Check file size
    if (file.size > config.upload.maxFileSize) {
      throw new AppError(
        `File size too large. Maximum size is ${(config.upload.maxFileSize / 1024 / 1024).toFixed(2)}MB`,
        400,
        true,
        'FILE_TOO_LARGE'
      );
    }

    // Check file type
    if (!config.upload.allowedTypes.includes(file.mimetype)) {
      throw new AppError(
        `File type ${file.mimetype} is not allowed`,
        400,
        true,
        'INVALID_FILE_TYPE'
      );
    }

    // Check for malicious files
    const suspiciousExtensions = ['.exe', '.bat', '.sh', '.php', '.asp', '.jsp'];
    const fileName = file.originalname.toLowerCase();
    
    if (suspiciousExtensions.some(ext => fileName.endsWith(ext))) {
      throw new AppError('File type not allowed for security reasons', 400, true, 'SECURITY_RISK');
    }

    return true;
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    try {
      const result = await cloudinaryUtils.getFolderResources(FOLDERS.TEMP);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      const now = Date.now();
      const toDelete = [];

      result.resources.forEach(resource => {
        const createdAt = new Date(resource.created_at).getTime();
        if (now - createdAt > maxAge) {
          toDelete.push(resource.public_id);
        }
      });

      if (toDelete.length > 0) {
        const deleteResult = await this.deleteMultipleImages(toDelete);
        
        logger.info(`Cleaned up ${deleteResult.deleted} temporary files`);
        
        return {
          success: true,
          deleted: deleteResult.deleted,
          failed: deleteResult.failed,
        };
      }

      return {
        success: true,
        deleted: 0,
        failed: 0,
      };

    } catch (error) {
      logger.logError(error, { service: 'FileUploadService', method: 'cleanupTempFiles' });
      throw new AppError('Cleanup failed', 500);
    }
  }

  /**
   * Get upload statistics
   */
  async getUploadStatistics() {
    try {
      const stats = {};

      for (const [folderName, folderPath] of Object.entries(FOLDERS)) {
        const result = await cloudinaryUtils.getFolderResources(folderPath);
        
        if (result.success) {
          stats[folderName.toLowerCase()] = {
            count: result.total_count,
            resources: result.resources.length,
          };
        }
      }

      return {
        success: true,
        statistics: stats,
      };

    } catch (error) {
      logger.logError(error, { service: 'FileUploadService', method: 'getUploadStatistics' });
      throw new AppError('Failed to get upload statistics', 500);
    }
  }
}

module.exports = new FileUploadService();