const express = require('express');
const router = express.Router();
const { Post, User } = require('../models');  // Import models directly
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');
const { Op } = require('sequelize');
const { isAdmin } = require('../middleware/isAdmin');
const { adminValidations } = require('../middleware/extendedValidator');
const { validate } = require('../middleware/validator');

// Auth routes (no authentication required)
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);

// Protected routes (require authentication)
router.use(auth.authenticate);

// Dashboard routes
router.get('/dashboard/stats', isAdmin, adminController.getDashboardStats);
router.get('/dashboard/stats', isAdmin, adminController.getAdminDashboardStats);

// Account Management
router.post('/accounts/manage', isAdmin, adminValidations.manageAccount, validate, adminController.manageUserAccount);
router.patch('/users/:username/status', isAdmin, adminController.manageUserAccount);

// User management
router.get('/users', isAdmin, adminController.getAllUsers);

// Recent posts route
router.get('/posts/recent', isAdmin, async (req, res) => {
    try {
        console.log('Fetching recent posts...');
        const posts = await Post.findAll({
            attributes: [
                ['id', 'id'],
                ['title', 'title'],
                ['createdAt', 'createdAt']
            ],
            include: [{
                model: User,
                as: 'author',
                attributes: [
                    ['id', 'id'],
                    ['username', 'username']
                ],
                required: false
            }],
            order: [['createdAt', 'DESC']],
            limit: 10
        });

        console.log('Posts found:', posts.length);
        res.json({
            status: 'success',
            posts: posts
        });
    } catch (error) {
        console.error('Detailed error in recent posts:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Most viewed posts route
router.get('/posts/most-viewed', isAdmin, async (req, res) => {
    try {
        console.log('Fetching most viewed posts...');
        const posts = await Post.findAll({
            attributes: [
                ['id', 'id'],
                ['title', 'title'],
                ['createdAt', 'createdAt']
            ],
            include: [{
                model: User,
                as: 'author',
                attributes: [
                    ['id', 'id'],
                    ['username', 'username']
                ],
                required: false
            }],
            order: [['createdAt', 'DESC']],
            limit: 10
        });

        console.log('Posts found:', posts.length);
        res.json({
            status: 'success',
            posts: posts
        });
    } catch (error) {
        console.error('Detailed error in most viewed posts:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Search route
router.get('/search/:type/:id', isAdmin, adminController.searchByTraceId);

// Posts management
router.get('/posts', isAdmin, adminController.getPosts);
router.get('/posts/pending', isAdmin, adminController.getPendingPosts);
router.put('/posts/:id/status', isAdmin, adminController.updatePostStatus);

// Approver Management
router.post('/approvers', isAdmin, adminValidations.registerApprover, validate, adminController.registerApprover);
router.post('/approvers/register', isAdmin, adminController.registerApprover);
router.delete('/approvers/:username', isAdmin, adminController.removeApprover);
router.get('/approvers', isAdmin, adminController.getApprovers);
router.get('/approvers/:id', isAdmin, adminController.getApproverDetails);
router.patch('/approvers/:id/status', isAdmin, adminController.updateApproverStatus);

// Messaging
router.post('/messages/users', isAdmin, adminController.sendMessageToAllUsers);
router.post('/messages/approvers', isAdmin, adminController.sendMessageToApprovers);

// Video Management
router.get('/videos', isAdmin, adminController.getAllVideos);
router.get('/videos/all', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';

        const where = {};
        if (search) {
            where.title = { [Op.iLike]: `%${search}%` };
        }
        if (status) {
            where.status = status;
        }

        const videos = await Post.findAndCountAll({
            attributes: [
                ['id', 'id'],
                ['title', 'title'],
                ['status', 'status'],
                ['createdAt', 'createdAt'],
                ['views', 'views']
            ],
            include: [{
                model: User,
                as: 'author',
                attributes: [
                    ['id', 'id'],
                    ['username', 'username']
                ],
                required: false
            }],
            where,
            order: [['createdAt', 'DESC']],
            limit,
            offset: (page - 1) * limit
        });

        res.json({
            status: 'success',
            data: {
                videos: videos.rows,
                total: videos.count,
                pages: Math.ceil(videos.count / limit),
                currentPage: page
            }
        });
    } catch (error) {
        console.error('Error fetching videos:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

router.get('/videos/:id', isAdmin, async (req, res) => {
    try {
        const video = await Post.findOne({
            attributes: [
                ['id', 'id'],
                ['title', 'title'],
                ['status', 'status'],
                ['createdAt', 'createdAt'],
                ['views', 'views'],
                ['content', 'content']
            ],
            include: [{
                model: User,
                as: 'author',
                attributes: [
                    ['id', 'id'],
                    ['username', 'username']
                ],
                required: false
            }],
            where: { id: req.params.id }
        });

        if (!video) {
            return res.status(404).json({
                status: 'error',
                message: 'Video not found'
            });
        }

        res.json({
            status: 'success',
            video
        });
    } catch (error) {
        console.error('Error fetching video:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Ad management
router.post('/ads/upload', isAdmin, adminController.uploadAd);

// Profile management
router.get('/profile', isAdmin, adminController.getProfile);
router.put('/profile', isAdmin, adminController.updateProfile);
router.put('/change-password', isAdmin, adminController.changePassword);

module.exports = router; 