const { v4: uuidv4, validate: isUuid } = require('uuid');
const path = require('path');
const prisma = require('../lib/prisma');
const { processWatermarkAsync } = require('../utils/videoProcessor');
const { createClient } = require('@supabase/supabase-js');
const os = require('os');
const fs = require('fs').promises;
const { 
    CACHE_KEYS, 
    getFollowingPostsCache, 
    setFollowingPostsCache,
    getAllPostsCache,
    setAllPostsCache,
    getSinglePostCache,
    setSinglePostCache,
    getSearchCache,
    setSearchCache,
    clearCacheByPattern 
} = require('../utils/cache');
const { emitEvent } = require('../lib/realtime');

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

        // Determine post status: draft if status is provided as 'draft', otherwise 'active' (published immediately)
        const postStatus = req.body.status === 'draft' ? 'draft' : 'active';

        // Check draft limit: users can only have a maximum of 3 draft posts
        if (postStatus === 'draft') {
            const draftCount = await prisma.post.count({
                where: {
                    user_id: userId,
                    status: 'draft'
                }
            });

            if (draftCount >= 3) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Maximum draft limit reached',
                    details: 'You can only have a maximum of 3 draft posts. Please publish or delete existing drafts before creating a new one.',
                    currentDraftCount: draftCount,
                    maxDrafts: 3
                });
            }
        }
        // Handle file upload
        let video_url = '';
        let fileType = 'text';
        let filePath = '';
        let mimetype = '';
        if (req.file) {
            // File was uploaded to R2 (or local storage as fallback)
            video_url = req.file.r2Url || req.file.localUrl || req.file.supabaseUrl || '';
            fileType = req.file.mimetype.startsWith('image') ? 'image' : 'video';
            filePath = req.file.path;
            mimetype = req.file.mimetype;
            console.log("File uploaded successfully:", {
                url: video_url,
                filename: req.file.filename,
                path: req.file.path,
                mimetype: req.file.mimetype,
                size: req.file.size,
                storage: req.file.r2Url ? 'R2' : 'local'
            });
        } else {
            console.log("No file was uploaded. Check if the request is using multipart/form-data and the file field is named 'file'");
        }

        const post = await prisma.post.create({
            data: {
            user_id: userId,
            status: postStatus, // Default to active (published immediately), can be set to draft
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

        // Optionally link post to challenge if challenge_id is provided
        let challengePost = null;
        if (req.body.challenge_id) {
            try {
                const challengeId = req.body.challenge_id;
                
                // Check if challenge exists and is active
                const challenge = await prisma.challenge.findUnique({
                    where: { id: challengeId }
                });

                if (challenge && (challenge.status === 'active' || challenge.status === 'approved')) {
                    // Check if user is a participant
                    const participant = await prisma.challengeParticipant.findUnique({
                        where: {
                            unique_challenge_participant: {
                                challenge_id: challengeId,
                                user_id: userId
                            }
                        }
                    });

                    if (participant) {
                        // Check if post is already linked
                        const existingLink = await prisma.challengePost.findUnique({
                            where: {
                                unique_challenge_post: {
                                    challenge_id: challengeId,
                                    post_id: post.id
                                }
                            }
                        });

                        if (!existingLink) {
                            challengePost = await prisma.challengePost.create({
                                data: {
                                    challenge_id: challengeId,
                                    post_id: post.id,
                                    user_id: userId
                                }
                            });
                            console.log("Post linked to challenge:", challengeId);
                        }
                    } else {
                        console.log("User is not a participant in the challenge, skipping link");
                    }
                } else {
                    console.log("Challenge not found or not active, skipping link");
                }
            } catch (error) {
                console.error("Error linking post to challenge:", error);
                // Don't fail post creation if challenge linking fails
            }
        }

        // Update user's post count
        await prisma.user.update({
            where: { id: userId },
            data: {
                posts_count: {
                    increment: 1
                }
            }
        });

        // Clear relevant caches
        await clearCacheByPattern('following_posts');
        await clearCacheByPattern('featured_posts');
        await clearCacheByPattern('all_posts');
        await clearCacheByPattern('search_posts');

        emitEvent('post:created', { postId: post.id, userId: userId });

        // Process video watermarking asynchronously (non-blocking)
        // This happens in the background and updates the post when complete
        // Note: Watermarking only works for local files, not R2 files
        if (req.file && fileType === 'video' && filePath && !req.file.r2Url) {
            // Only process watermarking if file is stored locally (not in R2)
            // Resolve full path to uploaded video file
            // filePath is either relative (uploads/filename) or absolute
            const fullInputPath = path.isAbsolute(filePath) 
                ? filePath 
                : path.join(process.cwd(), filePath);
            
            // Verify file exists before processing
            fs.access(fullInputPath)
                .then(() => {
                    // Process watermarking in background (don't await - non-blocking)
                    processWatermarkAsync(
                        fullInputPath,
                        post.id,
                        async (watermarkedUrl) => {
                            // Update post with watermarked video URL
                            try {
                                await prisma.post.update({
                                    where: { id: post.id },
                                    data: { video_url: watermarkedUrl }
                                });
                                console.log(`[WATERMARK] ✅ Updated post ${post.id} with watermarked video: ${watermarkedUrl}`);
                            } catch (error) {
                                console.error(`[WATERMARK] ❌ Failed to update post ${post.id} with watermarked URL:`, error);
                            }
                        }
                    ).catch(error => {
                        console.error(`[WATERMARK] Background watermarking failed for post ${post.id}:`, error);
                        // Post remains with original video - not a critical failure
                    });
                })
                .catch(error => {
                    console.warn(`[WATERMARK] Video file not found at ${fullInputPath}, skipping watermarking:`, error.message);
                });
        } else if (req.file && fileType === 'video' && req.file.r2Url) {
            console.log(`[WATERMARK] Skipping watermarking for R2-stored video (post ${post.id}) - watermarking requires local file access`);
        }

        res.status(201).json({
            status: 'success',
            data: { 
                post: {
                    ...post,
                    video_url: video_url, // Original video URL (will be updated when watermarking completes)
                    challenge_linked: challengePost ? true : false,
                    challenge_id: challengePost ? challengePost.challenge_id : null
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
        const { 
            country_id, 
            page = 1, 
            limit = 20, 
            sort = 'default', // default, newest, oldest, most_liked, most_viewed, most_commented
            status = 'active', // active, all, pending, suspended
            category_id,
            featured_first = 'true' // true by default
        } = req.query;
        
        const offset = (page - 1) * limit;
        const shouldFeatureFirst = featured_first === 'true';

        // Create cache key with all parameters
        const cacheKey = `${CACHE_KEYS.ALL_POSTS}_${page}_${limit}_${sort}_${status}_${category_id || 'all'}_${country_id || 'all'}_${featured_first}`;
        
        // Try to get from cache first
        const cachedData = await getAllPostsCache(cacheKey);
        if (cachedData) {
            console.log('Serving all posts from cache');
            return res.json({
                status: 'success',
                data: cachedData,
                cached: true
            });
        }

        // Build base where clause
        const baseWhereClause = {
            is_frozen: false
        };

        // Filter by status - ensure valid PostStatus enum value
        if (status && status !== 'all') {
            // Validate status is a valid PostStatus enum value
            if (['draft', 'active', 'suspended'].includes(status)) {
                baseWhereClause.status = status;
            } else {
                baseWhereClause.status = 'active';
            }
        } else if (status === 'all') {
            // Include all statuses except frozen
        } else {
            baseWhereClause.status = 'active';
        }

        // Filter by category
        if (category_id) {
            baseWhereClause.category_id = parseInt(category_id);
        }

        // Determine sort order for non-featured posts
        let orderBy = {};
        switch (sort) {
            case 'newest':
                orderBy = { createdAt: 'desc' };
                break;
            case 'oldest':
                orderBy = { createdAt: 'asc' };
                break;
            case 'most_liked':
                orderBy = { likes: 'desc' };
                break;
            case 'most_viewed':
                orderBy = { views: 'desc' };
                break;
            case 'most_commented':
                orderBy = { comment_count: 'desc' };
                break;
            case 'default':
            default:
                // Default: most liked for non-featured posts
                orderBy = { likes: 'desc' };
                break;
        }

        const currentDate = new Date();

        // Get featured posts first (if featured_first is true)
        let featuredPosts = [];
        let featuredPostIds = [];
        
        if (shouldFeatureFirst) {
            // Get all active featured posts from FeaturedPost table that haven't expired
            // Build post filter explicitly to ensure enum types are correct
            const postFilter = {
                is_frozen: false
            };
            
            // Add status filter if present in baseWhereClause
            if (baseWhereClause.status) {
                postFilter.status = baseWhereClause.status;
            }
            
            // Add category filter if present
            if (baseWhereClause.category_id) {
                postFilter.category_id = baseWhereClause.category_id;
            }
            
            const activeFeaturedPosts = await prisma.featuredPost.findMany({
                where: {
                    is_active: true,
                    OR: [
                        { expires_at: null },
                        { expires_at: { gt: currentDate } }
                    ],
                    post: postFilter
                },
                include: {
                    post: {
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
                            },
                            _count: {
                                select: {
                                    comments: true,
                                    postLikes: true,
                                    postViews: true
                                }
                            }
                        }
                    },
                    admin: {
                        select: {
                            username: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc' // Featured posts by newest first
                }
            });

            featuredPosts = activeFeaturedPosts.map(fp => ({
                ...fp.post,
                isFeatured: true,
                featuredAt: fp.createdAt,
                expiresAt: fp.expires_at,
                featuredBy: fp.admin?.username,
                featuredReason: fp.reason
            }));
            
            featuredPostIds = featuredPosts.map(fp => fp.id);

            // Also get posts with is_featured: true that don't have FeaturedPost entries
            // (posts featured via the alternative route)
            const postsWithFeaturedFlag = await prisma.post.findMany({
                where: {
                    ...baseWhereClause,
                    is_featured: true,
                    id: {
                        notIn: featuredPostIds // Exclude already found featured posts
                    }
                },
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
                    },
                    _count: {
                        select: {
                            comments: true,
                            postLikes: true,
                            postViews: true
                        }
                    }
                },
                orderBy: {
                    featured_at: 'desc' // Sort by when it was featured
                }
            });

            // Add posts with is_featured flag to featured posts list
            const additionalFeatured = postsWithFeaturedFlag.map(post => ({
                ...post,
                isFeatured: true,
                featuredAt: post.featured_at || post.createdAt,
                expiresAt: null,
                featuredBy: null,
                featuredReason: null
            }));

            featuredPosts = [...featuredPosts, ...additionalFeatured];
            featuredPostIds = featuredPosts.map(fp => fp.id);
        }

        // Build where clause for regular posts (exclude featured if featured_first is true)
        const regularWhereClause = {
            ...baseWhereClause
        };

        if (shouldFeatureFirst && featuredPostIds.length > 0) {
            regularWhereClause.id = {
                notIn: featuredPostIds
            };
        }

        // Calculate pagination for combined results
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const featuredCount = featuredPosts.length;
        
        // Determine how many featured posts to show on this page
        let featuredOnPage = [];
        let regularOffset = offset;
        let regularLimit = limitNum;
        
        if (shouldFeatureFirst && featuredCount > 0) {
            // Calculate which featured posts belong on this page
            const featuredStart = Math.max(0, offset);
            const featuredEnd = Math.min(featuredCount, offset + limitNum);
            
            if (featuredStart < featuredCount) {
                featuredOnPage = featuredPosts.slice(featuredStart, featuredEnd);
                regularLimit = limitNum - featuredOnPage.length;
                // If we've shown all featured posts, adjust offset for regular posts
                if (featuredEnd >= featuredCount) {
                    regularOffset = Math.max(0, offset - featuredCount);
                } else {
                    // Still showing featured posts, so no regular posts needed
                    regularLimit = 0;
                }
            }
        }

        // Get regular posts
        const [regularPosts, totalRegular] = await Promise.all([
            regularLimit > 0 ? prisma.post.findMany({
                where: regularWhereClause,
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
                    },
                    _count: {
                        select: {
                            comments: true,
                            postLikes: true,
                            postViews: true
                        }
                    }
                },
                orderBy: orderBy,
                take: regularLimit,
                skip: regularOffset
            }) : Promise.resolve([]),
            prisma.post.count({
                where: regularWhereClause
            })
        ]);

        // Combine featured and regular posts
        const allPosts = shouldFeatureFirst 
            ? [...featuredOnPage, ...regularPosts]
            : regularPosts;
        
        // Calculate total count
        const totalCount = shouldFeatureFirst 
            ? featuredCount + totalRegular
            : totalRegular;

        // Add full URLs for files (Supabase URLs are already complete)
        const postsWithUrls = allPosts.map(post => {
            if (post.video_url) {
                post.fullUrl = post.video_url; // Supabase URL is already complete
            }
            return post;
        });

        const responseData = {
            posts: postsWithUrls,
            pagination: {
                total: totalCount,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(totalCount / limitNum),
                featuredCount: shouldFeatureFirst ? featuredCount : 0
            },
            filters: {
                sort,
                status,
                category_id: category_id || null,
                country_id: null, // Disabled for now
                featured_first: shouldFeatureFirst
            }
        };

        // Cache the response
        await setAllPostsCache(cacheKey, responseData);

        res.json({
            status: 'success',
            data: responseData,
            cached: false
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
        
        // Check for common non-UUID route conflicts
        const reservedRoutes = ['following', 'feed', 'user', 'all', 'search'];
        if (reservedRoutes.includes(postId)) {
            console.error('Reserved route used as post ID:', postId);
            return res.status(400).json({
                status: 'error',
                message: 'Invalid post ID',
                details: `"${postId}" is a reserved route. Please use the correct endpoint: /api/follows/posts for following posts.`
            });
        }
        
        // Validate UUID format before querying Prisma
        if (!isUuid(postId)) {
            console.error('Invalid UUID format:', postId);
            return res.status(400).json({
                status: 'error',
                message: 'Invalid post ID format',
                details: `Expected UUID format, got: ${postId}. If you're trying to fetch posts from followed users, use: /api/follows/posts`
            });
        }
        
        // Create cache key
        const cacheKey = `${CACHE_KEYS.SINGLE_POST}_${postId}`;
        
        // Try to get from cache first
        const cachedData = await getSinglePostCache(cacheKey);
        if (cachedData) {
            console.log('Serving single post from cache');
            return res.json({
                status: 'success',
                data: cachedData,
                cached: true
            });
        }
        
        const post = await prisma.post.findUnique({
            where: { id: postId },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
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
                        comments: true,
                        postViews: true
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

        // Check if post is draft - only owner can view draft posts
        if (post.status === 'draft') {
            // If user is authenticated and is the owner, allow access
            if (req.user && req.user.id === post.user_id) {
                // Owner can view their own draft
            } else {
                // Non-owners cannot view draft posts
                return res.status(404).json({
                    status: 'error',
                    message: 'Post not found'
                });
            }
        }

        // Add full URL for media
        const postWithUrl = {
            ...post,
            fullUrl: post.video_url // Supabase URL is already complete
        };

        const responseData = { post: postWithUrl };

        // Cache the response
        await setSinglePostCache(cacheKey, responseData);

        console.log(`Post with associations retrieved successfully`);
        res.json({
            status: 'success',
            data: responseData,
            cached: false
        });
    } catch (error) {
        console.error('Error getting post:', error);
        
        // Handle Prisma UUID parsing errors
        if (error.message && error.message.includes('UUID') && error.message.includes('invalid character')) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid post ID format',
                details: `The provided post ID is not a valid UUID. If you're trying to fetch posts from followed users, use: /api/follows/posts`
            });
        }
        
        // Handle Prisma not found errors
        if (error.code === 'P2025') {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found'
            });
        }
        
        res.status(500).json({
            status: 'error',
            message: 'Error fetching post',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
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

        await clearCacheByPattern('single_post');
        await clearCacheByPattern('all_posts');
        await clearCacheByPattern('following_posts');
        await clearCacheByPattern('featured_posts');
        await clearCacheByPattern('search_posts');

        emitEvent('post:updated', { postId, userId });

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

        // Delete related records first (comments don't have cascade delete)
        // Delete comments
        await prisma.comment.deleteMany({
            where: { post_id: postId }
        });

        // Delete featured post associations
        await prisma.featuredPost.deleteMany({
            where: { post_id: postId }
        });

        // Note: PostLike, Share, View have cascade delete, so they'll be deleted automatically
        // Note: PostReport and PostAppeal are kept for admin review (not deleted)

        // Delete the post
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

        await clearCacheByPattern('single_post');
        await clearCacheByPattern('all_posts');
        await clearCacheByPattern('following_posts');
        await clearCacheByPattern('featured_posts');
        await clearCacheByPattern('search_posts');

        emitEvent('post:deleted', { postId, userId: userID });

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

// Deprecated: Use getUserDraftPosts instead
exports.getPendingPosts = async (req, res) => {
    try {
        const posts = await prisma.post.findMany({
            where: { status: 'draft' },
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

        if (!['draft', 'active', 'suspended'].includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid status value. Must be one of: draft, active, suspended'
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
            status: status
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

// Deprecated: Use getUserDraftPosts instead
exports.getUserPendingPosts = async (req, res) => {
    try {
        const posts = await prisma.post.findMany({
            where: {
                user_id: req.user.id,
                status: 'draft'
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

        console.log(`Found ${posts.length} draft posts for user ${req.user.id}`);

        res.json({
            status: 'success',
            data: posts
        });

    } catch (error) {
        console.error('Error fetching user pending posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching draft posts'
        });
    }
};

exports.getUserPosts = async (req, res) => {
    try {
        console.log("user id ----->", req.user.id);
        console.log("user id type ----->", typeof req.user.id);
        
        // Get active posts and drafts for the user (drafts only visible to owner)
        const posts = await prisma.post.findMany({
            where: { 
                user_id: req.user.id,
                status: {
                    in: ['active', 'draft'] // Show active posts and drafts (owner can see their drafts)
                }
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

// Get all active posts (replaces getApprovedPosts)
exports.getActivePosts = async (req, res) => {
    try {
        const posts = await prisma.post.findMany({
            where: { status: 'active' },
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

// Removed: getUserApprovedPosts, getUserRejectedPosts, getRejectedPosts
// These used Sequelize models which are not available in this Prisma-based codebase
// Use getUserPosts to get active and draft posts, or admin endpoints for suspended posts

// Removed: approvePost and rejectPost - posts are now published directly as 'active'
// Use updatePostStatus endpoint to change post status to 'active' or 'suspended'

// Deprecated: Use getAllPosts or getPostById instead
exports.getPosts = async (req, res) => {
    res.status(410).json({
        status: 'deprecated',
        message: 'This endpoint is deprecated. Please use /api/posts/all or /api/posts/:postId instead'
    });
};

// Deprecated: Use getPostById instead
exports.getPost = async (req, res) => {
    res.status(410).json({
        status: 'deprecated',
        message: 'This endpoint is deprecated. Please use /api/posts/:postId instead'
    });
};

// Like functionality moved to likeController.js
// Use /api/likes/posts/:postId/toggle endpoint instead
exports.likePost = async (req, res) => {
    res.status(410).json({
        status: 'deprecated',
        message: 'This endpoint is deprecated. Please use /api/likes/posts/:postId/toggle instead'
    });
};

// Deprecated: Comment functionality moved to commentController.js
// Use /api/comments/posts/:postId endpoint instead
exports.addComment = async (req, res) => {
    res.status(410).json({
        status: 'deprecated',
        message: 'This endpoint is deprecated. Please use /api/comments/posts/:postId instead'
    });
};

// Deprecated: Comment functionality moved to commentController.js
// Use /api/comments/posts/:postId endpoint instead
exports.getPostComments = async (req, res) => {
    res.status(410).json({
        status: 'deprecated',
        message: 'This endpoint is deprecated. Please use /api/comments/posts/:postId instead'
    });
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
        const { q, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        if (!q || q.trim() === '') {
            return res.json({
                status: 'success',
                data: {
                    posts: [],
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: 0,
                        totalCount: 0,
                        hasNext: false,
                        hasPrev: false,
                        limit: parseInt(limit)
                    }
                }
            });
        }

        // Create cache key
        const cacheKey = `${CACHE_KEYS.SEARCH_POSTS}_${q.toLowerCase()}_${page}_${limit}`;
        
        // Try to get from cache first
        const cachedData = await getSearchCache(cacheKey);
        if (cachedData) {
            console.log('Serving search results from cache');
            return res.json({
                status: 'success',
                data: cachedData,
                cached: true
            });
        }

        // Search posts by title or description, only return active posts
        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: {
                    status: 'active',
                    is_frozen: false,
                    OR: [
                        {
                            title: {
                                contains: q,
                                mode: 'insensitive'
                            }
                        },
                        {
                            description: {
                                contains: q,
                                mode: 'insensitive'
                            }
                        },
                        {
                            content: {
                                contains: q,
                                mode: 'insensitive'
                            }
                        }
                    ]
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
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
                            name: true,
                            description: true
                        }
                    },
                    _count: {
                        select: {
                            comments: true,
                            postLikes: true,
                            postViews: true
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
                where: {
                    status: 'active',
                    is_frozen: false,
                    OR: [
                        {
                            title: {
                                contains: q,
                                mode: 'insensitive'
                            }
                        },
                        {
                            description: {
                                contains: q,
                                mode: 'insensitive'
                            }
                        },
                        {
                            content: {
                                contains: q,
                                mode: 'insensitive'
                            }
                        }
                    ]
                }
            })
        ]);

        // Add full URLs for videos (Supabase URLs are already complete)
        const postsWithUrls = posts.map(post => ({
            ...post,
            fullUrl: post.video_url // Supabase URL is already complete
        }));

        const responseData = {
            posts: postsWithUrls,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount,
                hasNext: page * limit < totalCount,
                hasPrev: page > 1,
                limit: parseInt(limit)
            },
            searchQuery: q
        };

        // Cache the response
        await setSearchCache(cacheKey, responseData);

        res.json({
            status: 'success',
            data: responseData,
            cached: false
        });
    } catch (error) {
        console.error('Error searching posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error searching posts',
            data: {
                posts: [],
                pagination: {
                    currentPage: parseInt(req.query.page) || 1,
                    totalPages: 0,
                    totalCount: 0,
                    hasNext: false,
                    hasPrev: false,
                    limit: parseInt(req.query.limit) || 20
                }
            }
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



// Get posts from users that the current user follows (optimized with caching)
exports.getFollowingPosts = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, sort = 'newest' } = req.query;
        const offset = (page - 1) * limit;

        // Debug logging
        console.log('getFollowingPosts - User ID:', userId, 'Type:', typeof userId);
        console.log('getFollowingPosts - User object:', req.user);

        // Validate userId is a valid UUID
        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid user ID'
            });
        }
        

        // Additional UUID format validation
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            console.error('Invalid UUID format:', userId);
            return res.status(400).json({
                status: 'error',
                message: 'Invalid user ID format. Please log in again.',
                details: `Expected UUID format, got: ${userId}`
            });
        }

        // Create cache key
        const cacheKey = `${CACHE_KEYS.FOLLOWING_POSTS}_${userId}_${sort}_${page}_${limit}`;
        
        // Try to get from cache first
        const cachedData = await getFollowingPostsCache(cacheKey);
        if (cachedData) {
            console.log('Serving following posts from cache');
            return res.json({
                status: 'success',
                data: cachedData,
                cached: true
            });
        }

        // Determine sort order
        const orderBy = sort === 'oldest' 
            ? { createdAt: 'asc' } 
            : { createdAt: 'desc' };

        // Get posts from users that the current user follows
        console.log('About to query database with userId:', userId);
        
        // First, get the list of user IDs that the current user follows
        const followingRelations = await prisma.follow.findMany({
            where: {
                followerId: userId
            },
            select: {
                followingId: true
            }
        });
        
        const followingUserIds = followingRelations.map(rel => rel.followingId);
        
        console.log(`User ${userId} follows ${followingUserIds.length} users:`, followingUserIds);
        
        // If user follows no one, return empty result
        if (followingUserIds.length === 0) {
            return res.json({
                status: 'success',
                data: {
                    posts: [],
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: 0,
                        totalCount: 0,
                        hasNext: false,
                        hasPrev: false,
                        limit: parseInt(limit)
                    },
                    filters: {
                        sort,
                        fromFollowing: true
                    }
                },
                cached: false
            });
        }
        
        const [followingPosts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: {
                    status: 'active',
                    is_frozen: false,
                    user_id: {
                        in: followingUserIds
                    }
                },
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
                            name: true,
                            description: true
                        }
                    },
                    _count: {
                        select: {
                            comments: true,
                            postLikes: true,
                            postViews: true
                        }
                    }
                },
                orderBy,
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: {
                    status: 'active',
                    is_frozen: false,
                    user_id: {
                        in: followingUserIds
                    }
                }
            })
        ]);

        // Process posts to add full URLs and optimize response
        const processedPosts = followingPosts.map(post => ({
            ...post,
            fullUrl: post.video_url, // Supabase URLs are already complete
            isFromFollowing: true
        }));

        const responseData = {
            posts: processedPosts,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount,
                hasNext: page * limit < totalCount,
                hasPrev: page > 1,
                limit: parseInt(limit)
            },
            filters: {
                sort,
                fromFollowing: true
            }
        };

        // Cache the response
        await setFollowingPostsCache(cacheKey, responseData);

        res.json({
            status: 'success',
            data: responseData,
            cached: false
        });

    } catch (error) {
        console.error('Error fetching following posts:', error);
        
        // Check if it's a UUID-related error
        if (error.message && error.message.includes('UUID')) {
            console.error('UUID Error Details:', {
                userId: req.user?.id,
                userIdType: typeof req.user?.id,
                error: error.message
            });
            
            return res.status(400).json({
                status: 'error',
                message: 'Invalid user ID format. Please log in again.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
        
        res.status(500).json({
            status: 'error',
            message: 'Error fetching posts from users you follow',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get optimized feed with featured and following posts
exports.getOptimizedFeed = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, includeFeatured = true, includeFollowing = true } = req.query;
        const offset = (page - 1) * limit;

        const feedPosts = [];

        // Get featured posts if requested
        if (includeFeatured === 'true') {
            const featuredPosts = await prisma.featuredPost.findMany({
                where: {
                    is_active: true,
                    OR: [
                        { expires_at: null },
                        { expires_at: { gt: new Date() } }
                    ]
                },
                include: {
                    post: {
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
                                    name: true,
                                    description: true
                                }
                            },
                            _count: {
                                select: {
                                    comments: true,
                                    postLikes: true,
                                    postViews: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: Math.floor(parseInt(limit) * 0.3) // 30% featured posts
            });

            featuredPosts.forEach(featured => {
                feedPosts.push({
                    ...featured.post,
                    fullUrl: featured.post.video_url,
                    isFeatured: true,
                    featuredAt: featured.createdAt,
                    expiresAt: featured.expires_at,
                    featuredBy: featured.admin?.username,
                    featuredReason: featured.reason
                });
            });
        }

        // Get following posts if requested
        if (includeFollowing === 'true') {
            const followingPosts = await prisma.post.findMany({
                where: {
                    status: 'active',
                    is_frozen: false,
                    user: {
                        followers: {
                            some: {
                                followerId: userId
                            }
                        }
                    }
                },
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
                            name: true,
                            description: true
                        }
                    },
                    _count: {
                        select: {
                            comments: true,
                            postLikes: true,
                            postViews: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: Math.floor(parseInt(limit) * 0.7) // 70% following posts
            });

            followingPosts.forEach(post => {
                feedPosts.push({
                    ...post,
                    fullUrl: post.video_url,
                    isFromFollowing: true
                });
            });
        }

        // Sort combined feed by creation date
        feedPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Apply pagination to combined results
        const paginatedPosts = feedPosts.slice(offset, offset + parseInt(limit));

        res.json({
            status: 'success',
            data: {
                posts: paginatedPosts,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(feedPosts.length / limit),
                    totalCount: feedPosts.length,
                    hasNext: offset + parseInt(limit) < feedPosts.length,
                    hasPrev: page > 1,
                    limit: parseInt(limit)
                },
                filters: {
                    includeFeatured: includeFeatured === 'true',
                    includeFollowing: includeFollowing === 'true'
                }
            }
        });

    } catch (error) {
        console.error('Error fetching optimized feed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching optimized feed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get user's draft posts
exports.getUserDraftPosts = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const [draftPosts, total] = await Promise.all([
            prisma.post.findMany({
                where: {
                    user_id: userId,
                    status: 'draft'
                },
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
                            comments: true,
                            postViews: true
                        }
                    }
                },
                orderBy: {
                    updatedAt: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: {
                    user_id: userId,
                    status: 'draft'
                }
            })
        ]);

        // Add full URLs for files
        const postsWithUrls = draftPosts.map(post => ({
            ...post,
            fullUrl: post.video_url
        }));

        res.json({
            status: 'success',
            data: {
                posts: postsWithUrls,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalCount: total,
                    hasNext: page * limit < total,
                    hasPrev: page > 1,
                    limit: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching draft posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching draft posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Publish a draft post (change status from draft to active - published immediately)
exports.publishDraftPost = async (req, res) => {
    try {
        const postId = req.params.postId;
        const userId = req.user.id;

        // Check if post exists, belongs to user, and is in draft status
        const existingPost = await prisma.post.findFirst({
            where: {
                id: postId,
                user_id: userId,
                status: 'draft'
            }
        });

        if (!existingPost) {
            return res.status(404).json({
                status: 'error',
                message: 'Draft post not found or you do not have permission to publish it'
            });
        }

        // Update post status to active (published immediately)
        const updatedPost = await prisma.post.update({
            where: { id: postId },
            data: {
                status: 'active',
                updatedAt: new Date()
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
                }
            }
        });

        // Clear relevant caches
        await clearCacheByPattern('single_post');
        await clearCacheByPattern('all_posts');
        await clearCacheByPattern('following_posts');
        await clearCacheByPattern('featured_posts');
        await clearCacheByPattern('search_posts');

        emitEvent('post:published', { postId, userId });

        res.json({
            status: 'success',
            message: 'Draft post published successfully and is now active',
            data: { post: updatedPost }
        });
    } catch (error) {
        console.error('Error publishing draft post:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error publishing draft post',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}; 