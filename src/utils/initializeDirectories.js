const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

/**
 * Initialize required directories for the application
 */
class DirectoryInitializer {
  constructor() {
    this.baseUploadPath = path.join(process.cwd(), 'upload');
    this.requiredDirectories = [
      path.join(this.baseUploadPath, 'campaigns'),
      path.join(this.baseUploadPath, 'campaignupdate'),
      path.join(this.baseUploadPath, 'profiles'),
      path.join(this.baseUploadPath, 'gallery'),
      path.join(this.baseUploadPath, 'temp')
    ];
  }

  /**
   * Ensure directory exists
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
      logger.debug(`Directory exists: ${dirPath}`);
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
   * Initialize all required directories
   */
  async initialize() {
    try {
      logger.info('Initializing application directories...');
      
      // Ensure base upload directory exists
      await this.ensureDirectoryExists(this.baseUploadPath);
      
      // Create all required subdirectories
      for (const directory of this.requiredDirectories) {
        await this.ensureDirectoryExists(directory);
      }
      
      logger.info('All application directories initialized successfully');
      return { success: true, directories: this.requiredDirectories };
      
    } catch (error) {
      logger.error('Failed to initialize directories:', error);
      throw error;
    }
  }

  /**
   * Verify directory permissions
   */
  async verifyPermissions() {
    try {
      const results = {};
      
      for (const directory of this.requiredDirectories) {
        try {
          // Test write permission by creating a temporary file
          const testFile = path.join(directory, '.write-test');
          await fs.writeFile(testFile, 'test');
          await fs.unlink(testFile);
          
          results[directory] = { readable: true, writable: true };
        } catch (error) {
          results[directory] = { 
            readable: false, 
            writable: false, 
            error: error.message 
          };
        }
      }
      
      return results;
    } catch (error) {
      logger.error('Failed to verify directory permissions:', error);
      throw error;
    }
  }

  /**
   * Get directory statistics
   */
  async getDirectoryStats() {
    try {
      const stats = {};
      
      for (const directory of this.requiredDirectories) {
        try {
          const files = await fs.readdir(directory);
          let totalSize = 0;
          let fileCount = 0;
          
          for (const file of files) {
            try {
              const filePath = path.join(directory, file);
              const fileStat = await fs.stat(filePath);
              
              if (fileStat.isFile()) {
                totalSize += fileStat.size;
                fileCount++;
              }
            } catch (error) {
              // Skip files that can't be accessed
              continue;
            }
          }
          
          stats[directory] = {
            exists: true,
            fileCount,
            totalSize,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
          };
        } catch (error) {
          stats[directory] = {
            exists: false,
            error: error.message
          };
        }
      }
      
      return stats;
    } catch (error) {
      logger.error('Failed to get directory statistics:', error);
      throw error;
    }
  }
}

module.exports = new DirectoryInitializer();