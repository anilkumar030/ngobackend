const { Gallery, User } = require('../models');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const fileUploadService = require('../services/fileUploadService');
const { deleteUploadedFile } = require('../middleware/galleryUpload');
const logger = require('../utils/logger');
const { redisUtils, CACHE_KEYS } = require('../config/redis');
const { Op, Sequelize } = require('sequelize');

/**
 * Create new gallery item with image upload
 */
const createGalleryItem = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const galleryData = req.body;

  // Check if image was uploaded
  if (!req.file) {
    throw new AppError('Image file is required', 400, true, 'IMAGE_REQUIRED');
  }

  try {
    // Prepare gallery item data with local uploaded file
    const galleryItem = await Gallery.create({
      ...galleryData,
      image_url: req.uploadedImageUrl, // Set by processUploadedFile middleware
      original_filename: req.file.originalname,
      file_size: req.file.size,
      file_type: req.file.mimetype.split('/')[1],
      dimensions: {
        width: 0, // Will be updated if image analysis is implemented
        height: 0
      },
      uploaded_by: userId,
    });

    // Clear gallery cache
    await redisUtils.deletePattern(`${CACHE_KEYS.GALLERY_LIST}:*`);

    logger.info(`Gallery item created: ${galleryItem.id}`, {
      userId,
      galleryId: galleryItem.id,
      title: galleryItem.title,
      category: galleryItem.category
    });

    res.status(201).json({
      success: true,
      message: 'Gallery item created successfully',
      data: {
        gallery: galleryItem.getPublicData()
      }
    });

  } catch (error) {
    // Clean up uploaded file if gallery creation fails
    if (req.file && req.file.filename) {
      deleteUploadedFile(req.file.filename);
    }
    throw error;
  }
});

/**
 * Get all gallery items for admin (with filters and pagination)
 */
const getAllGalleryItems = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status = 'all',
    category,
    subcategory,
    featured,
    search,
    sort_by = 'created_at',
    sort_order = 'desc',
    uploaded_by
  } = req.query;

  const offset = (page - 1) * limit;

  // Build where clause
  const whereClause = {};

  // Status filter
  if (status !== 'all') {
    whereClause.status = status;
  }

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

  // Uploaded by filter
  if (uploaded_by) {
    whereClause.uploaded_by = uploaded_by;
  }

  // Search filter
  if (search) {
    whereClause[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { tags: { [Op.contains]: [search] } },
      { photographer: { [Op.iLike]: `%${search}%` } },
      { location: { [Op.iLike]: `%${search}%` } }
    ];
  }

  // Build order clause
  const orderClause = [[sort_by, sort_order.toUpperCase()]];
  
  // Secondary sort for consistent ordering
  if (sort_by !== 'created_at') {
    orderClause.push(['created_at', 'DESC']);
  }

  // Execute query
  const { rows: galleryItems, count: totalItems } = await Gallery.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'uploader',
        attributes: ['id', 'first_name', 'last_name', 'email'],
        required: false
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: orderClause,
    distinct: true
  });

  // Calculate pagination info
  const totalPages = Math.ceil(totalItems / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  // Get category statistics
  const categoryStats = await Gallery.findAll({
    where: status !== 'all' ? { status } : {},
    attributes: [
      'category',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
    ],
    group: ['category'],
    raw: true
  });

  res.json({
    success: true,
    message: 'Gallery items retrieved successfully',
    data: {
      gallery: galleryItems.map(item => ({
        ...item.toJSON(),
        uploader: item.uploader ? {
          id: item.uploader.id,
          name: `${item.uploader.first_name} ${item.uploader.last_name}`,
          email: item.uploader.email
        } : null
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems,
        itemsPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage
      },
      filters: {
        status,
        category,
        subcategory,
        featured,
        search,
        sort_by,
        sort_order,
        uploaded_by
      },
      statistics: {
        categories: categoryStats
      }
    }
  });
});

/**
 * Get gallery item by ID
 */
const getGalleryItemById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const galleryItem = await Gallery.findOne({
    where: { id },
    include: [
      {
        model: User,
        as: 'uploader',
        attributes: ['id', 'first_name', 'last_name', 'email'],
        required: false
      }
    ]
  });

  if (!galleryItem) {
    throw new AppError('Gallery item not found', 404, true, 'GALLERY_NOT_FOUND');
  }

  res.json({
    success: true,
    message: 'Gallery item retrieved successfully',
    data: {
      gallery: {
        ...galleryItem.toJSON(),
        uploader: galleryItem.uploader ? {
          id: galleryItem.uploader.id,
          name: `${galleryItem.uploader.first_name} ${galleryItem.uploader.last_name}`,
          email: galleryItem.uploader.email
        } : null
      }
    }
  });
});

/**
 * Update gallery item
 */
const updateGalleryItem = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const galleryItem = await Gallery.findByPk(id);

  if (!galleryItem) {
    throw new AppError('Gallery item not found', 404, true, 'GALLERY_NOT_FOUND');
  }

  try {
    // If new image is uploaded, handle image replacement
    if (req.file) {
      // Delete old image if it exists and is from our system
      if (galleryItem.image_url && galleryItem.image_url.includes('/uploads/gallery/')) {
        const oldFilename = galleryItem.image_url.split('/').pop();
        deleteUploadedFile(oldFilename);
      }

      // Update image-related fields with new local file
      updateData.image_url = req.uploadedImageUrl; // Set by processUploadedFile middleware
      updateData.original_filename = req.file.originalname;
      updateData.file_size = req.file.size;
      updateData.file_type = req.file.mimetype.split('/')[1];
      updateData.dimensions = {
        width: 0, // Will be updated if image analysis is implemented
        height: 0
      };
    }

    // Update gallery item
    await galleryItem.update(updateData);

    // Clear gallery cache
    await redisUtils.deletePattern(`${CACHE_KEYS.GALLERY_LIST}:*`);

    logger.info(`Gallery item updated: ${galleryItem.id}`, {
      userId: req.user.id,
      galleryId: galleryItem.id,
      updatedFields: Object.keys(updateData)
    });

    res.json({
      success: true,
      message: 'Gallery item updated successfully',
      data: {
        gallery: galleryItem.getPublicData()
      }
    });

  } catch (error) {
    // Clean up uploaded file if update fails
    if (req.file && req.file.filename) {
      deleteUploadedFile(req.file.filename);
    }
    throw error;
  }
});

/**
 * Delete gallery item
 */
const deleteGalleryItem = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { permanent = false } = req.query;

  const galleryItem = await Gallery.findByPk(id);

  if (!galleryItem) {
    throw new AppError('Gallery item not found', 404, true, 'GALLERY_NOT_FOUND');
  }

  if (permanent === 'true' || permanent === true) {
    // Permanent delete - remove file and database record
    if (galleryItem.image_url && galleryItem.image_url.includes('/uploads/gallery/')) {
      const filename = galleryItem.image_url.split('/').pop();
      deleteUploadedFile(filename);
    }

    await galleryItem.destroy();

    logger.info(`Gallery item permanently deleted: ${id}`, {
      userId: req.user.id,
      galleryId: id,
      title: galleryItem.title
    });

    res.json({
      success: true,
      message: 'Gallery item permanently deleted successfully'
    });
  } else {
    // Soft delete - change status to archived
    await galleryItem.update({ status: 'archived' });

    logger.info(`Gallery item soft deleted: ${id}`, {
      userId: req.user.id,
      galleryId: id,
      title: galleryItem.title
    });

    res.json({
      success: true,
      message: 'Gallery item archived successfully'
    });
  }

  // Clear gallery cache
  await redisUtils.deletePattern(`${CACHE_KEYS.GALLERY_LIST}:*`);
});

/**
 * Bulk update gallery items
 */
const bulkUpdateGalleryItems = catchAsync(async (req, res) => {
  const { ids, updates } = req.body;

  // Validate that all items exist
  const galleryItems = await Gallery.findAll({
    where: { id: { [Op.in]: ids } }
  });

  if (galleryItems.length !== ids.length) {
    throw new AppError('Some gallery items not found', 404, true, 'SOME_GALLERIES_NOT_FOUND');
  }

  // Perform bulk update
  const [affectedCount] = await Gallery.update(updates, {
    where: { id: { [Op.in]: ids } }
  });

  // Clear gallery cache
  await redisUtils.deletePattern(`${CACHE_KEYS.GALLERY_LIST}:*`);

  logger.info(`Bulk updated ${affectedCount} gallery items`, {
    userId: req.user.id,
    galleryIds: ids,
    updates
  });

  res.json({
    success: true,
    message: `${affectedCount} gallery items updated successfully`,
    data: {
      updated_count: affectedCount,
      updates
    }
  });
});

/**
 * Bulk delete gallery items
 */
const bulkDeleteGalleryItems = catchAsync(async (req, res) => {
  const { ids, permanent = false } = req.body;

  // Validate that all items exist
  const galleryItems = await Gallery.findAll({
    where: { id: { [Op.in]: ids } }
  });

  if (galleryItems.length !== ids.length) {
    throw new AppError('Some gallery items not found', 404, true, 'SOME_GALLERIES_NOT_FOUND');
  }

  let affectedCount = 0;

  if (permanent) {
    // Permanent delete - remove files and database records
    for (const item of galleryItems) {
      if (item.image_url && item.image_url.includes('/uploads/gallery/')) {
        const filename = item.image_url.split('/').pop();
        deleteUploadedFile(filename);
      }
    }

    affectedCount = await Gallery.destroy({
      where: { id: { [Op.in]: ids } }
    });
  } else {
    // Soft delete - change status to archived
    [affectedCount] = await Gallery.update(
      { status: 'archived' },
      { where: { id: { [Op.in]: ids } } }
    );
  }

  // Clear gallery cache
  await redisUtils.deletePattern(`${CACHE_KEYS.GALLERY_LIST}:*`);

  logger.info(`Bulk ${permanent ? 'deleted' : 'archived'} ${affectedCount} gallery items`, {
    userId: req.user.id,
    galleryIds: ids,
    permanent
  });

  res.json({
    success: true,
    message: `${affectedCount} gallery items ${permanent ? 'permanently deleted' : 'archived'} successfully`,
    data: {
      affected_count: affectedCount,
      permanent
    }
  });
});

/**
 * Get gallery statistics
 */
const getGalleryStatistics = catchAsync(async (req, res) => {
  const { period = '30d', category, group_by = 'status' } = req.query;

  // Calculate date range
  let startDate;
  const endDate = new Date();

  switch (period) {
    case '7d':
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '3m':
      startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '6m':
      startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = null;
  }

  // Build base where clause
  const whereClause = {};
  if (startDate && period !== 'all') {
    whereClause.created_at = { [Op.gte]: startDate };
  }
  if (category) {
    whereClause.category = category;
  }

  // Get overall statistics
  const totalItems = await Gallery.count({ where: whereClause });
  const activeItems = await Gallery.count({ 
    where: { ...whereClause, status: 'active' } 
  });
  const featuredItems = await Gallery.count({ 
    where: { ...whereClause, status: 'active', featured: true } 
  });
  const totalViews = await Gallery.sum('view_count', { where: whereClause }) || 0;
  const totalLikes = await Gallery.sum('like_count', { where: whereClause }) || 0;

  // Get grouped statistics
  let groupedStats = [];
  
  switch (group_by) {
    case 'status':
      groupedStats = await Gallery.findAll({
        where: whereClause,
        attributes: [
          'status',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });
      break;
      
    case 'category':
      groupedStats = await Gallery.findAll({
        where: whereClause,
        attributes: [
          'category',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
          [Sequelize.fn('SUM', Sequelize.col('view_count')), 'total_views'],
          [Sequelize.fn('SUM', Sequelize.col('like_count')), 'total_likes']
        ],
        group: ['category'],
        raw: true
      });
      break;
      
    default:
      // Time-based grouping would require more complex queries
      break;
  }

  res.json({
    success: true,
    message: 'Gallery statistics retrieved successfully',
    data: {
      overview: {
        total_items: totalItems,
        active_items: activeItems,
        featured_items: featuredItems,
        total_views: parseInt(totalViews),
        total_likes: parseInt(totalLikes),
        period,
        category: category || 'all'
      },
      grouped_statistics: groupedStats,
      group_by
    }
  });
});

module.exports = {
  createGalleryItem,
  getAllGalleryItems,
  getGalleryItemById,
  updateGalleryItem,
  deleteGalleryItem,
  bulkUpdateGalleryItems,
  bulkDeleteGalleryItems,
  getGalleryStatistics
};