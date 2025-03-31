
const Post = require('../models/Post.js');
const User = require('../models/User.js');
const Notification = require('../models/Notification.js');
const Comment = require('../models/Comment.js');

exports.addComment = async (req, res) => {
    try {
        const { postId } = req.params;
        const { commentText } = req.body;
        const username = req.user.username;

        const comment = await Comment.create({
            commentorID: username,
            postID: postId,
            commentText,
            commentDate: new Date()
        });

        // Increment post's comment count
        await Post.increment('comments', {
            where: { uniqueTraceability_id: postId }
        });

        // Notify post owner
        const post = await Post.findByPk(postId);
        await Notification.create({
            userID: post.uploaderID,
            notification_text: `${username} commented on your post`,
            notification_date: new Date()
        });

        res.status(201).json({
            status: 'success',
            data: { comment }
        });
    } catch (error) {
        console.error('Comment creation error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error adding comment'
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