const prisma = require('../lib/prisma');

exports.addComment = async (req, res) => {
    try {
        const { postId } = req.params;
        const { comment_text } = req.body;
        const username = req.user.id;
        const commentorName = req.user.username;

        // Create comment using Prisma
        const comment = await prisma.comment.create({
            data: {
                commentor_id: username,
                post_id: postId,
                comment_text: comment_text,
                comment_date: new Date()
            }
        });

        // Increment post's comment count using Prisma
        await prisma.post.update({
            where: { id: postId },
            data: {
                comment_count: {
                    increment: 1
                }
            }
        });

        // Get post owner's username for notification
        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { user_id: true }
        });

        if (post) {
            // Create notification using Prisma
            await prisma.notification.create({
                data: {
                    userID: post.user_id,
                    message: `${commentorName} commented on your post`,
                    type: 'comment',
                    isRead: false
                }
            });
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
            attributes: ['comment_id', 'commentor_id', 'comment_date', 'post_id', 'comment_text', 'comment_reports'],
            where: { post_id: postId },
            include: [{
                model: User,
                attributes: ['id', 'username'],
                required: false
            }],
            order: [['comment_date', 'DESC']]
        });

        res.json({
            status: 'success',
            data: { comments }
        });
    } catch (error) {
        console.error('Comments fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching comments',
            details: error.message
        });
    }
};

exports.deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const username = req.user.username;

        // First get the comment to know which post it belongs to
        const comment = await Comment.findOne({
            where: {
                comment_id: commentId,
                commentor_id: username
            }
        });

        if (!comment) {
            return res.status(404).json({
                status: 'error',
                message: 'Comment not found or unauthorized'
            });
        }

        const postId = comment.post_id;

        // Delete the comment
        await comment.destroy();

        // Decrement post's comment count
        await sequelize.query(
            `UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = $1`,
            {
                bind: [postId],
                type: sequelize.QueryTypes.UPDATE
            }
        );

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

/**
 * Get all comments on the logged-in user's posts for the Inbox page
 */
exports.getUserPostComments = async (req, res) => {
    try {
        const userId = req.user.id;

        // Optional query parameters for pagination and filtering
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const fromDate = req.query.from || null;

        // Prepare date condition for SQL
        const dateCondition = fromDate ? `AND c.comment_date >= $3` : '';
        
        // Set up bind parameters
        const bindParams = [userId, limit];
        if (fromDate) {
            bindParams.push(fromDate);
        }
        bindParams.push(offset); // This will be $3 or $4 depending on dateCondition
        
        // Use raw SQL with explicit type casts to avoid type mismatch issues
        const comments = await sequelize.query(
            `SELECT 
                c.comment_id as id,
                c.post_id as "postId",
                p.title as "postTitle",
                p.video_url as "postThumbnail",
                c.comment_text as content,
                c.comment_date as "createdAt",
                u.id as "user.id",
                u.username as "user.name",
                u.username as "user.username",
                u.profile_picture as "user.avatar"
            FROM comments c
            JOIN posts p ON c.post_id::uuid = p.id::uuid
            JOIN users u ON c.commentor_id::uuid = u.id::uuid
            WHERE p.user_id::uuid = $1::uuid
            ${dateCondition}
            ORDER BY c.comment_date DESC
            LIMIT $2 OFFSET $${fromDate ? '4' : '3'}`,
            {
                bind: bindParams,
                type: sequelize.QueryTypes.SELECT,
                nest: true
            }
        );

        // Format the response
        const formattedComments = comments.map(comment => ({
            id: comment.id.toString(),
            postId: comment.postId,
            postTitle: comment.postTitle,
            postThumbnail: comment.postThumbnail,
            content: comment.content,
            createdAt: new Date(comment.createdAt).toISOString(),
            user: {
                id: comment.user.id,
                name: comment.user.name,
                username: comment.user.username,
                avatar: comment.user.avatar || null
            }
        }));

        res.json({
            status: 'success',
            data: {
                comments: formattedComments
            }
        });
    } catch (error) {
        console.error('Error fetching user post comments:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch comments'
        });
    }
}; 