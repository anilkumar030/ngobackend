#!/usr/bin/env node

/**
 * Campaign Image Migration Script
 * 
 * This script migrates image files from a source folder to the campaign upload directory
 * and updates the campaign record in the database with the new image URLs.
 * 
 * Usage: node migrate-campaign-images.js <folder-path> <campaign-id>
 * 
 * Features:
 * - Reads all image files from the specified folder
 * - Moves files to /upload/campaigns/<campaign-folder>/ directory
 * - Generates proper URLs in format: https://devapi.bdrf.in/upload/campaigns/<folder-name>/<filename>
 * - Updates Campaign record in database using Sequelize
 * - Shows progress during execution
 * - Comprehensive error handling and logging
 * 
 * @author Claude Code
 * @version 1.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Import database models and configuration
const { Campaign, sequelize } = require('./src/models');

/**
 * Configuration constants
 */
const CONFIG = {
  // Supported image formats
  SUPPORTED_FORMATS: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.svg'],
  
  // Upload directory configuration
  UPLOAD_BASE_PATH: path.join(__dirname, 'upload', 'campaigns'),
  
  // API base URL for generating image URLs
  API_BASE_URL: process.env.API_BASE_URL || 'https://devapi.bdrf.in',
  
  // Progress reporting frequency
  PROGRESS_INTERVAL: 5
};

/**
 * Logger utility for consistent output formatting
 */
class Logger {
  static info(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] INFO: ${message}`);
    if (data) {
      console.log('  Data:', JSON.stringify(data, null, 2));
    }
  }

  static success(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ✓ SUCCESS: ${message}`);
    if (data) {
      console.log('  Details:', JSON.stringify(data, null, 2));
    }
  }

  static warn(message, data = null) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] ⚠ WARNING: ${message}`);
    if (data) {
      console.warn('  Details:', JSON.stringify(data, null, 2));
    }
  }

  static error(message, error = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ✗ ERROR: ${message}`);
    if (error) {
      console.error('  Error Details:', error.message);
      if (process.env.NODE_ENV === 'development') {
        console.error('  Stack Trace:', error.stack);
      }
    }
  }

  static progress(current, total, message = '') {
    const percentage = Math.round((current / total) * 100);
    const progressBar = '█'.repeat(Math.floor(percentage / 2)) + '░'.repeat(50 - Math.floor(percentage / 2));
    process.stdout.write(`\r[${progressBar}] ${percentage}% (${current}/${total}) ${message}`);
    if (current === total) {
      console.log(); // New line when complete
    }
  }
}

/**
 * File operations utility class
 */
class FileOperations {
  /**
   * Check if a file is a supported image format
   * @param {string} filename - The filename to check
   * @returns {boolean} - True if supported, false otherwise
   */
  static isSupportedImageFormat(filename) {
    const ext = path.extname(filename).toLowerCase();
    return CONFIG.SUPPORTED_FORMATS.includes(ext);
  }

  /**
   * Generate a unique filename to prevent conflicts
   * @param {string} originalFilename - Original filename
   * @returns {string} - Unique filename with timestamp and UUID
   */
  static generateUniqueFilename(originalFilename) {
    const timestamp = Date.now();
    const uniqueId = uuidv4();
    const ext = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, ext);
    
    // Clean the base name to remove any special characters
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '-');
    
    return `${timestamp}-${uniqueId}-${cleanBaseName}${ext}`;
  }

  /**
   * Ensure directory exists, create if it doesn't
   * @param {string} dirPath - Directory path to ensure
   */
  static async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
      Logger.info(`Directory already exists: ${dirPath}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        Logger.info(`Creating directory: ${dirPath}`);
        await fs.mkdir(dirPath, { recursive: true });
        Logger.success(`Directory created successfully: ${dirPath}`);
      } else {
        throw new Error(`Failed to access directory ${dirPath}: ${error.message}`);
      }
    }
  }

  /**
   * Get all image files from a directory
   * @param {string} sourcePath - Source directory path
   * @returns {Array<string>} - Array of image file paths
   */
  static async getImageFiles(sourcePath) {
    try {
      Logger.info(`Scanning directory for images: ${sourcePath}`);
      const files = await fs.readdir(sourcePath);
      
      const imageFiles = files.filter(file => {
        const isImage = this.isSupportedImageFormat(file);
        if (isImage) {
          Logger.info(`Found image: ${file}`);
        }
        return isImage;
      });

      Logger.success(`Found ${imageFiles.length} image files`, { 
        count: imageFiles.length,
        files: imageFiles 
      });
      
      return imageFiles;
    } catch (error) {
      throw new Error(`Failed to read source directory ${sourcePath}: ${error.message}`);
    }
  }

  /**
   * Move a file from source to destination
   * @param {string} sourcePath - Source file path
   * @param {string} destPath - Destination file path
   * @param {string} filename - Original filename for logging
   */
  static async moveFile(sourcePath, destPath, filename) {
    try {
      // Check if source file exists
      await fs.access(sourcePath);
      
      // Copy file to destination
      await fs.copyFile(sourcePath, destPath);
      
      // Verify copy was successful by checking file size
      const sourceStats = await fs.stat(sourcePath);
      const destStats = await fs.stat(destPath);
      
      if (sourceStats.size !== destStats.size) {
        throw new Error(`File size mismatch during copy: ${filename}`);
      }
      
      // Remove source file only after successful copy verification
      await fs.unlink(sourcePath);
      
      Logger.success(`Moved file: ${filename}`, {
        source: sourcePath,
        destination: destPath,
        size: `${sourceStats.size} bytes`
      });
      
    } catch (error) {
      throw new Error(`Failed to move file ${filename}: ${error.message}`);
    }
  }
}

/**
 * Campaign database operations utility class
 */
class CampaignOperations {
  /**
   * Find campaign by ID with error handling
   * @param {string} campaignId - Campaign UUID
   * @returns {Object} - Campaign instance
   */
  static async findCampaign(campaignId) {
    try {
      Logger.info(`Looking up campaign: ${campaignId}`);
      
      const campaign = await Campaign.findByPk(campaignId);
      
      if (!campaign) {
        throw new Error(`Campaign not found with ID: ${campaignId}`);
      }
      
      Logger.success(`Campaign found: ${campaign.title}`, {
        id: campaign.id,
        title: campaign.title,
        status: campaign.status,
        currentImages: campaign.images ? campaign.images.length : 0
      });
      
      return campaign;
    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        throw new Error(`Invalid campaign ID format: ${campaignId}`);
      }
      throw new Error(`Database error while finding campaign: ${error.message}`);
    }
  }

  /**
   * Update campaign images in database with transaction support
   * @param {Object} campaign - Campaign instance
   * @param {Array<string>} imageUrls - Array of image URLs
   */
  static async updateCampaignImages(campaign, imageUrls) {
    const transaction = await sequelize.transaction();
    
    try {
      Logger.info(`Updating campaign images in database`, {
        campaignId: campaign.id,
        newImageCount: imageUrls.length,
        existingImageCount: campaign.images ? campaign.images.length : 0
      });
      
      // Merge with existing images if any
      const existingImages = campaign.images || [];
      const allImages = [...existingImages, ...imageUrls];
      
      // Remove duplicates based on URL
      const uniqueImages = [...new Set(allImages)];
      
      // Update campaign with new images array
      await campaign.update({ 
        images: uniqueImages 
      }, { 
        transaction,
        fields: ['images'] // Only update images field
      });
      
      await transaction.commit();
      
      Logger.success(`Campaign images updated successfully`, {
        campaignId: campaign.id,
        totalImages: uniqueImages.length,
        newImagesAdded: imageUrls.length,
        duplicatesRemoved: allImages.length - uniqueImages.length
      });
      
      return uniqueImages;
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Failed to update campaign images in database: ${error.message}`);
    }
  }
}

/**
 * Main migration orchestrator class
 */
class ImageMigrator {
  constructor(sourcePath, campaignId) {
    this.sourcePath = sourcePath;
    this.campaignId = campaignId;
    this.destinationFolder = null;
    this.campaign = null;
    this.processedUrls = [];
    this.errors = [];
  }

  /**
   * Validate input parameters
   */
  async validateInputs() {
    Logger.info('Validating input parameters...');
    
    // Validate source path
    if (!this.sourcePath) {
      throw new Error('Source folder path is required');
    }
    
    try {
      const stat = await fs.stat(this.sourcePath);
      if (!stat.isDirectory()) {
        throw new Error(`Source path is not a directory: ${this.sourcePath}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Source directory does not exist: ${this.sourcePath}`);
      }
      throw error;
    }
    
    // Validate campaign ID
    if (!this.campaignId) {
      throw new Error('Campaign ID is required');
    }
    
    // UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(this.campaignId)) {
      throw new Error(`Invalid UUID format for campaign ID: ${this.campaignId}`);
    }
    
    Logger.success('Input parameters validated successfully');
  }

  /**
   * Setup destination folder structure
   */
  async setupDestination() {
    Logger.info('Setting up destination folder structure...');
    
    // Generate unique folder name for this campaign
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.destinationFolder = `campaign-${this.campaignId.split('-')[0]}-${timestamp}`;
    
    const destinationPath = path.join(CONFIG.UPLOAD_BASE_PATH, this.destinationFolder);
    
    // Ensure base upload directory exists
    await FileOperations.ensureDirectoryExists(CONFIG.UPLOAD_BASE_PATH);
    
    // Create campaign-specific folder
    await FileOperations.ensureDirectoryExists(destinationPath);
    
    Logger.success('Destination folder setup complete', {
      folderName: this.destinationFolder,
      fullPath: destinationPath
    });
    
    return destinationPath;
  }

  /**
   * Process all images in the source folder
   */
  async processImages() {
    Logger.info('Starting image processing...');
    
    // Get all image files from source
    const imageFiles = await FileOperations.getImageFiles(this.sourcePath);
    
    if (imageFiles.length === 0) {
      Logger.warn('No image files found in source directory');
      return [];
    }
    
    const destinationPath = await this.setupDestination();
    const processedUrls = [];
    
    Logger.info(`Processing ${imageFiles.length} images...`);
    
    // Process each image file
    for (let i = 0; i < imageFiles.length; i++) {
      const originalFilename = imageFiles[i];
      
      try {
        // Generate unique filename
        const uniqueFilename = FileOperations.generateUniqueFilename(originalFilename);
        
        // Setup paths
        const sourcePath = path.join(this.sourcePath, originalFilename);
        const destPath = path.join(destinationPath, uniqueFilename);
        
        // Move file
        await FileOperations.moveFile(sourcePath, destPath, originalFilename);
        
        // Generate URL
        const imageUrl = `${CONFIG.API_BASE_URL}/upload/campaigns/${this.destinationFolder}/${uniqueFilename}`;
        processedUrls.push(imageUrl);
        
        // Show progress
        if ((i + 1) % CONFIG.PROGRESS_INTERVAL === 0 || i === imageFiles.length - 1) {
          Logger.progress(i + 1, imageFiles.length, `Processing: ${originalFilename}`);
        }
        
      } catch (error) {
        this.errors.push({
          file: originalFilename,
          error: error.message
        });
        
        Logger.error(`Failed to process image: ${originalFilename}`, error);
        
        // Continue with other files even if one fails
        continue;
      }
    }
    
    Logger.success(`Image processing complete`, {
      totalFiles: imageFiles.length,
      successfullyProcessed: processedUrls.length,
      errors: this.errors.length
    });
    
    if (this.errors.length > 0) {
      Logger.warn('Some files failed to process:', this.errors);
    }
    
    return processedUrls;
  }

  /**
   * Execute the complete migration process
   */
  async migrate() {
    const startTime = Date.now();
    
    try {
      Logger.info('='.repeat(60));
      Logger.info('CAMPAIGN IMAGE MIGRATION STARTED');
      Logger.info('='.repeat(60));
      Logger.info(`Source Path: ${this.sourcePath}`);
      Logger.info(`Campaign ID: ${this.campaignId}`);
      Logger.info(`API Base URL: ${CONFIG.API_BASE_URL}`);
      
      // Step 1: Validate inputs
      await this.validateInputs();
      
      // Step 2: Find and validate campaign
      this.campaign = await CampaignOperations.findCampaign(this.campaignId);
      
      // Step 3: Process images
      this.processedUrls = await this.processImages();
      
      if (this.processedUrls.length === 0) {
        Logger.warn('No images were successfully processed. Skipping database update.');
        return {
          success: true,
          message: 'No images to process',
          campaign: this.campaign.getPublicData(),
          processedImages: 0,
          errors: this.errors
        };
      }
      
      // Step 4: Update database
      const finalImages = await CampaignOperations.updateCampaignImages(
        this.campaign, 
        this.processedUrls
      );
      
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      
      Logger.info('='.repeat(60));
      Logger.success('CAMPAIGN IMAGE MIGRATION COMPLETED SUCCESSFULLY');
      Logger.info('='.repeat(60));
      Logger.success(`Execution Time: ${executionTime}ms`);
      Logger.success(`Images Processed: ${this.processedUrls.length}`);
      Logger.success(`Total Campaign Images: ${finalImages.length}`);
      Logger.success(`Destination Folder: ${this.destinationFolder}`);
      
      if (this.errors.length > 0) {
        Logger.warn(`Errors Encountered: ${this.errors.length}`);
      }
      
      return {
        success: true,
        message: 'Migration completed successfully',
        campaign: this.campaign.getPublicData(),
        processedImages: this.processedUrls.length,
        totalImages: finalImages.length,
        destinationFolder: this.destinationFolder,
        imageUrls: this.processedUrls,
        executionTime: executionTime,
        errors: this.errors
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      Logger.info('='.repeat(60));
      Logger.error('CAMPAIGN IMAGE MIGRATION FAILED');
      Logger.info('='.repeat(60));
      Logger.error(`Execution Time: ${executionTime}ms`);
      Logger.error('Migration Error:', error);
      
      return {
        success: false,
        message: error.message,
        executionTime: executionTime,
        errors: [...this.errors, { general: error.message }]
      };
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  // Check command line arguments
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error('Usage: node migrate-campaign-images.js <folder-path> <campaign-id>');
    console.error('');
    console.error('Examples:');
    console.error('  node migrate-campaign-images.js /home/user/images 123e4567-e89b-12d3-a456-426614174000');
    console.error('  node migrate-campaign-images.js ./local-images 987fcdeb-51a2-43d1-b123-456789abcdef');
    console.error('');
    console.error('Supported image formats: ' + CONFIG.SUPPORTED_FORMATS.join(', '));
    process.exit(1);
  }
  
  const [sourcePath, campaignId] = args;
  
  // Create migrator instance
  const migrator = new ImageMigrator(sourcePath, campaignId);
  
  let result;
  try {
    // Execute migration
    result = await migrator.migrate();
  } catch (error) {
    Logger.error('Unexpected error during migration:', error);
    process.exit(1);
  } finally {
    // Always close database connection
    try {
      await sequelize.close();
      Logger.info('Database connection closed');
    } catch (error) {
      Logger.error('Error closing database connection:', error);
    }
  }
  
  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Handle unhandled promise rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  Logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Execute main function if script is run directly
if (require.main === module) {
  main().catch((error) => {
    Logger.error('Critical error in main execution:', error);
    process.exit(1);
  });
}

module.exports = {
  ImageMigrator,
  FileOperations,
  CampaignOperations,
  Logger,
  CONFIG
};