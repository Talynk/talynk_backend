const prisma = require('../lib/prisma');

/**
 * Record a view for a post
 * Uses efficient tracking with IP and user-based uniqueness
 */
exports.recordView = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user?.id; // Optional for anonymous users
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        // Check if post exists
        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { id: true, views: true }
        });

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found'
            });
        }

        // Use transaction for atomic view recording
        const result = await prisma.$transaction(async (tx) => {
            let viewRecorded = false;
            let newViewCount = post.views;

            if (userId) {
                // Authenticated user - fast existence query using count()
                const viewExists = await tx.view.count({
                    where: {
                        user_id: userId,
                        post_id: postId
                    }
                });

                if (viewExists === 0) {
                    await tx.view.create({
                        data: {
                            user_id: userId,
                            post_id: postId,
                            ip_address: ipAddress,
                            user_agent: userAgent
                        }
                    });
                    viewRecorded = true;
                }
            } else {
                // Anonymous user - fast existence query using count()
                const viewExists = await tx.view.count({
                    where: {
                        ip_address: ipAddress,
                        post_id: postId
                    }
                });

                if (viewExists === 0) {
                    await tx.view.create({
                        data: {
                            user_id: null,
                            post_id: postId,
                            ip_address: ipAddress,
                            user_agent: userAgent
                        }
                    });
                    viewRecorded = true;
                }
            }

            // Increment view count if new view was recorded
            if (viewRecorded) {
                await tx.post.update({
                    where: { id: postId },
                    data: {
                        views: {
                            increment: 1
                        }
                    }
                });
                newViewCount = post.views + 1;
            }

            return {
                viewRecorded,
                viewCount: newViewCount
            };
        });

        res.json({
            status: 'success',
            message: result.viewRecorded ? 'View recorded' : 'View already counted',
            data: {
                viewRecorded: result.viewRecorded,
                viewCount: result.viewCount
            }
        });

    } catch (error) {
        console.error('Record view error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error recording view'
        });
    }
};

/**
 * Get view statistics for a post
 */
exports.getPostViewStats = async (req, res) => {
    try {
        const { postId } = req.params;

        const [totalViews, uniqueUserViews, recentViews] = await Promise.all([
            prisma.view.count({
                where: { post_id: postId }
            }),
            prisma.view.count({
                where: { 
                    post_id: postId,
                    user_id: { not: null }
                }
            }),
            prisma.view.findMany({
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
                totalViews,
                uniqueUserViews,
                anonymousViews: totalViews - uniqueUserViews,
                recentViews: recentViews.map(view => ({
                    user: view.user,
                    viewedAt: view.createdAt,
                    isAnonymous: !view.user_id
                }))
            }
        });

    } catch (error) {
        console.error('Get post view stats error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching view statistics'
        });
    }
};

/**
 * Get trending posts based on views and likes
 */
exports.getTrendingPosts = async (req, res) => {
    try {
        const { period = '24h', limit = 20 } = req.query;
        
        // Calculate time threshold based on period
        const now = new Date();
        let timeThreshold;
        
        switch (period) {
            case '1h':
                timeThreshold = new Date(now.getTime() - 60 * 60 * 1000);
                break;
            case '24h':
                timeThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                timeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                timeThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                timeThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }

        // Get posts with recent activity
        const trendingPosts = await prisma.post.findMany({
            where: {
                status: 'active',
                is_frozen: false,
                createdAt: {
                    gte: timeThreshold
                }
            },
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
                },
                _count: {
                    select: {
                        postLikes: true,
                        postViews: true,
                        comments: true
                    }
                }
            },
            orderBy: [
                { views: 'desc' },
                { likes: 'desc' },
                { createdAt: 'desc' }
            ],
            take: parseInt(limit)
        });

        // Calculate trending score (weighted combination of views, likes, and comments)
        const postsWithScore = trendingPosts.map(post => {
            const trendingScore = 
                (post.views * 1) + 
                (post.likes * 3) + 
                (post._count.comments * 2) +
                (post._count.postLikes * 3);
            
            return {
                id: post.id,
                title: post.title,
                caption: post.caption,
                video_url: post.video_url,
                image_url: post.image_url,
                like_count: post.likes,
                comment_count: post.comment_count,
                view_count: post.views,
                share_count: post.shares,
                status: post.status,
                created_at: post.createdAt,
                user: post.user,
                category: post.category,
                trendingScore
            };
        });

        // Sort by trending score
        postsWithScore.sort((a, b) => b.trendingScore - a.trendingScore);

        res.json({
            status: 'success',
            data: {
                posts: postsWithScore,
                period,
                generatedAt: new Date()
            }
        });

    } catch (error) {
        console.error('Get trending posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching trending posts'
        });
    }
};

/**
 * Batch update view counts (for background processing)
 * This can be called periodically to sync view counts
 */
exports.batchUpdateViewCounts = async (req, res) => {
    try {
        // This would typically be called by a background job
        // For now, we'll just return success
        res.json({
            status: 'success',
            message: 'View count sync completed'
        });

    } catch (error) {
        console.error('Batch update view counts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating view counts'
        });
    }
};
