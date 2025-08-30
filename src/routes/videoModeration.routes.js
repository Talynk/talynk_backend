const express = require("express");
const router = express.Router();
// const { authenticate } = require('../middleware/auth');
const upload = require("../middleware/fileUpload");
const videoModerationController = require("../controllers/videoModerationController");

/**
 * @route POST /api/video-moderation/analyze
 * @desc Submit a video for analysis using Hive API (sync for short videos, async for longer videos)
 * @access Public
 */
router.post(
  "/analyze",
  // authenticate,
  ...upload.single("video"),
  videoModerationController.analyzeVideo
);

/**
 * @route GET /api/video-moderation/status/:jobId
 * @desc Check the status of an async video analysis job
 * @access Public
 */
router.get(
  "/status/:jobId",
  // authenticate,
  videoModerationController.checkJobStatus
);

/**
 * @route POST /api/video-moderation/webhook
 * @desc Webhook endpoint for Hive API callbacks (for async processing)
 * @access Public
 */
router.post("/webhook", videoModerationController.webhookHandler);

module.exports = router;
