const Joi = require('joi');

const getUserCertificatesValidation = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
    year: Joi.number().integer().min(2020).max(new Date().getFullYear()).optional(),
    type: Joi.string().valid('80g', 'annual_summary', 'project_specific', 'consolidated').optional(),
  }),
};

const generateCertificateValidation = {
  body: Joi.object({
    year: Joi.number().integer().min(2020).max(new Date().getFullYear()).required()
      .messages({
        'number.base': 'Year must be a number',
        'number.integer': 'Year must be an integer',
        'number.min': 'Year cannot be earlier than 2020',
        'number.max': 'Year cannot be in the future',
        'any.required': 'Year is required'
      }),
    type: Joi.string().valid('80g', 'annual_summary', 'project_specific', 'consolidated').default('80g')
      .messages({
        'any.only': 'Certificate type must be one of: 80g, annual_summary, project_specific, consolidated'
      }),
  }),
};

const getCertificateByIdValidation = {
  params: Joi.object({
    id: Joi.string().uuid().required()
      .messages({
        'string.guid': 'Certificate ID must be a valid UUID',
        'any.required': 'Certificate ID is required'
      }),
  }),
};

const downloadCertificateValidation = {
  params: Joi.object({
    id: Joi.string().uuid().required()
      .messages({
        'string.guid': 'Certificate ID must be a valid UUID',
        'any.required': 'Certificate ID is required'
      }),
  }),
};

module.exports = {
  getUserCertificatesValidation,
  generateCertificateValidation,
  getCertificateByIdValidation,
  downloadCertificateValidation,
};