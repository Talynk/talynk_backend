const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const { Admin, Approver } = require('../models');

// Auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify', authController.verifyToken);
router.get('/profile', authenticate, authController.getProfile);

// Profile routes
router.put('/profile', authenticate, authController.updateProfile); // Update current user's profile
router.put('/users/:username', authenticate, authController.updateProfile); // Update specific user by username

// User management routes
// router.put('/users/:username/password', authenticate, authController.updateUserPassword);

module.exports = router; 