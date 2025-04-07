const Approver = require('../models/Approver.js');
const Post = require('../models/Post.js');
const User = require('../models/User.js');
const Notification = require('../models/Notification.js');
const { Op } = require('sequelize');

exports.getApproverStats = async (req, res) => {
    try {
        const approverUsername = req.user.username;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [pendingCount, approvedCount, todayCount] = await Promise.all([
            Post.count({ where: { post_status: 'pending' } }),
            Post.count({ 
                where: { 
                    post_status: 'approved',
                    approverID: approverUsername 
                } 
            }),
            Post.count({
                where: {
                    post_status: 'approved',
                    approverID: approverUsername,
                    approvedDate: {
                        [Op.gte]: today
                    }
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                pendingCount,
                approvedCount,
                todayCount
            }
        });
    } catch (error) {
        console.error('Stats fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching approver statistics'
        });
    }
};

exports.getPendingPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const posts = await Post.findAndCountAll({
            where: { post_status: 'pending' },
            include: [{
                model: User,
                attributes: ['username', 'email']
            }],
            order: [['uploadDate', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            status: 'success',
            data: {
                posts: posts.rows,
                total: posts.count,
                pages: Math.ceil(posts.count / limit),
                currentPage: parseInt(page)
            }
        });
    } catch (error) {
        console.error('Pending posts fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching pending posts'
        });
    }
};

exports.getApprovedPosts = async (req, res) => {
    try {
        const { date, search, page = 1, limit = 10 } = req.query;
        const approverUsername = req.user.id;
        const whereClause = {
            status: 'approved',
            approver_id: approverUsername
        };

        if (date) {
            const searchDate = new Date(date);
            whereClause.approved_at = {
                [Op.gte]: searchDate,
                [Op.lt]: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000)
            };
        }

        if (search) {
            whereClause.title = {
                [Op.like]: `%${search}%`
            };
        }

        const posts = await Post.findAndCountAll({
            where: whereClause,
            include: [{
                model: User,
                attributes: ['username', 'email']
            }],
            order: [['approved_at', 'DESC']],
            limit: parseInt(limit),
            offset: (page - 1) * limit
        });

        res.json({
            status: 'success',
            data: {
                posts: posts.rows,
                total: posts.count,
                pages: Math.ceil(posts.count / limit),
                currentPage: parseInt(page)
            }
        });
    } catch (error) {
        console.error('Approved posts fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching approved posts'
        });
    }
};

exports.getPostDetails = async (req, res) => {
    try {
        const { postId } = req.params;

        const post = await Post.findOne({
            where: { uniqueTraceability_id: postId },
            include: [{
                model: User,
                attributes: ['username', 'email']
            }]
        });

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found'
            });
        }

        res.json({
            status: 'success',
            data: { post }
        });
    } catch (error) {
        console.error('Post details fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching post details'
        });
    }
};

exports.approvePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { notes } = req.body;
        const approverUsername = req.user.username;

        const post = await Post.findOne({
            where: { 
                uniqueTraceability_id: postId,
                post_status: 'pending'
            }
        });

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found or already processed'
            });
        }

        await post.update({
            post_status: 'approved',
            approverID: approverUsername,
            approvedDate: new Date(),
            review_notes: notes
        });

        // Notify post owner
        await Notification.create({
            userID: post.uploaderID,
            notification_text: 'Your post has been approved',
            notification_date: new Date()
        });

        res.json({
            status: 'success',
            message: 'Post approved successfully'
        });
    } catch (error) {
        console.error('Post approval error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error approving post'
        });
    }
};

exports.rejectPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { notes } = req.body;
        const approverUsername = req.user.username;

        const post = await Post.findOne({
            where: { 
                uniqueTraceability_id: postId,
                post_status: 'pending'
            }
        });

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found or already processed'
            });
        }

        await post.update({
            post_status: 'rejected',
            approverID: approverUsername,
            rejectedDate: new Date(),
            review_notes: notes
        });

        // Notify post owner
        await Notification.create({
            userID: post.uploaderID,
            notification_text: `Your post has been rejected. Reason: ${notes}`,
            notification_date: new Date()
        });

        res.json({
            status: 'success',
            message: 'Post rejected successfully'
        });
    } catch (error) {
        console.error('Post rejection error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error rejecting post'
        });
    }
};

exports.getApproverNotifications = async (req, res) => {
    try {
        const approverUsername = req.user.username;

        const notifications = await Notification.findAll({
            where: { userID: approverUsername },
            order: [['notification_date', 'DESC']],
            limit: 50
        });

        res.json({
            status: 'success',
            data: { notifications }
        });
    } catch (error) {
        console.error('Notifications fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching notifications'
        });
    }
}; 