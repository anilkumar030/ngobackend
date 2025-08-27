const express = require('express');
const testimonialController = require('../controllers/testimonialController');
const { 
  authenticateToken, 
  optionalAuth, 
  requireAdmin,
  requireOwnership 
} = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { uploadMiddleware } = require('../config/cloudinary');

// Get project name from environment variable with fallback
const PROJECT_NAME = process.env.PROJECT_NAME || 'Shiv Dhaam Foundation';
const PROJECT_FOLDER = PROJECT_NAME.toLowerCase().replace(/\s+/g, '-');
const {
  getTestimonialsValidation,
  submitTestimonialValidation,
  updateTestimonialValidation,
  approveTestimonialValidation,
  rejectTestimonialValidation,
  getUserTestimonialsValidation,
  getAdminTestimonialsValidation,
  testimonialIdValidation,
} = require('../validators/testimonialValidators');

const router = express.Router();

// Public routes
router.get('/', optionalAuth, validate(getTestimonialsValidation), testimonialController.getTestimonials);

// User testimonial management routes (must come before /:id routes to avoid conflicts)
router.get('/user/my-testimonials', authenticateToken, validate(getUserTestimonialsValidation), testimonialController.getUserTestimonials);

// Admin routes (must come before /:id routes to avoid conflicts)
router.get('/admin/all', authenticateToken, requireAdmin, validate(getAdminTestimonialsValidation), testimonialController.getAdminTestimonials);

// Specific testimonial routes
router.get('/:id', optionalAuth, validate(testimonialIdValidation), testimonialController.getTestimonialById);

// Protected routes (require authentication)
router.post('/', authenticateToken, validate(submitTestimonialValidation), testimonialController.submitTestimonial);
router.put('/:id', authenticateToken, validate(updateTestimonialValidation), testimonialController.updateTestimonial);
router.delete('/:id', authenticateToken, validate(testimonialIdValidation), testimonialController.deleteTestimonial);

// Image upload routes  
router.post('/:id/upload-image', authenticateToken, uploadMiddleware.single('image', `${PROJECT_FOLDER}/testimonials`), validate(testimonialIdValidation), testimonialController.uploadTestimonialImage);
router.delete('/:id/delete-image', authenticateToken, validate(testimonialIdValidation), testimonialController.deleteTestimonialImage);

// Admin management routes
router.post('/:id/approve', authenticateToken, requireAdmin, validate(approveTestimonialValidation), testimonialController.approveTestimonial);
router.post('/:id/reject', authenticateToken, requireAdmin, validate(rejectTestimonialValidation), testimonialController.rejectTestimonial);
router.post('/:id/toggle-featured', authenticateToken, requireAdmin, validate(testimonialIdValidation), testimonialController.toggleFeaturedStatus);

module.exports = router;