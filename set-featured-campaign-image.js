#!/usr/bin/env node

/**
 * Campaign Featured Image Setter Script
 * 
 * This script sets a single image as the featured image (first image) for a campaign.
 * It moves the image file to the campaign upload directory and updates the campaign
 * record in the database, placing the new image as the first image.
 * 
 * Usage: node set-featured-campaign-image.js <image-path> <campaign-id>
 * 
 * Features:
 * - Takes a single image file path and campaign ID
 * - Moves file to /upload/campaigns/<campaign-folder>/ directory
 * - Generates proper URL in format: https://devapi.bdrf.in/upload/campaigns/<folder-name>/<filename>
 * - Updates Campaign record placing this image as the FIRST image (featured image)
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
  API_BASE_URL: process.env.API_BASE_URL || 'https://devapi.bdrf.in'
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
    
    return `featured-${timestamp}-${uniqueId}-${cleanBaseName}${ext}`;
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
   * Update campaign images in database, placing new image as FIRST (featured image)
   * @param {Object} campaign - Campaign instance
   * @param {string} featuredImageUrl - Featured image URL to place first
   */
  static async setFeaturedImage(campaign, featuredImageUrl) {
    const transaction = await sequelize.transaction();
    
    try {
      Logger.info(`Setting featured image for campaign`, {
        campaignId: campaign.id,
        featuredImageUrl: featuredImageUrl,
        existingImageCount: campaign.images ? campaign.images.length : 0
      });
      
      const existingImages = campaign.images || [];
      
      // Remove the featured image if it already exists in the array to avoid duplicates
      const filteredExistingImages = existingImages.filter(img => img !== featuredImageUrl);
      
      // Place the featured image first, then add all other existing images
      const updatedImages = [featuredImageUrl, ...filteredExistingImages];
      
      // Update campaign with new images array
      await campaign.update({ 
        images: updatedImages 
      }, { 
        transaction,
        fields: ['images'] // Only update images field
      });
      
      await transaction.commit();
      
      Logger.success(`Featured image set successfully`, {
        campaignId: campaign.id,
        featuredImageUrl: featuredImageUrl,
        totalImages: updatedImages.length,
        imagePosition: 'First (Featured)'
      });
      
      return updatedImages;
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Failed to set featured image in database: ${error.message}`);
    }
  }
}

/**
 * Main featured image setter class
 */
class FeaturedImageSetter {
  constructor(imagePath, campaignId) {
    this.imagePath = imagePath;
    this.campaignId = campaignId;
    this.destinationFolder = null;
    this.campaign = null;
    this.featuredImageUrl = null;
  }

  /**
   * Validate input parameters
   */
  async validateInputs() {
    Logger.info('Validating input parameters...');
    
    // Validate image path
    if (!this.imagePath) {
      throw new Error('Image file path is required');
    }
    
    try {
      const stat = await fs.stat(this.imagePath);
      if (!stat.isFile()) {
        throw new Error(`Image path is not a file: ${this.imagePath}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Image file does not exist: ${this.imagePath}`);
      }
      throw error;
    }
    
    // Validate image format
    const filename = path.basename(this.imagePath);
    if (!FileOperations.isSupportedImageFormat(filename)) {
      throw new Error(`Unsupported image format: ${filename}. Supported formats: ${CONFIG.SUPPORTED_FORMATS.join(', ')}`);
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
   * Process the featured image
   */
  async processImage() {
    Logger.info('Processing featured image...');
    
    const originalFilename = path.basename(this.imagePath);
    const destinationPath = await this.setupDestination();
    
    try {
      // Generate unique filename with featured prefix
      const uniqueFilename = FileOperations.generateUniqueFilename(originalFilename);
      
      // Setup paths
      const destPath = path.join(destinationPath, uniqueFilename);
      
      // Move file
      await FileOperations.moveFile(this.imagePath, destPath, originalFilename);
      
      // Generate URL
      this.featuredImageUrl = `${CONFIG.API_BASE_URL}/upload/campaigns/${this.destinationFolder}/${uniqueFilename}`;
      
      Logger.success(`Featured image processed successfully`, {
        originalFile: originalFilename,
        uniqueFilename: uniqueFilename,
        imageUrl: this.featuredImageUrl
      });
      
      return this.featuredImageUrl;
      
    } catch (error) {
      throw new Error(`Failed to process featured image: ${originalFilename}. Error: ${error.message}`);
    }
  }

  /**
   * Execute the complete featured image setting process
   */
  async setFeaturedImage() {
    const startTime = Date.now();
    
    try {
      Logger.info('='.repeat(60));
      Logger.info('CAMPAIGN FEATURED IMAGE SETTER STARTED');
      Logger.info('='.repeat(60));
      Logger.info(`Image Path: ${this.imagePath}`);
      Logger.info(`Campaign ID: ${this.campaignId}`);
      Logger.info(`API Base URL: ${CONFIG.API_BASE_URL}`);
      
      // Step 1: Validate inputs
      await this.validateInputs();
      
      // Step 2: Find and validate campaign
      this.campaign = await CampaignOperations.findCampaign(this.campaignId);
      
      // Step 3: Process the image
      await this.processImage();
      
      // Step 4: Update database with featured image
      const finalImages = await CampaignOperations.setFeaturedImage(
        this.campaign, 
        this.featuredImageUrl
      );
      
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      
      Logger.info('='.repeat(60));
      Logger.success('CAMPAIGN FEATURED IMAGE SET SUCCESSFULLY');
      Logger.info('='.repeat(60));
      Logger.success(`Execution Time: ${executionTime}ms`);
      Logger.success(`Featured Image URL: ${this.featuredImageUrl}`);
      Logger.success(`Total Campaign Images: ${finalImages.length}`);
      Logger.success(`Destination Folder: ${this.destinationFolder}`);
      
      return {
        success: true,
        message: 'Featured image set successfully',
        campaign: {
          id: this.campaign.id,
          title: this.campaign.title,
          status: this.campaign.status
        },
        featuredImageUrl: this.featuredImageUrl,
        totalImages: finalImages.length,
        destinationFolder: this.destinationFolder,
        executionTime: executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      Logger.info('='.repeat(60));
      Logger.error('CAMPAIGN FEATURED IMAGE SETTING FAILED');
      Logger.info('='.repeat(60));
      Logger.error(`Execution Time: ${executionTime}ms`);
      Logger.error('Error:', error);
      
      return {
        success: false,
        message: error.message,
        executionTime: executionTime,
        error: error.message
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
    console.error('Usage: node set-featured-campaign-image.js <image-path> <campaign-id>');
    console.error('');
    console.error('Examples:');
    console.error('  node set-featured-campaign-image.js /home/user/featured.jpg 123e4567-e89b-12d3-a456-426614174000');
    console.error('  node set-featured-campaign-image.js ./featured-image.png 987fcdeb-51a2-43d1-b123-456789abcdef');
    console.error('');
    console.error('Supported image formats: ' + CONFIG.SUPPORTED_FORMATS.join(', '));
    console.error('');
    console.error('Note: This script will set the provided image as the FIRST (featured) image for the campaign.');
    process.exit(1);
  }
  
  const [imagePath, campaignId] = args;
  
  // Create setter instance
  const setter = new FeaturedImageSetter(imagePath, campaignId);
  
  let result;
  try {
    // Execute featured image setting
    result = await setter.setFeaturedImage();
  } catch (error) {
    Logger.error('Unexpected error during featured image setting:', error);
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
  FeaturedImageSetter,
  FileOperations,
  CampaignOperations,
  Logger,
  CONFIG
};