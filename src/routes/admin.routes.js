const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { isAdmin } = require('../middleware/isAdmin');

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
router.get('/approvers/:approverId/approved-posts', authenticate, isAdmin, adminController.getAllApprovedPostsByApprover);
router.get('/dashboard/stats', authenticate, isAdmin, adminController.getDashboardStats);
router.get('/users/stats', authenticate, isAdmin, adminController.getUserStats);
router.get('/posts/search', authenticate, isAdmin, adminController.searchPosts);

module.exports = router; 