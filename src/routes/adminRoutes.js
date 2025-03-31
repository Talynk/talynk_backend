const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin } = require('../middleware/isAdmin');
const { adminValidations } = require('../middleware/extendedValidator');
const { validate } = require('../middleware/validator');

// Account Management
router.post('/accounts/manage', 
    isAdmin, 
    adminValidations.manageAccount, 
    validate, 
    adminController.manageUserAccount
);

// Video Management
router.get('/videos', 
    isAdmin, 
    adminController.getAllVideos
);

// Approver Management
router.post('/approvers', 
    isAdmin, 
    adminValidations.registerApprover, 
    validate, 
    adminController.registerApprover
);

router.delete('/approvers/:username', 
    isAdmin, 
    adminController.removeApprover
);

// Messaging
router.post('/messages/users', 
    isAdmin, 
    adminController.sendMessageToAllUsers
);

router.post('/messages/approvers', 
    isAdmin, 
    adminController.sendMessageToApprovers
);

// Dashboard Statistics
router.get('/dashboard/stats', 
    isAdmin, 
    adminController.getAdminDashboardStats
);

module.exports = router; 