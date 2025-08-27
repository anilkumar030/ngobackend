const express = require('express');
const contentController = require('../controllers/contentController');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { uploadMiddleware } = require('../config/cloudinary');
const Joi = require('joi');
const {
  createContentSectionValidation,
  updateContentSectionValidation,
  getContentSectionsValidation,
  getContentSectionValidation,
  deleteContentSectionValidation,
  bulkUpdateContentSectionsValidation,
  getContentAnalyticsValidation,
  getPageContentValidation,
  reorderSectionsValidation,
} = require('../validators/contentValidators');

const router = express.Router();

/**
 * Content Sections API Routes
 * 
 * This module provides comprehensive content management for the BDRF NGO website.
 * It supports flexible content sections that can be used across different pages.
 * 
 * Public Endpoints (no authentication required):
 * - GET /api/content/sections - Get all public content sections with filtering
 * - GET /api/content/sections/:key - Get specific content section by key/id/slug
 * - GET /api/content/pages/:page - Get all content sections for a specific page
 * - GET /api/content/sections/bdrf-info - Get BDRF info section (legacy)
 * - GET /api/content/call-to-action - Get call-to-action section (legacy)
 * - GET /api/content/gallery - Get gallery images
 * 
 * Admin Endpoints (require admin authentication):
 * - POST /api/content/sections - Create new content section
 * - PUT /api/content/sections/:id - Update content section by ID
 * - DELETE /api/content/sections/:id - Delete content section
 * - PATCH /api/content/sections/bulk - Bulk update content sections
 * - POST /api/content/sections/reorder - Reorder content sections
 * - GET /api/content/sections/:id/analytics - Get content section analytics
 * - POST /api/content/gallery/upload - Upload gallery image
 * - PUT /api/content/gallery/:id - Update gallery image
 * - DELETE /api/content/gallery/:id - Delete gallery image
 * 
 * Content Section Structure:
 * - Supports multiple content types: hero, text, image, gallery, video, testimonial, cta, etc.
 * - Flexible settings and metadata support
 * - Multilingual content support
 * - SEO optimization fields
 * - Content scheduling and visibility controls
 * - Device-specific visibility settings
 * - Analytics tracking
 * 
 * Features:
 * - Caching for better performance
 * - Content versioning and status management
 * - Rich media support (images, videos, links)
 * - Bulk operations for admin efficiency
 * - Content analytics and reporting
 * - Responsive design support
 */

// Legacy validation schemas (for backward compatibility)
const contentSectionValidation = {
  params: Joi.object({
    type: Joi.string().valid('hero', 'sacred-impact', 'main-content', 'footer', 'header').required(),
  }),
};

const updateContentValidation = {
  params: Joi.object({
    type: Joi.string().valid('hero', 'sacred-impact', 'main-content', 'footer', 'header').required(),
  }),
  body: Joi.object({
    title: Joi.string().min(1).max(200).optional(),
    description: Joi.string().max(500).optional(),
    content_data: Joi.object().required(),
    is_active: Joi.boolean().optional(),
  }),
};

const galleryQueryValidation = {
  query: Joi.object({
    category: Joi.string().max(50).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    sort_by: Joi.string().valid('created_at', 'title', 'category').default('created_at'),
    sort_order: Joi.string().valid('asc', 'desc').default('desc'),
  }),
};

const uploadGalleryImageValidation = {
  body: Joi.object({
    category: Joi.string().max(50).default('general'),
    title: Joi.string().max(200).optional(),
    description: Joi.string().max(500).optional(),
    alt_text: Joi.string().max(200).optional(),
  }),
};

const updateGalleryImageValidation = {
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
  body: Joi.object({
    title: Joi.string().max(200).optional(),
    description: Joi.string().max(500).optional(),
    alt_text: Joi.string().max(200).optional(),
    category: Joi.string().max(50).optional(),
    is_active: Joi.boolean().optional(),
  }),
};

const deleteGalleryImageValidation = {
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
};

// Public routes
router.get('/sections/:type', 
  optionalAuth, 
  validate(contentSectionValidation), 
  contentController.getContentSection
);

router.get('/gallery', 
  optionalAuth, 
  validate(galleryQueryValidation), 
  contentController.getGalleryImages
);

// Special content sections (legacy endpoints)
router.get('/sections/bdrf-info', optionalAuth, contentController.getBdrfInfoSection);
router.get('/call-to-action', optionalAuth, contentController.getCallToActionSection);

// New flexible content section endpoints (public)
router.get('/sections', 
  optionalAuth, 
  validate(getContentSectionsValidation), 
  contentController.getContentSections
);

router.get('/sections/:key', 
  optionalAuth, 
  validate(getContentSectionValidation), 
  contentController.getContentSectionByKey
);

router.get('/pages/:page', 
  optionalAuth, 
  validate(getPageContentValidation), 
  contentController.getPageContent
);

// Protected routes (require authentication)
router.use(authenticateToken);

// Content section management
router.post('/sections', 
  requireAdmin, 
  validate(createContentSectionValidation), 
  contentController.createContentSection
);

router.put('/sections/:id', 
  requireAdmin, 
  validate(updateContentSectionValidation), 
  contentController.updateContentSectionById
);

router.delete('/sections/:id', 
  requireAdmin, 
  validate(deleteContentSectionValidation), 
  contentController.deleteContentSection
);

// Legacy admin endpoint
router.get('/admin/sections', 
  requireAdmin, 
  contentController.getAllContentSections
);

// Legacy section type endpoint
router.put('/sections/:type', 
  requireAdmin, 
  validate(updateContentValidation), 
  contentController.updateContentSection
);

// Bulk operations (admin only)
router.patch('/sections/bulk', 
  requireAdmin, 
  validate(bulkUpdateContentSectionsValidation), 
  contentController.bulkUpdateContentSections
);

router.post('/sections/reorder', 
  requireAdmin, 
  validate(reorderSectionsValidation), 
  contentController.reorderContentSections
);

// Analytics (admin only)
router.get('/sections/:id/analytics', 
  requireAdmin, 
  validate(getContentAnalyticsValidation), 
  contentController.getContentAnalytics
);

// Gallery management (admin only)
router.post('/gallery/upload', 
  requireAdmin,
  uploadMiddleware.single('image'),
  validate(uploadGalleryImageValidation),
  contentController.uploadGalleryImage
);

router.put('/gallery/:id', 
  requireAdmin, 
  validate(updateGalleryImageValidation), 
  contentController.updateGalleryImage
);

router.delete('/gallery/:id', 
  requireAdmin, 
  validate(deleteGalleryImageValidation), 
  contentController.deleteGalleryImage
);

module.exports = router;