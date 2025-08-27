const { Gallery } = require('../models');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { redisUtils, CACHE_KEYS } = require('../config/redis');
const { Op, Sequelize } = require('sequelize');

/**
 * Get gallery items for frontend with pagination and filters
 */
const getGalleryItems = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    category,
    subcategory,
    featured,
    tags,
    sort_by = 'sort_order',
    sort_order = 'asc'
  } = req.query;

  const offset = (page - 1) * limit;

  // Check cache first
  const cacheKey = `${CACHE_KEYS.GALLERY_LIST}:frontend:${JSON.stringify(req.query)}`;
  const cachedResult = await redisUtils.get(cacheKey);
  
  if (cachedResult) {
    return res.json(cachedResult);
  }

  // Build where clause - only show active items for frontend
  const whereClause = {
    status: 'active'
  };

  // Category filter
  if (category) {
    whereClause.category = category;
  }

  // Subcategory filter
  if (subcategory) {
    whereClause.subcategory = subcategory;
  }

  // Featured filter
  if (featured !== undefined) {
    whereClause.featured = featured === 'true';
  }

  // Tags filter
  if (tags) {
    const tagList = tags.split(',').map(tag => tag.trim());
    whereClause.tags = {
      [Op.overlap]: tagList
    };
  }

  // Build order clause
  const orderClause = [];
  
  switch (sort_by) {
    case 'created_at':
      orderClause.push(['created_at', sort_order.toUpperCase()]);
      break;
    case 'view_count':
      orderClause.push(['view_count', sort_order.toUpperCase()]);
      break;
    case 'like_count':
      orderClause.push(['like_count', sort_order.toUpperCase()]);
      break;
    case 'sort_order':
    default:
      orderClause.push(['sort_order', sort_order.toUpperCase()]);
      orderClause.push(['created_at', 'DESC']); // Secondary sort
      break;
  }

  // Execute query
  const { rows: galleryItems, count: totalItems } = await Gallery.findAndCountAll({
    where: whereClause,
    attributes: [
      'id',
      'title',
      'slug',
      'description',
      'image_url',
      'thumbnail_url',
      'medium_url',
      'category',
      'subcategory',
      'tags',
      'alt_text',
      'caption',
      'photographer',
      'location',
      'taken_at',
      'dimensions',
      'featured',
      'view_count',
      'like_count',
      'sort_order',
      'created_at'
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: orderClause
  });

  // Calculate pagination info
  const totalPages = Math.ceil(totalItems / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const response = {
    success: true,
    message: 'Gallery items retrieved successfully',
    data: {
      gallery: galleryItems.map(item => item.getPublicData()),
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems,
        itemsPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage
      },
      filters: {
        category,
        subcategory,
        featured,
        tags,
        sort_by,
        sort_order
      }
    }
  };

  // Cache the result for 5 minutes
  await redisUtils.setex(cacheKey, 300, response);

  res.json(response);
});

/**
 * Get featured gallery items
 */
const getFeaturedGalleryItems = catchAsync(async (req, res) => {
  const { limit = 8 } = req.query;

  // Check cache first
  const cacheKey = `${CACHE_KEYS.GALLERY_LIST}:featured:${limit}`;
  const cachedResult = await redisUtils.get(cacheKey);
  
  if (cachedResult) {
    return res.json(cachedResult);
  }

  const galleryItems = await Gallery.scope('featured').findAll({
    attributes: [
      'id',
      'title',
      'slug',
      'description',
      'image_url',
      'thumbnail_url',
      'medium_url',
      'category',
      'tags',
      'alt_text',
      'caption',
      'photographer',
      'location',
      'dimensions',
      'view_count',
      'like_count',
      'created_at'
    ],
    limit: parseInt(limit),
    order: [['sort_order', 'ASC'], ['created_at', 'DESC']]
  });

  const response = {
    success: true,
    message: 'Featured gallery items retrieved successfully',
    data: {
      gallery: galleryItems.map(item => item.getPublicData()),
      count: galleryItems.length
    }
  };

  // Cache the result for 10 minutes
  await redisUtils.setex(cacheKey, 600, response);

  res.json(response);
});

/**
 * Get gallery item by ID or slug
 */
const getGalleryItemById = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Check cache first
  const cacheKey = `${CACHE_KEYS.GALLERY_DETAIL}:${id}`;
  const cachedResult = await redisUtils.get(cacheKey);
  
  if (cachedResult) {
    return res.json(cachedResult);
  }

  // Find by ID or slug
  const whereClause = {
    status: 'active'
  };

  // Check if it's a UUID or slug
  if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
    whereClause.id = id;
  } else {
    whereClause.slug = id;
  }

  const galleryItem = await Gallery.findOne({
    where: whereClause,
    attributes: [
      'id',
      'title',
      'slug',
      'description',
      'image_url',
      'thumbnail_url',
      'medium_url',
      'category',
      'subcategory',
      'tags',
      'alt_text',
      'caption',
      'photographer',
      'location',
      'taken_at',
      'dimensions',
      'file_size',
      'file_type',
      'exif_data',
      'color_palette',
      'featured',
      'view_count',
      'like_count',
      'allow_download',
      'copyright_info',
      'license',
      'created_at'
    ]
  });

  if (!galleryItem) {
    throw new AppError('Gallery item not found', 404, true, 'GALLERY_NOT_FOUND');
  }

  // Increment view count asynchronously
  setImmediate(async () => {
    try {
      await galleryItem.incrementViewCount();
      // Clear cache for this item after view count update
      await redisUtils.del(cacheKey);
    } catch (error) {
      logger.logError(error, { 
        context: 'increment_view_count', 
        galleryId: galleryItem.id 
      });
    }
  });

  const response = {
    success: true,
    message: 'Gallery item retrieved successfully',
    data: {
      gallery: galleryItem.getPublicData()
    }
  };

  // Cache the result for 15 minutes
  await redisUtils.setex(cacheKey, 900, response);

  res.json(response);
});

/**
 * Get gallery categories with counts
 */
const getGalleryCategories = catchAsync(async (req, res) => {
  const { include_subcategories = false } = req.query;

  // Check cache first
  const cacheKey = `${CACHE_KEYS.GALLERY_CATEGORIES}:${include_subcategories}`;
  const cachedResult = await redisUtils.get(cacheKey);
  
  if (cachedResult) {
    return res.json(cachedResult);
  }

  // Get categories with item counts
  const categories = await Gallery.findAll({
    where: { status: 'active' },
    attributes: [
      'category',
      ...(include_subcategories === 'true' ? ['subcategory'] : []),
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
    ],
    group: include_subcategories === 'true' ? ['category', 'subcategory'] : ['category'],
    order: [['category', 'ASC']],
    raw: true
  });

  // Get featured count per category
  const featuredCounts = await Gallery.findAll({
    where: { status: 'active', featured: true },
    attributes: [
      'category',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'featured_count']
    ],
    group: ['category'],
    raw: true
  });

  // Merge featured counts
  const featuredCountMap = featuredCounts.reduce((acc, item) => {
    acc[item.category] = parseInt(item.featured_count);
    return acc;
  }, {});

  const formattedCategories = categories.map(cat => ({
    category: cat.category,
    ...(include_subcategories === 'true' && cat.subcategory ? { subcategory: cat.subcategory } : {}),
    count: parseInt(cat.count),
    featured_count: featuredCountMap[cat.category] || 0
  }));

  const response = {
    success: true,
    message: 'Gallery categories retrieved successfully',
    data: {
      categories: formattedCategories,
      total_categories: new Set(categories.map(c => c.category)).size
    }
  };

  // Cache the result for 30 minutes
  await redisUtils.setex(cacheKey, 1800, response);

  res.json(response);
});

/**
 * Get related gallery items
 */
const getRelatedGalleryItems = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { limit = 6 } = req.query;

  // Get the current gallery item first
  const currentItem = await Gallery.findOne({
    where: { id, status: 'active' },
    attributes: ['id', 'category', 'subcategory', 'tags']
  });

  if (!currentItem) {
    throw new AppError('Gallery item not found', 404, true, 'GALLERY_NOT_FOUND');
  }

  // Check cache
  const cacheKey = `${CACHE_KEYS.GALLERY_RELATED}:${id}:${limit}`;
  const cachedResult = await redisUtils.get(cacheKey);
  
  if (cachedResult) {
    return res.json(cachedResult);
  }

  // Build query to find related items
  const whereClause = {
    status: 'active',
    id: { [Op.ne]: id } // Exclude current item
  };

  // Priority: same subcategory > same category > similar tags
  const relatedItems = await Gallery.findAll({
    where: {
      ...whereClause,
      [Op.or]: [
        // Same subcategory (highest priority)
        ...(currentItem.subcategory ? [{
          category: currentItem.category,
          subcategory: currentItem.subcategory
        }] : []),
        // Same category
        { category: currentItem.category },
        // Similar tags
        ...(currentItem.tags && currentItem.tags.length > 0 ? [{
          tags: { [Op.overlap]: currentItem.tags }
        }] : [])
      ]
    },
    attributes: [
      'id',
      'title',
      'slug',
      'description',
      'image_url',
      'thumbnail_url',
      'category',
      'tags',
      'alt_text',
      'view_count',
      'like_count',
      'created_at'
    ],
    limit: parseInt(limit),
    order: [
      // Prioritize items with same subcategory
      [Sequelize.literal(`CASE 
        WHEN subcategory = '${currentItem.subcategory}' THEN 1 
        WHEN category = '${currentItem.category}' THEN 2 
        ELSE 3 
      END`), 'ASC'],
      ['view_count', 'DESC'],
      ['created_at', 'DESC']
    ]
  });

  const response = {
    success: true,
    message: 'Related gallery items retrieved successfully',
    data: {
      gallery: relatedItems.map(item => item.getPublicData()),
      count: relatedItems.length,
      related_to: {
        id: currentItem.id,
        category: currentItem.category,
        subcategory: currentItem.subcategory
      }
    }
  };

  // Cache the result for 20 minutes
  await redisUtils.setex(cacheKey, 1200, response);

  res.json(response);
});

/**
 * Search gallery items
 */
const searchGalleryItems = catchAsync(async (req, res) => {
  const {
    q: query,
    page = 1,
    limit = 12,
    category,
    sort_by = 'relevance'
  } = req.query;

  if (!query || query.trim().length < 2) {
    throw new AppError('Search query must be at least 2 characters long', 400, true, 'INVALID_SEARCH_QUERY');
  }

  const offset = (page - 1) * limit;
  const searchTerm = query.trim();

  // Build where clause
  const whereClause = {
    status: 'active',
    [Op.or]: [
      { title: { [Op.iLike]: `%${searchTerm}%` } },
      { description: { [Op.iLike]: `%${searchTerm}%` } },
      { tags: { [Op.contains]: [searchTerm] } },
      { photographer: { [Op.iLike]: `%${searchTerm}%` } },
      { location: { [Op.iLike]: `%${searchTerm}%` } },
      { caption: { [Op.iLike]: `%${searchTerm}%` } }
    ]
  };

  // Category filter
  if (category) {
    whereClause.category = category;
  }

  // Build order clause
  let orderClause = [];
  
  switch (sort_by) {
    case 'date':
      orderClause = [['created_at', 'DESC']];
      break;
    case 'views':
      orderClause = [['view_count', 'DESC']];
      break;
    case 'likes':
      orderClause = [['like_count', 'DESC']];
      break;
    case 'relevance':
    default:
      // Simple relevance scoring based on title match
      orderClause = [
        [Sequelize.literal(`CASE 
          WHEN title ILIKE '%${searchTerm}%' THEN 1 
          WHEN description ILIKE '%${searchTerm}%' THEN 2 
          ELSE 3 
        END`), 'ASC'],
        ['view_count', 'DESC']
      ];
      break;
  }

  // Execute search query
  const { rows: galleryItems, count: totalItems } = await Gallery.findAndCountAll({
    where: whereClause,
    attributes: [
      'id',
      'title',
      'slug',
      'description',
      'image_url',
      'thumbnail_url',
      'category',
      'tags',
      'alt_text',
      'caption',
      'photographer',
      'location',
      'view_count',
      'like_count',
      'created_at'
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: orderClause
  });

  // Calculate pagination info
  const totalPages = Math.ceil(totalItems / limit);

  res.json({
    success: true,
    message: `Found ${totalItems} gallery items matching your search`,
    data: {
      gallery: galleryItems.map(item => item.getPublicData()),
      search: {
        query: searchTerm,
        total_results: totalItems,
        category: category || 'all'
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems,
        itemsPerPage: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  });
});

module.exports = {
  getGalleryItems,
  getFeaturedGalleryItems,
  getGalleryItemById,
  getGalleryCategories,
  getRelatedGalleryItems,
  searchGalleryItems
};