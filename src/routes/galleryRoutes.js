const express = require('express');
const { validate } = require('../middleware/validation');
const galleryController = require('../controllers/galleryController');
const galleryValidators = require('../validators/galleryValidators');
const { catchAsync } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * Frontend Gallery Routes
 * 
 * Public API for gallery browsing with the following features:
 * - Paginated gallery listing with filters
 * - Category-based filtering
 * - Featured gallery items
 * - Gallery item details with view tracking
 * - Related items suggestion
 * - Search functionality
 * - Category listing with counts
 * - Optimized for frontend consumption
 */

/**
 * GET /gallery - Get gallery items with pagination and filters
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 12, max: 50)
 * - category: Filter by category
 * - subcategory: Filter by subcategory
 * - featured: Filter featured items (true/false)
 * - tags: Comma-separated list of tags to filter by
 * - sort_by: Sort field (created_at, view_count, like_count, sort_order)
 * - sort_order: Sort order (asc, desc)
 * 
 * Returns: Paginated active gallery items only
 */
router.get('/', validate(galleryValidators.frontendGalleryListValidation), galleryController.getGalleryItems);

/**
 * GET /gallery/featured - Get featured gallery items
 * Query parameters:
 * - limit: Number of items to return (default: 8, max: 20)
 * 
 * Returns: Featured gallery items ordered by sort_order
 */
router.get('/featured', galleryController.getFeaturedGalleryItems);

/**
 * GET /gallery/categories - Get gallery categories with item counts
 * Query parameters:
 * - include_subcategories: Include subcategory breakdown (true/false, default: false)
 * 
 * Returns: Categories with active item counts and featured counts
 */
router.get('/categories', galleryController.getGalleryCategories);

/**
 * GET /gallery/search - Search gallery items
 * Query parameters:
 * - q: Search query (required, min 2 characters)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 12, max: 50)
 * - category: Filter by category
 * - sort_by: Sort field (relevance, date, views, likes)
 * 
 * Searches in: title, description, tags, photographer, location, caption
 * Returns: Matching active gallery items with search metadata
 */
router.get('/search', galleryController.searchGalleryItems);

/**
 * GET /gallery/:id - Get gallery item details by ID or slug
 * 
 * Accepts: UUID or slug
 * Automatically increments view count
 * Returns: Complete gallery item data (active items only)
 */
router.get('/:id', validate(galleryValidators.frontendGalleryDetailValidation), galleryController.getGalleryItemById);

/**
 * GET /gallery/:id/related - Get related gallery items
 * Query parameters:
 * - limit: Number of related items (default: 6, max: 12)
 * 
 * Finds related items based on:
 * 1. Same subcategory (highest priority)
 * 2. Same category
 * 3. Similar tags
 * 
 * Returns: Related active gallery items
 */
router.get('/:id/related', galleryController.getRelatedGalleryItems);

module.exports = router;