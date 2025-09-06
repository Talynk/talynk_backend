const prisma = require('../lib/prisma');

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
                select: { id: true, like_count: true }
            });

            if (!post) {
                throw new Error('Post not found');
            }

            // Check if user already liked the post
            const existingLike = await tx.postLike.findUnique({
                where: {
                    unique_user_post_like: {
                        user_id: userId,
                        post_id: postId
                    }
                }
            });

            let isLiked = false;
            let newLikeCount = post.like_count;

            if (existingLike) {
                // Unlike: Remove the like and decrement count
                await tx.postLike.delete({
                    where: {
                        unique_user_post_like: {
                            user_id: userId,
                            post_id: postId
                        }
                    }
                });
                
                newLikeCount = Math.max(0, post.like_count - 1);
                isLiked = false;
            } else {
                // Like: Create the like and increment count
                await tx.postLike.create({
                    data: {
                        user_id: userId,
                        post_id: postId
                    }
                });
                
                newLikeCount = post.like_count + 1;
                isLiked = true;
            }

            // Update the post's like count
            await tx.post.update({
                where: { id: postId },
                data: { like_count: newLikeCount }
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
 * Check if a user has liked a specific post
 */
exports.checkLikeStatus = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;

        const like = await prisma.postLike.findUnique({
            where: {
                unique_user_post_like: {
                    user_id: userId,
                    post_id: postId
                }
            }
        });

        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { like_count: true }
        });

        res.json({
            status: 'success',
            data: {
                isLiked: !!like,
                likeCount: post?.like_count || 0
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
            like_count: like.post.like_count,
            comment_count: like.post.comment_count,
            view_count: like.post.view_count,
            share_count: like.post.share_count,
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
