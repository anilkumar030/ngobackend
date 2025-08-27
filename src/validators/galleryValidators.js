const Joi = require('joi');

// Common validation schemas
const uuidSchema = Joi.string().uuid().required().messages({
  'string.uuid': 'Please provide a valid ID',
  'any.required': 'ID is required',
});

const titleSchema = Joi.string()
  .trim()
  .min(1)
  .max(500)
  .messages({
    'string.min': 'Title must be at least 1 character long',
    'string.max': 'Title cannot exceed 500 characters',
  });

const descriptionSchema = Joi.string()
  .trim()
  .allow('')
  .max(2000)
  .messages({
    'string.max': 'Description cannot exceed 2000 characters',
  });

const categorySchema = Joi.string()
  .trim()
  .min(1)
  .max(100)
  .required()
  .messages({
    'string.min': 'Category must be at least 1 character long',
    'string.max': 'Category cannot exceed 100 characters',
    'any.required': 'Category is required',
  });

const subcategorySchema = Joi.string()
  .trim()
  .max(100)
  .allow('')
  .messages({
    'string.max': 'Subcategory cannot exceed 100 characters',
  });

const tagsSchema = Joi.array()
  .items(Joi.string().trim().max(50))
  .max(10)
  .default([])
  .messages({
    'array.max': 'Maximum 10 tags are allowed',
    'string.max': 'Each tag cannot exceed 50 characters',
  });

const altTextSchema = Joi.string()
  .trim()
  .max(255)
  .allow('')
  .messages({
    'string.max': 'Alt text cannot exceed 255 characters',
  });

const captionSchema = Joi.string()
  .trim()
  .allow('')
  .max(1000)
  .messages({
    'string.max': 'Caption cannot exceed 1000 characters',
  });

const photographerSchema = Joi.string()
  .trim()
  .max(255)
  .allow('')
  .messages({
    'string.max': 'Photographer name cannot exceed 255 characters',
  });

const locationSchema = Joi.string()
  .trim()
  .max(255)
  .allow('')
  .messages({
    'string.max': 'Location cannot exceed 255 characters',
  });

const statusSchema = Joi.string()
  .valid('active', 'inactive', 'archived')
  .default('active')
  .messages({
    'any.only': 'Status must be either active, inactive, or archived',
  });

const sortOrderSchema = Joi.number()
  .integer()
  .min(0)
  .default(0)
  .messages({
    'number.integer': 'Sort order must be an integer',
    'number.min': 'Sort order cannot be negative',
  });

// Admin gallery validation schemas
const createGalleryValidation = {
  body: Joi.object({
    title: titleSchema,
    description: descriptionSchema,
    category: categorySchema,
    subcategory: subcategorySchema,
    tags: tagsSchema,
    alt_text: altTextSchema,
    caption: captionSchema,
    photographer: photographerSchema,
    location: locationSchema,
    taken_at: Joi.date().iso().allow('').messages({
      'date.format': 'Please provide a valid date in ISO format',
    }),
    status: statusSchema,
    featured: Joi.boolean().default(false),
    sort_order: sortOrderSchema,
    allow_download: Joi.boolean().default(false),
    copyright_info: Joi.string().trim().max(500).allow('').messages({
      'string.max': 'Copyright info cannot exceed 500 characters',
    }),
    license: Joi.string().trim().max(100).allow('').messages({
      'string.max': 'License cannot exceed 100 characters',
    }),
    seo_title: Joi.string().trim().max(255).allow('').messages({
      'string.max': 'SEO title cannot exceed 255 characters',
    }),
    seo_description: descriptionSchema,
    seo_keywords: tagsSchema,
  }).options({ stripUnknown: true })
};

const updateGalleryValidation = {
  params: Joi.object({
    id: uuidSchema
  }),
  body: Joi.object({
    title: titleSchema,
    description: descriptionSchema,
    category: categorySchema,
    subcategory: subcategorySchema,
    tags: tagsSchema,
    alt_text: altTextSchema,
    caption: captionSchema,
    photographer: photographerSchema,
    location: locationSchema,
    taken_at: Joi.date().iso().allow('').messages({
      'date.format': 'Please provide a valid date in ISO format',
    }),
    status: statusSchema,
    featured: Joi.boolean(),
    sort_order: sortOrderSchema,
    allow_download: Joi.boolean(),
    copyright_info: Joi.string().trim().max(500).allow('').messages({
      'string.max': 'Copyright info cannot exceed 500 characters',
    }),
    license: Joi.string().trim().max(100).allow('').messages({
      'string.max': 'License cannot exceed 100 characters',
    }),
    seo_title: Joi.string().trim().max(255).allow('').messages({
      'string.max': 'SEO title cannot exceed 255 characters',
    }),
    seo_description: descriptionSchema,
    seo_keywords: tagsSchema,
  }).min(1).options({ stripUnknown: true }).messages({
    'object.min': 'At least one field is required for update',
  })
};

const getGalleryByIdValidation = {
  params: Joi.object({
    id: uuidSchema
  })
};

const deleteGalleryValidation = {
  params: Joi.object({
    id: uuidSchema
  })
};

// Admin gallery list validation
const adminGalleryListValidation = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1',
    }),
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100',
    }),
    status: Joi.string().valid('active', 'inactive', 'archived', 'all').default('all'),
    category: Joi.string().trim().max(100).allow(''),
    subcategory: Joi.string().trim().max(100).allow(''),
    featured: Joi.boolean(),
    search: Joi.string().trim().max(255).allow('').messages({
      'string.max': 'Search term cannot exceed 255 characters',
    }),
    sort_by: Joi.string()
      .valid('created_at', 'updated_at', 'title', 'view_count', 'like_count', 'sort_order')
      .default('created_at'),
    sort_order: Joi.string().valid('asc', 'desc').default('desc'),
    uploaded_by: Joi.string().uuid().messages({
      'string.uuid': 'Uploaded by must be a valid user ID',
    }),
  }).options({ stripUnknown: true })
};

// Frontend gallery list validation
const frontendGalleryListValidation = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1',
    }),
    limit: Joi.number().integer().min(1).max(50).default(12).messages({
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 50',
    }),
    category: Joi.string().trim().max(100).allow(''),
    subcategory: Joi.string().trim().max(100).allow(''),
    featured: Joi.boolean(),
    tags: Joi.string().trim().max(255).allow('').messages({
      'string.max': 'Tags filter cannot exceed 255 characters',
    }),
    sort_by: Joi.string()
      .valid('created_at', 'view_count', 'like_count', 'sort_order')
      .default('sort_order'),
    sort_order: Joi.string().valid('asc', 'desc').default('asc'),
  }).options({ stripUnknown: true })
};

// Frontend gallery detail validation
const frontendGalleryDetailValidation = {
  params: Joi.object({
    id: Joi.alternatives()
      .try(
        Joi.string().uuid(),
        Joi.string().pattern(/^[a-z0-9-]+$/).max(255)
      )
      .required()
      .messages({
        'alternatives.match': 'ID must be a valid UUID or slug',
        'any.required': 'ID is required',
      })
  })
};

// Bulk operations validation
const bulkUpdateValidation = {
  body: Joi.object({
    ids: Joi.array()
      .items(uuidSchema.messages({ 'any.required': 'Each ID must be a valid UUID' }))
      .min(1)
      .max(50)
      .required()
      .messages({
        'array.min': 'At least one ID is required',
        'array.max': 'Maximum 50 IDs are allowed',
        'any.required': 'IDs array is required',
      }),
    updates: Joi.object({
      status: statusSchema,
      category: categorySchema,
      subcategory: subcategorySchema,
      featured: Joi.boolean(),
      allow_download: Joi.boolean(),
    }).min(1).messages({
      'object.min': 'At least one update field is required',
    })
  })
};

const bulkDeleteValidation = {
  body: Joi.object({
    ids: Joi.array()
      .items(uuidSchema.messages({ 'any.required': 'Each ID must be a valid UUID' }))
      .min(1)
      .max(50)
      .required()
      .messages({
        'array.min': 'At least one ID is required',
        'array.max': 'Maximum 50 IDs are allowed',
        'any.required': 'IDs array is required',
      }),
    permanent: Joi.boolean().default(false)
  })
};

// Gallery statistics validation
const galleryStatsValidation = {
  query: Joi.object({
    period: Joi.string()
      .valid('7d', '30d', '3m', '6m', '1y', 'all')
      .default('30d'),
    category: Joi.string().trim().max(100).allow(''),
    group_by: Joi.string()
      .valid('category', 'status', 'month', 'week', 'day')
      .default('status'),
  }).options({ stripUnknown: true })
};

module.exports = {
  createGalleryValidation,
  updateGalleryValidation,
  getGalleryByIdValidation,
  deleteGalleryValidation,
  adminGalleryListValidation,
  frontendGalleryListValidation,
  frontendGalleryDetailValidation,
  bulkUpdateValidation,
  bulkDeleteValidation,
  galleryStatsValidation
};