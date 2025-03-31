const express = require('express');
const router = express.Router();
const approverController = require('../controllers/approverController');
const { isApprover } = require('../middleware/isApprover');
const { validate } = require('../middleware/validator');

// Stats
router.get('/stats', 
    isApprover, 
    approverController.getApproverStats
);

// Posts Management
router.get('/posts/pending', 
    isApprover, 
    approverController.getPendingPosts
);

router.get('/posts/approved', 
    isApprover, 
    approverController.getApprovedPosts
);

router.get('/posts/:postId', 
    isApprover, 
    approverController.getPostDetails
);

router.put('/posts/:postId/approve', 
    isApprover, 
    approverController.approvePost
);

router.put('/posts/:postId/reject', 
    isApprover, 
    approverController.rejectPost
);

// Notifications
router.get('/notifications', 
    isApprover, 
    approverController.getApproverNotifications
);

module.exports = router; 