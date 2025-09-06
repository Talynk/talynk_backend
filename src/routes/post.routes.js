const express = require('express');
const router = express.Router();

// Import middleware
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/fileUpload');

// Import controllers
const postController = require('../controllers/postController');

// Post routes (all protected)
router.post('/', authenticate, ...upload.single('file'), postController.createPost);
router.get('/user', authenticate, postController.getUserPosts);
router.delete('/:postId', authenticate, postController.deletePost);

// Note: Like functionality has been moved to /api/likes endpoints
// - GET /api/likes/user/liked - Get user's liked posts
// - POST /api/likes/posts/:postId/toggle - Toggle like on post
// - GET /api/likes/posts/:postId/status - Check like status

// Public post routes
router.get('/all', postController.getAllPosts); // only approved
router.get('/search', postController.searchPosts);
router.get('/:postId', postController.getPostById);

module.exports = router;