const express = require('express');
const authController = require('../controllers/authController');
const { 
  authenticateToken, 
  requireAdmin, 
  requireVerification,
  optionalAuth 
} = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
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
  adminCreateUserValidation,
  adminUpdateUserValidation,
} = require('../validators/authValidators');

const router = express.Router();

// Public routes
router.post('/register', validate(registerValidation), authController.register);
router.post('/login', validate(loginValidation), authController.login);
router.post('/refresh', validate(refreshTokenValidation), authController.refreshToken);
router.post('/forgot-password', validate(forgotPasswordValidation), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordValidation), authController.resetPassword);
router.post('/verify-email', validate(verifyEmailValidation), authController.verifyEmail);
router.post('/resend-verification', validate(resendVerificationValidation), authController.resendEmailVerification);
router.get('/check-email', authController.checkEmailAvailability);

// Routes that work with optional authentication
router.get('/status', optionalAuth, authController.getAuthStatus);

// Protected routes (require authentication)
router.use(authenticateToken);

router.post('/logout', authController.logout);
router.get('/me', authController.getMe);
router.get('/profile', authController.getProfile);
router.put('/profile', validate(updateProfileValidation), authController.updateProfile);
router.put('/change-password', validate(changePasswordValidation), authController.changePassword);
router.post('/deactivate', authController.deactivateAccount);
router.delete('/delete-account', authController.deleteAccount);

// Phone verification routes
router.post('/send-otp', validate(sendOTPValidation), authController.sendOTP);
router.post('/verify-otp', validate(verifyOTPValidation), authController.verifyOTP);

// Admin routes
router.get('/users', requireAdmin, authController.getAllUsers);
router.get('/users/:id', requireAdmin, validate(adminUpdateUserValidation), authController.getUserById);
router.put('/users/:id', requireAdmin, validate(adminUpdateUserValidation), authController.updateUser);
router.post('/admin/create-user', requireAdmin, validate(adminCreateUserValidation), authController.register);

module.exports = router;