const express = require('express');
const { Product, Order, OrderItem } = require('../models');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const getProductsValidation = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(12),
    category: Joi.string().max(50).optional(),
    search: Joi.string().min(1).max(100).optional(),
    min_price: Joi.number().min(0).optional(),
    max_price: Joi.number().min(0).optional(),
    sort_by: Joi.string().valid('name', 'price', 'created_at').default('created_at'),
    sort_order: Joi.string().valid('asc', 'desc').default('desc'),
    is_featured: Joi.boolean().optional(),
    is_available: Joi.boolean().optional(),
  }),
};

/**
 * Get all products with filters
 */
const getProducts = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    category,
    search,
    min_price,
    max_price,
    sort_by = 'created_at',
    sort_order = 'desc',
    is_featured,
    is_available = true,
  } = req.query;

  const offset = (page - 1) * limit;

  // Build where conditions
  const whereConditions = {
    is_available: is_available,
  };

  if (category) {
    whereConditions.category = category;
  }

  if (search) {
    whereConditions[require('sequelize').Op.or] = [
      { name: { [require('sequelize').Op.iLike]: `%${search}%` } },
      { description: { [require('sequelize').Op.iLike]: `%${search}%` } },
    ];
  }

  if (min_price || max_price) {
    whereConditions.price = {};
    if (min_price) whereConditions.price[require('sequelize').Op.gte] = parseFloat(min_price);
    if (max_price) whereConditions.price[require('sequelize').Op.lte] = parseFloat(max_price);
  }

  if (is_featured !== undefined) {
    whereConditions.is_featured = is_featured === 'true';
  }

  const { count, rows: products } = await Product.findAndCountAll({
    where: whereConditions,
    order: [[sort_by, sort_order.toUpperCase()]],
    limit: parseInt(limit),
    offset: offset,
    attributes: {
      exclude: ['created_by', 'updated_at'],
    },
  });

  const totalPages = Math.ceil(count / limit);

  res.status(200).json({
    success: true,
    data: {
      products,
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
 * Get single product by ID
 */
const getProduct = catchAsync(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findOne({
    where: { 
      id: parseInt(id),
      is_available: true,
    },
    attributes: {
      exclude: ['created_by', 'updated_at'],
    },
  });

  if (!product) {
    throw new AppError('Product not found', 404, true, 'PRODUCT_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    data: {
      product,
    },
  });
});

/**
 * Get product categories
 */
const getCategories = catchAsync(async (req, res) => {
  const categories = await Product.findAll({
    attributes: [
      'category',
      [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'product_count'],
    ],
    where: {
      is_available: true,
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
        count: parseInt(cat.product_count),
      })),
    },
  });
});

/**
 * Get featured products
 */
const getFeaturedProducts = catchAsync(async (req, res) => {
  const { limit = 8 } = req.query;

  const products = await Product.findAll({
    where: {
      is_featured: true,
      is_available: true,
    },
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    attributes: {
      exclude: ['created_by', 'updated_at'],
    },
  });

  res.status(200).json({
    success: true,
    data: {
      products,
    },
  });
});

// Public routes
router.get('/', optionalAuth, validate(getProductsValidation), getProducts);
router.get('/categories', getCategories);
router.get('/featured', getFeaturedProducts);
router.get('/:id', optionalAuth, getProduct);

module.exports = router;