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

        // Use transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
            // Check if post exists
            const post = await tx.post.findUnique({
                where: { id: postId },
                select: { id: true, likes: true }
            });

            if (!post) {
                console.log(`Post not found --------->  + ${post}`);
                throw new Error('Post not found');
            }

            // Fast existence query using utility function
            const likeExists = await userHasLikedPost(userId, postId);

            let isLiked = false;
            let newLikeCount = post.likes;

            if (likeExists) {
                // Unlike: Remove the like and decrement count
                await tx.postLike.deleteMany({
                    where: {
                        user_id: userId,
                        post_id: postId
                    }
                });
                
                newLikeCount = Math.max(0, post.likes - 1);
                isLiked = false;
            } else {
                // Like: Create the like and increment count
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
                message: 'Post not found'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error processing like/unlike',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Check if a user has liked a specific post (Fast existence query)
 * Uses count() for boolean response instead of fetching full records
 */
exports.checkLikeStatus = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;

        // Fast existence query using utility function
        const [likeExists, post] = await Promise.all([
            userHasLikedPost(userId, postId),
            prisma.post.findUnique({
                where: { id: postId },
                select: { likes: true }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                isLiked: likeExists, // Already a boolean
                likeCount: post?.likes || 0
            }
        });

    } catch (error) {
        console.error('Check like status error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error checking like status'
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
 */
exports.batchCheckLikeStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const { postIds } = req.body;

        if (!Array.isArray(postIds) || postIds.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'postIds must be a non-empty array'
            });
        }

        if (postIds.length > 100) {
            return res.status(400).json({
                status: 'error',
                message: 'Maximum 100 posts can be checked at once'
            });
        }

        // Batch existence check for user likes
        const likeStatuses = await batchUserLikes(userId, postIds);

        // Get like counts for all posts
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

        const likeCounts = {};
        posts.forEach(post => {
            likeCounts[post.id] = post.likes;
        });

        // Combine results
        const result = {};
        postIds.forEach(postId => {
            result[postId] = {
                isLiked: likeStatuses[postId] || false,
                likeCount: likeCounts[postId] || 0
            };
        });

        res.json({
            status: 'success',
            data: result
        });

    } catch (error) {
        console.error('Batch check like status error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error checking like statuses'
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
