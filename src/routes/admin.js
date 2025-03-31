const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { isAdmin } = require('../middleware/isAdmin');

// Admin routes
router.get('/users', authenticate, isAdmin, adminController.getAllUsers);
router.post('/accounts/manage', authenticate, isAdmin, adminController.manageUserAccount);
router.post('/approvers', authenticate, isAdmin, adminController.registerApprover);
router.delete('/approvers/:username', authenticate, isAdmin, adminController.removeApprover);
router.get('/videos', authenticate, isAdmin, adminController.getAllVideos);
router.get('/dashboard/stats', authenticate, isAdmin, adminController.getAdminDashboardStats);

module.exports = router; 