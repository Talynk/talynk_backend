const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');
const { isAdmin } = require('../middleware/isAdmin');

// Report a post
router.post('/posts/:postId', authenticate, reportController.reportPost);

// Get all reports (Admin only)
router.get('/', authenticate, isAdmin, reportController.getAllReports);

// Get reports for a specific post
router.get('/posts/:postId', authenticate, reportController.getPostReports);

// Review a report (Admin only)
router.put('/:reportId/review', authenticate, isAdmin, reportController.reviewReport);

// Get report statistics (Admin only)
router.get('/stats', authenticate, isAdmin, reportController.getReportStats);

module.exports = router;

