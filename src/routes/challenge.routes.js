const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const upload = require('../middleware/fileUpload');

// ===== PUBLIC ROUTES (No authentication required) =====

// Get all approved/active challenges (public - accessible to unauthenticated users)
router.get('/', challengeController.getAllChallenges);

// Get active challenges (public - accessible to unauthenticated users)
router.get('/active', challengeController.getActiveChallenges);

// Get ended challenges (public - accessible to unauthenticated users)
router.get('/ended', challengeController.getEndedChallenges);

// Challenge Statistics Endpoints (must be before parameterized routes)
router.get('/stats/overview', challengeController.getChallengeStatistics);
router.get('/stats/most-participants', challengeController.getChallengesWithMostParticipants);
router.get('/stats/most-posts', challengeController.getChallengesWithMostPosts);
router.get('/stats/most-rewarding', challengeController.getMostRewardingChallenges);
router.get('/stats/top-organizers', challengeController.getUsersWithMostChallenges);

// Get a single challenge by ID (public - accessible to unauthenticated users)
router.get('/:challengeId', optionalAuthenticate, challengeController.getChallengeById);

// Get participants of a challenge (public - accessible to unauthenticated users)
router.get('/:challengeId/participants', challengeController.getChallengeParticipants);

// Get posts for a challenge (public - accessible to unauthenticated users)
router.get('/:challengeId/posts', challengeController.getChallengePosts);

// ===== PROTECTED ROUTES (Authentication required) =====

// Create a new challenge request
router.post('/', authenticate, challengeController.createChallenge);

// Get challenges organized by current user (must be before parameterized routes)
router.get('/my-challenges', authenticate, challengeController.getMyChallenges);

// Get challenges the user has joined (must be before parameterized routes)
router.get('/joined', authenticate, challengeController.getJoinedChallenges);

// Join a challenge
router.post('/:challengeId/join', authenticate, challengeController.joinChallenge);

// Create a post directly in a challenge (with file upload)
router.post('/:challengeId/posts', authenticate, upload.single('file'), challengeController.createPostInChallenge);

// Link an existing post to a challenge
router.post('/:challengeId/posts/:postId', authenticate, challengeController.linkPostToChallenge);

module.exports = router;

