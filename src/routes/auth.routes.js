const express = require('express');
const router = express.Router();

// Import middleware
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/fileUpload');

// Import controllers
const authController = require('../controllers/authController');

// Auth routes
router.post('/login', authController.login);
router.post('/register', authController.register); // Legacy endpoint (deprecated)

// New OTP-based registration flow
router.post('/register/request-otp', authController.requestRegistrationOTP);
router.post('/register/verify-otp', authController.verifyRegistrationOTP);
router.post('/register/complete', authController.completeRegistration);

// Password reset flow
router.post('/password-reset/request-otp', authController.requestPasswordResetOTP);
router.post('/password-reset/verify-otp', authController.verifyPasswordResetOTP);
router.post('/password-reset/reset', authController.resetPassword);

router.post('/refresh-token', authController.refreshToken);
// Protected auth routes
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);

// Account deletion (requires authentication)
router.post('/account/delete/request-otp', authenticate, authController.requestAccountDeletionOTP);
router.post('/account/delete', authenticate, authController.deleteAccount);

module.exports = router;