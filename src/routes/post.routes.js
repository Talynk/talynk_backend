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
router.get('/liked', authenticate, postController.getLikedPosts);
router.delete('/:postId', authenticate, postController.deletePost);
router.post('/:postId/like', authenticate, postController.likePost);
router.get('/:postId/like-status', authenticate, postController.checkLikeStatus);

// Public post routes
router.get('/all', postController.getAllPosts); // only approved
router.get('/search', postController.searchPosts);
router.get('/:postId', postController.getPostById);

module.exports = router;