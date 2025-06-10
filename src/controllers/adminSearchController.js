const User = require('../models/User.js');
const Post = require('../models/Post.js');
const Category = require('../models/Category.js');
const { Op } = require('sequelize');

exports.searchPosts = async (req, res) => {
    try {
        const { q } = req.query;

        // Validate search query
        if (!q || q.trim() === '') {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid search query'
            });
        }

        const searchTerm = q.trim();

        // Search posts by various criteria
        const posts = await Post.findAll({
            where: {
                [Op.or]: [
                    // Search by post ID (exact match)
                    { id: searchTerm },
                    // Search by unique traceability ID
                    { unique_traceability_id: { [Op.iLike]: `%${searchTerm}%` } },
                    // Search by title
                    { title: { [Op.iLike]: `%${searchTerm}%` } },
                    // Search by description
                    { description: { [Op.iLike]: `%${searchTerm}%` } }
                ]
            },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'username', 'email']
                },
                {
                    model: Category,
                    as: 'category',
                    attributes: ['id', 'name']
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: 50 // Limit results to prevent performance issues
        });

        // Add full URLs for files
        const postsWithUrls = posts.map(post => {
            const postData = post.toJSON();
            if (postData.video_url) {
                postData.fullUrl = `${process.env.API_BASE_URL || 'http://localhost:3000'}${postData.video_url}`;
            }
            return postData;
        });

        res.json({
            status: 'success',
            data: postsWithUrls
        });

    } catch (error) {
        console.error('Error searching posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}; 