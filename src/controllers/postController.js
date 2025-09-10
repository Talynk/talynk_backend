const { v4: uuidv4 } = require('uuid');
const path = require('path');
const prisma = require('../lib/prisma');
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
        console.log("post_category ----->", post_category)

        // Validate that the user exists
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found',
                user_id: userId
            });
        }

        console.log("User found:", user.username || user.email);

        // First, get the category ID from the category name (can be main category or subcategory)
        const category = await prisma.category.findFirst({
            where: {
                name: {
                    mode: 'insensitive',
                    equals: post_category.trim()
                },
                status: 'active'
            }
        });
        console.log("found category ----->", category);

        if (!category) {
            // Get available categories for error message
            const availableCategories = await prisma.category.findMany({
                where: { status: 'active' },
                select: { name: true, level: true, parent_id: true },
                orderBy: [
                    { level: 'asc' },
                    { sort_order: 'asc' }
                ]
            });

            return res.status(400).json({
                status: 'error',
                message: 'Invalid category',
                received_category: post_category,
                available_categories: availableCategories.map(cat => ({
                    name: cat.name,
                    level: cat.level === 1 ? 'main' : 'subcategory',
                    parent_id: cat.parent_id
                }))
            });
        }

        console.log("Category found:", category.name, "(ID:", category.id + ")");

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

        const post = await prisma.post.create({
            data: {
            user_id: userId,
            status: 'approved', // Posts are now active by default
            category_id: category.id,  // Use the category ID instead of name
            title,
            description: caption,
            uploadDate: new Date(),
            type: fileType,
            video_url,
            content: caption
            }
        });

        console.log("Post created successfully:", post.id);

        // Update user's post count
        await prisma.user.update({
            where: { id: userId },
            data: {
                posts_count: {
                    increment: 1
                }
            }
        });

        res.status(201).json({
            status: 'success',
            data: { 
                post: {
                    ...post,
                    video_url: video_url // Already the full Supabase URL
                }
            }
        });
    } catch (error) {
        console.error('Post creation error:', error);
        
        // Handle specific Prisma errors
        if (error.code === 'P2003') {
            return res.status(400).json({
                status: 'error',
                message: 'Foreign key constraint violation. User or category not found.',
                details: error.meta
            });
        }
        
        if (error.code === 'P2002') {
            return res.status(400).json({
                status: 'error',
                message: 'Unique constraint violation. Post with this data already exists.',
                details: error.meta
            });
        }
        
        res.status(500).json({
            status: 'error',
            message: 'Error creating post',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getAllPosts = async (req, res) => {
    try {
        const { country_id, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        // Build where clause
        const whereClause = {
            status: 'approved',
            is_frozen: false
        };

        // Add country filter if provided
        if (country_id) {
            whereClause.user = {
                country_id: parseInt(country_id)
            };
        }

        const [posts, total] = await Promise.all([
            prisma.post.findMany({
                where: whereClause,
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            profile_picture: true,
                            country: {
                                select: {
                                    id: true,
                                    name: true,
                                    code: true,
                                    flag_emoji: true
                                }
                            }
                        }
                    },
                    category: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: whereClause
            })
        ]);

        // Add full URLs for files (Supabase URLs are already complete)
        const postsWithUrls = posts.map(post => {
            if (post.video_url) {
                post.fullUrl = post.video_url; // Supabase URL is already complete
            }
            return post;
        });

        res.json({
            status: 'success',
            data: {
                posts: postsWithUrls,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit)
                },
                filters: {
                    country_id: country_id ? parseInt(country_id) : null
                }
            }
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
        
        const post = await prisma.post.findUnique({
            where: { id: postId },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        profile_picture: true
                    }
                },
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                },
                comments: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                profile_picture: true
                            }
                        }
                    },
                    orderBy: {
                        comment_date: 'desc'
                    }
                },
                _count: {
                    select: {
                        postLikes: true,
                        comments: true
                    }
                }
            }
        });

        if (!post) {
            console.log(`Post with ID ${postId} not found`);
            return res.status(404).json({
                status: 'error',
                message: 'Post not found'
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
        const postId = req.params.id;
        const userId = req.user.id;

        // Check if post exists and belongs to user
        const existingPost = await prisma.post.findFirst({
            where: { 
                id: postId,
                user_id: userId
            }
        });

        if (!existingPost) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found or you do not have permission to update it'
            });
        }

        const updatedPost = await prisma.post.update({
            where: { id: postId },
            data: req.body,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                },
                category: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        res.json({
            status: 'success',
            data: { post: updatedPost }
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

        // Check if post exists and belongs to user
        const post = await prisma.post.findFirst({
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

        // Delete the post (this will cascade delete related records)
        await prisma.post.delete({
            where: { id: postId }
        });

        // Update user's post count
        await prisma.user.update({
            where: { id: userID },
            data: {
                posts_count: {
                    decrement: 1
                }
            }
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

        const posts = await prisma.post.findMany({
            where: { user_id: req.user.id },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                },
                _count: {
                    select: {
                        postLikes: true,
                        comments: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
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
        const posts = await prisma.post.findMany({
            where: { status: 'pending' },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                },
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                },
                _count: {
                    select: {
                        postLikes: true,
                        comments: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Process media URLs
        const processedPosts = posts.map(post => {
            const postObj = { ...post };
            if (postObj.video_url && !postObj.video_url.startsWith('http')) {
                postObj.video_url = `/uploads/${postObj.video_url.replace(/^uploads\//, '')}`;
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

        const post = await prisma.post.findUnique({
            where: { id: id }
        });

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found'
            });
        }

        const updateData = { 
            status: status,
            approved_at: status === 'approved' ? new Date() : null
        };

        const updatedPost = await prisma.post.update({
            where: { id: id },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                },
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                }
            }
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
        const posts = await prisma.post.findMany({
            where: {
                user_id: req.user.id,
                status: 'pending'
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                },
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                },
                _count: {
                    select: {
                        postLikes: true,
                        comments: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
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
        
        const posts = await prisma.post.findMany({
            where: { 
                user_id: req.user.id
            },
            include: {
                user: {
                    select: {
                        username: true,
                        email: true,
                        profile_picture: true
                    }
                },
                category: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                postLikes: {
                    select: {
                        user_id: true
                    }
                },
                _count: {
                    select: {
                        postLikes: true,
                        comments: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Add full URLs for files (Supabase URLs are already complete)
        const postsWithUrls = posts.map(post => {
            const postData = { ...post };
            if (postData.video_url) {
                postData.fullUrl = postData.video_url; // Supabase URL is already complete
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
        const posts = await prisma.post.findMany({
            where: { status: 'approved' },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                },
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                },
                _count: {
                    select: {
                        postLikes: true,
                        comments: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
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

        // Include the full URL for the file (Supabase URLs are already complete)
        const postData = post.toJSON();
        if (postData.url) {
            postData.fullUrl = postData.url; // Supabase URL is already complete
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

// Like functionality moved to likeController.js
// Use /api/likes/posts/:postId/toggle endpoint instead
exports.likePost = async (req, res) => {
    res.status(410).json({
        status: 'deprecated',
        message: 'This endpoint is deprecated. Please use /api/likes/posts/:postId/toggle instead'
    });
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

// Like status check moved to likeController.js
// Use /api/likes/posts/:postId/status endpoint instead
exports.checkLikeStatus = async (req, res) => {
    res.status(410).json({
        status: 'deprecated',
        message: 'This endpoint is deprecated. Please use /api/likes/posts/:postId/status instead'
    });
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

        // Add full URLs for videos (Supabase URLs are already complete)
        const postsWithUrls = posts.map(post => {
            const postData = post.toJSON();
            if (postData.video_url) {
                postData.fullUrl = postData.video_url; // Supabase URL is already complete
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

// Liked posts functionality moved to likeController.js
// Use /api/likes/user/liked endpoint instead
exports.getLikedPosts = async (req, res) => {
    res.status(410).json({
        status: 'deprecated',
        message: 'This endpoint is deprecated. Please use /api/likes/user/liked instead'
    });
}; 