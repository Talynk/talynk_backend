const Post = require('../models/Post.js');
const User = require('../models/User.js');
const Notification = require('../models/Notification.js');
const Comment = require('../models/Comment.js');
const sequelize = require('../config/database');

exports.addComment = async (req, res) => {
    try {
        const { postId } = req.params;
        const { comment_text } = req.body;
        const username = req.user.id;

        // Create comment using raw SQL with all required fields
        const [comment] = await sequelize.query(
            `INSERT INTO comments (commentor_id, post_id, comment_text, comment_date)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            {
                bind: [username, postId, comment_text, new Date()],
                type: sequelize.QueryTypes.INSERT
            }
        );

        // Increment post's comment count using raw SQL
        // await sequelize.query(
        //     `UPDATE posts SET comments = comments + 1 WHERE id = $1`,
        //     {
        //         bind: [postId],
        //         type: sequelize.QueryTypes.UPDATE
        //     }
        // );

        // Get post owner's username for notification
        const [post] = await sequelize.query(
            `SELECT u.id FROM posts p 
             JOIN users u ON p.user_id = u.id 
             WHERE p.id = $1`,
            {
                bind: [postId],
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (post) {
            // Create notification using raw SQL
            await sequelize.query(
                `INSERT INTO notifications (user_id, notification_text, notification_date, is_read)
                 VALUES ($1, $2, $3, $4)`,
                {
                    bind: [
                        post.id,
                        `${username} commented on your post`,
                        new Date(),
                        false
                    ],
                    type: sequelize.QueryTypes.INSERT
                }
            );
        }

        res.status(201).json({
            status: 'success',
            data: { comment }
        });
    } catch (error) {
        console.error('Comment creation error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error adding comment',
            details: error.message
        });
    }
};

exports.getPostComments = async (req, res) => {
    try {
        const { postId } = req.params;

        const comments = await Comment.findAll({
            where: { postID: postId },
            include: [{
                model: User,
                attributes: ['username', 'user_facial_image']
            }],
            order: [['commentDate', 'DESC']]
        });

        res.json({
            status: 'success',
            data: { comments }
        });
    } catch (error) {
        console.error('Comments fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching comments'
        });
    }
};

exports.deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const username = req.user.username;

        const comment = await Comment.findOne({
            where: {
                commentID: commentId,
                commentorID: username
            }
        });

        if (!comment) {
            return res.status(404).json({
                status: 'error',
                message: 'Comment not found or unauthorized'
            });
        }

        await comment.destroy();

        // Decrement post's comment count
        await Post.decrement('comments', {
            where: { uniqueTraceability_id: comment.postID }
        });

        res.json({
            status: 'success',
            message: 'Comment deleted successfully'
        });
    } catch (error) {
        console.error('Comment deletion error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error deleting comment'
        });
    }
};

exports.reportComment = async (req, res) => {
    try {
        const { commentId } = req.params;

        await Comment.increment('comment_reports', {
            where: { commentID: commentId }
        });

        res.json({
            status: 'success',
            message: 'Comment reported successfully'
        });
    } catch (error) {
        console.error('Comment report error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error reporting comment'
        });
    }
}; 