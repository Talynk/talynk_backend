const Post = require('../models/Post.js');
const User = require('../models/User.js');
const Category = require('../models/Category.js');
const Comment = require('../models/Comment.js');
const PostLike = require('../models/PostLike.js');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const path = require('path');
const db = require('../config/database');
const { sql}  =  require("@sequelize/core")
const { QueryTypes } = require('sequelize');
const Notification = require('../models/Notification.js');
const sequelize = require('../config/database');

exports.createPost = async (req, res) => {
    try {
        const { title, caption, post_category } = req.body;
        const userId = req.user.id;
        console.log("Request headers:", req.headers);
        console.log("Content-Type:", req.headers['content-type']);
        console.log("Request body:", req.body);
        console.log("Request file:", req.file);
        console.log("user id ----->", userId);
        console.log("post_category ----->", post_category);

        // First, get the category ID from the category name
        const category = await Category.findOne({
            where: {
                name: {
                    [Op.iLike]: post_category.trim()  // Case-insensitive and trim whitespace
                }
            }
        });
        console.log("found category ----->", category);

        if (!category) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid category',
                received_category: post_category,
                available_categories: ['Technology', 'Entertainment', 'Sports', 'Education', 'Lifestyle', 'Business', 'Health', 'Travel', 'Science', 'Art']
            });
        }

        // Handle file upload
        let video_url = '';
        let fileType = 'text';

        if (req.file) {
            // File was uploaded successfully using the fileUpload middleware
            video_url = `/uploads/${req.file.filename}`;
            fileType = req.file.mimetype.startsWith('image') ? 'image' : 'video';
            console.log("File uploaded successfully:", {
                filename: req.file.filename,
                mimetype: req.file.mimetype,
                size: req.file.size,
                path: req.file.path
            });
        } else {
            console.log("No file was uploaded. Check if the request is using multipart/form-data and the file field is named 'file'");
        }

        const post = await Post.create({
            user_id: userId,
            status: 'pending',
            category_id: category.id,  // Use the category ID instead of name
            title,
            description: caption,
            uploadDate: new Date(),
            type: fileType,
            video_url,
            content: caption
        });

        // Add full URL in response
        const fullUrl = video_url ? `${req.protocol}://${req.get('host')}${video_url}` : '';

        // Update user's post count
        await User.increment('posts_count', {
            where: { id: userId }
        });

        res.status(201).json({
            status: 'success',
            data: { 
                post: {
                    ...post.toJSON(),
                    video_url: fullUrl
                }
            }
        });
    } catch (error) {
        console.error('Post creation error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error creating post',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getAllPosts = async (req, res) => {
    try {
        const posts = await Post.findAll({
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'username']
                },
                {
                    model: Category,
                    as: 'category',
                    attributes: ['id', 'name']
                }
            ]
        });

        // Add full URLs for files
        const postsWithUrls = posts.map(post => {
            const postData = post.toJSON();
            if (postData.url) {
                postData.fullUrl = `${process.env.API_BASE_URL || 'http://localhost:3000'}${postData.url}`;
            }
            return postData;
        });

        res.json({
            status: 'success',
            data: postsWithUrls
        });
    } catch (error) {
        console.error('Error getting posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error getting posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getPostById = async (req, res) => {
    try {
        const post = await Post.findByPk(req.params.id, {
            include: [
                {
                    model: User,
                    as: 'uploader',
                    attributes: ['id', 'username']
                },
                {
                    model: Category,
                    attributes: ['id', 'name']
                }
            ]
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
        console.error('Error getting post:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching post'
        });
    }
};

exports.updatePost = async (req, res) => {
    try {
        const post = await Post.findOne({
            where: { 
                id: req.params.id,
                uploaderId: req.user.id
            }
        });

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found'
            });
        }

        await post.update(req.body);

        res.json({
            status: 'success',
            data: { post }
        });
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating post'
        });
    }
};

exports.deletePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const userID = req.user.id;

        const post = await Post.findOne({
            where: {
                id: postId,
                user_id: userID
            }
        });

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found or unauthorized'
            });
        }

        await post.destroy();

        // Update user's post count
        await User.decrement('posts_count', {
            where: { id: userID }
        });

        res.json({
            status: 'success',
            message: 'Post deleted successfully'
        });
    } catch (error) {
        console.error('Post deletion error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error deleting post'
        });
    }
};

exports.getPostsByUser = async (req, res) => {
    try {

        console.log("user id -->", req.user.id);

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

        res.json({
            status: 'success',
            data: posts
        });

    } catch (error) {
        console.error('Error fetching user posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching user posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getPendingPosts = async (req, res) => {
    try {
        const posts = await Post.findAll({
            where: { status: 'pending' },
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username']
                },
                {
                    model: Category,
                    as: 'category'
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Process media URLs
        const processedPosts = posts.map(post => {
            const postObj = post.toJSON();
            if (postObj.mediaUrl && !postObj.mediaUrl.startsWith('http')) {
                postObj.mediaUrl = `/uploads/${postObj.mediaUrl.replace(/^uploads\//, '')}`;
            }
            return postObj;
        });

        res.json({
            status: 'success',
            data: processedPosts
        });

    } catch (error) {
        console.error('Error fetching pending posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching posts'
        });
    }
};

exports.updatePostStatus = async (req, res) => {
    try {
        console.log('Updating post status:', req.params.id, req.body); // Debug log

        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid status value'
            });
        }

        const post = await Post.findByPk(id);

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found'
            });
        }

        const updateData = { status };
        if (status === 'rejected' && rejectionReason) {
            updateData.rejectionReason = rejectionReason;
        }

        await post.update(updateData);

        // Fetch updated post with associations
        const updatedPost = await Post.findByPk(id, {
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username']
                },
                {
                    model: Category,
                    as: 'category'
                }
            ]
        });

        console.log('Post updated:', updatedPost); // Debug log

        res.json({
            status: 'success',
            message: 'Post status updated successfully',
            data: updatedPost
        });

    } catch (error) {
        console.error('Error updating post status:', error); // Debug log
        res.status(500).json({
            status: 'error',
            message: 'Error updating post status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getUserPendingPosts = async (req, res) => {
    try {
        const posts = await Post.findAll({
            where: {
                userId: req.user.id,
                status: 'pending'
            },
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username']
                },
                {
                    model: Category,
                    as: 'category'
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        console.log(`Found ${posts.length} pending posts for user ${req.user.id}`);

        res.json({
            status: 'success',
            data: posts
        });

    } catch (error) {
        console.error('Error fetching user pending posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching pending posts'
        });
    }
};

exports.getUserPosts = async (req, res) => {
    try {
        console.log("user id ----->", req.user.id);
        console.log("user id type ----->", typeof req.user.id);
        
        const posts = await Post.findAll({
            where: { 
                user_id: req.user.id
            },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['username', 'email']
                },
                {
                    model: PostLike,
                    attributes: ['user_id'],
                    required: false
                }
            ],
            order: [['created_at', 'DESC']]
        });

        // Add full URLs for files
        const postsWithUrls = posts.map(post => {
            const postData = post.toJSON();
            if (postData.video_url) {
                postData.fullUrl = `${req.protocol}://${req.get('host')}${postData.video_url}`;
            }
            console.log(` Posts: ${JSON.stringify(postData)}`)
            return postData;
        });
        console.log(` Posts: ${JSON.stringify(postsWithUrls)}`)
        res.json({
          
            status: 'success',
            data: { posts: postsWithUrls }
        });
    } catch (error) {
        console.error('Posts fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getApprovedPosts = async (req, res) => {
    try {
        const posts = await Post.findAll({
            where: { status: 'approved' },
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username']
                },
                {
                    model: Category,
                    as: 'category'
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const processedPosts = posts.map(post => {
            const postObj = post.toJSON();
            if (postObj.mediaUrl && !postObj.mediaUrl.startsWith('http')) {
                postObj.mediaUrl = `/uploads/${postObj.mediaUrl.replace(/^uploads\//, '')}`;
            }
            return postObj;
        });

        res.json({
            status: 'success',
            data: processedPosts
        });

    } catch (error) {
        console.error('Error fetching approved posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching posts'
        });
    }
};

exports.getUserApprovedPosts = async (req, res) => {
    try {
        const posts = await Post.findAll({
            where: {
                userId: req.user.id,
                status: 'approved'
            },
            include: [
                {
                    model: Category,
                    as: 'category'
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({
            status: 'success',
            data: posts
        });
    } catch (error) {
        console.error('Error fetching approved posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching posts'
        });
    }
};

exports.getUserRejectedPosts = async (req, res) => {
    try {
        const posts = await Post.findAll({
            where: {
                userId: req.user.id,
                status: 'rejected'
            },
            include: [
                {
                    model: Category,
                    as: 'category'
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({
            status: 'success',
            data: posts
        });
    } catch (error) {
        console.error('Error fetching rejected posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching posts'
        });
    }
};

exports.getRejectedPosts = async (req, res) => {
    try {
        const posts = await Post.findAll({
            where: { status: 'rejected' },
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username']
                },
                {
                    model: Category,
                    as: 'category'
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const processedPosts = posts.map(post => {
            const postObj = post.toJSON();
            if (postObj.mediaUrl && !postObj.mediaUrl.startsWith('http')) {
                postObj.mediaUrl = `/uploads/${postObj.mediaUrl.replace(/^uploads\//, '')}`;
            }
            return postObj;
        });

        res.json({
            status: 'success',
            data: processedPosts
        });

    } catch (error) {
        console.error('Error fetching rejected posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching posts'
        });
    }
};

exports.approvePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const post = await Post.findByPk(postId);
        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found'
            });
        }

        await post.update({ status: 'approved' });

        res.json({
            status: 'success',
            message: 'Post approved successfully',
            data: post
        });

    } catch (error) {
        console.error('Error approving post:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error approving post'
        });
    }
};

exports.rejectPost = async (req, res) => {
    try {
        const postId = req.params.id;
        const { reason } = req.body;

        const post = await Post.findByPk(postId);

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found'
            });
        }

        await post.update({ 
            status: 'rejected',
            rejectionReason: reason
        });

        res.json({
            status: 'success',
            message: 'Post rejected successfully',
            data: post
        });

    } catch (error) {
        console.error('Error rejecting post:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error rejecting post'
        });
    }
};

exports.getPosts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const offset = (page - 1) * limit;
        const categoryId = req.query.category || null;
        const sort = req.query.sort || 'latest';

        let whereClause = {
            status: 'approved'
        };

        if (categoryId) {
            whereClause.categoryId = categoryId;
        }

        const order = sort === 'oldest' ? [['createdAt', 'ASC']] : [['createdAt', 'DESC']];

        const posts = await Post.findAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username']
                },
                {
                    model: Category,
                    as: 'category'
                }
            ],
            order: order,
            limit: limit,
            offset: offset
        });

        const processedPosts = posts.map(post => {
            const postObj = post.toJSON();
            if (postObj.mediaUrl && !postObj.mediaUrl.startsWith('http')) {
                postObj.mediaUrl = `/uploads/${postObj.mediaUrl.replace(/^uploads\//, '')}`;
            }
            return postObj;
        });

        res.json({
            status: 'success',
            data: processedPosts,
            pagination: {
                page,
                limit,
                hasMore: posts.length === limit
            }
        });

    } catch (error) {
        console.error('Error in getPosts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching posts'
        });
    }
};

exports.getPost = async (req, res) => {
    try {
        const post = await Post.findByPk(req.params.id, {
            include: [
                {
                    model: User,
                    as: 'uploader',
                    attributes: ['id', 'username']
                },
                {
                    model: Category,
                    attributes: ['id', 'name']
                }
            ]
        });

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found'
            });
        }

        // Include the full URL for the file
        const postData = post.toJSON();
        if (postData.url) {
            // Ensure the URL is properly formatted
            postData.fullUrl = `${req.protocol}://${req.get('host')}${postData.url}`;
        }

        res.json({
            status: 'success',
            data: { post: postData }
        });
    } catch (error) {
        console.error('Error getting post:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching post',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.likePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const userID = req.user.id; // Using username instead of ID since PostLike uses username
        console.log("username ----->", userID);

        // Check if like exists using raw SQL
        const [existingLike] = await sequelize.query(
            `SELECT * FROM post_likes 
             WHERE post_id = $1 AND user_id = $2`,
            {
                bind: [postId, userID],
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (existingLike) {
            // Unlike - Delete the like and decrement count
            await sequelize.query(
                `DELETE FROM post_likes 
                 WHERE post_id = $1 AND user_id = $2`,
                {
                    bind: [postId, userID],
                    type: sequelize.QueryTypes.DELETE
                }
            );
            
            await sequelize.query(
                `UPDATE posts 
                 SET likes = likes - 1 
                 WHERE id = $1`,
                {
                    bind: [postId],
                    type: sequelize.QueryTypes.UPDATE
                }
            );
        } else {
            // Like - Create new like and increment count
            await sequelize.query(
                `INSERT INTO post_likes (post_id, user_id, like_date)
                 VALUES ($1, $2, $3)`,
                {
                    bind: [postId, userID, new Date()],
                    type: sequelize.QueryTypes.INSERT
                }
            );

            await sequelize.query(
                `UPDATE posts 
                 SET likes = likes + 1 
                 WHERE id = $1`,
                {
                    bind: [postId],
                    type: sequelize.QueryTypes.UPDATE
                }
            );

            // Get post owner's ID for notification
            const [post] = await sequelize.query(
                `SELECT user_id FROM posts WHERE id = $1`,
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
                            post.user_id,
                            `${userID} liked your post`,
                            new Date(),
                            false
                        ],
                        type: sequelize.QueryTypes.INSERT
                    }
                );
            }
        }

        res.json({
            status: 'success',
            message: existingLike ? 'Post unliked successfully' : 'Post liked successfully'
        });
    } catch (error) {
        console.error('Like/Unlike error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error processing like/unlike'
        });
    }
};

exports.addComment = async (req, res) => {
    try {
        const { postId } = req.params;
        const { commentText } = req.body;
        const username = req.user.username;

        const result = await db.query(
            `INSERT INTO comments (
                commentor_id, 
                post_id, 
                comment_text
            ) VALUES ($1, $2, $3)
            RETURNING *`,
            [username, postId, commentText]
        );

        // Update post's comment count
        await db.query(
            'UPDATE posts SET comments = comments + 1 WHERE uniqueTraceability_id = $1',
            [postId]
        );

        res.status(201).json({
            status: 'success',
            data: {
                comment: result.rows[0]
            }
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error adding comment'
        });
    }
};

exports.getPostComments = async (req, res) => {
    try {
        const { postId } = req.params;

      

        const result = await Comment.findAll({
            where: { post_id: postId },
            include: [
                { model: User, as: 'commentor', attributes: ['username'] }
            ],
            order: [['comment_date', 'DESC']]
        });



        res.json({
            status: 'success',
            data: {
                comments: result.rows
            }
        });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching comments'
        });
    }
}; 