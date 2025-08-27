const Joi = require('joi');

/**
 * Blog Validators
 * 
 * Comprehensive validation schemas for blog operations including:
 * - Blog creation and updates with rich content features
 * - SEO meta fields validation
 * - Social media optimization fields
 * - File upload validation for images
 * - Admin operations (status changes, bulk operations)
 * - Frontend filtering and pagination
 * 
 * All validators follow the project's established patterns and include
 * detailed error messages for better user experience.
 */

// Common validation patterns for blog operations
const titleSchema = Joi.string()
  .trim()
  .min(1)
  .max(500)
  .messages({
    'string.empty': 'Title cannot be empty',
    'string.min': 'Title must be at least 1 character long',
    'string.max': 'Title cannot exceed 500 characters',
  });

const contentSchema = Joi.string()
  .allow(null, '')
  .max(100000) // 100KB limit for content
  .messages({
    'string.max': 'Content cannot exceed 100,000 characters',
  });

const excerptSchema = Joi.string()
  .allow(null, '')
  .max(1000)
  .messages({
    'string.max': 'Excerpt cannot exceed 1,000 characters',
  });

const categorySchema = Joi.string()
  .trim()
  .max(100)
  .allow(null, '')
  .messages({
    'string.max': 'Category cannot exceed 100 characters',
  });

const tagsSchema = Joi.array()
  .items(Joi.string().trim().min(1).max(50))
  .max(20)
  .default([])
  .messages({
    'array.max': 'Cannot have more than 20 tags',
    'string.min': 'Each tag must be at least 1 character long',
    'string.max': 'Each tag cannot exceed 50 characters',
  });

const authorNameSchema = Joi.string()
  .trim()
  .max(255)
  .allow(null, '')
  .messages({
    'string.max': 'Author name cannot exceed 255 characters',
  });

const statusSchema = Joi.string()
  .valid('draft', 'published', 'archived', 'scheduled')
  .messages({
    'any.only': 'Status must be one of: draft, published, archived, scheduled',
  });

const seoTitleSchema = Joi.string()
  .trim()
  .max(255)
  .allow(null, '')
  .messages({
    'string.max': 'SEO title cannot exceed 255 characters',
  });

const seoDescriptionSchema = Joi.string()
  .trim()
  .max(320)
  .allow(null, '')
  .messages({
    'string.max': 'SEO description cannot exceed 320 characters',
  });

const seoKeywordsSchema = Joi.array()
  .items(Joi.string().trim().min(1).max(50))
  .max(20)
  .default([])
  .messages({
    'array.max': 'Cannot have more than 20 SEO keywords',
    'string.min': 'Each keyword must be at least 1 character long',
    'string.max': 'Each keyword cannot exceed 50 characters',
  });

const urlSchema = Joi.string()
  .uri({ scheme: ['http', 'https'] })
  .allow(null, '')
  .messages({
    'string.uri': 'Must be a valid URL',
  });

const ogTitleSchema = Joi.string()
  .trim()
  .max(255)
  .allow(null, '')
  .messages({
    'string.max': 'Open Graph title cannot exceed 255 characters',
  });

const ogDescriptionSchema = Joi.string()
  .trim()
  .max(300)
  .allow(null, '')
  .messages({
    'string.max': 'Open Graph description cannot exceed 300 characters',
  });

const twitterTitleSchema = Joi.string()
  .trim()
  .max(255)
  .allow(null, '')
  .messages({
    'string.max': 'Twitter title cannot exceed 255 characters',
  });

const twitterDescriptionSchema = Joi.string()
  .trim()
  .max(200)
  .allow(null, '')
  .messages({
    'string.max': 'Twitter description cannot exceed 200 characters',
  });

const metadataSchema = Joi.object()
  .default({})
  .messages({
    'object.base': 'Metadata must be a valid object',
  });

// UUID parameter validation
const uuidParamSchema = Joi.object({
  id: Joi.string()
    .uuid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'Invalid blog post ID format',
      'any.required': 'Blog post ID is required',
    }),
});

// Slug parameter validation
const slugParamSchema = Joi.object({
  slug: Joi.string()
    .trim()
    .min(1)
    .max(255)
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .required()
    .messages({
      'string.empty': 'Slug cannot be empty',
      'string.min': 'Slug must be at least 1 character long',
      'string.max': 'Slug cannot exceed 255 characters',
      'string.pattern.base': 'Slug must contain only lowercase letters, numbers, and hyphens',
      'any.required': 'Slug is required',
    }),
});

/**
 * Admin Blog Post Creation Validation
 */
const createBlogValidation = {
  body: Joi.object({
    title: titleSchema.required().messages({
      'any.required': 'Title is required',
    }),
    content: contentSchema,
    custom_excerpt: excerptSchema,
    category: categorySchema,
    tags: tagsSchema,
    author_name: authorNameSchema,
    status: statusSchema.default('draft'),
    is_featured: Joi.boolean().default(false),
    allow_comments: Joi.boolean().default(true),
    published_at: Joi.date()
      .iso()
      .min('now')
      .allow(null)
      .messages({
        'date.format': 'Published date must be in ISO format',
        'date.min': 'Published date cannot be in the past',
      }),
    
    // SEO Fields
    seo_title: seoTitleSchema,
    seo_description: seoDescriptionSchema,
    seo_keywords: seoKeywordsSchema,
    canonical_url: urlSchema,
    
    // Open Graph Fields
    og_title: ogTitleSchema,
    og_description: ogDescriptionSchema,
    og_image: urlSchema,
    
    // Twitter Card Fields
    twitter_title: twitterTitleSchema,
    twitter_description: twitterDescriptionSchema,
    twitter_image: urlSchema,
    
    // Metadata
    metadata: metadataSchema,
  }).options({ stripUnknown: true }),
};

/**
 * Admin Blog Post Update Validation
 */
const updateBlogValidation = {
  params: uuidParamSchema,
  body: Joi.object({
    title: titleSchema,
    content: contentSchema,
    custom_excerpt: excerptSchema,
    category: categorySchema,
    tags: tagsSchema,
    author_name: authorNameSchema,
    status: statusSchema,
    is_featured: Joi.boolean(),
    allow_comments: Joi.boolean(),
    published_at: Joi.date()
      .iso()
      .allow(null)
      .messages({
        'date.format': 'Published date must be in ISO format',
      }),
    
    // SEO Fields
    seo_title: seoTitleSchema,
    seo_description: seoDescriptionSchema,
    seo_keywords: seoKeywordsSchema,
    canonical_url: urlSchema,
    
    // Open Graph Fields
    og_title: ogTitleSchema,
    og_description: ogDescriptionSchema,
    og_image: urlSchema,
    
    // Twitter Card Fields
    twitter_title: twitterTitleSchema,
    twitter_description: twitterDescriptionSchema,
    twitter_image: urlSchema,
    
    // Metadata
    metadata: metadataSchema,
  }).options({ stripUnknown: true }),
};

/**
 * Blog Post ID Parameter Validation
 */
const blogParamsValidation = {
  params: uuidParamSchema,
};

/**
 * Blog Post Slug Parameter Validation
 */
const blogSlugParamsValidation = {
  params: slugParamSchema,
};

/**
 * Admin Blog Posts List Validation
 */
const getAllBlogsAdminValidation = {
  query: Joi.object({
    // Pagination
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    
    // Filtering
    status: statusSchema,
    category: Joi.string().trim().max(100),
    is_featured: Joi.string().valid('true', 'false'),
    author_id: Joi.string().uuid(),
    
    // Search
    search: Joi.string().trim().min(1).max(100).messages({
      'string.min': 'Search query must be at least 1 character long',
      'string.max': 'Search query cannot exceed 100 characters',
    }),
    
    // Sorting
    sort_by: Joi.string()
      .valid('created_at', 'updated_at', 'title', 'status', 'view_count', 'like_count', 'published_at')
      .default('created_at'),
    sort_order: Joi.string().valid('asc', 'desc').default('desc'),
    
    // Date range
    date_from: Joi.date().iso().messages({
      'date.format': 'Date from must be in ISO format',
    }),
    date_to: Joi.date()
      .iso()
      .min(Joi.ref('date_from'))
      .messages({
        'date.format': 'Date to must be in ISO format',
        'date.min': 'Date to must be after date from',
      }),
  }).options({ stripUnknown: true }),
};

/**
 * Toggle Blog Status Validation
 */
const toggleBlogStatusValidation = {
  params: uuidParamSchema,
  body: Joi.object({
    status: statusSchema.required().messages({
      'any.required': 'Status is required',
    }),
  }).options({ stripUnknown: true }),
};

/**
 * Bulk Operations Validation
 */
const bulkOperationsValidation = {
  body: Joi.object({
    operation: Joi.string()
      .valid('delete', 'archive', 'publish', 'feature', 'unfeature', 'update_category')
      .required()
      .messages({
        'any.only': 'Operation must be one of: delete, archive, publish, feature, unfeature, update_category',
        'any.required': 'Operation is required',
      }),
    post_ids: Joi.array()
      .items(Joi.string().uuid())
      .min(1)
      .max(50)
      .required()
      .messages({
        'array.min': 'At least one post ID is required',
        'array.max': 'Cannot process more than 50 posts at once',
        'any.required': 'Post IDs are required',
      }),
    data: Joi.object({
      category: categorySchema,
    }).optional(),
  }).options({ stripUnknown: true }),
};

/**
 * Frontend Blog Posts List Validation
 */
const getBlogPostsValidation = {
  query: Joi.object({
    // Pagination
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
    
    // Filtering
    category: Joi.string().trim().max(100),
    
    // Search
    search: Joi.string().trim().min(1).max(100).messages({
      'string.min': 'Search query must be at least 1 character long',
      'string.max': 'Search query cannot exceed 100 characters',
    }),
    
    // Sorting
    sort_by: Joi.string()
      .valid('title', 'created_at', 'published_at', 'view_count')
      .default('published_at'),
    sort_order: Joi.string().valid('asc', 'desc').default('desc'),
  }).options({ stripUnknown: true }),
};

/**
 * Featured Posts Validation
 */
const getFeaturedPostsValidation = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(20).default(5),
  }).options({ stripUnknown: true }),
};

/**
 * Latest Posts Validation
 */
const getLatestPostsValidation = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(20).default(5),
  }).options({ stripUnknown: true }),
};

/**
 * Related Posts Validation
 */
const getRelatedPostsValidation = {
  params: slugParamSchema,
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(10).default(3),
  }).options({ stripUnknown: true }),
};

module.exports = {
  // Admin validations
  createBlogValidation,
  updateBlogValidation,
  blogParamsValidation,
  getAllBlogsAdminValidation,
  toggleBlogStatusValidation,
  bulkOperationsValidation,
  
  // Frontend validations
  getBlogPostsValidation,
  getFeaturedPostsValidation,
  getLatestPostsValidation,
  getRelatedPostsValidation,
  blogSlugParamsValidation,
  
  // Common schemas (for reuse)
  titleSchema,
  contentSchema,
  excerptSchema,
  categorySchema,
  tagsSchema,
  statusSchema,
  seoTitleSchema,
  seoDescriptionSchema,
  seoKeywordsSchema,
  urlSchema,
  metadataSchema,
  uuidParamSchema,
  slugParamSchema,
};