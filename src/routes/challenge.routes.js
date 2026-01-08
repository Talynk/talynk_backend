const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/fileUpload');

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

// Challenge Statistics Endpoints (must be before parameterized routes)
router.get('/stats/overview', challengeController.getChallengeStatistics);
router.get('/stats/most-participants', challengeController.getChallengesWithMostParticipants);
router.get('/stats/most-posts', challengeController.getChallengesWithMostPosts);
router.get('/stats/most-rewarding', challengeController.getMostRewardingChallenges);
router.get('/stats/top-organizers', challengeController.getUsersWithMostChallenges);

// Get a single challenge by ID
router.get('/:challengeId', challengeController.getChallengeById);

// Join a challenge
router.post('/:challengeId/join', challengeController.joinChallenge);

// Get participants of a challenge
router.get('/:challengeId/participants', challengeController.getChallengeParticipants);

// Get posts for a challenge
router.get('/:challengeId/posts', challengeController.getChallengePosts);

// Create a post directly in a challenge (with file upload)
router.post('/:challengeId/posts', ...upload.single('file'), challengeController.createPostInChallenge);

// Link an existing post to a challenge
router.post('/:challengeId/posts/:postId', challengeController.linkPostToChallenge);

module.exports = router;

