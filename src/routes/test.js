const express = require('express');
const router = express.Router();
const uploadMiddleware = require('../middleware/fileUpload');
const { addWatermarkToVideo } = require('../utils/videoProcessor');
const fs = require('fs').promises;
const path = require('path');

// Test route for video watermarking
router.post('/test-watermark', uploadMiddleware.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'No video file uploaded'
            });
        }

        res.json({
            status: 'success',
            message: 'Video processed successfully',
            file: {
                originalName: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
                url: req.file.supabaseUrl
            }
        });
    } catch (error) {
        console.error('Test watermark error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error processing video',
            error: error.message
        });
    }
});

module.exports = router; 