const Joi = require('joi');

// Common validation patterns
const positiveNumberSchema = Joi.number().positive().required();
const optionalPositiveNumberSchema = Joi.number().positive().optional();
const slugSchema = Joi.string()
  .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .min(3)
  .max(100);

// Create campaign validation - supports both JSON and FormData
const createCampaignValidation = {
  body: Joi.object({
    title: Joi.string()
      .trim()
      .min(5)
      .max(500)
      .required()
      .messages({
        'string.min': 'Title must be at least 5 characters long',
        'string.max': 'Title cannot exceed 500 characters',
        'any.required': 'Title is required',
      }),
    
    slug: slugSchema
      .required()
      .messages({
        'string.pattern.base': 'Slug must contain only lowercase letters, numbers, and hyphens',
        'string.min': 'Slug must be at least 3 characters long',
        'string.max': 'Slug cannot exceed 100 characters',
        'any.required': 'Slug is required',
      }),
    
    description: Joi.string()
      .trim()
      .min(50)
      .max(5000)
      .required()
      .messages({
        'string.min': 'Description must be at least 50 characters long',
        'string.max': 'Description cannot exceed 5000 characters',
        'any.required': 'Description is required',
      }),
    
    short_description: Joi.string()
      .trim()
      .min(20)
      .max(500)
      .required()
      .messages({
        'string.min': 'Short description must be at least 20 characters long',
        'string.max': 'Short description cannot exceed 500 characters',
        'any.required': 'Short description is required',
      }),
    
    target_amount: positiveNumberSchema.messages({
      'number.positive': 'Goal amount must be a positive number',
      'any.required': 'Goal amount is required',
    }),
    
    min_donation: optionalPositiveNumberSchema.default(10).messages({
      'number.positive': 'Minimum donation must be a positive number',
    }),
    
    category: Joi.string()
      .valid(
        'education',
        'healthcare',
        'infrastructure',
        'temple_construction',
        'disaster_relief',
        'environment',
        'social_welfare',
        'religious',
        'animal_welfare',
        'community',
        'other'
      )
      .required()
      .messages({
        'any.only': 'Invalid category specified',
        'any.required': 'Category is required',
      }),
    
    start_date: Joi.date()
      .min('now')
      .required()
      .messages({
        'date.min': 'Start date cannot be in the past',
        'any.required': 'Start date is required',
      }),
    
    end_date: Joi.date()
      .min(Joi.ref('start_date'))
      .required()
      .messages({
        'date.min': 'End date must be after start date',
        'any.required': 'End date is required',
      }),
    
    // For FormData, featured_image will be a URL string, for JSON it's optional
    featured_image: Joi.string().uri().optional(),
    
    // For FormData, gallery_images will be an array of URLs, for JSON it's optional
    gallery_images: Joi.array()
      .items(Joi.string().uri())
      .max(10)
      .optional()
      .messages({
        'array.max': 'Cannot upload more than 10 gallery images',
      }),
    
    // Tags can be array or JSON string (for FormData)
    tags: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().trim().max(50)).max(10),
        Joi.string().custom((value, helpers) => {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.length <= 10) {
              return parsed;
            }
            return helpers.error('array.max');
          } catch (error) {
            return helpers.error('string.invalid');
          }
        })
      )
      .optional()
      .messages({
        'array.max': 'Cannot add more than 10 tags',
        'string.max': 'Each tag cannot exceed 50 characters',
        'string.invalid': 'Tags must be valid JSON array',
      }),
    
    // location: Joi.object({
    //   city: Joi.string().trim().max(100).optional(),
    //   state: Joi.string().trim().max(100).optional(),
    //   country: Joi.string().trim().max(100).optional(),
    //   coordinates: Joi.object({
    //     latitude: Joi.number().min(-90).max(90).optional(),
    //     longitude: Joi.number().min(-180).max(180).optional(),
    //   }).optional(),
    // }).optional(),
    
    is_featured: Joi.boolean().optional().default(false),
    is_urgent: Joi.boolean().optional().default(false),
    
    visibility: Joi.string()
      .valid('public', 'private', 'unlisted')
      .optional()
      .default('public'),
    
    // beneficiary_info: Joi.object({
    //   name: Joi.string().trim().max(200).optional(),
    //   contact: Joi.string().trim().max(100).optional(),
    //   story: Joi.string().trim().max(2000).optional(),
    // }).optional(),
    
    // Contact information
    contact_phone: Joi.string()
      .trim()
      .pattern(/^[+]?[0-9\-() ]+$/)
      .min(10)
      .max(20)
      .optional()
      .messages({
        'string.pattern.base': 'Contact phone must be a valid phone number',
        'string.min': 'Contact phone must be at least 10 characters long',
        'string.max': 'Contact phone cannot exceed 20 characters',
      }),
    
    contact_email: Joi.string()
      .email()
      .trim()
      .max(255)
      .optional()
      .messages({
        'string.email': 'Contact email must be a valid email address',
        'string.max': 'Contact email cannot exceed 255 characters',
      }),
    
    // Beneficiary details
    // beneficiary_details: Joi.string()
    //   .trim()
    //   .max(2000)
    //   .optional()
    //   .messages({
    //     'string.max': 'Beneficiary details cannot exceed 2000 characters',
    //   }),
    
    // SEO fields
    // seo_title: Joi.string()
    //   .trim()
    //   .max(60)
    //   .optional()
    //   .messages({
    //     'string.max': 'SEO title cannot exceed 60 characters',
    //   }),
    
    // seo_description: Joi.string()
    //   .trim()
    //   .max(160)
    //   .optional()
    //   .messages({
    //     'string.max': 'SEO description cannot exceed 160 characters',
    //   }),
    
    // meta_keywords: Joi.array()
    //   .items(Joi.string().trim().max(50))
    //   .max(20)
    //   .optional()
    //   .messages({
    //     'array.max': 'Cannot add more than 20 meta keywords',
    //     'string.max': 'Each meta keyword cannot exceed 50 characters',
    //   }),
    
    // Additional content
    long_description: Joi.string()
      .trim()
      .max(10000)
      .optional()
      .messages({
        'string.max': 'Long description cannot exceed 10000 characters',
      }),
    
    location: Joi.string()
      .trim()
      .max(255)
      .optional()
      .messages({
        'string.max': 'Location cannot exceed 255 characters',
      }),
    
    images: Joi.array()
      .items(Joi.string().uri())
      .max(20)
      .optional()
      .messages({
        'array.max': 'Cannot add more than 20 images',
      }),
    
    // Metadata can be object or JSON string (for FormData)
    metadata: Joi.alternatives()
      .try(
        Joi.object(),
        Joi.string().custom((value, helpers) => {
          try {
            return JSON.parse(value);
          } catch (error) {
            return helpers.error('string.invalid');
          }
        })
      )
      .optional()
      .messages({
        'string.invalid': 'Metadata must be valid JSON object',
      }),
    
    status: Joi.string()
      .valid('draft', 'active', 'paused', 'completed', 'cancelled')
      .optional()
      .default('draft'),
    
    // How you can help options - array of objects with title and amount
    howyoucanhelp: Joi.alternatives()
      .try(
        Joi.array().items(
          Joi.object({
            title: Joi.string().trim().min(1).max(255).required().messages({
              'string.min': 'Help option title must be at least 1 character',
              'string.max': 'Help option title cannot exceed 255 characters',
              'any.required': 'Help option title is required'
            }),
            amount: Joi.number().positive().required().messages({
              'number.positive': 'Help option amount must be a positive number',
              'any.required': 'Help option amount is required'
            })
          })
        ).max(10),
        Joi.string().custom((value, helpers) => {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.length <= 10) {
              // Validate each item in the parsed array
              for (const item of parsed) {
                if (!item.title || !item.amount || typeof item.title !== 'string' || typeof item.amount !== 'number') {
                  return helpers.error('array.invalid');
                }
                if (item.amount <= 0) {
                  return helpers.error('number.positive');
                }
              }
              return parsed;
            }
            return helpers.error('array.max');
          } catch (error) {
            return helpers.error('string.invalid');
          }
        })
      )
      .optional()
      .messages({
        'array.max': 'Cannot add more than 10 help options',
        'array.invalid': 'Each help option must have title (string) and amount (positive number)',
        'number.positive': 'Help option amount must be positive',
        'string.invalid': 'howyoucanhelp must be valid JSON array'
      }),
    
  }).options({ stripUnknown: true }),
};

// Update campaign validation
const updateCampaignValidation = {
  params: Joi.object({
    id: Joi.alternatives()
      .try(
        Joi.number().integer().positive(),
        Joi.string().uuid()
      )
      .required()
      .messages({
        'alternatives.match': 'Campaign ID must be a valid numeric ID or UUID',
        'any.required': 'Campaign ID is required',
      }),
  }),
  
  body: Joi.object({
    title: Joi.string()
      .trim()
      .min(10)
      .max(200)
      .optional(),
    
    description: Joi.string()
      .trim()
      .min(50)
      .max(5000)
      .optional(),
    
    short_description: Joi.string()
      .trim()
      .min(20)
      .max(500)
      .optional(),
    
    target_amount: optionalPositiveNumberSchema,
    min_donation: optionalPositiveNumberSchema,
    
    category: Joi.string()
      .valid(
        'education',
        'healthcare',
        'infrastructure',
        'temple_construction',
        'disaster_relief',
        'environment',
        'social_welfare',
        'religious',
        'animal_welfare',
        'community',
        'other'
      )
      .optional(),
    
    start_date: Joi.date().min('now').optional(),
    end_date: Joi.date().optional(),
    
    featured_image: Joi.string().uri().optional(),
    gallery_images: Joi.array().items(Joi.string().uri()).max(10).optional(),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(10).optional(),
    
    // location: Joi.object({
    //   city: Joi.string().trim().max(100).optional(),
    //   state: Joi.string().trim().max(100).optional(),
    //   country: Joi.string().trim().max(100).optional(),
    //   coordinates: Joi.object({
    //     latitude: Joi.number().min(-90).max(90).optional(),
    //     longitude: Joi.number().min(-180).max(180).optional(),
    //   }).optional(),
    // }).optional(),
    
    is_featured: Joi.boolean().optional(),
    is_urgent: Joi.boolean().optional(),
    visibility: Joi.string().valid('public', 'private', 'unlisted').optional(),
    
    beneficiary_info: Joi.object({
      name: Joi.string().trim().max(200).optional(),
      contact: Joi.string().trim().max(100).optional(),
      story: Joi.string().trim().max(2000).optional(),
    }).optional(),
    
    // Contact information
    contact_phone: Joi.string()
      .trim()
      .pattern(/^[+]?[0-9\-() ]+$/)
      .min(10)
      .max(20)
      .optional()
      .messages({
        'string.pattern.base': 'Contact phone must be a valid phone number',
        'string.min': 'Contact phone must be at least 10 characters long',
        'string.max': 'Contact phone cannot exceed 20 characters',
      }),
    
    contact_email: Joi.string()
      .email()
      .trim()
      .max(255)
      .optional()
      .messages({
        'string.email': 'Contact email must be a valid email address',
        'string.max': 'Contact email cannot exceed 255 characters',
      }),
    
    // Beneficiary details
    beneficiary_details: Joi.string()
      .trim()
      .max(2000)
      .optional()
      .messages({
        'string.max': 'Beneficiary details cannot exceed 2000 characters',
      }),
    
    // SEO fields
    seo_title: Joi.string()
      .trim()
      .max(60)
      .optional()
      .messages({
        'string.max': 'SEO title cannot exceed 60 characters',
      }),
    
    seo_description: Joi.string()
      .trim()
      .max(160)
      .optional()
      .messages({
        'string.max': 'SEO description cannot exceed 160 characters',
      }),
    
    meta_keywords: Joi.array()
      .items(Joi.string().trim().max(50))
      .max(20)
      .optional()
      .messages({
        'array.max': 'Cannot add more than 20 meta keywords',
        'string.max': 'Each meta keyword cannot exceed 50 characters',
      }),
    
    // Additional content
    long_description: Joi.string()
      .trim()
      .max(10000)
      .optional()
      .messages({
        'string.max': 'Long description cannot exceed 10000 characters',
      }),
    
    location: Joi.string()
      .trim()
      .max(255)
      .optional()
      .messages({
        'string.max': 'Location cannot exceed 255 characters',
      }),
    
    images: Joi.array()
      .items(Joi.string().uri())
      .max(20)
      .optional()
      .messages({
        'array.max': 'Cannot add more than 20 images',
      }),
    
    metadata: Joi.object().optional(),
    
    status: Joi.string()
      .valid('draft', 'active', 'paused', 'completed', 'cancelled')
      .optional(),
    
    // How you can help options - array of objects with title and amount
    howyoucanhelp: Joi.alternatives()
      .try(
        Joi.array().items(
          Joi.object({
            title: Joi.string().trim().min(1).max(255).required().messages({
              'string.min': 'Help option title must be at least 1 character',
              'string.max': 'Help option title cannot exceed 255 characters',
              'any.required': 'Help option title is required'
            }),
            amount: Joi.number().positive().required().messages({
              'number.positive': 'Help option amount must be a positive number',
              'any.required': 'Help option amount is required'
            })
          })
        ).max(10),
        Joi.string().custom((value, helpers) => {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.length <= 10) {
              // Validate each item in the parsed array
              for (const item of parsed) {
                if (!item.title || !item.amount || typeof item.title !== 'string' || typeof item.amount !== 'number') {
                  return helpers.error('array.invalid');
                }
                if (item.amount <= 0) {
                  return helpers.error('number.positive');
                }
              }
              return parsed;
            }
            return helpers.error('array.max');
          } catch (error) {
            return helpers.error('string.invalid');
          }
        })
      )
      .optional()
      .messages({
        'array.max': 'Cannot add more than 10 help options',
        'array.invalid': 'Each help option must have title (string) and amount (positive number)',
        'number.positive': 'Help option amount must be positive',
        'string.invalid': 'howyoucanhelp must be valid JSON array'
      }),
    
  }).options({ stripUnknown: true }),
};

// Get campaigns validation (query parameters)
const getCampaignsValidation = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(100).optional().default(10),
    
    category: Joi.string()
      .valid(
        'education',
        'healthcare',
        'infrastructure',
        'temple_construction',
        'disaster_relief',
        'environment',
        'social_welfare',
        'religious',
        'animal_welfare',
        'community',
        'other'
      )
      .optional(),
    
    status: Joi.string()
      .valid('draft', 'active', 'paused', 'completed', 'cancelled')
      .optional(),
    
    visibility: Joi.string()
      .valid('public', 'private', 'unlisted')
      .optional(),
    
    is_featured: Joi.boolean().optional(),
    is_urgent: Joi.boolean().optional(),
    
    sort_by: Joi.string()
      .valid('created_at', 'target_amount', 'raised_amount', 'end_date', 'title')
      .optional()
      .default('created_at'),
    
    sort_order: Joi.string()
      .valid('asc', 'desc')
      .optional()
      .default('desc'),
    
    search: Joi.string().trim().max(100).optional(),
    
    min_goal: optionalPositiveNumberSchema,
    max_goal: optionalPositiveNumberSchema,
    
    city: Joi.string().trim().max(100).optional(),
    state: Joi.string().trim().max(100).optional(),
    country: Joi.string().trim().max(100).optional(),
    
    created_by: Joi.number().integer().positive().optional(),
    
    start_date_from: Joi.date().optional(),
    start_date_to: Joi.date().optional(),
    end_date_from: Joi.date().optional(),
    end_date_to: Joi.date().optional(),
    
  }).options({ stripUnknown: true }),
};

// Get single campaign validation
const getCampaignValidation = {
  params: Joi.object({
    identifier: Joi.alternatives()
      .try(
        Joi.number().integer().positive(),
        slugSchema
      )
      .required()
      .messages({
        'alternatives.match': 'Campaign identifier must be a valid ID or slug',
        'any.required': 'Campaign identifier is required',
      }),
  }),
};

// Delete campaign validation
const deleteCampaignValidation = {
  params: Joi.object({
    id: Joi.alternatives()
      .try(
        Joi.number().integer().positive(),
        Joi.string().uuid()
      )
      .required()
      .messages({
        'alternatives.match': 'Campaign ID must be a valid numeric ID or UUID',
        'any.required': 'Campaign ID is required',
      }),
  }),
};

// Campaign status update validation
const updateCampaignStatusValidation = {
  params: Joi.object({
    id: Joi.alternatives()
      .try(
        Joi.number().integer().positive(),
        Joi.string().uuid()
      )
      .required()
      .messages({
        'alternatives.match': 'Campaign ID must be a valid numeric ID or UUID',
        'any.required': 'Campaign ID is required',
      }),
  }),
  
  body: Joi.object({
    status: Joi.string()
      .valid('draft', 'active', 'paused', 'completed', 'cancelled')
      .required()
      .messages({
        'any.only': 'Invalid status specified',
        'any.required': 'Status is required',
      }),
    
    reason: Joi.string()
      .trim()
      .max(500)
      .when('status', {
        is: Joi.string().valid('paused', 'cancelled'),
        then: Joi.required(),
        otherwise: Joi.optional(),
      })
      .messages({
        'any.required': 'Reason is required when pausing or cancelling a campaign',
        'string.max': 'Reason cannot exceed 500 characters',
      }),
  }).options({ stripUnknown: true }),
};

// Campaign analytics validation
const getCampaignAnalyticsValidation = {
  params: Joi.object({
    id: Joi.alternatives()
      .try(
        Joi.number().integer().positive(),
        Joi.string().uuid()
      )
      .required()
      .messages({
        'alternatives.match': 'Campaign ID must be a valid numeric ID or UUID',
        'any.required': 'Campaign ID is required',
      }),
  }),
  
  query: Joi.object({
    period: Joi.string()
      .valid('7d', '30d', '3m', '6m', '1y', 'all')
      .optional()
      .default('30d'),
    
    metrics: Joi.array()
      .items(
        Joi.string().valid(
          'donations',
          'amount',
          'donors',
          'views',
          'shares',
          'conversion'
        )
      )
      .optional()
      .default(['donations', 'amount', 'donors']),
  }).options({ stripUnknown: true }),
};

// Campaign donors validation
const getCampaignDonorsValidation = {
  params: Joi.object({
    id: Joi.alternatives()
      .try(
        Joi.number().integer().positive(),
        Joi.string().uuid(),
        slugSchema
      )
      .required()
      .messages({
        'alternatives.match': 'Campaign identifier must be a valid numeric ID, UUID, or slug',
        'any.required': 'Campaign identifier is required',
      }),
  }),
  
  query: Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .optional()
      .default(1)
      .messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1',
      }),
    
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100',
      }),
    
    show_anonymous: Joi.boolean()
      .optional()
      .default(false)
      .messages({
        'boolean.base': 'Show anonymous must be a boolean value',
      }),
  }).options({ stripUnknown: true }),
};

module.exports = {
  createCampaignValidation,
  updateCampaignValidation,
  getCampaignsValidation,
  getCampaignValidation,
  deleteCampaignValidation,
  updateCampaignStatusValidation,
  getCampaignAnalyticsValidation,
  getCampaignDonorsValidation,
};