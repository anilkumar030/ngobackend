const Joi = require('joi');

// Common validation patterns
const nameSchema = Joi.string()
  .trim()
  .min(2)
  .max(50)
  .pattern(/^[a-zA-Z\s]+$/)
  .required()
  .messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 50 characters',
    'string.pattern.base': 'Name can only contain letters and spaces',
    'any.required': 'Name is required',
  });

const emailSchema = Joi.string()
  .email()
  .required()
  .messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  });

const phoneSchema = Joi.string()
  .trim()
  .pattern(/^[+]?[1-9]?[0-9]{7,15}$/)
  .optional()
  .messages({
    'string.pattern.base': 'Please provide a valid phone number',
  });

const messageSchema = Joi.string()
  .trim()
  .min(10)
  .max(1000)
  .required()
  .messages({
    'string.min': 'Message must be at least 10 characters long',
    'string.max': 'Message cannot exceed 1000 characters',
    'any.required': 'Message is required',
  });

// Contact form submission validation
const contactFormValidation = {
  body: Joi.object({
    firstName: nameSchema.messages({
      'any.required': 'First name is required',
    }),
    lastName: nameSchema.messages({
      'any.required': 'Last name is required',
    }),
    email: emailSchema,
    phone: phoneSchema,
    message: messageSchema,
  }).options({ 
    allowUnknown: false,
    stripUnknown: true 
  }),
};

module.exports = {
  contactFormValidation,
};