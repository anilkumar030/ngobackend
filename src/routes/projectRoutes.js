const express = require('express');
const projectController = require('../controllers/projectController');
const { optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  getProjectsValidation,
  getProjectValidation,
  getProjectUpdatesValidation,
} = require('../validators/projectValidators');

const router = express.Router();

// Public routes (with optional auth for personalization)
router.get('/statistics', projectController.getProjectStatistics);
router.get('/categories', projectController.getProjectCategories);
router.get('/active', optionalAuth, validate(getProjectsValidation), projectController.getActiveProjects);
router.get('/', optionalAuth, validate(getProjectsValidation), projectController.getProjects);
router.get('/:id/updates', optionalAuth, validate(getProjectUpdatesValidation), projectController.getProjectUpdates);
router.get('/:identifier', optionalAuth, validate(getProjectValidation), projectController.getProject);

module.exports = router;