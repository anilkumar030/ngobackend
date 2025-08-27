const express = require('express');
const campaignUpdateController = require('../controllers/campaignUpdateController');
const { 
  authenticateToken, 
  requireAdmin, 
  optionalAuth 
} = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { uploadMiddleware } = require('../config/cloudinary');
const localFileUploadService = require('../services/localFileUploadService');
const {
  createCampaignUpdateValidation,
  getCampaignUpdatesValidation,
  getCampaignUpdateValidation,
  updateCampaignUpdateValidation,
  deleteCampaignUpdateValidation,
  uploadUpdateImagesValidation
} = require('../validators/campaignUpdateValidators');

const router = express.Router();

// Public routes (with optional auth for draft checking)
// Get all updates for a campaign
router.get('/campaigns/:campaignId/updates', 
  optionalAuth, 
  validate(getCampaignUpdatesValidation), 
  campaignUpdateController.getCampaignUpdates
);

// Get specific update (public access)
router.get('/campaign-updates/:id', 
  optionalAuth, 
  validate(getCampaignUpdateValidation), 
  campaignUpdateController.getCampaignUpdate
);

// Protected routes (require authentication)
// Campaign update management routes
// Create new update for a campaign
router.post('/campaigns/:campaignId/updates', 
  authenticateToken,
  localFileUploadService.createCampaignUpdateMulter().array('images', 10),
  validate(createCampaignUpdateValidation), 
  campaignUpdateController.createCampaignUpdate
);

// Update an existing campaign update
router.put('/campaign-updates/:id', 
  authenticateToken,
  localFileUploadService.createCampaignUpdateMulter().array('images', 10),
  validate(updateCampaignUpdateValidation), 
  campaignUpdateController.updateCampaignUpdate
);

// Delete a campaign update
router.delete('/campaign-updates/:id', 
  authenticateToken,
  validate(deleteCampaignUpdateValidation), 
  campaignUpdateController.deleteCampaignUpdate
);

// Image upload route for campaign updates
router.post('/campaign-updates/:id/images', 
  authenticateToken,
  validate(uploadUpdateImagesValidation),
  localFileUploadService.createCampaignUpdateMulter().array('images', 10), 
  campaignUpdateController.uploadUpdateImages
);

module.exports = router;