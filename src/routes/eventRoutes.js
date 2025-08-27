const express = require('express');
const eventController = require('../controllers/eventController');
const { 
  authenticateToken, 
  optionalAuth 
} = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  getEventsValidation,
  getEventValidation,
  registerForEventValidation,
} = require('../validators/eventValidators');

const router = express.Router();

// Public routes (with optional auth for personalization)
router.get('/', optionalAuth, validate(getEventsValidation), eventController.getEvents);
router.get('/:identifier', optionalAuth, validate(getEventValidation), eventController.getEvent);

// Protected routes (require authentication)
router.post('/:id/register', authenticateToken, validate(registerForEventValidation), eventController.registerForEvent);

module.exports = router;