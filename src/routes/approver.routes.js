const express = require('express');
const router = express.Router();
const { authenticate, isApprover } = require('../middleware/auth');

// Protected approver routes
router.use(authenticate, isApprover);

// Get approver dashboard data
router.get('/dashboard', async (req, res) => {
    try {
        res.json({
            status: 'success',
            data: {
                pendingVideos: 5,
                approvedToday: 10,
                totalReviewed: 50
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

module.exports = router; 