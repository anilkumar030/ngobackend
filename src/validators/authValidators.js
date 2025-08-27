const Joi = require('joi');

// Common validation patterns
const emailSchema = Joi.string().email().required().messages({
  'string.email': 'Please provide a valid email address',
  'any.required': 'Email is required',
});

const phoneSchema = Joi.string()
  .pattern(/^[+]?[1-9]?[0-9]{7,15}$/)
  .messages({
    'string.pattern.base': 'Please provide a valid phone number',
  });

const passwordSchema = Joi.string()
  .min(8)
  .max(100)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@#$!%*?&]/)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password cannot exceed 100 characters',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    'any.required': 'Password is required',
  });

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

// Registration validation
const registerValidation = {
  body: Joi.object({
    first_name: nameSchema.messages({
      'any.required': 'First name is required',
    }),
    last_name: nameSchema.messages({
      'any.required': 'Last name is required',
    }),
    email: emailSchema,
    phone: phoneSchema.optional(),
    password: Joi.string()
       .required()
       .messages({
         'any.only': 'Password required',
         'any.required': 'Password is required',
       }),
    // confirm_password: Joi.string()
    //   .valid(Joi.ref('password'))
    //   .required()
    //   .messages({
    //     'any.only': 'Password confirmation does not match password',
    //     'any.required': 'Password confirmation is required',
    //   }),
    // terms_accepted: Joi.boolean()
    //   .valid(true)
    //   .required()
    //   .messages({
    //     'any.only': 'You must accept the terms and conditions',
    //     'any.required': 'Terms acceptance is required',
    //   }),
    newsletter_subscribed: Joi.boolean().optional().default(false),
  }).options({ stripUnknown: true }),
};

// Login validation
const loginValidation = {
  body: Joi.object({
    email: emailSchema,
    password: Joi.string().required().messages({
      'any.required': 'Password is required',
    }),
    remember_me: Joi.boolean().optional().default(false),
  }).options({ stripUnknown: true }),
};

// Forgot password validation
const forgotPasswordValidation = {
  body: Joi.object({
    email: emailSchema,
  }).options({ stripUnknown: true }),
};

// Reset password validation
const resetPasswordValidation = {
  body: Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'Reset token is required',
    }),
    password: passwordSchema,
    confirm_password: Joi.string()
      .valid(Joi.ref('password'))
      .required()
      .messages({
        'any.only': 'Password confirmation does not match password',
        'any.required': 'Password confirmation is required',
      }),
  }).options({ stripUnknown: true }),
};

// Change password validation
const changePasswordValidation = {
  body: Joi.object({
    current_password: Joi.string().required().messages({
      'any.required': 'Current password is required',
    }),
    new_password: passwordSchema.messages({
      'any.required': 'New password is required',
    }),
    confirm_new_password: Joi.string()
      .valid(Joi.ref('new_password'))
      .required()
      .messages({
        'any.only': 'New password confirmation does not match new password',
        'any.required': 'New password confirmation is required',
      }),
  }).options({ stripUnknown: true }),
};

// Refresh token validation
const refreshTokenValidation = {
  body: Joi.object({
    refresh_token: Joi.string().optional(),
    refreshToken: Joi.string().optional(),
  })
    .or('refresh_token', 'refreshToken')
    .messages({
      'object.missing': 'Refresh token is required',
    })
    .options({ stripUnknown: true }),
};

// Email verification validation
const verifyEmailValidation = {
  body: Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'Verification token is required',
    }),
  }).options({ stripUnknown: true }),
};

// Resend verification email validation
const resendVerificationValidation = {
  body: Joi.object({
    email: emailSchema,
  }).options({ stripUnknown: true }),
};

// OTP verification validation
const verifyOTPValidation = {
  body: Joi.object({
    phone: phoneSchema.required().messages({
      'any.required': 'Phone number is required',
    }),
    otp: Joi.string()
      .length(6)
      .pattern(/^\d+$/)
      .required()
      .messages({
        'string.length': 'OTP must be exactly 6 digits',
        'string.pattern.base': 'OTP must contain only digits',
        'any.required': 'OTP is required',
      }),
  }).options({ stripUnknown: true }),
};

// Send OTP validation
const sendOTPValidation = {
  body: Joi.object({
    phone: phoneSchema.required().messages({
      'any.required': 'Phone number is required',
    }),
  }).options({ stripUnknown: true }),
};

// Update profile validation
const updateProfileValidation = {
  body: Joi.object({
    first_name: nameSchema.optional(),
    last_name: nameSchema.optional(),
    phone: phoneSchema.optional(),
    date_of_birth: Joi.date().max('now').optional().messages({
      'date.max': 'Date of birth cannot be in the future',
    }),
    gender: Joi.string()
      .valid('male', 'female', 'other', 'prefer_not_to_say')
      .optional(),
    bio: Joi.string().max(500).optional().messages({
      'string.max': 'Bio cannot exceed 500 characters',
    }),
    newsletter_subscribed: Joi.boolean().optional(),
  }).options({ stripUnknown: true }),
};

// Social login validation
const socialLoginValidation = {
  body: Joi.object({
    provider: Joi.string()
      .valid('google', 'facebook', 'twitter')
      .required()
      .messages({
        'any.only': 'Invalid social provider',
        'any.required': 'Social provider is required',
      }),
    access_token: Joi.string().required().messages({
      'any.required': 'Access token is required',
    }),
    email: emailSchema.optional(),
    first_name: nameSchema.optional(),
    last_name: nameSchema.optional(),
  }).options({ stripUnknown: true }),
};

// Admin create user validation
const adminCreateUserValidation = {
  body: Joi.object({
    first_name: nameSchema,
    last_name: nameSchema,
    email: emailSchema,
    phone: phoneSchema.optional(),
    password: passwordSchema,
    role: Joi.string()
      .valid('user', 'admin', 'super_admin')
      .required()
      .messages({
        'any.only': 'Invalid role specified',
        'any.required': 'Role is required',
      }),
    is_active: Joi.boolean().optional().default(true),
    is_email_verified: Joi.boolean().optional().default(false),
    is_phone_verified: Joi.boolean().optional().default(false),
  }).options({ stripUnknown: true }),
};

// Admin update user validation
const adminUpdateUserValidation = {
  params: Joi.object({
    id: Joi.number().integer().positive().required().messages({
      'number.base': 'User ID must be a number',
      'number.integer': 'User ID must be an integer',
      'number.positive': 'User ID must be positive',
      'any.required': 'User ID is required',
    }),
  }),
  body: Joi.object({
    first_name: nameSchema.optional(),
    last_name: nameSchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    role: Joi.string()
      .valid('user', 'admin', 'super_admin')
      .optional(),
    is_active: Joi.boolean().optional(),
    is_email_verified: Joi.boolean().optional(),
    is_phone_verified: Joi.boolean().optional(),
  }).options({ stripUnknown: true }),
};

module.exports = {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  refreshTokenValidation,
  verifyEmailValidation,
  resendVerificationValidation,
  verifyOTPValidation,
  sendOTPValidation,
  updateProfileValidation,
  socialLoginValidation,
  adminCreateUserValidation,
  adminUpdateUserValidation,
};