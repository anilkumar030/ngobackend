const Joi = require('joi');

const getSavedCampaignsValidation = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
    priority: Joi.string().valid('low', 'medium', 'high').optional(),
    sort_by: Joi.string().valid('created_at', 'priority').default('created_at'),
    sort_order: Joi.string().valid('asc', 'desc').default('desc'),
  }),
};

const saveCampaignValidation = {
  body: Joi.object({
    campaign_id: Joi.alternatives().try(
      Joi.string().uuid(),
      Joi.number().integer().positive()
    ).required(),
    notes: Joi.string().max(1000).optional(),
    priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
  }),
};

const removeSavedCampaignValidation = {
  params: Joi.object({
    campaign_id: Joi.alternatives().try(
      Joi.string().uuid(),
      Joi.number().integer().positive()
    ).required(),
  }),
};

const updateSavedCampaignValidation = {
  params: Joi.object({
    campaign_id: Joi.alternatives().try(
      Joi.string().uuid(),
      Joi.number().integer().positive()
    ).required(),
  }),
  body: Joi.object({
    notes: Joi.string().max(1000).optional(),
    priority: Joi.string().valid('low', 'medium', 'high').optional(),
    is_notification_enabled: Joi.boolean().optional(),
  }).min(1), // At least one field must be provided
};

const toggleNotificationsValidation = {
  params: Joi.object({
    campaign_id: Joi.alternatives().try(
      Joi.string().uuid(),
      Joi.number().integer().positive()
    ).required(),
  }),
};

module.exports = {
  getSavedCampaignsValidation,
  saveCampaignValidation,
  removeSavedCampaignValidation,
  updateSavedCampaignValidation,
  toggleNotificationsValidation,
};