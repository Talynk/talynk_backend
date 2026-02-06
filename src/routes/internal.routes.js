const express = require('express');
const router = express.Router();
const { videoProcessingCallback } = require('../controllers/internalController');
const { authenticateInternalAPI } = require('../middleware/internalAuth');

/**
 * Internal API Routes
 * These routes are called by internal services (e.g., video processor VPS)
 * Requires INTERNAL_API_KEY authentication
 */

// Video processing callback
router.post('/video-callback', authenticateInternalAPI, videoProcessingCallback);

module.exports = router;
