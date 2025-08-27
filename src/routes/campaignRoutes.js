const express = require('express');
const campaignController = require('../controllers/campaignController');
const { 
  authenticateToken, 
  requireAdmin, 
  optionalAuth 
} = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { uploadMiddleware } = require('../config/cloudinary');
const { 
  campaignUploadFields, 
  handleMixedData, 
  processUploadedFiles, 
  handleUploadError 
} = require('../middleware/localUpload');
const {
  createCampaignValidation,
  updateCampaignValidation,
  getCampaignsValidation,
  getCampaignValidation,
  deleteCampaignValidation,
  updateCampaignStatusValidation,
  getCampaignAnalyticsValidation,
  getCampaignDonorsValidation,
} = require('../validators/campaignValidators');

const router = express.Router();

// Public routes (with optional auth for personalization)
router.get('/', optionalAuth, validate(getCampaignsValidation), campaignController.getCampaigns);
router.get('/:identifier', optionalAuth, validate(getCampaignValidation), campaignController.getCampaign);
router.get('/:id/donors', optionalAuth, validate(getCampaignDonorsValidation), campaignController.getCampaignDonors);

// Protected routes (require authentication)
router.use(authenticateToken);

// User routes (authenticated users can create campaigns)
// Support both JSON and FormData with file uploads
router.post('/', 
  campaignUploadFields,
  handleUploadError,
  handleMixedData,
  processUploadedFiles,
  validate(createCampaignValidation), 
  campaignController.createCampaign
);
router.put('/:id', validate(updateCampaignValidation), campaignController.updateCampaign);
router.delete('/:id', validate(deleteCampaignValidation), campaignController.deleteCampaign);
router.patch('/:id/status', validate(updateCampaignStatusValidation), campaignController.updateCampaignStatus);
router.get('/:id/analytics', validate(getCampaignAnalyticsValidation), campaignController.getCampaignAnalytics);

// Image upload routes
router.post(
  '/:id/images', 
  uploadMiddleware.array('images', 10), 
  campaignController.uploadCampaignImages
);

module.exports = router;