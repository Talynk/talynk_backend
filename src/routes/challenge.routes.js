const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');
const { authenticate } = require('../middleware/auth');

// All challenge routes require authentication
router.use(authenticate);

// Create a new challenge request
router.post('/', challengeController.createChallenge);

// Get all approved/active challenges (public view for authenticated users)
router.get('/', challengeController.getAllChallenges);

// Get challenges organized by current user
router.get('/my-challenges', challengeController.getMyChallenges);

// Get challenges the user has joined
router.get('/joined', challengeController.getJoinedChallenges);

// Get a single challenge by ID
router.get('/:challengeId', challengeController.getChallengeById);

// Join a challenge
router.post('/:challengeId/join', challengeController.joinChallenge);

// Get participants of a challenge
router.get('/:challengeId/participants', challengeController.getChallengeParticipants);

// Get posts for a challenge
router.get('/:challengeId/posts', challengeController.getChallengePosts);

// Link a post to a challenge
router.post('/:challengeId/posts/:postId', challengeController.linkPostToChallenge);

module.exports = router;

