const Joi = require('joi');

const getEventsValidation = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
    status: Joi.string().valid('active', 'draft', 'cancelled', 'completed', 'upcoming', 'ongoing').optional(),
    category: Joi.string().valid('healthcare', 'education', 'workshop', 'awareness', 'fundraising', 'volunteer', 'other').optional(),
    search: Joi.string().max(255).optional(),
    sort_by: Joi.string().valid('title', 'created_at', 'start_date', 'end_date').default('start_date'),
    sort_order: Joi.string().valid('asc', 'desc').default('asc'),
    is_featured: Joi.boolean().optional(),
  }),
};

const getEventValidation = {
  params: Joi.object({
    identifier: Joi.alternatives().try(
      Joi.string().uuid(),
      Joi.string().pattern(/^[a-z0-9-]+$/).min(3).max(255)
    ).required(),
  }),
};

const registerForEventValidation = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    participant_count: Joi.number().integer().min(1).max(10).default(1),
    contact_phone: Joi.string().pattern(/^[+]?[1-9][\d\s-()]+$/).required(),
    special_requirements: Joi.string().max(1000).optional(),
  }),
};

module.exports = {
  getEventsValidation,
  getEventValidation,
  registerForEventValidation,
};