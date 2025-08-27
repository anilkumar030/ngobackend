const Joi = require('joi');

const getProjectsValidation = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
    status: Joi.string().valid('upcoming', 'active', 'completed', 'on-hold', 'cancelled').optional(),
    category: Joi.string().valid(
      'Water Projects',
      'Housing',
      'Emergency Relief',
      'Healthcare',
      'Education',
      'Environment',
      'Infrastructure',
      'Community Development',
      'Disaster Relief',
      'Other'
    ).optional(),
    search: Joi.string().max(255).optional(),
    sort_by: Joi.string().valid(
      'title', 
      'created_at', 
      'start_date', 
      'estimated_completion',
      'progress_percentage',
      'total_budget',
      'amount_spent',
      'beneficiaries'
    ).default('created_at'),
    sort_order: Joi.string().valid('asc', 'desc').default('desc'),
    is_featured: Joi.boolean().optional(),
  }),
};

const getProjectValidation = {
  params: Joi.object({
    identifier: Joi.alternatives().try(
      Joi.string().uuid(),
      Joi.string().pattern(/^[a-z0-9-]+$/).min(3).max(255)
    ).required(),
  }),
};

const getProjectUpdatesValidation = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
    update_type: Joi.string().valid('progress', 'milestone', 'announcement', 'photos', 'budget', 'challenge', 'completion', 'other').optional(),
    sort_by: Joi.string().valid('published_at', 'created_at', 'title').default('published_at'),
    sort_order: Joi.string().valid('asc', 'desc').default('desc'),
  }),
};

const createProjectValidation = {
  body: Joi.object({
    title: Joi.string().min(3).max(500).required(),
    description: Joi.string().max(1000).optional(),
    long_description: Joi.string().optional(),
    category: Joi.string().valid(
      'Water Projects',
      'Housing', 
      'Emergency Relief',
      'Healthcare',
      'Education',
      'Environment',
      'Infrastructure',
      'Community Development',
      'Disaster Relief',
      'Other'
    ).required(),
    status: Joi.string().valid('upcoming', 'active', 'completed', 'on-hold', 'cancelled').default('active'),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
    location: Joi.string().min(1).max(500).required(),
    geographic_scope: Joi.string().valid('local', 'district', 'state', 'national', 'international').default('local'),
    start_date: Joi.date().iso().required(),
    estimated_completion_date: Joi.date().iso().greater(Joi.ref('start_date')).optional(),
    total_budget: Joi.number().min(0).max(1000000000).required(),
    funding_sources: Joi.array().items(Joi.object()).optional(),
    beneficiaries_count: Joi.number().integer().min(0).optional(),
    progress_percentage: Joi.number().min(0).max(100).default(0),
    implementation_strategy: Joi.object().optional(),
    impact_metrics: Joi.object().optional(),
    stakeholders: Joi.array().items(Joi.object()).optional(),
    risks_and_mitigation: Joi.array().items(Joi.object()).optional(),
    sustainability_plan: Joi.string().optional(),
    is_featured: Joi.boolean().default(false),
    is_public: Joi.boolean().default(true),
    tags: Joi.array().items(Joi.string()).max(20).optional(),
    managed_by: Joi.string().uuid().optional(),
  }),
};

const updateProjectValidation = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    title: Joi.string().min(3).max(500).optional(),
    description: Joi.string().max(1000).optional(),
    long_description: Joi.string().optional(),
    category: Joi.string().valid(
      'Water Projects',
      'Housing',
      'Emergency Relief', 
      'Healthcare',
      'Education',
      'Environment',
      'Infrastructure',
      'Community Development',
      'Disaster Relief',
      'Other'
    ).optional(),
    status: Joi.string().valid('upcoming', 'active', 'completed', 'on-hold', 'cancelled').optional(),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
    location: Joi.string().min(1).max(500).optional(),
    geographic_scope: Joi.string().valid('local', 'district', 'state', 'national', 'international').optional(),
    start_date: Joi.date().iso().optional(),
    estimated_completion_date: Joi.date().iso().optional(),
    actual_completion_date: Joi.date().iso().optional(),
    total_budget: Joi.number().min(0).max(1000000000).optional(),
    amount_spent: Joi.number().min(0).optional(),
    funding_sources: Joi.array().items(Joi.object()).optional(),
    beneficiaries_count: Joi.number().integer().min(0).optional(),
    progress_percentage: Joi.number().min(0).max(100).optional(),
    implementation_strategy: Joi.object().optional(),
    impact_metrics: Joi.object().optional(),
    stakeholders: Joi.array().items(Joi.object()).optional(),
    risks_and_mitigation: Joi.array().items(Joi.object()).optional(),
    sustainability_plan: Joi.string().optional(),
    is_featured: Joi.boolean().optional(),
    is_public: Joi.boolean().optional(),
    tags: Joi.array().items(Joi.string()).max(20).optional(),
    managed_by: Joi.string().uuid().optional(),
  }),
};

const updateProjectStatusValidation = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    status: Joi.string().valid('upcoming', 'active', 'completed', 'on-hold', 'cancelled').required(),
    actual_completion_date: Joi.date().iso().optional(),
    completion_notes: Joi.string().max(1000).optional(),
  }),
};

const updateProjectProgressValidation = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    progress_percentage: Joi.number().min(0).max(100).required(),
    progress_notes: Joi.string().max(1000).optional(),
    milestone_reached: Joi.string().max(255).optional(),
  }),
};

const deleteProjectValidation = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  query: Joi.object({
    permanent: Joi.boolean().default(false),
  }),
};

module.exports = {
  getProjectsValidation,
  getProjectValidation,
  getProjectUpdatesValidation,
  createProjectValidation,
  updateProjectValidation,
  updateProjectStatusValidation,
  updateProjectProgressValidation,
  deleteProjectValidation,
};