const emailService = require('../services/emailService');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const config = require('../config/environment');

// Get project name from environment variable with fallback
const PROJECT_NAME = process.env.PROJECT_NAME || 'Shiv Dhaam Foundation';

/**
 * Handle contact form submission
 */
const submitContactForm = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, message } = req.body;

    // Log the contact form submission
    logger.info('Contact form submitted', {
      action: 'contact_form_submitted',
      email,
      firstName,
      lastName,
      phone: phone || 'Not provided',
      timestamp: new Date().toISOString(),
    });

    // Send contact form email to admin
    const adminEmail = 'team@bdrf.in'; // Send to the configured admin email
    const contactEmailResult = await emailService.sendContactFormNotification(adminEmail, {
      firstName,
      lastName,
      email,
      phone,
      message,
    });

    if (!contactEmailResult.success) {
      logger.logError(new Error('Failed to send contact form email'), {
        service: 'ContactController',
        method: 'submitContactForm',
        email,
        error: contactEmailResult.error,
      });
      
      throw new AppError('Failed to send contact form. Please try again later.', 500);
    }

    // Send confirmation email to the user
    const confirmationEmailResult = await emailService.sendContactFormConfirmation(email, {
      firstName,
      lastName,
    });

    if (!confirmationEmailResult.success) {
      // Log the error but don't fail the request since the main contact email was sent
      logger.logError(new Error('Failed to send contact confirmation email'), {
        service: 'ContactController',
        method: 'submitContactForm',
        email,
        error: confirmationEmailResult.error,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.',
      data: {
        submitted_at: new Date().toISOString(),
        confirmation_email_sent: confirmationEmailResult.success,
      },
    });

  } catch (error) {
    logger.logError(error, {
      service: 'ContactController',
      method: 'submitContactForm',
      body: req.body,
    });
    next(error);
  }
};

module.exports = {
  submitContactForm,
};