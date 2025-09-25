const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { isAdmin } = require('../middleware/isAdmin');
const seedController = require('../controllers/seedController');

// Admin registration (no authentication required for initial setup)
router.post('/register', adminController.registerAdmin);

// Admin routes (all require authentication and admin privileges)
router.get('/users', authenticate, isAdmin, adminController.getAllUsers);
router.post('/accounts/manage', authenticate, isAdmin, adminController.manageUserAccount);
router.post('/approvers', authenticate, isAdmin, adminController.registerApprover);
router.delete('/approvers/:id', authenticate, isAdmin, adminController.removeApprover);
router.get('/videos', authenticate, isAdmin, adminController.getAllVideos);
router.put('/approve', authenticate, isAdmin, adminController.updatePostStatus);
router.get('/approved/posts', authenticate, isAdmin, adminController.getApprovedPosts);
router.get('/posts/pending', authenticate, isAdmin, adminController.getPendingPosts);
router.get('/posts/rejected', authenticate, isAdmin, adminController.getRejectedPosts);
router.get('/posts/flagged', authenticate, isAdmin, adminController.getFlaggedPosts);
router.get('/approvers/:approverId/approved-posts', authenticate, isAdmin, adminController.getAllApprovedPostsByApprover);
router.get('/dashboard/stats', authenticate, isAdmin, adminController.getDashboardStats);
router.get('/users/stats', authenticate, isAdmin, adminController.getUserStats);
router.get('/posts/search', authenticate, isAdmin, adminController.searchPosts);

// Seeding and reset endpoints (Admin only)
router.post('/seed/countries', authenticate, isAdmin, seedController.seedCountries);
router.post('/seed/categories', authenticate, isAdmin, seedController.seedCategories);
router.post('/seed/all', authenticate, isAdmin, seedController.seedAll);
router.delete('/reset/countries', authenticate, isAdmin, seedController.resetCountries);
router.delete('/reset/categories', authenticate, isAdmin, seedController.resetCategories);
router.delete('/reset/all', authenticate, isAdmin, seedController.resetAll);

module.exports = router; 