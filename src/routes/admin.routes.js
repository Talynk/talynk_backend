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
router.get('/approvers', authenticate, isAdmin, adminController.getApprovers);
router.get('/approvers/:approverId/posts', authenticate, isAdmin, adminController.getAllApprovedPostsByApprover);
router.put('/approvers/:id/deactivate', authenticate, isAdmin, adminController.deactivateApprover);
router.put('/approvers/:id/activate', authenticate, isAdmin, adminController.activateApprover);
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

// ===== NEW ADMIN ANALYTICS & MANAGEMENT ROUTES =====

// Analytics & Reports
router.get('/analytics', authenticate, isAdmin, adminController.getAnalytics);
router.get('/content-management/stats', authenticate, isAdmin, adminController.getContentManagementStats);

// Post Management
router.put('/posts/:postId/featured', authenticate, isAdmin, adminController.setPostFeatured);
router.put('/posts/:postId/freeze', authenticate, isAdmin, adminController.freezePost);
router.put('/posts/:postId/unfreeze', authenticate, isAdmin, adminController.unfreezePost);
router.get('/posts/:postId/reports', authenticate, isAdmin, adminController.getPostReports);
router.get('/posts/analytics', authenticate, isAdmin, adminController.getAdminPosts);

// Appeals Management
router.get('/appeals', authenticate, isAdmin, adminController.getAllAppeals);

// Broadcast Notifications
router.post('/notifications/broadcast', authenticate, isAdmin, adminController.sendBroadcastNotification);






// Seeding and reset endpoints (Admin only)
router.post('/seed/countries', authenticate, isAdmin, seedController.seedCountries);
router.post('/seed/categories', authenticate, isAdmin, seedController.seedCategories);
router.post('/seed/all', authenticate, isAdmin, seedController.seedAll);
router.delete('/reset/countries', authenticate, isAdmin, seedController.resetCountries);
router.delete('/reset/categories', authenticate, isAdmin, seedController.resetCategories);
router.delete('/reset/all', authenticate, isAdmin, seedController.resetAll);

module.exports = router; 