const Joi = require('joi');

// Common validation patterns
const positiveNumberSchema = Joi.number().positive();
const optionalPositiveNumberSchema = Joi.number().positive().optional();
const urlSchema = Joi.string().uri().allow('');
const optionalUrlSchema = Joi.string().uri().allow('').optional();
const uuidSchema = Joi.string().uuid();
const keySchema = Joi.string()
  .pattern(/^[a-z0-9_-]+$/)
  .min(1)
  .max(100)
  .messages({
    'string.pattern.base': 'Key must contain only lowercase letters, numbers, underscores, and hyphens',
    'string.min': 'Key must be at least 1 character long',
    'string.max': 'Key cannot exceed 100 characters',
  });

const slugSchema = Joi.string()
  .pattern(/^[a-z0-9-]*$/)
  .max(255)
  .allow('')
  .messages({
    'string.pattern.base': 'Slug must contain only lowercase letters, numbers, and hyphens',
    'string.max': 'Slug cannot exceed 255 characters',
  });

// Section type validation
const sectionTypeSchema = Joi.string().valid(
  'hero',
  'text', 
  'image',
  'gallery',
  'video',
  'testimonial',
  'cta',
  'feature',
  'stats',
  'team',
  'faq',
  'contact',
  'footer',
  'header',
  'sidebar',
  'custom',
  'bdrf-info',
  'call-to-action'
);

// Status validation
const statusSchema = Joi.string().valid('active', 'inactive', 'scheduled', 'archived');
const visibilitySchema = Joi.string().valid('public', 'private', 'members_only');

// Device visibility schema
const deviceVisibilitySchema = Joi.object({
  desktop: Joi.boolean().default(true),
  tablet: Joi.boolean().default(true),
  mobile: Joi.boolean().default(true)
}).default({ desktop: true, tablet: true, mobile: true });

// Image object schema for content
const imageSchema = Joi.object({
  url: urlSchema.required(),
  alt: Joi.string().max(200).allow('').optional(),
  caption: Joi.string().max(500).allow('').optional(),
  width: optionalPositiveNumberSchema,
  height: optionalPositiveNumberSchema,
  size: optionalPositiveNumberSchema,
  thumbnail_url: optionalUrlSchema
});

// Video object schema for content  
const videoSchema = Joi.object({
  url: urlSchema.required(),
  title: Joi.string().max(200).allow('').optional(),
  thumbnail: optionalUrlSchema,
  duration: optionalPositiveNumberSchema,
  provider: Joi.string().valid('youtube', 'vimeo', 'local', 'other').optional()
});

// Link object schema for content
const linkSchema = Joi.object({
  url: urlSchema.required(),
  text: Joi.string().max(200).required(),
  type: Joi.string().valid('internal', 'external', 'download', 'email', 'phone').default('external'),
  target: Joi.string().valid('_self', '_blank', '_parent', '_top').default('_self'),
  rel: Joi.string().max(100).optional()
});

// Button schema
const buttonSchema = Joi.object({
  text: Joi.string().max(100).required(),
  url: urlSchema.required(),
  style: Joi.string().valid('primary', 'secondary', 'outline', 'ghost', 'link').default('primary'),
  target: Joi.string().valid('_self', '_blank', '_parent', '_top').default('_self'),
  icon: Joi.string().max(50).optional()
});

// Pagination schema
const paginationSchema = Joi.object({
  current_page: Joi.number().integer().min(0).default(0),
  total_pages: Joi.number().integer().min(0).default(1),
  per_page: optionalPositiveNumberSchema,
  total_items: optionalPositiveNumberSchema,
  has_next: Joi.boolean().optional(),
  has_prev: Joi.boolean().optional()
});

// Settings schema for various content configurations
const settingsSchema = Joi.object({
  layout: Joi.string().max(50).optional(),
  theme: Joi.string().max(50).optional(),
  background_color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
  text_color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
  padding: Joi.object({
    top: Joi.number().min(0).optional(),
    right: Joi.number().min(0).optional(),
    bottom: Joi.number().min(0).optional(),
    left: Joi.number().min(0).optional()
  }).optional(),
  margin: Joi.object({
    top: Joi.number().min(0).optional(),
    right: Joi.number().min(0).optional(),
    bottom: Joi.number().min(0).optional(),
    left: Joi.number().min(0).optional()
  }).optional(),
  animation: Joi.object({
    type: Joi.string().max(50).optional(),
    duration: optionalPositiveNumberSchema,
    delay: Joi.number().min(0).optional()
  }).optional()
}).unknown(true);

// Localized content schema
const localizedContentSchema = Joi.object().pattern(
  Joi.string().pattern(/^[a-z]{2}(-[A-Z]{2})?$/), // Language codes like 'en', 'en-US'
  Joi.object({
    title: Joi.string().max(500).optional(),
    subtitle: Joi.string().max(1000).optional(),
    content: Joi.string().optional(),
    button_text: Joi.string().max(100).optional()
  })
).default({});

// SEO schema
const seoSchema = Joi.object({
  title: Joi.string().max(255).optional(),
  description: Joi.string().max(500).optional(),
  keywords: Joi.array().items(Joi.string().max(50)).max(20).default([]),
  canonical_url: optionalUrlSchema,
  og_title: Joi.string().max(255).optional(),
  og_description: Joi.string().max(500).optional(),
  og_image: optionalUrlSchema,
  twitter_title: Joi.string().max(255).optional(),
  twitter_description: Joi.string().max(500).optional(),
  twitter_image: optionalUrlSchema
});

// Metadata schema for additional data
const metadataSchema = Joi.object({
  author: Joi.string().max(200).optional(),
  source: Joi.string().max(200).optional(),
  version: Joi.string().max(50).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).default([]),
  category: Joi.string().max(100).optional(),
  priority: Joi.number().integer().min(1).max(10).optional(),
  featured: Joi.boolean().default(false)
}).unknown(true);

// Create content section validation
const createContentSectionValidation = {
  body: Joi.object({
    key: keySchema.required().messages({
      'any.required': 'Key is required',
    }),
    
    slug: slugSchema.optional(),
    
    page: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .required()
      .messages({
        'string.min': 'Page must be at least 1 character long',
        'string.max': 'Page cannot exceed 100 characters',
        'any.required': 'Page is required',
      }),
    
    section_type: sectionTypeSchema.required().messages({
      'any.only': 'Invalid section type specified',
      'any.required': 'Section type is required',
    }),
    
    title: Joi.string()
      .max(500)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Title cannot exceed 500 characters',
      }),
    
    subtitle: Joi.string()
      .max(1000)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Subtitle cannot exceed 1000 characters',
      }),
    
    content: Joi.string()
      .allow('')
      .optional(),
    
    images: Joi.array().items(imageSchema).default([]),
    videos: Joi.array().items(videoSchema).default([]),
    links: Joi.array().items(linkSchema).default([]),
    
    button_text: Joi.string()
      .max(100)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Button text cannot exceed 100 characters',
      }),
    
    button_url: Joi.string()
      .max(500)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Button URL cannot exceed 500 characters',
      }),
    
    button_style: Joi.string()
      .valid('primary', 'secondary', 'outline', 'ghost', 'link')
      .optional(),
    
    settings: settingsSchema.optional(),
    
    css_classes: Joi.string()
      .max(500)
      .allow('')
      .optional()
      .messages({
        'string.max': 'CSS classes cannot exceed 500 characters',
      }),
    
    inline_styles: Joi.string()
      .allow('')
      .optional(),
    
    sort_order: Joi.number().integer().default(0),
    
    status: statusSchema.default('active'),
    visibility: visibilitySchema.default('public'),
    device_visibility: deviceVisibilitySchema,
    
    start_date: Joi.date().optional(),
    end_date: Joi.date().min(Joi.ref('start_date')).optional(),
    scheduled_at: Joi.date().optional(),
    
    localized_content: localizedContentSchema,
    
    seo_title: Joi.string().max(255).allow('').optional(),
    seo_description: Joi.string().allow('').optional(),
    seo_keywords: Joi.array().items(Joi.string().max(50)).max(20).default([]),
    
    metadata: metadataSchema.optional(),
    
  }).options({ stripUnknown: true }),
};

// Update content section validation
const updateContentSectionValidation = {
  params: Joi.object({
    id: uuidSchema.required().messages({
      'string.uuid': 'Invalid content section ID format',
      'any.required': 'Content section ID is required',
    }),
  }),
  
  body: Joi.object({
    key: keySchema.optional(),
    slug: slugSchema.optional(),
    page: Joi.string().trim().min(1).max(100).optional(),
    section_type: sectionTypeSchema.optional(),
    title: Joi.string().max(500).allow('').optional(),
    subtitle: Joi.string().max(1000).allow('').optional(),
    content: Joi.string().allow('').optional(),
    images: Joi.array().items(imageSchema).optional(),
    videos: Joi.array().items(videoSchema).optional(),
    links: Joi.array().items(linkSchema).optional(),
    button_text: Joi.string().max(100).allow('').optional(),
    button_url: Joi.string().max(500).allow('').optional(),
    button_style: Joi.string().valid('primary', 'secondary', 'outline', 'ghost', 'link').optional(),
    settings: settingsSchema.optional(),
    css_classes: Joi.string().max(500).allow('').optional(),
    inline_styles: Joi.string().allow('').optional(),
    sort_order: Joi.number().integer().optional(),
    status: statusSchema.optional(),
    visibility: visibilitySchema.optional(),
    device_visibility: deviceVisibilitySchema.optional(),
    start_date: Joi.date().optional(),
    end_date: Joi.date().optional(),
    scheduled_at: Joi.date().optional(),
    localized_content: localizedContentSchema.optional(),
    seo_title: Joi.string().max(255).allow('').optional(),
    seo_description: Joi.string().allow('').optional(),
    seo_keywords: Joi.array().items(Joi.string().max(50)).max(20).optional(),
    metadata: metadataSchema.optional(),
  }).options({ stripUnknown: true }),
};

// Get content sections validation
const getContentSectionsValidation = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1',
    }),
    
    limit: Joi.number().integer().min(1).max(100).default(10).messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100',
    }),
    
    page_filter: Joi.string().trim().max(100).optional(),
    section_type: sectionTypeSchema.optional(),
    status: statusSchema.optional(),
    visibility: visibilitySchema.optional(),
    
    sort_by: Joi.string()
      .valid('created_at', 'updated_at', 'title', 'sort_order', 'page', 'section_type')
      .default('sort_order')
      .messages({
        'any.only': 'Invalid sort field specified',
      }),
    
    sort_order: Joi.string()
      .valid('asc', 'desc')
      .default('asc')
      .messages({
        'any.only': 'Sort order must be either "asc" or "desc"',
      }),
    
    search: Joi.string().trim().max(100).optional(),
    
    created_by: uuidSchema.optional(),
    updated_by: uuidSchema.optional(),
    
    start_date_from: Joi.date().optional(),
    start_date_to: Joi.date().optional(),
    end_date_from: Joi.date().optional(),
    end_date_to: Joi.date().optional(),
    
    language: Joi.string().pattern(/^[a-z]{2}(-[A-Z]{2})?$/).default('en').optional(),
    
    include_expired: Joi.boolean().default(false),
    include_scheduled: Joi.boolean().default(false),
    
  }).options({ stripUnknown: true }),
};

// Get single content section validation
const getContentSectionValidation = {
  params: Joi.object({
    key: Joi.alternatives()
      .try(
        uuidSchema,
        keySchema,
        slugSchema.min(1)
      )
      .required()
      .messages({
        'alternatives.match': 'Content section identifier must be a valid UUID, key, or slug',
        'any.required': 'Content section identifier is required',
      }),
  }),
  
  query: Joi.object({
    page: Joi.string().trim().max(100).optional(),
    language: Joi.string().pattern(/^[a-z]{2}(-[A-Z]{2})?$/).default('en').optional(),
    include_analytics: Joi.boolean().default(false),
  }).options({ stripUnknown: true }),
};

// Delete content section validation
const deleteContentSectionValidation = {
  params: Joi.object({
    id: uuidSchema.required().messages({
      'string.uuid': 'Invalid content section ID format',
      'any.required': 'Content section ID is required',
    }),
  }),
};

// Bulk operations validation
const bulkUpdateContentSectionsValidation = {
  body: Joi.object({
    ids: Joi.array()
      .items(uuidSchema)
      .min(1)
      .max(50)
      .required()
      .messages({
        'array.min': 'At least one content section ID is required',
        'array.max': 'Cannot update more than 50 content sections at once',
        'any.required': 'Content section IDs are required',
      }),
    
    updates: Joi.object({
      status: statusSchema.optional(),
      visibility: visibilitySchema.optional(),
      sort_order: Joi.number().integer().optional(),
      page: Joi.string().trim().min(1).max(100).optional(),
    }).min(1).required().messages({
      'object.min': 'At least one field to update is required',
      'any.required': 'Updates object is required',
    }),
  }).options({ stripUnknown: true }),
};

// Analytics validation
const getContentAnalyticsValidation = {
  params: Joi.object({
    id: uuidSchema.required(),
  }),
  
  query: Joi.object({
    period: Joi.string()
      .valid('7d', '30d', '3m', '6m', '1y', 'all')
      .default('30d')
      .messages({
        'any.only': 'Invalid period specified',
      }),
    
    metrics: Joi.array()
      .items(
        Joi.string().valid('views', 'clicks', 'conversions', 'engagement')
      )
      .default(['views', 'clicks'])
      .messages({
        'any.only': 'Invalid metric specified',
      }),
  }).options({ stripUnknown: true }),
};

// Page content validation (get all sections for a page)
const getPageContentValidation = {
  params: Joi.object({
    page: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .required()
      .messages({
        'string.min': 'Page must be at least 1 character long',
        'string.max': 'Page cannot exceed 100 characters',
        'any.required': 'Page is required',
      }),
  }),
  
  query: Joi.object({
    language: Joi.string().pattern(/^[a-z]{2}(-[A-Z]{2})?$/).default('en').optional(),
    status: statusSchema.optional(),
    visibility: visibilitySchema.optional(),
    include_scheduled: Joi.boolean().default(false),
    include_expired: Joi.boolean().default(false),
  }).options({ stripUnknown: true }),
};

// Reorder sections validation
const reorderSectionsValidation = {
  body: Joi.object({
    sections: Joi.array()
      .items(
        Joi.object({
          id: uuidSchema.required(),
          sort_order: Joi.number().integer().min(0).required(),
        })
      )
      .min(1)
      .max(100)
      .required()
      .messages({
        'array.min': 'At least one section is required',
        'array.max': 'Cannot reorder more than 100 sections at once',
        'any.required': 'Sections array is required',
      }),
  }).options({ stripUnknown: true }),
};

module.exports = {
  createContentSectionValidation,
  updateContentSectionValidation,
  getContentSectionsValidation,
  getContentSectionValidation,
  deleteContentSectionValidation,
  bulkUpdateContentSectionsValidation,
  getContentAnalyticsValidation,
  getPageContentValidation,
  reorderSectionsValidation,
};