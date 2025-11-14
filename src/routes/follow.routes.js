const express = require('express');
const router = express.Router();

// Import middleware
const { authenticate } = require('../middleware/auth');

// Import controllers
const followController = require('../controllers/followController');
const postController = require('../controllers/postController');

// Follow routes
router.post('/', authenticate, followController.followUser);
router.delete('/:followingId', authenticate, followController.unfollowUser);
router.get('/users/:userId/followers', followController.getFollowers);
router.get('/users/:userId/following', followController.getFollowing);
router.get('/check/:followingId', authenticate, followController.checkFollowStatus);

// Posts from users that the current user follows
router.get('/posts', authenticate, postController.getFollowingPosts);

module.exports = router;
