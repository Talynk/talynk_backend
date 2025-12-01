const express = require('express');
const router = express.Router();

// Import middleware
const { authenticate } = require('../middleware/auth');
const { isApprover } = require('../middleware/isApprover');

// Import controllers
const approverController = require('../controllers/approverController');

// Approver routes (all require authentication and approver privileges)
router.get('/stats', authenticate, isApprover, approverController.getApproverStats);
router.get('/posts/pending', authenticate, isApprover, approverController.getPendingPosts);
router.get('/posts/approved', authenticate, isApprover, approverController.getApprovedPosts);
router.get('/posts/all', authenticate, isApprover, approverController.getAllPosts);
router.get('/posts/flagged', authenticate, isApprover, approverController.getFlaggedPosts);
router.put('/posts/:postId/approve', authenticate, isApprover, approverController.approvePost);
router.put('/posts/:postId/reject', authenticate, isApprover, approverController.rejectPost);
router.put('/posts/:postId/flagged/review', authenticate, isApprover, approverController.reviewFlaggedPost);
router.get('/notifications', authenticate, isApprover, approverController.getApproverNotifications);
router.get('/posts/search', authenticate, isApprover, approverController.searchPosts);

module.exports = router; 