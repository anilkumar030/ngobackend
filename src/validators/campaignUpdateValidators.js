const Joi = require('joi');

// Common validation patterns
const uuidSchema = Joi.string()
  .guid({ version: 'uuidv4' })
  .required()
  .messages({
    'string.guid': 'Must be a valid UUID',
    'any.required': 'ID is required'
  });

const optionalUuidSchema = Joi.string()
  .guid({ version: 'uuidv4' })
  .optional()
  .messages({
    'string.guid': 'Must be a valid UUID'
  });

const imageArraySchema = Joi.array()
  .items(
    Joi.string().uri().messages({
      'string.uri': 'Each image must be a valid URL'
    })
  )
  .max(10)
  .default([])
  .messages({
    'array.max': 'Cannot have more than 10 images'
  });

const paginationSchema = {
  page: Joi.number().integer().positive().default(1).messages({
    'number.positive': 'Page must be a positive number'
  }),
  limit: Joi.number().integer().positive().max(100).default(10).messages({
    'number.positive': 'Limit must be a positive number',
    'number.max': 'Limit cannot exceed 100'
  }),
  sort_by: Joi.string().valid('created_at', 'updated_at', 'title').default('created_at'),
  sort_order: Joi.string().valid('asc', 'desc').default('desc')
};

// Create campaign update validation
const createCampaignUpdateValidation = {
  params: Joi.object({
    campaignId: uuidSchema.messages({
      'any.required': 'Campaign ID is required'
    })
  }),
  body: Joi.object({
    title: Joi.string()
      .trim()
      .min(3)
      .max(500)
      .required()
      .messages({
        'string.min': 'Title must be at least 3 characters long',
        'string.max': 'Title cannot exceed 500 characters',
        'any.required': 'Title is required',
        'string.empty': 'Title cannot be empty'
      }),
    
    description: Joi.string()
      .trim()
      .min(10)
      .max(50000)
      .required()
      .messages({
        'string.min': 'Description must be at least 10 characters long',
        'string.max': 'Description cannot exceed 50,000 characters',
        'any.required': 'Description is required',
        'string.empty': 'Description cannot be empty'
      }),
    
    images: Joi.alternatives()
      .try(
        imageArraySchema,
        Joi.string().custom((value, helpers) => {
          try {
            const parsed = JSON.parse(value);
            if (!Array.isArray(parsed)) {
              return helpers.error('any.invalid');
            }
            return parsed;
          } catch (error) {
            return helpers.error('any.invalid');
          }
        })
      )
      .default([])
      .messages({
        'any.invalid': 'Images must be a valid array of URLs or JSON string'
      })
  })
};

// Get campaign updates validation
const getCampaignUpdatesValidation = {
  params: Joi.object({
    campaignId: uuidSchema.messages({
      'any.required': 'Campaign ID is required'
    })
  }),
  query: Joi.object(paginationSchema)
};

// Get single campaign update validation
const getCampaignUpdateValidation = {
  params: Joi.object({
    id: uuidSchema.messages({
      'any.required': 'Update ID is required'
    })
  })
};

// Update campaign update validation
const updateCampaignUpdateValidation = {
  params: Joi.object({
    id: uuidSchema.messages({
      'any.required': 'Update ID is required'
    })
  }),
  body: Joi.object({
    title: Joi.string()
      .trim()
      .min(3)
      .max(500)
      .optional()
      .messages({
        'string.min': 'Title must be at least 3 characters long',
        'string.max': 'Title cannot exceed 500 characters',
        'string.empty': 'Title cannot be empty'
      }),
    
    description: Joi.string()
      .trim()
      .min(10)
      .max(50000)
      .optional()
      .messages({
        'string.min': 'Description must be at least 10 characters long',
        'string.max': 'Description cannot exceed 50,000 characters',
        'string.empty': 'Description cannot be empty'
      }),
    
    images: Joi.alternatives()
      .try(
        imageArraySchema,
        Joi.string().custom((value, helpers) => {
          try {
            const parsed = JSON.parse(value);
            if (!Array.isArray(parsed)) {
              return helpers.error('any.invalid');
            }
            return parsed;
          } catch (error) {
            return helpers.error('any.invalid');
          }
        })
      )
      .optional()
      .messages({
        'any.invalid': 'Images must be a valid array of URLs or JSON string'
      })
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update'
  })
};

// Delete campaign update validation
const deleteCampaignUpdateValidation = {
  params: Joi.object({
    id: uuidSchema.messages({
      'any.required': 'Update ID is required'
    })
  })
};

// Upload update images validation
const uploadUpdateImagesValidation = {
  params: Joi.object({
    id: uuidSchema.messages({
      'any.required': 'Update ID is required'
    })
  })
};

module.exports = {
  createCampaignUpdateValidation,
  getCampaignUpdatesValidation,
  getCampaignUpdateValidation,
  updateCampaignUpdateValidation,
  deleteCampaignUpdateValidation,
  uploadUpdateImagesValidation
};