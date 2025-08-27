const express = require('express');
const { BlogPost, User } = require('../models');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { redisUtils, CACHE_KEYS } = require('../config/redis');
const blogValidators = require('../validators/blogValidators');

const router = express.Router();

/**
 * Public Frontend Blog Routes
 * 
 * Public API endpoints for blog content consumption with the following features:
 * - Optimized for frontend performance with caching
 * - Only shows published and public content
 * - SEO-friendly slug-based routing
 * - Optional authentication for enhanced features
 * - Advanced filtering and search capabilities
 * - Related content suggestions
 */

/**
 * Get all blog posts with filters
 */
const getBlogPosts = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    category,
    search,
    sort_by = 'published_at',
    sort_order = 'desc',
    status = 'published',
  } = req.query;

  const offset = (page - 1) * limit;

  // Build where conditions
  const whereConditions = {
    status: status,
  };

  if (category) {
    whereConditions.category = category;
  }

  if (search) {
    whereConditions[require('sequelize').Op.or] = [
      { title: { [require('sequelize').Op.iLike]: `%${search}%` } },
      { excerpt: { [require('sequelize').Op.iLike]: `%${search}%` } },
      { content: { [require('sequelize').Op.iLike]: `%${search}%` } },
    ];
  }

  // Only show published posts for public access
  if (!req.user || req.user.role === 'user') {
    whereConditions.status = 'published';
    whereConditions.published_at = {
      [require('sequelize').Op.lte]: new Date(),
    };
  }

  const { count, rows: blogPosts } = await BlogPost.findAndCountAll({
    where: whereConditions,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'first_name', 'last_name', 'profile_image'],
      },
    ],
    order: [[sort_by, sort_order.toUpperCase()]],
    limit: parseInt(limit),
    offset: offset,
    attributes: {
      exclude: ['content'], // Exclude full content in list view
    },
  });

  const totalPages = Math.ceil(count / limit);

  res.status(200).json({
    success: true,
    data: {
      posts: blogPosts,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: count,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    },
  });
});

/**
 * Get single blog post by slug
 */
const getBlogPost = catchAsync(async (req, res) => {
  const { slug } = req.params;

  // Check cache first
  const cacheKey = CACHE_KEYS.BLOG_POST(slug);
  const cachedPost = await redisUtils.get(cacheKey);
  
  if (cachedPost) {
    return res.status(200).json({
      success: true,
      data: {
        post: cachedPost,
      },
    });
  }

  const whereConditions = { slug };

  // Only show published posts for public access
  if (!req.user || req.user.role === 'user') {
    whereConditions.status = 'published';
    whereConditions.published_at = {
      [require('sequelize').Op.lte]: new Date(),
    };
  }

  const blogPost = await BlogPost.findOne({
    where: whereConditions,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'first_name', 'last_name', 'profile_image', 'bio'],
      },
    ],
  });

  if (!blogPost) {
    throw new AppError('Blog post not found', 404, true, 'BLOG_POST_NOT_FOUND');
  }

  // Increment view count
  await blogPost.increment('view_count');

  const postData = blogPost.toJSON();
  postData.view_count += 1; // Update the returned data

  // Cache for 1 hour
  await redisUtils.set(cacheKey, postData, 3600);

  res.status(200).json({
    success: true,
    data: {
      post: postData,
    },
  });
});

/**
 * Get blog categories
 */
const getCategories = catchAsync(async (req, res) => {
  const categories = await BlogPost.findAll({
    attributes: [
      'category',
      [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'post_count'],
    ],
    where: {
      status: 'published',
      category: {
        [require('sequelize').Op.ne]: null,
      },
    },
    group: ['category'],
    order: [['category', 'ASC']],
    raw: true,
  });

  res.status(200).json({
    success: true,
    data: {
      categories: categories.map(cat => ({
        name: cat.category,
        count: parseInt(cat.post_count),
      })),
    },
  });
});

/**
 * Get featured blog posts
 */
const getFeaturedPosts = catchAsync(async (req, res) => {
  const { limit = 5 } = req.query;

  const posts = await BlogPost.findAll({
    where: {
      is_featured: true,
      status: 'published',
      published_at: {
        [require('sequelize').Op.lte]: new Date(),
      },
    },
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'first_name', 'last_name', 'profile_image'],
      },
    ],
    order: [['published_at', 'DESC']],
    limit: parseInt(limit),
    attributes: {
      exclude: ['content'],
    },
  });

  res.status(200).json({
    success: true,
    data: {
      posts,
    },
  });
});

/**
 * Get latest blog posts
 */
const getLatestPosts = catchAsync(async (req, res) => {
  const { limit = 5 } = req.query;

  const posts = await BlogPost.findAll({
    where: {
      status: 'published',
      published_at: {
        [require('sequelize').Op.lte]: new Date(),
      },
    },
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'first_name', 'last_name', 'profile_image'],
      },
    ],
    order: [['published_at', 'DESC']],
    limit: parseInt(limit),
    attributes: {
      exclude: ['content'],
    },
  });

  res.status(200).json({
    success: true,
    data: {
      posts,
    },
  });
});

/**
 * Get related posts
 */
const getRelatedPosts = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const { limit = 3 } = req.query;

  // First get the current post
  const currentPost = await BlogPost.findOne({
    where: { slug },
    attributes: ['id', 'category', 'tags'],
  });

  if (!currentPost) {
    throw new AppError('Blog post not found', 404, true, 'BLOG_POST_NOT_FOUND');
  }

  // Find related posts based on category and tags
  const whereConditions = {
    id: { [require('sequelize').Op.ne]: currentPost.id },
    status: 'published',
    published_at: { [require('sequelize').Op.lte]: new Date() },
  };

  // Prefer posts from the same category
  if (currentPost.category) {
    whereConditions.category = currentPost.category;
  }

  const relatedPosts = await BlogPost.findAll({
    where: whereConditions,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'first_name', 'last_name', 'profile_image'],
      },
    ],
    order: [['published_at', 'DESC']],
    limit: parseInt(limit),
    attributes: {
      exclude: ['content'],
    },
  });

  res.status(200).json({
    success: true,
    data: {
      posts: relatedPosts,
    },
  });
});

/**
 * Frontend Blog API Routes
 */

/**
 * GET /blogs - Get published blog posts with filtering and pagination
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 50)
 * - category: Filter by category name
 * - search: Full-text search in title, content, excerpt
 * - sort_by: Sort field (title, created_at, published_at, view_count)
 * - sort_order: Sort direction (asc, desc)
 * 
 * Response: Paginated list of published posts (content excluded for performance)
 * Authentication: Optional (for enhanced features)
 */
router.get('/', optionalAuth, validate(blogValidators.getBlogPostsValidation), getBlogPosts);

/**
 * GET /blogs/categories - Get all blog categories with post counts
 * 
 * Returns: Array of categories with post counts for published posts only
 * Authentication: None required
 */
router.get('/categories', getCategories);

/**
 * GET /blogs/featured - Get featured blog posts
 * 
 * Query parameters:
 * - limit: Number of posts to return (default: 5, max: 20)
 * 
 * Response: Array of featured posts (published only, content excluded)
 * Authentication: None required
 */
router.get('/featured', validate(blogValidators.getFeaturedPostsValidation), getFeaturedPosts);

/**
 * GET /blogs/latest - Get latest published blog posts
 * 
 * Query parameters:
 * - limit: Number of posts to return (default: 5, max: 20)
 * 
 * Response: Array of latest posts ordered by published_at (content excluded)
 * Authentication: None required
 */
router.get('/latest', validate(blogValidators.getLatestPostsValidation), getLatestPosts);

/**
 * GET /blogs/:slug - Get single blog post by slug
 * 
 * Path parameters:
 * - slug: URL-friendly post identifier (lowercase, hyphenated)
 * 
 * Features:
 * - Includes full content and author information
 * - Increments view count automatically
 * - Redis caching for performance (1 hour TTL)
 * - Only shows published posts to public users
 * 
 * Response: Complete blog post with author details
 * Authentication: Optional (admins can view unpublished posts)
 */
router.get('/:slug', optionalAuth, validate(blogValidators.blogSlugParamsValidation), getBlogPost);

/**
 * GET /blogs/:slug/related - Get related blog posts
 * 
 * Path parameters:
 * - slug: Source post slug for finding related content
 * 
 * Query parameters:
 * - limit: Number of related posts (default: 3, max: 10)
 * 
 * Logic:
 * - Prioritizes posts from same category
 * - Falls back to general recent posts if no category matches
 * - Excludes the source post itself
 * 
 * Response: Array of related posts (content excluded)
 * Authentication: None required
 */
router.get('/:slug/related', validate(blogValidators.getRelatedPostsValidation), getRelatedPosts);

module.exports = router;