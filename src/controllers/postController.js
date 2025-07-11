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
const { addWatermarkToVideo } = require('../utils/videoProcessor');
const { createClient } = require('@supabase/supabase-js');
const os = require('os');
const fs = require('fs').promises;

// Remove the applyWatermarkAsync function and all calls to it

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
        let filePath = '';
        let mimetype = '';
        if (req.file) {
            // File was uploaded to Supabase
            video_url = req.file.supabaseUrl || '';
            fileType = req.file.mimetype.startsWith('image') ? 'image' : 'video';
            filePath = req.file.path;
            mimetype = req.file.mimetype;
            console.log("File uploaded successfully to Supabase:", {
                url: req.file.supabaseUrl,
                filename: req.file.filename,
                path: req.file.path,
                mimetype: req.file.mimetype,
                size: req.file.size
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

        // Update user's post count
        await User.increment('posts_count', {
            where: { id: userId }
        });

        res.status(201).json({
            status: 'success',
            data: { 
                post: {
                    ...post.toJSON(),
                    video_url: video_url // Already the full Supabase URL
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
            where: {
                status: 'approved'
            },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'username', 'profile_picture']
                },
                {
                    model: Category,
                    as: 'category',
                    attributes: ['id', 'name']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Add full URLs for files
        const postsWithUrls = posts.map(post => {
            const postData = post.toJSON();
            if (postData.video_url) {
                postData.fullUrl = `${process.env.API_BASE_URL || 'http://localhost:3000'}${postData.video_url}`;
            }
            return postData;
        });
        // console.log("postsWithUrls ----->", postsWithUrls)

        res.json({
            status: 'success',
            data: postsWithUrls,
           
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
        const postId = req.params.postId;
        console.log("postId ----->", postId);
        console.log(`Attempting to find post with ID: ${postId}`);
        
        // First, try a simpler query without associations
        const postExists = await Post.findByPk(postId);
        
        if (!postExists) {
            console.log(`Post with ID ${postId} not found in database using Sequelize`);
            
            // Try with raw SQL as a fallback
            const [rawPost] = await sequelize.query(
                `SELECT * FROM posts WHERE id = :postId`,
                {
                    replacements: { postId },
                    type: sequelize.QueryTypes.SELECT
                }
            );
            
            if (!rawPost) {
                console.log(`Post with ID ${postId} not found with raw SQL either`);
                return res.status(404).json({
                    status: 'error',
                    message: 'Post not found'
                });
            }
            
            console.log(`Post found with raw SQL: ${JSON.stringify(rawPost)}`);
            
            // Get user info with raw SQL
            const [user] = await sequelize.query(
                `SELECT id, username, email FROM users WHERE id = :userId`,
                {
                    replacements: { userId: rawPost.user_id },
                    type: sequelize.QueryTypes.SELECT
                }
            );
            
            // Get category info with raw SQL
            const [category] = await sequelize.query(
                `SELECT id, name FROM categories WHERE id = :categoryId`,
                {
                    replacements: { categoryId: rawPost.category_id },
                    type: sequelize.QueryTypes.SELECT
                }
            );
            
            // Combine the results
            rawPost.user = user || null;
            rawPost.category = category || null;
            
            return res.json({
                status: 'success',
                data: { post: rawPost }
            });
        }
        
        console.log(`Post exists in database: ${postExists.id}`);
        
        // Now try with associations
        const post = await Post.findByPk(postId, {
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
            ]
        });

        if (!post) {
            console.log(`Post found but association query failed`);
            return res.status(404).json({
                status: 'error',
                message: 'Post found but association query failed'
            });
        }

        console.log(`Post with associations retrieved successfully`);
        res.json({
            status: 'success',
            data: { post }
        });
    } catch (error) {
        console.error('Error getting post:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching post',
            details: error.message
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
    let t = await sequelize.transaction();
    
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        
        try {
            // Try to insert first - if it exists, it will throw a unique constraint error
            await sequelize.query(
                `INSERT INTO post_likes (post_id, user_id, like_date)
                 VALUES ($1, $2, $3)`,
                {
                    bind: [postId, userId, new Date()],
                    type: sequelize.QueryTypes.INSERT,
                    transaction: t
                }
            );

            // If we get here, the insert succeeded (post was not previously liked)
            // Increment post's like count
            await sequelize.query(
                `UPDATE posts SET likes = likes + 1 WHERE id = $1`,
                {
                    bind: [postId],
                    type: sequelize.QueryTypes.UPDATE,
                    transaction: t
                }
            );

            await t.commit();
            
            return res.json({
                status: 'success',
                message: 'Post liked successfully',
                action: 'liked'
            });
            
        } catch (insertError) {
            // We need to rollback the current transaction since it's in an error state
            await t.rollback();
            
            // Check if this is a unique constraint violation
            if (insertError.name === 'SequelizeUniqueConstraintError' || 
                (insertError.original && insertError.original.code === '23505')) {
                
                // Start a new transaction for the unlike operation
                t = await sequelize.transaction();
                
                try {
                    // This means the user already liked the post, so we should unlike it
                await sequelize.query(
                        `DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`,
                    {
                            bind: [postId, userId],
                            type: sequelize.QueryTypes.DELETE,
                            transaction: t
                    }
                );

                    // Decrement post's like count
                    await sequelize.query(
                        `UPDATE posts SET likes = GREATEST(likes - 1, 0) WHERE id = $1`,
            {
                bind: [postId],
                            type: sequelize.QueryTypes.UPDATE,
                            transaction: t
            }
        );

                    await t.commit();
                    
                    return res.json({
            status: 'success',
                        message: 'Post unliked successfully',
                        action: 'unliked'
        });
                } catch (unlikeError) {
                    await t.rollback();
                    throw unlikeError;
                }
            } else {
                // Some other error occurred, not related to unique constraint
                throw insertError;
            }
        }
        
    } catch (error) {
        // Make sure any active transaction is rolled back
        if (t && !t.finished) {
            await t.rollback();
        }
        console.error('Like/Unlike error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error liking/unliking post'
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
            'UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1',
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

        const comments = await Comment.findAll({
            where: { post_id: postId },
            include: [
                { 
                    model: User,
                    attributes: ['id', 'username']
                }
            ],
            order: [['comment_date', 'DESC']]
        });

        res.json({
            status: 'success',
            data: {
                comments
            }
        });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching comments',
            details: error.message
        });
    }
};

exports.checkLikeStatus = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;

        // Check if like exists using raw SQL
        const [existingLike] = await sequelize.query(
            `SELECT * FROM post_likes 
             WHERE post_id = $1 AND user_id = $2 
             LIMIT 1`,
            {
                bind: [postId, userId],
                type: sequelize.QueryTypes.SELECT
            }
        );

        res.json({
            status: 'success',
            data: {
                hasLiked: !!existingLike,
                likeDate: existingLike ? existingLike.like_date : null
            }
        });
    } catch (error) {
        console.error('Like status check error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error checking like status',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.searchPosts = async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.trim() === '') {
            return res.json({
                status: 'success',
                data: []
            });
        }

        // Search posts by title or description, only return approved posts
        const posts = await Post.findAll({
            where: {
                status: 'approved',
                [Op.or]: [
                    {
                        title: {
                            [Op.iLike]: `%${q}%`
                        }
                    },
                    {
                        description: {
                            [Op.iLike]: `%${q}%`
                        }
                    }
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
            limit: 20
        });

        // Add full URLs for videos
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
            message: 'Error searching posts',
            data: []
        });
    }
};

exports.getLikedPosts = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get posts liked by the authenticated user
        const likedPosts = await sequelize.query(
            `SELECT 
                p.id, 
                p.title, 
                p.status, 
                p.video_url as image,
                p.video_url, 
                u.id as user_id, 
                u.username, 
                u.profile_picture as avatar,
                p.likes as likes_count, 
                p.comment_count as comments_count, 
                p.created_at
            FROM posts p
            JOIN post_likes pl ON p.id = pl.post_id
            JOIN users u ON p.user_id = u.id
            WHERE pl.user_id = $1 AND p.status = 'approved'
            ORDER BY pl.like_date DESC`,
            {
                bind: [userId],
                type: sequelize.QueryTypes.SELECT
            }
        );

        // Process the results to match the expected response format
        const formattedPosts = likedPosts.map(post => ({
            id: post.id,
            title: post.title,
            status: post.status,
            image: post.image,
            video_url: post.video_url,
            fullUrl: post.video_url ? `${process.env.API_BASE_URL || 'http://localhost:3000'}${post.video_url}` : null,
            user: {
                id: post.user_id,
                username: post.username,
                avatar: post.avatar
            },
            likes_count: parseInt(post.likes_count),
            comments_count: parseInt(post.comments_count),
            created_at: post.created_at
        }));

        res.json({
            status: 'success',
            message: 'Liked posts retrieved successfully',
            data: {
                posts: formattedPosts
            }
        });
    } catch (error) {
        console.error('Error fetching liked posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching liked posts',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}; 