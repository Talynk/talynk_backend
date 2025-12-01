const prisma = require('../lib/prisma');
const { userHasLikedPost, batchUserLikes } = require('../utils/existenceQueries');

/**
 * Like or unlike a post with atomic operations
 * Uses transactions to ensure data consistency
 */
exports.toggleLike = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;

        // First, verify user exists in database (JWT might be valid but user deleted)
        const userExists = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true }
        });

        if (!userExists) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found. Please log in again.'
            });
        }

        // Retry mechanism for handling race conditions
        const maxRetries = 3;
        let lastError;
        let result;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // Use transaction to ensure atomicity
                result = await prisma.$transaction(async (tx) => {
                    // Check if post exists
                    const post = await tx.post.findUnique({
                        where: { id: postId },
                        select: { id: true, likes: true }
                    });

                    if (!post) {
                        throw new Error('Post not found');
                    }

                    // Use delete-first approach to avoid unique constraint errors
                    // This is idempotent and handles race conditions gracefully
                    // Try to delete the like first (safe even if it doesn't exist)
                    const deleteResult = await tx.postLike.deleteMany({
                        where: {
                            user_id: userId,
                            post_id: postId
                        }
                    });

                    let isLiked = false;
                    let newLikeCount = post.likes;

                    if (deleteResult.count > 0) {
                        // Like existed and was deleted (unlike action)
                        newLikeCount = Math.max(0, post.likes - 1);
                        isLiked = false;
                    } else {
                        // Like didn't exist, so create it (like action)
                        await tx.postLike.create({
                            data: {
                                user_id: userId,
                                post_id: postId
                            }
                        });
                        newLikeCount = post.likes + 1;
                        isLiked = true;
                    }

                    // Update the post's like count
                    await tx.post.update({
                        where: { id: postId },
                        data: { likes: newLikeCount }
                    });

                    return {
                        isLiked,
                        likeCount: newLikeCount
                    };
                });

                // Success - break out of retry loop
                break;
                
            } catch (error) {
                lastError = error;
                
                // Handle foreign key constraint error (user or post doesn't exist)
                if (error.code === 'P2003') {
                    if (error.meta?.constraint === 'post_likes_user_id_fkey') {
                        return res.status(404).json({
                            status: 'error',
                            message: 'User not found. Please log in again.'
                        });
                    } else if (error.meta?.constraint === 'post_likes_post_id_fkey') {
                        return res.status(404).json({
                            status: 'error',
                            message: 'Post not found'
                        });
                    }
                    // Unknown foreign key error, throw it
                    throw error;
                }
                
                // If it's a unique constraint error, another request created the like
                // Start a fresh transaction to delete it (toggle behavior)
                if (error.code === 'P2002') {
                    try {
                        // Fresh transaction to handle the toggle
                        result = await prisma.$transaction(async (tx) => {
                            const post = await tx.post.findUnique({
                                where: { id: postId },
                                select: { id: true, likes: true }
                            });

                            if (!post) {
                                throw new Error('Post not found');
                            }

                            // Delete the like that was created by the other request
                            const deleteResult = await tx.postLike.deleteMany({
                                where: {
                                    user_id: userId,
                                    post_id: postId
                                }
                            });

                            const newLikeCount = Math.max(0, post.likes - (deleteResult.count > 0 ? 1 : 0));

                            await tx.post.update({
                                where: { id: postId },
                                data: { likes: newLikeCount }
                            });

                            return {
                                isLiked: false,
                                likeCount: newLikeCount
                            };
                        });
                        // Success - break out of retry loop
                        break;
                    } catch (retryError) {
                        // If the retry also fails, continue with normal retry logic
                        lastError = retryError;
                        if (attempt < maxRetries - 1) {
                            await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
                            continue;
                        }
                    }
                }
                
                // If it's not a retryable error, break and throw
                if (error.message === 'Post not found') {
                    throw error;
                }
                
                // For other errors, retry if we have attempts left
                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
                    continue;
                }
                
                throw error;
            }
        }
        
        // If we exhausted all retries without success, throw the last error
        if (!result) {
            throw lastError;
        }

        res.json({
            status: 'success',
            message: result.isLiked ? 'Post liked successfully' : 'Post unliked successfully',
            data: {
                isLiked: result.isLiked,
                likeCount: result.likeCount
            }
        });

    } catch (error) {
        console.error('Like toggle error:', error);
        
        if (error.message === 'Post not found') {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found',
                data: {}
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error processing like/unlike',
            data: {}
        });
    }
};

/**
 * Check if a user has liked a specific post (Fast existence query)
 * Uses count() for boolean response instead of fetching full records
 * Supports both authenticated and unauthenticated users
 */
exports.checkLikeStatus = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user?.id;

        // Check if post exists
        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { likes: true }
        });

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found',
                data: {}
            });
        }

        // If user is not authenticated, return isLiked: false with actual like count
        if (!userId) {
            return res.json({
                status: 'success',
                message: 'Like status retrieved',
                data: {
                    isLiked: false,
                    likeCount: post.likes || 0
                }
            });
        }

        // Fast existence query using utility function for authenticated users
        const likeExists = await userHasLikedPost(userId, postId);

        res.json({
            status: 'success',
            message: 'Like status retrieved',
            data: {
                isLiked: likeExists, // Already a boolean
                likeCount: post.likes || 0
            }
        });

    } catch (error) {
        console.error('Check like status error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error checking like status',
            data: {}
        });
    }
};

/**
 * Get all posts liked by a user
 */
exports.getLikedPosts = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [likedPosts, total] = await Promise.all([
            prisma.postLike.findMany({
                where: { user_id: userId },
                include: {
                    post: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true,
                                    profile_picture: true
                                }
                            },
                            category: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.postLike.count({
                where: { user_id: userId }
            })
        ]);

        const formattedPosts = likedPosts.map(like => ({
            id: like.post.id,
            title: like.post.title,
            caption: like.post.caption,
            video_url: like.post.video_url,
            image_url: like.post.image_url,
            like_count: like.post.likes,
            comment_count: like.post.comment_count,
            view_count: like.post.views,
            share_count: like.post.shares,
            status: like.post.status,
            created_at: like.post.createdAt,
            user: like.post.user,
            category: like.post.category,
            liked_at: like.createdAt
        }));

        res.json({
            status: 'success',
            data: {
                posts: formattedPosts,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get liked posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching liked posts'
        });
    }
};

/**
 * Batch check like status for multiple posts
 * Efficient for checking multiple posts at once
 * Supports both authenticated and unauthenticated users
 * Omits non-existent posts from response
 */
exports.batchCheckLikeStatus = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { postIds } = req.body;

        if (!Array.isArray(postIds) || postIds.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'postIds must be a non-empty array',
                data: {}
            });
        }

        if (postIds.length > 100) {
            return res.status(400).json({
                status: 'error',
                message: 'Maximum 100 posts can be checked at once',
                data: {}
            });
        }

        // Get like counts for all posts (only existing posts will be returned)
        const posts = await prisma.post.findMany({
            where: {
                id: {
                    in: postIds
                }
            },
            select: {
                id: true,
                likes: true
            }
        });

        // Create a set of existing post IDs for quick lookup
        const existingPostIds = new Set(posts.map(post => post.id));
        
        // Create a map of post ID to like count
        const likeCounts = {};
        posts.forEach(post => {
            likeCounts[post.id] = post.likes || 0;
        });

        // If user is authenticated, get their like statuses
        let likeStatuses = {};
        if (userId) {
            // Only check likes for existing posts
            const existingIds = Array.from(existingPostIds);
            if (existingIds.length > 0) {
                likeStatuses = await batchUserLikes(userId, existingIds);
            }
        }

        // Build result object - only include existing posts
        const result = {};
        existingPostIds.forEach(postId => {
            result[postId] = {
                isLiked: userId ? (likeStatuses[postId] || false) : false,
                likeCount: likeCounts[postId] || 0
            };
        });

        // Non-existent posts are automatically omitted from the result

        res.json({
            status: 'success',
            message: 'Like statuses retrieved',
            data: result
        });

    } catch (error) {
        console.error('Batch check like status error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error checking like statuses',
            data: {}
        });
    }
};

/**
 * Get like statistics for a post
 */
exports.getPostLikeStats = async (req, res) => {
    try {
        const { postId } = req.params;

        const [likeCount, recentLikes] = await Promise.all([
            prisma.postLike.count({
                where: { post_id: postId }
            }),
            prisma.postLike.findMany({
                where: { post_id: postId },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            profile_picture: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 10
            })
        ]);

        res.json({
            status: 'success',
            data: {
                likeCount,
                recentLikes: recentLikes.map(like => ({
                    user: like.user,
                    likedAt: like.createdAt
                }))
            }
        });

    } catch (error) {
        console.error('Get post like stats error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching like statistics'
        });
    }
};
