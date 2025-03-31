const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { authenticate, isAdmin } = require('../middleware/auth');
const Post = require('../models/Post');
const Category = require('../models/Category');

// Admin post management routes
router.get('/pending', authenticate, isAdmin, postController.getPendingPosts);
router.get('/approved', authenticate, isAdmin, postController.getApprovedPosts);
router.get('/rejected', authenticate, isAdmin, postController.getRejectedPosts);

// User post routes
router.post('/', authenticate, postController.createPost);
router.get('/', authenticate, postController.getPosts);
router.patch('/:id/approve', authenticate, isAdmin, postController.approvePost);
router.patch('/:id/reject', authenticate, isAdmin, postController.rejectPost);

// User's uploads route
router.get('/my-uploads', authenticate, async (req, res) => {
    try {
        const posts = await Post.findAll({
            where: { user_id: req.user.id },
            include: [
                {
                    model: Category,
                    as: 'category'
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const processedPosts = posts.map(post => {
            const postObj = post.get ? post.get({ plain: true }) : post;
            // Ensure videoUrl is properly formatted
            if (postObj.videoUrl && !postObj.videoUrl.startsWith('http')) {
                postObj.videoUrl = postObj.videoUrl.replace(/^uploads\//, '');
            }
            return postObj;
        });

        res.json({
            status: 'success',
            data: processedPosts
        });
    } catch (error) {
        console.error('Error fetching user posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router; 