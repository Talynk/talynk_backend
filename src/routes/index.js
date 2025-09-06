const express = require('express');
const router = express.Router();

// Import organized route modules
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const postRoutes = require('./post.routes');
const commentRoutes = require('./comment.routes');
const adminRoutes = require('./admin.routes');
const approverRoutes = require('./approver.routes');
const categoryRoutes = require('./category.routes');
const followRoutes = require('./follow.routes');
const suggestionRoutes = require('./suggestion.routes');
const subscriptionRoutes = require('./subscription.routes');
const adRoutes = require('./ad.routes');
const reportRoutes = require('./report.routes');
const featuredRoutes = require('./featured.routes');
const recommendationRoutes = require('./recommendation.routes');
const likeRoutes = require('./like.routes');
const viewRoutes = require('./view.routes');
const countryRoutes = require('./country.routes');

// Test route
router.get('/test', (req, res) => {
    res.json({ message: 'API is working' });
});

// Mount organized routes
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/users', userRoutes);
router.use('/posts', postRoutes);
router.use('/posts', commentRoutes); // Comments are nested under posts
router.use('/admin', adminRoutes);
router.use('/approver', approverRoutes);
router.use('/categories', categoryRoutes);
router.use('/follows', followRoutes);
router.use('/', suggestionRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/ads', adRoutes);
router.use('/reports', reportRoutes);
router.use('/featured', featuredRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/likes', likeRoutes);
router.use('/views', viewRoutes);
router.use('/countries', countryRoutes);

module.exports = router; 