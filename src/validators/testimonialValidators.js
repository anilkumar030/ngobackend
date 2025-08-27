const Joi = require('joi');

const getTestimonialsValidation = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
    category: Joi.string().valid('beneficiary', 'volunteer', 'donor', 'partner', 'staff', 'other').optional(),
    is_featured: Joi.boolean().optional(),
    project_id: Joi.string().uuid().optional(),
    campaign_id: Joi.string().uuid().optional(),
    sort_by: Joi.string().valid('approved_at', 'created_at', 'rating').default('approved_at'),
    sort_order: Joi.string().valid('asc', 'desc').default('desc'),
  }),
};

const submitTestimonialValidation = {
  body: Joi.object({
    content: Joi.string().min(10).max(5000).required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    project_id: Joi.string().uuid().optional(),
    campaign_id: Joi.string().uuid().optional(),
    category: Joi.string().valid('beneficiary', 'volunteer', 'donor', 'partner', 'staff', 'other').default('beneficiary'),
  }).or('project_id', 'campaign_id'), // At least one of project_id or campaign_id must be provided
};

const updateTestimonialValidation = {
  body: Joi.object({
    content: Joi.string().min(10).max(5000).optional(),
    rating: Joi.number().integer().min(1).max(5).optional(),
  }).min(1), // At least one field must be provided for update
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

const approveTestimonialValidation = {
  body: Joi.object({
    is_featured: Joi.boolean().default(false),
  }),
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

const rejectTestimonialValidation = {
  body: Joi.object({
    reason: Joi.string().min(5).max(500).optional(),
  }),
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

const getUserTestimonialsValidation = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
    status: Joi.string().valid('pending', 'approved', 'rejected', 'archived').optional(),
    category: Joi.string().valid('beneficiary', 'volunteer', 'donor', 'partner', 'staff', 'other').optional(),
    project_id: Joi.string().uuid().optional(),
    campaign_id: Joi.string().uuid().optional(),
  }),
};

const getAdminTestimonialsValidation = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().valid('pending', 'approved', 'rejected', 'archived').optional(),
    category: Joi.string().valid('beneficiary', 'volunteer', 'donor', 'partner', 'staff', 'other').optional(),
    is_featured: Joi.boolean().optional(),
    project_id: Joi.string().uuid().optional(),
    campaign_id: Joi.string().uuid().optional(),
    sort_by: Joi.string().valid('created_at', 'approved_at', 'rating', 'status').default('created_at'),
    sort_order: Joi.string().valid('asc', 'desc').default('desc'),
  }),
};

const testimonialIdValidation = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

module.exports = {
  getTestimonialsValidation,
  submitTestimonialValidation,
  updateTestimonialValidation,
  approveTestimonialValidation,
  rejectTestimonialValidation,
  getUserTestimonialsValidation,
  getAdminTestimonialsValidation,
  testimonialIdValidation,
};