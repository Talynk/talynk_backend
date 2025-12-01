const express = require('express');
const router = express.Router();

// Import middleware
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/fileUpload');

// Import controllers
const postController = require('../controllers/postController');
const likeController = require('../controllers/likeController');

// Post routes (all protected)
router.post('/', authenticate, ...upload.single('file'), postController.createPost);

// SPECIFIC ROUTES FIRST - before parameterized routes
router.get('/user', authenticate, postController.getUserPosts);
router.get('/feed', authenticate, postController.getOptimizedFeed);
router.get('/all', postController.getAllPosts); // only approved
router.get('/search', postController.searchPosts);

// PARAMETERIZED ROUTES LAST - to avoid conflicts
router.get('/:postId', postController.getPostById);
router.post('/:postId/like', authenticate, likeController.toggleLike);
router.delete('/:postId', authenticate, postController.deletePost);

module.exports = router;