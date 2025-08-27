const express = require('express');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Static file server middleware for uploaded files
 * Serves files from the 'upload' directory
 */
const createFileServer = () => {
  const uploadPath = path.join(process.cwd(), 'upload');
  
  // Ensure upload directory exists
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
    logger.info('Created upload directory:', uploadPath);
  }

  // Create static file server with security headers
  const fileServer = express.static(uploadPath, {
    maxAge: '1d', // Cache files for 1 day
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      
      // Set proper content type for images
      const ext = path.extname(filePath).toLowerCase();
      const imageTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
      };
      
      if (imageTypes[ext]) {
        res.setHeader('Content-Type', imageTypes[ext]);
      }
      
      // Add CORS headers for cross-origin requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    }
  });

  return fileServer;
};

/**
 * Custom file server with logging and error handling
 */
const serveUploadedFile = (req, res, next) => {
  const filePath = path.join(process.cwd(), 'upload', req.path.substring(1)); // Remove leading slash
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    logger.warn('File not found:', {
      requestedPath: req.path,
      filePath: filePath,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(404).json({
      success: false,
      message: 'File not found',
      error: 'FILE_NOT_FOUND'
    });
  }

  // Check if path is within upload directory (security check)
  const uploadDir = path.join(process.cwd(), 'upload');
  const resolvedPath = path.resolve(filePath);
  const resolvedUploadDir = path.resolve(uploadDir);
  
  if (!resolvedPath.startsWith(resolvedUploadDir)) {
    logger.error('Path traversal attempt detected:', {
      requestedPath: req.path,
      resolvedPath: resolvedPath,
      uploadDir: resolvedUploadDir,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(403).json({
      success: false,
      message: 'Access denied',
      error: 'ACCESS_DENIED'
    });
  }

  // Log file access
  logger.info('File accessed:', {
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Serve the file using express.static
  const fileServer = createFileServer();
  fileServer(req, res, next);
};

module.exports = {
  createFileServer,
  serveUploadedFile
};