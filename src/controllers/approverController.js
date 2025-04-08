const Approver = require('../models/Approver.js');
const Post = require('../models/Post.js');
const User = require('../models/User.js');
const Notification = require('../models/Notification.js');
const { Op } = require('sequelize');
const {validate, parse} = require('uuid');
const sequelize = require('../config/database');

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
            where: { status: 'pending' },
            include: [{
                model: User,
                as: "user",
                attributes: ['username', 'email']
            }],
            order: [['updated_at', 'DESC']],
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
                as: "user",
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
        const approverUsername = req.user.id;
        console.log("Got id ----->" + postId + "Type of it is : ----->" + typeof postId)

        const post = await Post.findOne({
            where: { 
                id: postId,
                status: 'pending'
            },
            include: [{
                model: User,
                as: "user",
                attributes: ['username',"id"]
            }]
        });

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found or already processed'
            });
        }

        await post.update({
            status: 'approved',
            approver_id: approverUsername,
            aproved_at: new Date(),
            review_notes: notes
        });

        // Create notification using raw SQL
        await sequelize.query(
            `INSERT INTO notifications (user_id, notification_text, notification_date, is_read)
             VALUES ($1, $2, $3, $4)`,
            {
                bind: [
                    post.user?.id,
                    'Your post has been approved',
                    new Date(),
                    false
                ],
                type: sequelize.QueryTypes.INSERT
            }
        );

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
                id: postId,
                status: 'pending'
            },
            include: [{
                model: User,
                as: "user",
                attributes: ['username', 'id']
            }]
        });

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found or already processed'
            });
        }

        await post.update({
            status: 'rejected',
            approver_id: approverUsername,
            rejected_at: new Date(),
            review_notes: notes
        });

        // Create notification using raw SQL
        await sequelize.query(
            `INSERT INTO notifications (user_id, notification_text, notification_date, is_read)
             VALUES ($1, $2, $3, $4)`,
            {
                bind: [
                    post.user.id,
                    `Your post has been rejected. Reason: ${notes}`,
                    new Date(),
                    false
                ],
                type: sequelize.QueryTypes.INSERT
            }
        );

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

        // Get notifications using raw SQL
        const [notifications] = await sequelize.query(
            `SELECT * FROM notifications 
             WHERE user_id = $1 
             ORDER BY notification_date DESC 
             LIMIT 50`,
            {
                bind: [approverUsername],
                type: sequelize.QueryTypes.SELECT
            }
        );

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