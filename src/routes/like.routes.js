const express = require('express');
const router = express.Router();

// Import middleware
const { authenticate } = require('../middleware/auth');

// Import controllers
const likeController = require('../controllers/likeController');

// Like routes (all require authentication)
router.post('/posts/:postId/toggle', authenticate, likeController.toggleLike);
router.get('/posts/:postId/status', authenticate, likeController.checkLikeStatus);
router.get('/posts/:postId/stats', likeController.getPostLikeStats);
router.get('/user/liked', authenticate, likeController.getLikedPosts);

module.exports = router;
