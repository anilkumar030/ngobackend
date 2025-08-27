const Joi = require('joi');

/**
 * Validation schema for detailed statistics query parameters
 */
const getDetailedStatisticsValidation = {
  query: Joi.object({
    start_date: Joi.date()
      .iso()
      .max('now')
      .optional()
      .messages({
        'date.base': 'start_date must be a valid date',
        'date.format': 'start_date must be in ISO date format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)',
        'date.max': 'start_date cannot be in the future'
      }),
    end_date: Joi.date()
      .iso()
      .min(Joi.ref('start_date'))
      .max('now')
      .optional()
      .messages({
        'date.base': 'end_date must be a valid date',
        'date.format': 'end_date must be in ISO date format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)',
        'date.min': 'end_date must be after or equal to start_date',
        'date.max': 'end_date cannot be in the future'
      }),
    category: Joi.string()
      .valid('projects', 'campaigns', 'events', 'donations')
      .optional()
      .messages({
        'string.base': 'category must be a string',
        'any.only': 'category must be one of: projects, campaigns, events, donations'
      }),
  }).custom((value, helpers) => {
    // Custom validation for date range logic
    if (value.end_date && !value.start_date) {
      return helpers.error('custom.dateRange', { 
        message: 'start_date is required when end_date is provided' 
      });
    }
    
    if (value.start_date && value.end_date) {
      const startDate = new Date(value.start_date);
      const endDate = new Date(value.end_date);
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      
      // Limit date range to maximum 2 years for performance
      if (daysDiff > 730) {
        return helpers.error('custom.dateRange', { 
          message: 'Date range cannot exceed 2 years (730 days)' 
        });
      }
    }
    
    return value;
  }).messages({
    'custom.dateRange': '{{#message}}'
  })
};

/**
 * Additional validation schemas for potential future endpoints
 */
const createStatisticValidation = {
  body: Joi.object({
    label: Joi.string()
      .trim()
      .min(1)
      .max(255)
      .required()
      .messages({
        'string.empty': 'label is required',
        'string.max': 'label must not exceed 255 characters'
      }),
    key: Joi.string()
      .trim()
      .pattern(/^[a-z0-9_]+$/)
      .min(1)
      .max(100)
      .required()
      .messages({
        'string.empty': 'key is required',
        'string.pattern.base': 'key must contain only lowercase letters, numbers, and underscores',
        'string.max': 'key must not exceed 100 characters'
      }),
    value: Joi.string()
      .trim()
      .max(50)
      .required()
      .messages({
        'string.empty': 'value is required',
        'string.max': 'value must not exceed 50 characters'
      }),
    category: Joi.string()
      .valid('impact', 'reach', 'financial', 'projects', 'events', 'volunteers', 'donations', 'beneficiaries', 'infrastructure', 'environment', 'healthcare', 'education', 'other')
      .default('impact')
      .messages({
        'any.only': 'category must be a valid category type'
      }),
    icon: Joi.string()
      .trim()
      .max(50)
      .optional()
      .allow('')
      .messages({
        'string.max': 'icon must not exceed 50 characters'
      }),
    description: Joi.string()
      .trim()
      .max(500)
      .optional()
      .allow('')
      .messages({
        'string.max': 'description must not exceed 500 characters'
      }),
    display_format: Joi.string()
      .valid('number', 'currency', 'percentage', 'compact', 'suffix', 'text')
      .default('number'),
    value_suffix: Joi.string()
      .trim()
      .max(10)
      .optional()
      .allow('')
      .messages({
        'string.max': 'value_suffix must not exceed 10 characters'
      }),
    display_order: Joi.number()
      .integer()
      .min(0)
      .default(0)
      .messages({
        'number.min': 'display_order must be a non-negative integer'
      }),
    is_active: Joi.boolean().default(true),
    is_featured: Joi.boolean().default(false),
    is_real_time: Joi.boolean().default(false),
    update_frequency: Joi.string()
      .valid('real-time', 'hourly', 'daily', 'weekly', 'monthly', 'manual')
      .default('manual'),
    data_source: Joi.string()
      .trim()
      .max(255)
      .optional()
      .allow('')
      .messages({
        'string.max': 'data_source must not exceed 255 characters'
      }),
    calculation_method: Joi.string()
      .trim()
      .optional()
      .allow(''),
    valid_from: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.format': 'valid_from must be in ISO format'
      }),
    valid_until: Joi.date()
      .iso()
      .min(Joi.ref('valid_from'))
      .optional()
      .messages({
        'date.format': 'valid_until must be in ISO format',
        'date.min': 'valid_until must be after valid_from'
      }),
    target_value: Joi.string()
      .trim()
      .max(50)
      .optional()
      .allow('')
      .messages({
        'string.max': 'target_value must not exceed 50 characters'
      }),
    baseline_value: Joi.string()
      .trim()
      .max(50)
      .optional()
      .allow('')
      .messages({
        'string.max': 'baseline_value must not exceed 50 characters'
      }),
    color_scheme: Joi.string()
      .trim()
      .max(50)
      .optional()
      .allow('')
      .messages({
        'string.max': 'color_scheme must not exceed 50 characters'
      }),
    tags: Joi.array()
      .items(Joi.string().trim().max(50))
      .default([])
      .messages({
        'array.base': 'tags must be an array'
      }),
    metadata: Joi.object().default({})
  })
};

/**
 * Validation for updating statistics
 */
const updateStatisticValidation = {
  params: Joi.object({
    id: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.guid': 'id must be a valid UUID',
        'any.required': 'id is required'
      })
  }),
  body: Joi.object({
    label: Joi.string()
      .trim()
      .min(1)
      .max(255)
      .optional()
      .messages({
        'string.max': 'label must not exceed 255 characters'
      }),
    value: Joi.string()
      .trim()
      .max(50)
      .optional()
      .messages({
        'string.max': 'value must not exceed 50 characters'
      }),
    category: Joi.string()
      .valid('impact', 'reach', 'financial', 'projects', 'events', 'volunteers', 'donations', 'beneficiaries', 'infrastructure', 'environment', 'healthcare', 'education', 'other')
      .optional(),
    icon: Joi.string()
      .trim()
      .max(50)
      .optional()
      .allow(''),
    description: Joi.string()
      .trim()
      .max(500)
      .optional()
      .allow(''),
    display_format: Joi.string()
      .valid('number', 'currency', 'percentage', 'compact', 'suffix', 'text')
      .optional(),
    value_suffix: Joi.string()
      .trim()
      .max(10)
      .optional()
      .allow(''),
    display_order: Joi.number()
      .integer()
      .min(0)
      .optional(),
    is_active: Joi.boolean().optional(),
    is_featured: Joi.boolean().optional(),
    is_real_time: Joi.boolean().optional(),
    update_frequency: Joi.string()
      .valid('real-time', 'hourly', 'daily', 'weekly', 'monthly', 'manual')
      .optional(),
    data_source: Joi.string()
      .trim()
      .max(255)
      .optional()
      .allow(''),
    calculation_method: Joi.string()
      .trim()
      .optional()
      .allow(''),
    valid_from: Joi.date()
      .iso()
      .optional(),
    valid_until: Joi.date()
      .iso()
      .min(Joi.ref('valid_from'))
      .optional(),
    target_value: Joi.string()
      .trim()
      .max(50)
      .optional()
      .allow(''),
    baseline_value: Joi.string()
      .trim()
      .max(50)
      .optional()
      .allow(''),
    color_scheme: Joi.string()
      .trim()
      .max(50)
      .optional()
      .allow(''),
    tags: Joi.array()
      .items(Joi.string().trim().max(50))
      .optional(),
    metadata: Joi.object().optional()
  }).min(1) // At least one field must be provided for update
    .messages({
      'object.min': 'At least one field must be provided for update'
    })
};

module.exports = {
  getDetailedStatisticsValidation,
  createStatisticValidation,
  updateStatisticValidation,
};