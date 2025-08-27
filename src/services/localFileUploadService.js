const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const config = require('../config/environment');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class LocalFileUploadService {
  constructor() {
    this.baseUploadPath = path.join(process.cwd(), 'upload');
    this.campaignUpdatePath = path.join(this.baseUploadPath, 'campaignupdate');
    this.allowedMimes = config.upload.allowedTypes;
    this.maxFileSize = config.upload.maxFileSize;
  }

  /**
   * Ensure directory exists
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true });
        logger.info(`Created directory: ${dirPath}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Generate unique filename
   */
  generateFileName(originalName) {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const uniqueId = uuidv4();
    return `${timestamp}-${uniqueId}${ext}`;
  }

  /**
   * Validate file
   */
  validateFile(file) {
    if (!file) {
      throw new AppError('No file provided', 400, true, 'NO_FILE');
    }

    // Check file size
    if (file.size > this.maxFileSize) {
      throw new AppError(
        `File size too large. Maximum size is ${(this.maxFileSize / 1024 / 1024).toFixed(2)}MB`,
        400,
        true,
        'FILE_TOO_LARGE'
      );
    }

    // Check file type
    if (!this.allowedMimes.includes(file.mimetype)) {
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
   * Create multer storage configuration for campaign updates
   */
  createCampaignUpdateStorage() {
    return multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          await this.ensureDirectoryExists(this.campaignUpdatePath);
          cb(null, this.campaignUpdatePath);
        } catch (error) {
          cb(error);
        }
      },
      filename: (req, file, cb) => {
        try {
          this.validateFile(file);
          const filename = this.generateFileName(file.originalname);
          cb(null, filename);
        } catch (error) {
          cb(error);
        }
      }
    });
  }

  /**
   * Create multer middleware for campaign updates
   */
  createCampaignUpdateMulter() {
    return multer({
      storage: this.createCampaignUpdateStorage(),
      limits: {
        fileSize: this.maxFileSize,
        files: 10 // Max 10 images per upload
      },
      fileFilter: (req, file, cb) => {
        try {
          this.validateFile(file);
          cb(null, true);
        } catch (error) {
          cb(error, false);
        }
      }
    });
  }

  /**
   * Save uploaded file and return URL
   */
  async saveFile(file, subfolder = '') {
    try {
      this.validateFile(file);

      const uploadDir = subfolder 
        ? path.join(this.campaignUpdatePath, subfolder)
        : this.campaignUpdatePath;

      await this.ensureDirectoryExists(uploadDir);

      const filename = this.generateFileName(file.originalname);
      const filePath = path.join(uploadDir, filename);

      // Write file
      await fs.writeFile(filePath, file.buffer);

      // Generate URL
      const relativePath = path.relative(this.baseUploadPath, filePath);
      const relativeUrl = `/upload/${relativePath.replace(/\\/g, '/')}`;
      
      // Use backend URL for accessible URLs
      const url = config.urls && config.urls.backend 
        ? `${config.urls.backend}${relativeUrl}`
        : relativeUrl;

      logger.contextLogger.upload('Local file saved', file.originalname, file.size, {
        filename: filename,
        url: url,
        path: filePath
      });

      return {
        success: true,
        filename: filename,
        url: url,
        path: filePath,
        size: file.size,
        mimetype: file.mimetype
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.logError(error, { service: 'LocalFileUploadService', method: 'saveFile' });
      throw new AppError('File save failed', 500);
    }
  }

  /**
   * Save multiple files
   */
  async saveMultipleFiles(files, subfolder = '') {
    try {
      const results = [];
      const errors = [];

      for (const file of files) {
        try {
          const result = await this.saveFile(file, subfolder);
          results.push({
            originalName: file.originalname,
            filename: result.filename,
            url: result.url,
            size: result.size,
            mimetype: result.mimetype
          });
        } catch (error) {
          errors.push({
            originalName: file.originalname,
            error: error.message
          });
        }
      }

      return {
        success: true,
        images: results,
        errors: errors.length > 0 ? errors : null,
        uploaded: results.length,
        failed: errors.length
      };

    } catch (error) {
      logger.logError(error, { service: 'LocalFileUploadService', method: 'saveMultipleFiles' });
      throw new AppError('Multiple file save failed', 500);
    }
  }

  /**
   * Delete file
   */
  async deleteFile(filename, subfolder = '') {
    try {
      const filePath = subfolder 
        ? path.join(this.campaignUpdatePath, subfolder, filename)
        : path.join(this.campaignUpdatePath, filename);

      await fs.unlink(filePath);

      logger.contextLogger.upload('Local file deleted', filename, 0, {
        path: filePath
      });

      return {
        success: true,
        filename: filename,
        deleted: true
      };

    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, consider it already deleted
        return {
          success: true,
          filename: filename,
          deleted: false,
          message: 'File not found'
        };
      }
      
      logger.logError(error, { service: 'LocalFileUploadService', method: 'deleteFile' });
      throw new AppError('File deletion failed', 500);
    }
  }

  /**
   * Delete multiple files
   */
  async deleteMultipleFiles(filenames, subfolder = '') {
    try {
      const results = [];
      const errors = [];

      for (const filename of filenames) {
        try {
          const result = await this.deleteFile(filename, subfolder);
          results.push(result);
        } catch (error) {
          errors.push({
            filename: filename,
            error: error.message
          });
        }
      }

      return {
        success: true,
        results: results,
        errors: errors.length > 0 ? errors : null,
        deleted: results.filter(r => r.deleted).length,
        failed: errors.length
      };

    } catch (error) {
      logger.logError(error, { service: 'LocalFileUploadService', method: 'deleteMultipleFiles' });
      throw new AppError('Multiple file deletion failed', 500);
    }
  }

  /**
   * Extract filename from URL
   */
  extractFilenameFromUrl(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }
    
    // Handle URLs like "/upload/campaignupdate/filename.jpg"
    const urlPath = url.replace(/^\/upload\/campaignupdate\//, '');
    return path.basename(urlPath);
  }

  /**
   * Get file info
   */
  async getFileInfo(filename, subfolder = '') {
    try {
      const filePath = subfolder 
        ? path.join(this.campaignUpdatePath, subfolder, filename)
        : path.join(this.campaignUpdatePath, filename);

      const stats = await fs.stat(filePath);
      const relativePath = path.relative(this.baseUploadPath, filePath);
      const relativeUrl = `/upload/${relativePath.replace(/\\/g, '/')}`;
      
      // Use backend URL for accessible URLs
      const url = config.urls && config.urls.backend 
        ? `${config.urls.backend}${relativeUrl}`
        : relativeUrl;

      return {
        success: true,
        filename: filename,
        url: url,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };

    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          success: false,
          error: 'File not found'
        };
      }
      
      logger.logError(error, { service: 'LocalFileUploadService', method: 'getFileInfo' });
      throw new AppError('Failed to get file info', 500);
    }
  }

  /**
   * Clean up old files
   */
  async cleanupOldFiles(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days
    try {
      const files = await fs.readdir(this.campaignUpdatePath);
      const now = Date.now();
      const deleted = [];
      const errors = [];

      for (const file of files) {
        try {
          const filePath = path.join(this.campaignUpdatePath, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile() && (now - stats.mtime.getTime()) > maxAge) {
            await fs.unlink(filePath);
            deleted.push(file);
          }
        } catch (error) {
          errors.push({
            filename: file,
            error: error.message
          });
        }
      }

      logger.info(`Cleaned up ${deleted.length} old campaign update files`);

      return {
        success: true,
        deleted: deleted.length,
        failed: errors.length,
        errors: errors.length > 0 ? errors : null
      };

    } catch (error) {
      logger.logError(error, { service: 'LocalFileUploadService', method: 'cleanupOldFiles' });
      throw new AppError('Cleanup failed', 500);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    try {
      const files = await fs.readdir(this.campaignUpdatePath);
      let totalSize = 0;
      let fileCount = 0;

      for (const file of files) {
        try {
          const filePath = path.join(this.campaignUpdatePath, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            totalSize += stats.size;
            fileCount++;
          }
        } catch (error) {
          // Skip files that can't be accessed
          continue;
        }
      }

      return {
        success: true,
        statistics: {
          totalFiles: fileCount,
          totalSize: totalSize,
          totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
          directory: this.campaignUpdatePath
        }
      };

    } catch (error) {
      logger.logError(error, { service: 'LocalFileUploadService', method: 'getStorageStats' });
      throw new AppError('Failed to get storage statistics', 500);
    }
  }
}

module.exports = new LocalFileUploadService();