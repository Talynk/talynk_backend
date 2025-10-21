// ===== NEW ADMIN ANALYTICS & MANAGEMENT ENDPOINTS =====

// Get comprehensive dashboard stats with date filtering
exports.getDashboardStats = async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        
        // Calculate date range based on period
        const now = new Date();
        let startDate;
        
        switch (period) {
            case '1h':
                startDate = new Date(now.getTime() - 60 * 60 * 1000);
                break;
            case '1d':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '1m':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '3m':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            case '1y':
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        const [
            totalUsers,
            totalVideos,
            pendingReviews,
            flaggedContents,
            totalViews,
            totalPosts,
            totalEngagements,
            recentContent
        ] = await Promise.all([
            // Total Users
            prisma.user.count(),
            
            // Total Videos (posts with video_url)
            prisma.post.count({
                where: {
                    video_url: { not: null },
                    createdAt: { gte: startDate }
                }
            }),
            
            // Pending Reviews
            prisma.post.count({
                where: { status: 'pending' }
            }),
            
            // Flagged Contents
            prisma.post.count({
                where: { 
                    is_frozen: true,
                    status: 'frozen'
                }
            }),
            
            // Total Views
            prisma.view.count({
                where: { createdAt: { gte: startDate } }
            }),
            
            // Total Posts
            prisma.post.count({
                where: { createdAt: { gte: startDate } }
            }),
            
            // Total Engagements (likes + comments + shares)
            prisma.$queryRaw`
                SELECT 
                    (SELECT COUNT(*) FROM "PostLikes" WHERE "createdAt" >= ${startDate}) +
                    (SELECT COUNT(*) FROM "Comment" WHERE "createdAt" >= ${startDate}) +
                    (SELECT COUNT(*) FROM "Share" WHERE "createdAt" >= ${startDate}) as total_engagements
            `,
            
            // Recent Content (last 10 posts)
            prisma.post.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' },
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
            })
        ]);

        // Calculate engagement rate
        const engagementRate = totalPosts > 0 ? 
            (totalEngagements[0]?.total_engagements || 0) / totalPosts * 100 : 0;

        res.json({
            status: 'success',
            data: {
                period,
                stats: {
                    totalUsers,
                    totalVideos,
                    pendingReviews,
                    flaggedContents,
                    totalViews,
                    totalPosts,
                    totalEngagements: totalEngagements[0]?.total_engagements || 0,
                    engagementRate: Math.round(engagementRate * 100) / 100
                },
                recentContent
            }
        });

    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching dashboard stats',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get detailed analytics with user demographics and device usage
exports.getAnalytics = async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        
        // Calculate date range
        const now = new Date();
        let startDate;
        
        switch (period) {
            case '1h':
                startDate = new Date(now.getTime() - 60 * 60 * 1000);
                break;
            case '1d':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '1m':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '3m':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            case '1y':
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        const [
            totalUsers,
            totalViews,
            totalPosts,
            totalEngagements,
            userDemographics,
            deviceUsage,
            topCountries,
            topCategories,
            avgSessionTimes,
            bounceRate,
            completionRate
        ] = await Promise.all([
            // Total Users
            prisma.user.count({
                where: { createdAt: { gte: startDate } }
            }),
            
            // Total Views
            prisma.view.count({
                where: { createdAt: { gte: startDate } }
            }),
            
            // Total Posts
            prisma.post.count({
                where: { createdAt: { gte: startDate } }
            }),
            
            // Total Engagements
            prisma.$queryRaw`
                SELECT 
                    (SELECT COUNT(*) FROM "PostLikes" WHERE "createdAt" >= ${startDate}) +
                    (SELECT COUNT(*) FROM "Comment" WHERE "createdAt" >= ${startDate}) +
                    (SELECT COUNT(*) FROM "Share" WHERE "createdAt" >= ${startDate}) as total_engagements
            `,
            
            // User Demographics (age groups based on date_of_birth)
            prisma.$queryRaw`
                SELECT 
                    CASE 
                        WHEN "date_of_birth" IS NULL THEN 'Unknown'
                        WHEN EXTRACT(YEAR FROM AGE("date_of_birth")) < 18 THEN 'Under 18'
                        WHEN EXTRACT(YEAR FROM AGE("date_of_birth")) BETWEEN 18 AND 24 THEN '18-24'
                        WHEN EXTRACT(YEAR FROM AGE("date_of_birth")) BETWEEN 25 AND 34 THEN '25-34'
                        WHEN EXTRACT(YEAR FROM AGE("date_of_birth")) BETWEEN 35 AND 44 THEN '35-44'
                        WHEN EXTRACT(YEAR FROM AGE("date_of_birth")) BETWEEN 45 AND 54 THEN '45-54'
                        WHEN EXTRACT(YEAR FROM AGE("date_of_birth")) BETWEEN 55 AND 64 THEN '55-64'
                        ELSE '65+'
                    END as age_group,
                    COUNT(*) as count
                FROM "User" 
                WHERE "createdAt" >= ${startDate}
                GROUP BY age_group
                ORDER BY count DESC
            `,
            
            // Device Usage (from user_agent in views)
            prisma.$queryRaw`
                SELECT 
                    CASE 
                        WHEN "user_agent" ILIKE '%mobile%' OR "user_agent" ILIKE '%android%' OR "user_agent" ILIKE '%iphone%' THEN 'Mobile'
                        WHEN "user_agent" ILIKE '%tablet%' OR "user_agent" ILIKE '%ipad%' THEN 'Tablet'
                        ELSE 'Desktop'
                    END as device_type,
                    COUNT(*) as count
                FROM "View" 
                WHERE "createdAt" >= ${startDate}
                GROUP BY device_type
                ORDER BY count DESC
            `,
            
            // Top Countries (User Distribution)
            prisma.$queryRaw`
                SELECT 
                    c.name as country,
                    c.flag_emoji,
                    COUNT(u.id) as user_count,
                    ROUND(COUNT(u.id) * 100.0 / (SELECT COUNT(*) FROM "User" WHERE "createdAt" >= ${startDate}), 2) as percentage
                FROM "User" u
                JOIN "Country" c ON u.country_id = c.id
                WHERE u."createdAt" >= ${startDate}
                GROUP BY c.id, c.name, c.flag_emoji
                ORDER BY user_count DESC
                LIMIT 10
            `,
            
            // Top Content Categories
            prisma.$queryRaw`
                SELECT 
                    cat.name as category,
                    COUNT(p.id) as post_count,
                    ROUND(COUNT(p.id) * 100.0 / (SELECT COUNT(*) FROM "Post" WHERE "createdAt" >= ${startDate}), 2) as percentage
                FROM "Post" p
                JOIN "Category" cat ON p.category_id = cat.id
                WHERE p."createdAt" >= ${startDate}
                GROUP BY cat.id, cat.name
                ORDER BY post_count DESC
                LIMIT 10
            `,
            
            // Average Session Times (simplified - using view timestamps)
            prisma.$queryRaw`
                SELECT 
                    AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt"))) as avg_session_seconds
                FROM "View" 
                WHERE "createdAt" >= ${startDate}
            `,
            
            // Bounce Rate (users with only 1 view)
            prisma.$queryRaw`
                SELECT 
                    COUNT(*) as single_view_users,
                    (SELECT COUNT(DISTINCT "user_id") FROM "View" WHERE "createdAt" >= ${startDate} AND "user_id" IS NOT NULL) as total_users,
                    ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(DISTINCT "user_id") FROM "View" WHERE "createdAt" >= ${startDate} AND "user_id" IS NOT NULL), 0), 2) as bounce_rate
                FROM (
                    SELECT "user_id", COUNT(*) as view_count
                    FROM "View" 
                    WHERE "createdAt" >= ${startDate} AND "user_id" IS NOT NULL
                    GROUP BY "user_id"
                    HAVING COUNT(*) = 1
                ) single_view
            `,
            
            // Completion Rate (posts with high engagement)
            prisma.$queryRaw`
                SELECT 
                    COUNT(*) as high_engagement_posts,
                    (SELECT COUNT(*) FROM "Post" WHERE "createdAt" >= ${startDate}) as total_posts,
                    ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM "Post" WHERE "createdAt" >= ${startDate}), 0), 2) as completion_rate
                FROM "Post" p
                WHERE p."createdAt" >= ${startDate}
                AND (p.likes + p.comment_count + p.shares) >= 10
            `
        ]);

        res.json({
            status: 'success',
            data: {
                period,
                analytics: {
                    totalUsers,
                    totalViews,
                    totalPosts,
                    totalEngagements: totalEngagements[0]?.total_engagements || 0,
                    userDemographics,
                    deviceUsage,
                    topCountries,
                    topCategories,
                    avgSessionTimes: Math.round((avgSessionTimes[0]?.avg_session_seconds || 0) / 60), // Convert to minutes
                    bounceRate: bounceRate[0]?.bounce_rate || 0,
                    completionRate: completionRate[0]?.completion_rate || 0
                }
            }
        });

    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching analytics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get content management dashboard stats
exports.getContentManagementStats = async (req, res) => {
    try {
        const [
            totalContents,
            videos,
            images,
            pendingReviews,
            flaggedContents,
            featuredContents
        ] = await Promise.all([
            prisma.post.count(),
            prisma.post.count({ where: { video_url: { not: null } } }),
            prisma.post.count({ where: { image_url: { not: null } } }),
            prisma.post.count({ where: { status: 'pending' } }),
            prisma.post.count({ where: { is_frozen: true } }),
            prisma.post.count({ where: { is_featured: true } })
        ]);

        res.json({
            status: 'success',
            data: {
                totalContents,
                videos,
                images,
                pendingReviews,
                flaggedContents,
                featuredContents
            }
        });

    } catch (error) {
        console.error('Get content management stats error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching content management stats',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Set post as featured
exports.setPostFeatured = async (req, res) => {
    try {
        const { postId } = req.params;
        const { featured } = req.body;

        const post = await prisma.post.update({
            where: { id: postId },
            data: { is_featured: featured },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            }
        });

        // Log admin action
        loggers.audit('set_post_featured', {
            adminId: req.user.id,
            postId: postId,
            featured: featured
        });

        res.json({
            status: 'success',
            message: `Post ${featured ? 'featured' : 'unfeatured'} successfully`,
            data: { post }
        });

    } catch (error) {
        console.error('Set post featured error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating post featured status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Freeze a post
exports.freezePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { reason } = req.body;

        const post = await prisma.post.update({
            where: { id: postId },
            data: {
                is_frozen: true,
                status: 'frozen',
                frozen_at: new Date(),
                frozen_reason: reason
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            }
        });

        // Notify post owner
        await prisma.notification.create({
            data: {
                userID: post.user.username,
                message: `Your post has been frozen. Reason: ${reason || 'Policy violation'}`,
                type: 'post_frozen',
                isRead: false
            }
        });

        // Log admin action
        loggers.audit('freeze_post', {
            adminId: req.user.id,
            postId: postId,
            reason: reason
        });

        res.json({
            status: 'success',
            message: 'Post frozen successfully',
            data: { post }
        });

    } catch (error) {
        console.error('Freeze post error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error freezing post',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Unfreeze a post
exports.unfreezePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { reason } = req.body;

        const post = await prisma.post.update({
            where: { id: postId },
            data: {
                is_frozen: false,
                status: 'approved',
                frozen_at: null,
                frozen_reason: null,
                report_count: 0 // Reset report count
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            }
        });

        // Notify post owner
        await prisma.notification.create({
            data: {
                userID: post.user.username,
                message: `Your post has been unfrozen and is now visible again. ${reason ? 'Reason: ' + reason : ''}`,
                type: 'post_unfrozen',
                isRead: false
            }
        });

        // Log admin action
        loggers.audit('unfreeze_post', {
            adminId: req.user.id,
            postId: postId,
            reason: reason
        });

        res.json({
            status: 'success',
            message: 'Post unfrozen successfully',
            data: { post }
        });

    } catch (error) {
        console.error('Unfreeze post error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error unfreezing post',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get post reports and reporters
exports.getPostReports = async (req, res) => {
    try {
        const { postId } = req.params;

        const reports = await prisma.postReport.findMany({
            where: { post_id: postId },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        profile_picture: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            status: 'success',
            data: { reports }
        });

    } catch (error) {
        console.error('Get post reports error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching post reports',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get all appeals
exports.getAllAppeals = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {};
        if (status) whereClause.status = status;

        const [appeals, totalCount] = await Promise.all([
            prisma.postAppeal.findMany({
                where: whereClause,
                include: {
                    post: {
                        select: {
                            id: true,
                            title: true,
                            status: true,
                            report_count: true,
                            frozen_at: true
                        }
                    },
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    reviewer: {
                        select: {
                            id: true,
                            username: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.postAppeal.count({ where: whereClause })
        ]);

        res.json({
            status: 'success',
            data: {
                appeals,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / limit),
                    totalCount,
                    hasNext: page * limit < totalCount,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error('Get all appeals error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching appeals',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Send broadcast notification to all users
exports.sendBroadcastNotification = async (req, res) => {
    try {
        const { title, message, type = 'broadcast' } = req.body;

        if (!title || !message) {
            return res.status(400).json({
                status: 'error',
                message: 'Title and message are required'
            });
        }

        // Get all active users
        const users = await prisma.user.findMany({
            where: { status: 'active' },
            select: { username: true }
        });

        // Create notifications for all users
        const notifications = users.map(user => ({
            userID: user.username,
            message: `${title}: ${message}`,
            type: type,
            isRead: false,
            createdAt: new Date(),
            updatedAt: new Date()
        }));

        await prisma.notification.createMany({
            data: notifications
        });

        // Log admin action
        loggers.audit('broadcast_notification', {
            adminId: req.user.id,
            title: title,
            message: message,
            recipientCount: users.length
        });

        res.json({
            status: 'success',
            message: `Broadcast notification sent to ${users.length} users`,
            data: {
                recipientCount: users.length,
                title,
                message
            }
        });

    } catch (error) {
        console.error('Send broadcast notification error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error sending broadcast notification',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get detailed posts with analytics for admin
exports.getAdminPosts = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, sort = 'newest' } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {};
        if (status && status !== 'all') {
            whereClause.status = status;
        }

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
            case 'most_reported':
                orderBy = { report_count: 'desc' };
                break;
            default:
                orderBy = { createdAt: 'desc' };
        }

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: whereClause,
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            profile_picture: true,
                            country: {
                                select: {
                                    name: true,
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
                            postLikes: true,
                            postViews: true,
                            comments: true,
                            shares: true,
                            reports: true
                        }
                    },
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: { createdAt: 'desc' },
                        take: 5
                    },
                    appeals: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: { createdAt: 'desc' }
                    }
                },
                orderBy,
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({ where: whereClause })
        ]);

        // Calculate engagement metrics for each post
        const postsWithAnalytics = posts.map(post => {
            const totalEngagements = post._count.postLikes + post._count.comments + post._count.shares;
            const engagementRate = post.views > 0 ? (totalEngagements / post.views) * 100 : 0;
            
            return {
                ...post,
                analytics: {
                    totalEngagements,
                    engagementRate: Math.round(engagementRate * 100) / 100,
                    avgEngagementPerView: post.views > 0 ? Math.round((totalEngagements / post.views) * 100) / 100 : 0,
                    isHighPerforming: totalEngagements >= 50,
                    isControversial: post._count.reports >= 3,
                    riskScore: Math.min(100, (post._count.reports * 20) + (post.is_frozen ? 50 : 0))
                }
            };
        });

        res.json({
            status: 'success',
            data: {
                posts: postsWithAnalytics,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / limit),
                    totalCount,
                    hasNext: page * limit < totalCount,
                    hasPrev: page > 1
                },
                filters: {
                    status,
                    sort
                }
            }
        });

    } catch (error) {
        console.error('Get admin posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching admin posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
