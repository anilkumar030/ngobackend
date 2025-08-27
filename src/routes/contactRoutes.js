const express = require('express');
const contactController = require('../controllers/contactController');
const { validate } = require('../middleware/validation');
const { contactFormValidation } = require('../validators/contactValidators');

const router = express.Router();

/**
 * @route   POST /api/contact
 * @desc    Submit contact form
 * @access  Public
 * @body    { firstName, lastName, email, phone?, message }
 */
router.post('/', validate(contactFormValidation), contactController.submitContactForm);

module.exports = router;