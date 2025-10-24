const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const { loggers } = require('../middleware/extendedLogger');

// Register a new admin
exports.registerAdmin = async (req, res) => {
    try {
        const { email, username, password } = req.body;

        // Validate required fields
        if (!email || !username || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Email, username, and password are required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid email format'
            });
        }

        // Validate password strength
        if (password.length < 6) {
            return res.status(400).json({
                status: 'error',
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check if admin already exists
        const existingAdmin = await prisma.admin.findFirst({
            where: {
                OR: [
                    { email: email.toLowerCase() },
                    { username: username.toLowerCase() }
                ]
            }
        });

        if (existingAdmin) {
            return res.status(409).json({
                status: 'error',
                message: 'Admin with this email or username already exists'
            });
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create admin
        const admin = await prisma.admin.create({
            data: {
                email: email.toLowerCase(),
                username: username.toLowerCase(),
                password: hashedPassword,
                status: 'active'
            },
            select: {
                id: true,
                email: true,
                username: true,
                status: true,
                createdAt: true
            }
        });

        res.status(201).json({
            status: 'success',
            message: 'Admin registered successfully',
            data: {
                admin
            }
        });

    } catch (error) {
        console.error('Admin registration error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error registering admin'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.searchPosts = async (req, res) => {
    try {
        const { query, type, page = 1, limit = 10 } = req.query;

        // Validate required parameters
        if (!query || !type) {
            return res.status(400).json({
                status: 'error',
                message: 'Query and type parameters are required'
            });
        }

        // Validate search type
        const validTypes = ['post_id', 'post_title', 'user_id', 'username', 'date', 'status'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid search type. Must be one of: ${validTypes.join(', ')}`
            });
        }

        // Build where clause based on search type
        let whereClause = {};
        let includeClause = {
            user: {
                select: {
                    id: true,
                    username: true,
                    email: true,
                    status: true,
                    profile_picture: true
                }
            },
            category: {
                select: {
                    id: true,
                    name: true
                }
            }
        };

        switch (type) {
            case 'post_id':
                whereClause.id = query;
                break;
            case 'post_title':
                whereClause.title = {
                    contains: query,
                    mode: 'insensitive'
                };
                break;
            case 'user_id':
                whereClause.user_id = query;
                break;
            case 'username':
                whereClause.user = {
                    username: {
                        contains: query,
                        mode: 'insensitive'
                    }
                };
                break;
            case 'date':
                const searchDate = new Date(query);
                if (isNaN(searchDate.getTime())) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid date format. Use YYYY-MM-DD'
                    });
                }
                const nextDay = new Date(searchDate.getTime() + 24 * 60 * 60 * 1000);
                whereClause.createdAt = {
                    gte: searchDate,
                    lt: nextDay
                };
                break;
            case 'status':
                const validStatuses = ['pending', 'approved', 'rejected', 'frozen'];
                if (!validStatuses.includes(query.toLowerCase())) {
                    return res.status(400).json({
                        status: 'error',
                        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                    });
                }
                whereClause.status = query.toLowerCase();
                break;
        }

        // Calculate pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Perform the search with pagination using Prisma
        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: whereClause,
                include: includeClause,
                orderBy: {
                    createdAt: 'desc'
                },
                take: parseInt(limit),
                skip: offset
            }),
            prisma.post.count({
                where: whereClause
            })
        ]);

        // Format the response
        const formattedPosts = posts.map(post => ({
            id: post.id,
            title: post.title,
            description: post.description,
            status: post.status,
            video_url: post.video_url,
            thumbnail_url: post.thumbnail_url,
            likes: post.likes,
            views: post.views,
            shares: post.shares,
            comments_count: post.comment_count,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            user_id: post.user_id,
            user: post.user,
            category: post.category
        }));

        res.json({
            status: 'success',
            data: {
                posts: formattedPosts,
                pagination: {
                    total: totalCount,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(totalCount / limit),
                    hasNext: page * limit < totalCount,
                    hasPrev: page > 1
                },
                searchInfo: {
                    query,
                    type,
                    resultsCount: formattedPosts.length
                }
            }
        });

    } catch (error) {
        console.error('Error searching posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while searching posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getDashboardData = async (req, res) => {
    try {
        // Get counts for different post statuses
        const totalPosts = await prisma.post.count();
        const pendingPosts = await prisma.post.count({ where: { status: 'pending' } });
        const approvedPosts = await prisma.post.count({ where: { status: 'approved' } });
        const rejectedPosts = await prisma.post.count({ where: { status: 'rejected' } });

        // Get recent posts with their authors and categories
        const recentPosts = await prisma.post.findMany({
            include: {
                author: {
                    select: {
                        id: true,
                        username: true
                    }
                },
                category: true
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 10
        });

        // Process media URLs for recent posts
        const processedPosts = recentPosts.map(post => {
            if (post.mediaUrl && !post.mediaUrl.startsWith('http')) {
                post.mediaUrl = `/uploads/${post.mediaUrl.replace(/^uploads\//, '')}`;
            }
            return post;
        });

        res.json({
            status: 'success',
            data: {
                stats: {
                    total: totalPosts,
                    pending: pendingPosts,
                    approved: approvedPosts,
                    rejected: rejectedPosts
                },
                recentPosts: processedPosts
            }
        });

    } catch (error) {
        console.error('Error in getDashboardData:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching dashboard data'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getPosts = async (req, res) => {
    try {
        const { status = 'all' } = req.query;
        
        const where = {};
        if (status !== 'all') {
            where.status = status;
        }

        const posts = await prisma.post.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true
                    }
                },
                approver: {
                    select: {
                        id: true,
                        username: true
                    }
                },
                category: true,
                likes: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true
                            }
                        }
                    }
                },
                comments: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true
                            }
                        }
                    }
                },
                shares: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true
                            }
                        }
                    }
                },
                views: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true
                            }
                        }
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
        console.error('Error fetching posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching posts'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get pending posts
exports.getPendingPosts = async (req, res) => {
    try {
        const posts = await prisma.post.findMany({
            where: { status: 'pending' },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true
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
            }
        });

        res.json({
            status: 'success',
            data: { posts }
        });
    } catch (error) {
        console.error('Error getting pending posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching pending posts'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Update post status (approve/reject)
exports.updatePostStatus = async (req, res) => {
    try {
        console.log(req.body)
        const { status, rejectionReason } = req.body;
        console.log("Post: --------> " + req.body)
        
        // Find post with user information
        const post = await prisma.post.findUnique({
            where: { id: req.body.id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            }
        });
        
        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found'
            });
        }

        if (status === 'rejected' && !rejectionReason) {
            return res.status(400).json({
                status: 'error',
                message: 'Rejection reason is required'
            });
        }

        await prisma.post.update({
            where: { id: req.body.id },
            data: {
                status,
                rejectionReason: status === 'rejected' ? rejectionReason : null,
                approver_id: req.user.id,
                approved_at: status === 'approved' ? new Date() : null
            }
        });

        // Create notification for post owner
        if (post.user && post.user.id) {
            // Create notification message based on status
            let notificationText = '';
            if (status === 'approved') {
                notificationText = `Your post "${post.title}" has been approved.`;
            } else if (status === 'rejected') {
                notificationText = `Your post "${post.title}" has been rejected. Reason: ${rejectionReason}`;
            }

            // Insert notification
            await prisma.notification.create({
                data: {
                    userID: post.user.id,
                    message: notificationText,
                    type: 'post_status_update',
                    isRead: false
                }
            });
            
            console.log(`Notification sent to user ${post.user.id} for post ${post.id} with status ${status}`);
        }

        res.json({
            status: 'success',
            message: `Post ${status} successfully`
        });
    } catch (error) {
        console.error('Error updating post status:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating post status'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get admin dashboard stats
exports.getDashboardStats = async (req, res) => {
    try {
        // Get counts using Prisma
        const stats = await Promise.all([
            prisma.user.count(),
            prisma.approver.count(),
            prisma.post.count({ where: { status: 'pending' } }),
            prisma.post.count({ where: { status: 'approved' } }),
            prisma.post.count({ where: { status: 'rejected' } }),
            prisma.post.count({ where: { status: 'frozen' } }),
            prisma.user.count({ where: { status: 'active' } }),
            prisma.user.count({ where: { status: 'frozen' } })
        ]);

        const [totalUsers, totalApprovers, pendingVideos, approvedVideos, rejectedVideos, flaggedVideos, activeUsers, frozenUsers] = stats;

        res.json({
            status: 'success',
            data: {
                totalUsers,
                totalApprovers,
                pendingVideos,
                approvedVideos,
                rejectedVideos,
                flaggedVideos,
                activeUsers,
                frozenUsers
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch dashboard statistics',
            details: error.message
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Account Management
exports.manageUserAccount = async (req, res) => {
    try {
        const { id, action } = req.body;

        // First, get the current user status
        const user = await prisma.user.findUnique({
            where: { id }
        });
        
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Determine the new status based on current status and action
        let newStatus;
        if (action === 'freeze') {
            if (user.status === 'active') {
                newStatus = 'frozen';
            } else {
                return res.status(400).json({
                    status: 'error',
                    message: 'User is not active and cannot be frozen'
                });
            }
        } else if (action === 'reactivate') {
            if (user.status === 'frozen') {
                newStatus = 'active';
            } else {
                return res.status(400).json({
                    status: 'error',
                    message: 'User is not frozen and cannot be reactivated'
                });
            }
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid action. Use "freeze" or "reactivate"'
            });
        }

        // Update the user status
        await prisma.user.update({
            where: { id },
            data: { status: newStatus }
        });

        res.json({
            status: 'success',
            message: `Account ${action}d successfully`,
            data: {
                userId: id,
                previousStatus: user.status,
                newStatus: newStatus
            }
        });
    } catch (error) {
        console.error('Error managing account:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error managing account',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getApprovedPosts = async (req, res) => {
    try {
        const { date, search, page = 1, limit = 10 } = req.query;
        const approverUsername = req.user.id;
        const whereClause = {
            status: 'approved',
            // approver_id: approverUsername
        };

        if (date) {
            const searchDate = new Date(date);
            whereClause.approved_at = {
                gte: searchDate,
                lt: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000)
            };
        }

        if (search) {
            whereClause.title = {
                contains: search,
                mode: 'insensitive'
            };
        }

        const [posts, total] = await Promise.all([
            prisma.post.findMany({
                where: whereClause,
                include: {
                    user: {
                        select: {
                            username: true,
                            email: true
                        }
                    }
                },
                orderBy: {
                    approved_at: 'desc'
                },
                take: parseInt(limit),
                skip: (page - 1) * limit
            }),
            prisma.post.count({
                where: whereClause
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts: posts,
                total: total,
                pages: Math.ceil(total / limit),
                currentPage: parseInt(page)
            }
        });
    } catch (error) {
        console.error('Approved posts fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching approved posts'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Video Management
exports.getAllVideos = async (req, res) => {
    try {
        const videos = await prisma.post.findMany({
            include: {
                user: {
                    select: {
                        username: true
                    }
                }
            }
        });
        res.json({
            status: 'success',
            data: { videos }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Error fetching videos'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Approver Management
exports.registerApprover = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const adminUsername = req.user.username;

        // Check if approver exists with the same email or username
        const existingApprover = await Approver.findOne({
            where: {
                [Op.or]: [
                    { email: email },
                    { username: username }
                ]
            }
        });

        if (existingApprover) {
            return res.status(409).json({
                status: 'error',
                message: 'Approver already exists',
                data: {
                    exists: true,
                    field: existingApprover.email === email ? 'email' : 'username'
                }
            });
        }

        // Hash password before storing
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new approver using Sequelize model
        await Approver.create({
            username,
            email,
            password: hashedPassword,
            registeredBy: adminUsername,
            role: 'approver',
            status: 'active',
            can_view_approved: true,
            can_view_pending: true,
            can_view_all_accounts: true
        });

        res.status(201).json({
            status: 'success',
            message: 'Approver registered successfully'
        });
    } catch (error) {
        console.error('Error registering approver:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error registering approver'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.removeApprover = async (req, res) => {
    try {
        const { id } = req.params;
        await Approver.destroy({
            where: { id }
        });
        res.json({
            status: 'success',
            message: 'Approver removed successfully'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Error removing approver'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Messaging
exports.sendMessageToAllUsers = async (req, res) => {
    try {
        const { message } = req.body;

        const users = await User.findAll({
            attributes: ['username']
        });

        await Promise.all(users.map(user => 
            Notification.create({
                userID: user.username,
                notification_text: message,
                notification_date: new Date()
            })
        ));

        res.json({
            status: 'success',
            message: 'Message sent to all users successfully'
        });
    } catch (error) {
        console.error('Message sending error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error sending message'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.sendMessageToApprovers = async (req, res) => {
    try {
        const { message } = req.body;

        const approvers = await Approver.findAll({
            attributes: ['username']
        });

        await Promise.all(approvers.map(approver => 
            Notification.create({
                userID: approver.username,
                notification_text: message,
                notification_date: new Date()
            })
        ));

        res.json({
            status: 'success',
            message: 'Message sent to all approvers successfully'
        });
    } catch (error) {
        console.error('Message sending error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error sending message'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Statistics and Reports
exports.getAdminDashboardStats = async (req, res) => {
    try {
        const [
            totalUsers,
            totalApprovers,
            totalPosts,
            pendingPosts,
            approvedPosts
        ] = await Promise.all([
            User.count(),
            Approver.count(),
            Post.count(),
            Post.count({ where: { status: 'pending' } }),
            Post.count({ where: { status: 'approved' } })
        ]);

        res.json({
            status: 'success',
            data: {
                totalUsers,
                totalApprovers,
                totalPosts,
                pendingPosts,
                approvedPosts
            }
        });
    } catch (error) {
        console.error('Stats fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching dashboard statistics'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.uploadAd = async (req, res) => {
    try {
        const adminUsername = req.user.username;
        
        const admin = await Admin.findByPk(adminUsername);
        if (!admin.ads_management) {
            return res.status(403).json({
                status: 'error',
                message: 'Not authorized to manage ads'
            });
        }

        await Ad.create({
            uploaderID: adminUsername,
            ad_video: req.file.buffer,
            status: 'active'
        });

        res.status(201).json({
            status: 'success',
            message: 'Ad uploaded successfully'
        });
    } catch (error) {
        console.error('Ad upload error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error uploading ad'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        // Get users with basic information
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                createdAt: true,
                status: true,
                posts_count: true,
                phone1: true,
                phone2: true
            }
        });

        // Get approved and pending post counts for all users
        const approvedCounts = await prisma.post.groupBy({
            by: ['user_id'],
            where: { status: 'approved' },
            _count: {
                id: true
            }
        });

        const pendingCounts = await prisma.post.groupBy({
            by: ['user_id'],
            where: { status: 'pending' },
            _count: {
                id: true
            }
        });

        // Create lookup maps for quick access
        const approvedCountMap = {};
        const pendingCountMap = {};
            
        approvedCounts.forEach(count => {
            approvedCountMap[count.user_id] = count._count.id;
        });
            
        pendingCounts.forEach(count => {
            pendingCountMap[count.user_id] = count._count.id;
        });

        // Enhance user objects with post counts
        const enhancedUsers = users.map(user => {
            return {
                ...user,
                postsApproved: approvedCountMap[user.id] || 0,
                postsPending: pendingCountMap[user.id] || 0
            };
        });

        res.json({
            status: 'success',
            data: { users: enhancedUsers }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching users'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getRecentActivity = async (req, res) => {
    try {
        const recentPosts = await Post.findAll({
            limit: 10,
            order: [['updatedAt', 'DESC']],
            include: [
                {
                    model: User,
                    attributes: ['username']
                },
                {
                    model: Approver,
                    attributes: ['username']
                }
            ]
        });

        const activity = recentPosts.map(post => ({
            action: post.status === 'approved' ? 'Video Approved' : 
                    post.status === 'rejected' ? 'Video Rejected' : 
                    'Video Submitted',
            user: post.User?.username || 'Unknown User',
            approver: post.Approver?.username,
            details: `Video: ${post.title}`,
            date: post.updatedAt
        }));

        res.json({
            status: 'success',
            data: activity
        });
    } catch (error) {
        console.error('Error getting recent activity:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get recent activity'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getApprovers = async (req, res) => {
    try {
        const approvers = await prisma.approver.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                status: true,
                createdAt: true,
                last_login: true,
                _count: {
                    select: {
                        approvedPosts: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Process approvers data
        const processedApprovers = approvers.map(approver => ({
            id: approver.id,
            username: approver.username,
            email: approver.email,
            status: approver.status,
            joinedDate: approver.createdAt,
            lastActive: approver.last_login,
            totalApprovedPosts: approver._count.approvedPosts || 0,
            performance: {
                approvalRate: 0,
                averageResponseTime: 0
            }
        }));

        res.json({
            status: 'success',
            data: {
                approvers: processedApprovers,
                total: processedApprovers.length
            }
        });

    } catch (error) {
        console.error('Error fetching approvers:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch approvers'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getApproverDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const approver = await Approver.findByPk(id, {
            attributes: [
                'id',
                'username',
                'email',
                'status',
                'createdAt',
                'lastLoginAt'
            ]
        });

        if (!approver) {
            return res.status(404).json({
                status: 'error',
                message: 'Approver not found'
            });
        }

        // Get recent approved posts using a separate query
        const recentPosts = await prisma.post.findMany({
            where: { approver_id: id },
            select: {
                id: true,
                title: true,
                status: true,
                createdAt: true
            },
            take: 10,
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Get statistics
        const stats = await prisma.post.groupBy({
            by: ['status'],
            where: { approver_id: id },
            _count: {
                id: true
            }
        });

        // Process statistics
        const statistics = {
            approved: 0,
            rejected: 0,
            pending: 0
        };

        stats.forEach(stat => {
            statistics[stat.status] = parseInt(stat.getDataValue('count'));
        });

        // Calculate average response time
        const averageResponseTime = await Post.findOne({
            where: { approver_id: id },
            attributes: [
                [
                    sequelize.fn('AVG', 
                        sequelize.fn('EXTRACT', sequelize.literal('EPOCH FROM (\"updatedAt\" - \"createdAt\")')
                    )),
                    'avgResponseTime'
                ]
            ]
        });

        res.json({
            status: 'success',
            data: {
                approver: {
                    id: approver.id,
                    username: approver.username,
                    email: approver.email,
                    status: approver.status,
                    joinedDate: approver.createdAt,
                    lastActive: approver.lastLoginAt,
                    statistics: {
                        ...statistics,
                        totalPosts: Object.values(statistics).reduce((a, b) => a + b, 0),
                        averageResponseTime: averageResponseTime?.getDataValue('avgResponseTime') || 0
                    },
                    recentActivity: recentPosts.map(post => ({
                        id: post.id,
                        title: post.title,
                        status: post.status,
                        date: post.createdAt
                    }))
                }
            }
        });

    } catch (error) {
        console.error('Error fetching approver details:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch approver details'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.updateApproverStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const approver = await Approver.findByPk(id);

        if (!approver) {
            return res.status(404).json({
                status: 'error',
                message: 'Approver not found'
            });
        }

        await approver.update({ status });

        res.json({
            status: 'success',
            message: 'Approver status updated successfully',
            data: {
                id: approver.id,
                username: approver.username,
                status: approver.status
            }
        });

    } catch (error) {
        console.error('Error updating approver status:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update approver status'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Profile Management
exports.getProfile = async (req, res) => {
    try {
        const admin = await Admin.findByPk(req.user.id, {
            attributes: ['id', 'username', 'email', 'createdAt', 'lastLoginAt']
        });

        if (!admin) {
            return res.status(404).json({
                status: 'error',
                message: 'Admin profile not found'
            });
        }

        res.json({
            status: 'success',
            data: {
                profile: {
                    id: admin.id,
                    username: admin.username,
                    email: admin.email,
                    joinedDate: admin.createdAt,
                    lastActive: admin.lastLoginAt
                }
            }
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching admin profile'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { username, email } = req.body;
        const admin = await Admin.findByPk(req.user.id);

        if (!admin) {
            return res.status(404).json({
                status: 'error',
                message: 'Admin profile not found'
            });
        }

        // Check if username or email already exists
        const existingAdmin = await Admin.findOne({
            where: {
                [Op.and]: [
                    { id: { [Op.ne]: req.user.id } },
                    { [Op.or]: [{ username }, { email }] }
                ]
            }
        });

        if (existingAdmin) {
            return res.status(400).json({
                status: 'error',
                message: 'Username or email already exists'
            });
        }

        await admin.update({
            username,
            email,
            updatedAt: new Date()
        });

        res.json({
            status: 'success',
            message: 'Profile updated successfully',
            data: {
                profile: {
                    id: admin.id,
                    username: admin.username,
                    email: admin.email,
                    updatedAt: admin.updatedAt
                }
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating admin profile'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const admin = await Admin.findByPk(req.user.id);

        if (!admin) {
            return res.status(404).json({
                status: 'error',
                message: 'Admin profile not found'
            });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, admin.password);
        if (!isValidPassword) {
            return res.status(401).json({
                status: 'error',
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await admin.update({
            password: hashedPassword,
            updatedAt: new Date()
        });

        res.json({
            status: 'success',
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error changing password'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Add these new methods
exports.getRecentPosts = async (req, res) => {
    try {
        const posts = await Post.findAll({
            include: [{
                model: User,
                as: 'author',
                attributes: ['username'],
                foreignKey: 'user_id'
            }],
            order: [['createdAt', 'DESC']],
            limit: 10
        });

        res.json({
            status: 'success',
            posts
        });
    } catch (error) {
        console.error('Error fetching recent posts:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Failed to fetch recent posts' 
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getMostViewedPosts = async (req, res) => {
    try {
        const posts = await Post.findAll({
            include: [{
                model: User,
                as: 'author',
                attributes: ['username'],
                foreignKey: 'user_id'
            }],
            order: [['views', 'DESC']],
            limit: 10
        });

        res.json({
            status: 'success',
            posts
        });
    } catch (error) {
        console.error('Error fetching most viewed posts:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Failed to fetch most viewed posts' 
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.searchByTraceId = async (req, res) => {
    try {
        const { type, id } = req.params;

        if (type === 'post') {
            const post = await prisma.post.findUnique({
                where: { id: id },
                include: {
                    user: {
                        select: {
                            username: true,
                            email: true
                        }
                    }
                }
            });

            if (!post) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Post not found'
                });
            }

            res.json({
                status: 'success',
                post
            });
        } else if (type === 'user') {
            const user = await User.findOne({
                where: { id },
                attributes: { exclude: ['password'] }
            });

            if (!user) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            res.json({
                status: 'success',
                user
            });
        } else {
            res.status(400).json({
                status: 'error',
                message: 'Invalid search type'
            });
        }
    } catch (error) {
        console.error('Error searching by trace ID:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Failed to search by ID' 
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getRejectedPosts = async (req, res) => {
    try {
        const posts = await prisma.post.findMany({
            where: {
                status: 'rejected'
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
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Add full URLs for files (Supabase URLs are already complete)
        const postsWithUrls = posts.map(post => {
            if (post.video_url) {
                post.fullUrl = post.video_url; // Supabase URL is already complete
            }
            return post;
        });

        res.json({
            status: 'success',
            data: postsWithUrls
        });
    } catch (error) {
        console.error('Error getting rejected posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error getting rejected posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getAllApprovedPostsByApprover = async (req, res) => {
    try {
        const { approverId } = req.params;

        // Check if the approver exists
        const approver = await Approver.findByPk(approverId);
        if (!approver) {
            return res.status(404).json({
                status: 'error',
                message: 'Approver not found'
            });
        }

        // Get all approved and rejected posts by this approver
        const posts = await Post.findAll({
            where: {
                status: {
                    [Op.in]: ['approved', 'rejected']
                },
                approver_id: approverId
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
            order: [['updated_at', 'DESC']]
        });

        // Get the counts for both approved and rejected posts
        const [approvedCount, rejectedCount] = await Promise.all([
            Post.count({
                where: {
                    status: 'approved',
                    approver_id: approverId
                }
            }),
            Post.count({
                where: {
                    status: 'rejected',
                    approver_id: approverId
                }
            })
        ]);

        // Add full URLs for files (Supabase URLs are already complete)
        const postsWithUrls = posts.map(post => {
            const postData = post.toJSON();
            if (postData.video_url) {
                postData.fullUrl = postData.video_url; // Supabase URL is already complete
            }
            return postData;
        });

        res.json({
            status: 'success',
            data: {
                approver: {
                    id: approver.id,
                    username: approver.username,
                    email: approver.email
                },
                posts: postsWithUrls,
                statistics: {
                    totalApproved: approvedCount,
                    totalRejected: rejectedCount,
                    totalProcessed: approvedCount + rejectedCount
                }
            }
        });
    } catch (error) {
        console.error('Error getting posts by approver:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error getting posts by approver',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getUsersStats = async (req, res) => {
    try {
        // Get total number of users
        const totalUsers = await User.count();

        // Get number of active users
        const activeUsers = await User.count({
            where: {
                status: 'active'
            }
        });

        // Get number of frozen users
        const frozenUsers = await User.count({
            where: {
                status: 'frozen'
            }
        });

        // Get total number of posts
        const totalPosts = await Post.count();

        // Get number of approved posts
        const approvedPosts = await Post.count({
            where: {
                status: 'approved'
            }
        });

        // Get number of pending posts
        const pendingPosts = await Post.count({
            where: {
                status: 'pending'
            }
        });

        res.json({
            status: 'success',
            data: {
                users: {
                    total: totalUsers,
                    active: activeUsers,
                    frozen: frozenUsers
                },
                posts: {
                    total: totalPosts,
                    approved: approvedPosts,
                    pending: pendingPosts
                }
            }
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching user statistics'
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getUserStats = async (req, res) => {
    try {
        // Get user statistics
        const totalUsers = await User.count();
        const activeUsers = await User.count({ where: { status: 'active' } });
        const frozenUsers = await User.count({ where: { status: 'frozen' } });

        // Get post statistics
        const totalPosts = await Post.count();
        const approvedPosts = await Post.count({ where: { status: 'approved' } });
        const pendingPosts = await Post.count({ where: { status: 'pending' } });

        res.json({
            status: 'success',
            data: {
                users: {
                    total: totalUsers,
                    active: activeUsers,
                    frozen: frozenUsers
                },
                posts: {
                    total: totalPosts,
                    approved: approvedPosts,
                    pending: pendingPosts
                }
            }
        });
    } catch (error) {
        console.error('Error getting user stats:', error);
        // Return default values in case of error
        res.status(500).json({
            status: 'error',
            data: {
                users: {
                    total: 0,
                    active: 0,
                    frozen: 0
                },
                posts: {
                    total: 0,
                    approved: 0,
                    pending: 0
                }
            }
        });
    }
};

// Get flagged posts (posts with 5+ reports)
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    category: true,
                    reports: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
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
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    frozen_at: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { 
                    status: 'frozen',
                    is_frozen: true
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
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
        console.error('Get flagged posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching flagged posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

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
