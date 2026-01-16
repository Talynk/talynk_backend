const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const { loggers } = require('../middleware/extendedLogger');
const { emitEvent } = require('../lib/realtime');

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

// NOTE: getFlaggedPosts is defined later in this file (line ~4528)
// This duplicate has been removed to avoid confusion

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
                    profile_picture: true,
                    bio: true
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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
        const pendingPosts = await prisma.post.count({ where: { status: 'draft' } });
        const approvedPosts = await prisma.post.count({ where: { status: 'active' } });
        const rejectedPosts = await prisma.post.count({ where: { status: 'suspended' } });

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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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
            where: { status: 'draft' },
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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

        // Map status values to enum
        let mappedStatus;
        if (status === 'approved' || status === 'active') {
            mappedStatus = 'active';
        } else if (status === 'rejected' || status === 'suspended') {
            mappedStatus = 'suspended';
            if (!rejectionReason) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Rejection reason is required'
                });
            }
        } else if (status === 'pending' || status === 'draft') {
            mappedStatus = 'draft';
        } else {
            mappedStatus = status; // Use as-is if already valid enum value
        }

        if (mappedStatus === 'suspended' && !rejectionReason) {
            return res.status(400).json({
                status: 'error',
                message: 'Rejection reason is required'
            });
        }

        await prisma.post.update({
            where: { id: req.body.id },
            data: {
                status: mappedStatus,
                rejectionReason: mappedStatus === 'suspended' ? rejectionReason : null,
                approver_id: req.user.id,
                approved_at: mappedStatus === 'active' ? new Date() : null
            }
        });

        // Create notification for post owner
        if (post.user && post.user.id) {
            // Create notification message based on status
            let notificationText = '';
            if (mappedStatus === 'active') {
                notificationText = `Your post "${post.title}" has been approved.`;
            } else if (mappedStatus === 'suspended') {
                notificationText = `Your post "${post.title}" has been rejected. Reason: ${rejectionReason}`;
            }

            // Insert notification (userID must be username, not user ID)
            if (post.user?.username) {
                await prisma.notification.create({
                    data: {
                        userID: post.user.username,
                        message: notificationText,
                        type: 'post_status_update',
                        isRead: false
                    }
                });
            }
            
            console.log(`Notification sent to user ${post.user.id} for post ${post.id} with status ${status}`);
        }

        // Check and auto-suspend user if they have 3+ suspended posts
        if (mappedStatus === 'suspended' && post.user_id) {
            const { checkAndSuspendUser } = require('../utils/userSuspensionService');
            const suspensionResult = await checkAndSuspendUser(post.user_id, req.body.id);
            
            if (suspensionResult.suspended) {
                console.log(`[Admin] User ${post.user?.username} automatically suspended: ${suspensionResult.message}`);
            }
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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
// DEPRECATED: This function has been replaced by the more comprehensive version at line 4616
// Keeping for backward compatibility but should be removed in future versions
// Use the version with date filtering instead

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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
        const { id, action, reason } = req.body;

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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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
            status: 'active',
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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
        const { email } = req.body;

        // Validate required fields
        if (!email) {
            return res.status(400).json({
                status: 'error',
                message: 'Email is required'
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

        // Check if approver exists with the same email
        const existingApprover = await prisma.approver.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (existingApprover) {
            return res.status(409).json({
                status: 'error',
                message: 'Approver with this email already exists',
                data: {
                    exists: true,
                    field: 'email'
                }
            });
        }

        // Generate onboarding token
        const crypto = require('crypto');
        const onboardingToken = crypto.randomBytes(32).toString('hex');

        // Create new approver with pending status
        const approver = await prisma.approver.create({
            data: {
                email: email.toLowerCase(),
                onboarding_token: onboardingToken,
                password_set: false,
                status: 'pending'
            },
            select: {
                id: true,
                email: true,
                status: true,
                createdAt: true
            }
        });

        // Send onboarding email with link
        const { sendApproverOnboardingEmail } = require('../services/emailService');
        const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
        const onboardingLink = `${frontendUrl}/approver/onboarding?token=${onboardingToken}`;
        
        try {
            await sendApproverOnboardingEmail(email, onboardingLink);
        } catch (emailError) {
            console.error('Error sending onboarding email:', emailError);
            // Continue even if email fails - admin can resend later
        }

        res.status(201).json({
            status: 'success',
            message: 'Approver created successfully. Onboarding link has been sent to their email.',
            data: {
                approver,
                onboardingLink: process.env.NODE_ENV === 'development' ? onboardingLink : undefined
            }
        });
    } catch (error) {
        console.error('Error registering approver:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error registering approver',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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

        // Check if approver exists
        const approver = await prisma.approver.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        posts: true
                    }
                }
            }
        });

        if (!approver) {
            return res.status(404).json({
                status: 'error',
                message: 'Approver not found'
            });
        }

        // Check if approver has any posts - warn but still allow deletion
        const hasPosts = approver._count.posts > 0;

        // Delete approver
        await prisma.approver.delete({
            where: { id }
        });

        res.json({
            status: 'success',
            message: 'Approver deleted successfully',
            data: {
                deletedApprover: {
                    id: approver.id,
                    username: approver.username,
                    email: approver.email
                },
                warning: hasPosts ? 'Approver had associated posts. Posts remain but approver reference removed.' : null
            }
        });
    } catch (error) {
        console.error('Error removing approver:', error);
        
        // Handle foreign key constraint errors
        if (error.code === 'P2003') {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot delete approver. They have associated records that need to be handled first.',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error removing approver',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Deactivate approver (soft delete by setting status to inactive)
exports.deactivateApprover = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if approver exists
        const approver = await prisma.approver.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        posts: true
                    }
                }
            }
        });

        if (!approver) {
            return res.status(404).json({
                status: 'error',
                message: 'Approver not found'
            });
        }

        // Check if already inactive
        if (approver.status === 'inactive') {
            return res.status(400).json({
                status: 'error',
                message: 'Approver is already inactive'
            });
        }

        // Update approver status to inactive
        const updatedApprover = await prisma.approver.update({
            where: { id },
            data: {
                status: 'inactive',
                updatedAt: new Date()
            },
            select: {
                id: true,
                username: true,
                email: true,
                status: true,
                updatedAt: true
            }
        });

        res.json({
            status: 'success',
            message: 'Approver deactivated successfully',
            data: {
                approver: updatedApprover,
                totalPosts: approver._count.posts
            }
        });
    } catch (error) {
        console.error('Error deactivating approver:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error deactivating approver',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Activate approver (reactivate a deactivated approver)
exports.activateApprover = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if approver exists
        const approver = await prisma.approver.findUnique({
            where: { id }
        });

        if (!approver) {
            return res.status(404).json({
                status: 'error',
                message: 'Approver not found'
            });
        }

        // Check if already active
        if (approver.status === 'active') {
            return res.status(400).json({
                status: 'error',
                message: 'Approver is already active'
            });
        }

        // Update approver status to active
        const updatedApprover = await prisma.approver.update({
            where: { id },
            data: {
                status: 'active',
                updatedAt: new Date()
            },
            select: {
                id: true,
                username: true,
                email: true,
                status: true,
                updatedAt: true
            }
        });

        res.json({
            status: 'success',
            message: 'Approver activated successfully',
            data: {
                approver: updatedApprover
            }
        });
    } catch (error) {
        console.error('Error activating approver:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error activating approver',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Suspend approver (temporarily disable access)
exports.suspendApprover = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        // Check if approver exists
        const approver = await prisma.approver.findUnique({
            where: { id }
        });

        if (!approver) {
            return res.status(404).json({
                status: 'error',
                message: 'Approver not found'
            });
        }

        if (approver.status === 'suspended') {
            return res.status(400).json({
                status: 'error',
                message: 'Approver is already suspended'
            });
        }

        // Update approver status to suspended
        const updatedApprover = await prisma.approver.update({
            where: { id },
            data: {
                status: 'suspended',
                updatedAt: new Date()
            },
            select: {
                id: true,
                username: true,
                email: true,
                status: true,
                createdAt: true,
                last_login: true
            }
        });

        res.json({
            status: 'success',
            message: 'Approver suspended successfully',
            data: {
                approver: updatedApprover,
                reason: reason || 'Suspended by admin'
            }
        });
    } catch (error) {
        console.error('Error suspending approver:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error suspending approver',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get approver stats with time range filter
exports.getApproverStats = async (req, res) => {
    try {
        const { approverId } = req.params;
        const { period = 'days', value = 7 } = req.query; // period: hours, days, weeks, months, annual

        // Check if approver exists
        const approver = await prisma.approver.findUnique({
            where: { id: approverId },
            select: {
                id: true,
                username: true,
                email: true,
                status: true,
                createdAt: true,
                last_login: true
            }
        });

        if (!approver) {
            return res.status(404).json({
                status: 'error',
                message: 'Approver not found'
            });
        }

        // Calculate date range based on period
        const now = new Date();
        let startDate = new Date();

        switch (period) {
            case 'hours':
                startDate = new Date(now.getTime() - parseInt(value) * 60 * 60 * 1000);
                break;
            case 'days':
                startDate = new Date(now.getTime() - parseInt(value) * 24 * 60 * 60 * 1000);
                break;
            case 'weeks':
                startDate = new Date(now.getTime() - parseInt(value) * 7 * 24 * 60 * 60 * 1000);
                break;
            case 'months':
                startDate = new Date(now);
                startDate.setMonth(startDate.getMonth() - parseInt(value));
                break;
            case 'annual':
                startDate = new Date(now);
                startDate.setFullYear(startDate.getFullYear() - parseInt(value));
                break;
            default:
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default: 7 days
        }

        // Get stats for the time period
        const [
            totalReviewed,
            approvedCount,
            rejectedCount,
            suspendedCount,
            averageResponseTime
        ] = await Promise.all([
            // Total reviewed posts
            prisma.post.count({
                where: {
                    approver_id: approverId,
                    updatedAt: {
                        gte: startDate
                    }
                }
            }),
            // Approved posts
            prisma.post.count({
                where: {
                    approver_id: approverId,
                    status: 'active',
                    updatedAt: {
                        gte: startDate
                    }
                }
            }),
            // Rejected posts (suspended status)
            prisma.post.count({
                where: {
                    approver_id: approverId,
                    status: 'suspended',
                    updatedAt: {
                        gte: startDate
                    }
                }
            }),
            // Suspended posts
            prisma.post.count({
                where: {
                    approver_id: approverId,
                    status: 'suspended',
                    updatedAt: {
                        gte: startDate
                    }
                }
            }),
            // Calculate average response time (time between post creation and approval/rejection)
            prisma.post.findMany({
                where: {
                    approver_id: approverId,
                    updatedAt: {
                        gte: startDate
                    },
                    approved_at: {
                        not: null
                    }
                },
                select: {
                    createdAt: true,
                    approved_at: true
                }
            })
        ]);

        // Calculate average response time in hours
        let avgResponseTime = 0;
        if (averageResponseTime.length > 0) {
            const totalResponseTime = averageResponseTime.reduce((sum, post) => {
                if (post.approved_at) {
                    const responseTime = post.approved_at.getTime() - post.createdAt.getTime();
                    return sum + responseTime;
                }
                return sum;
            }, 0);
            avgResponseTime = (totalResponseTime / averageResponseTime.length) / (1000 * 60 * 60); // Convert to hours
        }

        // Get recent activity (last 10 actions)
        const recentActivity = await prisma.post.findMany({
            where: {
                approver_id: approverId,
                updatedAt: {
                    gte: startDate
                }
            },
            select: {
                id: true,
                title: true,
                status: true,
                updatedAt: true,
                user: {
                    select: {
                        username: true
                    }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            },
            take: 10
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
                    lastActive: approver.last_login
                },
                period: {
                    type: period,
                    value: parseInt(value),
                    startDate,
                    endDate: now
                },
                statistics: {
                    totalReviewed,
                    approved: approvedCount,
                    rejected: rejectedCount,
                    suspended: suspendedCount,
                    approvalRate: totalReviewed > 0 ? ((approvedCount / totalReviewed) * 100).toFixed(2) : 0,
                    rejectionRate: totalReviewed > 0 ? ((rejectedCount / totalReviewed) * 100).toFixed(2) : 0,
                    averageResponseTimeHours: avgResponseTime.toFixed(2)
                },
                recentActivity
            }
        });
    } catch (error) {
        console.error('Error fetching approver stats:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching approver statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get approver analytics for graphs
exports.getApproverAnalytics = async (req, res) => {
    try {
        const { approverId } = req.params;
        const { period = 'days', value = 30, groupBy = 'day' } = req.query;

        // Check if approver exists
        const approver = await prisma.approver.findUnique({
            where: { id: approverId },
            select: {
                id: true,
                username: true,
                email: true
            }
        });

        if (!approver) {
            return res.status(404).json({
                status: 'error',
                message: 'Approver not found'
            });
        }

        // Calculate date range
        const now = new Date();
        let startDate = new Date();

        switch (period) {
            case 'hours':
                startDate = new Date(now.getTime() - parseInt(value) * 60 * 60 * 1000);
                break;
            case 'days':
                startDate = new Date(now.getTime() - parseInt(value) * 24 * 60 * 60 * 1000);
                break;
            case 'weeks':
                startDate = new Date(now.getTime() - parseInt(value) * 7 * 24 * 60 * 60 * 1000);
                break;
            case 'months':
                startDate = new Date(now);
                startDate.setMonth(startDate.getMonth() - parseInt(value));
                break;
            case 'annual':
                startDate = new Date(now);
                startDate.setFullYear(startDate.getFullYear() - parseInt(value));
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Get all posts reviewed in the period
        const posts = await prisma.post.findMany({
            where: {
                approver_id: approverId,
                updatedAt: {
                    gte: startDate
                }
            },
            select: {
                id: true,
                status: true,
                updatedAt: true,
                approved_at: true
            },
            orderBy: {
                updatedAt: 'asc'
            }
        });

        // Group data by time period
        const analyticsData = {};

        posts.forEach(post => {
            const date = new Date(post.updatedAt);
            let key = '';

            if (groupBy === 'hour') {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
            } else if (groupBy === 'day') {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            } else if (groupBy === 'week') {
                const week = Math.ceil(date.getDate() / 7);
                key = `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
            } else if (groupBy === 'month') {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            } else {
                key = `${date.getFullYear()}`;
            }

            if (!analyticsData[key]) {
                analyticsData[key] = {
                    date: key,
                    approved: 0,
                    rejected: 0,
                    suspended: 0,
                    total: 0
                };
            }

            analyticsData[key].total++;
            if (post.status === 'active') {
                analyticsData[key].approved++;
            } else if (post.status === 'suspended') {
                analyticsData[key].rejected++;
                analyticsData[key].suspended++;
            }
        });

        // Convert to array and sort by date
        const chartData = Object.values(analyticsData).sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
        });

        // Calculate totals
        const totals = {
            approved: posts.filter(p => p.status === 'active').length,
            rejected: posts.filter(p => p.status === 'suspended').length,
            suspended: posts.filter(p => p.status === 'suspended').length,
            total: posts.length
        };

        res.json({
            status: 'success',
            data: {
                approver: {
                    id: approver.id,
                    username: approver.username,
                    email: approver.email
                },
                period: {
                    type: period,
                    value: parseInt(value),
                    groupBy,
                    startDate,
                    endDate: now
                },
                chartData,
                totals
            }
        });
    } catch (error) {
        console.error('Error fetching approver analytics:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching approver analytics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get reviewed posts by approver with decisions
exports.getApproverReviewedPosts = async (req, res) => {
    try {
        const { approverId } = req.params;
        const { page = 1, limit = 20, status, decision, startDate, endDate } = req.query;
        const offset = (page - 1) * limit;

        // Check if approver exists
        const approver = await prisma.approver.findUnique({
            where: { id: approverId },
            select: {
                id: true,
                username: true,
                email: true,
                status: true
            }
        });

        if (!approver) {
            return res.status(404).json({
                status: 'error',
                message: 'Approver not found'
            });
        }

        // Build where clause
        const whereClause = {
            approver_id: approverId
        };

        // Filter by status/decision
        if (status || decision) {
            const decisionStatus = status || decision;
            if (['active', 'approved', 'rejected', 'suspended'].includes(decisionStatus)) {
                // Map user-friendly status names to enum values
                if (decisionStatus === 'approved') {
                    whereClause.status = 'active';
                } else if (decisionStatus === 'rejected') {
                    whereClause.status = 'suspended';
                } else {
                    whereClause.status = decisionStatus;
                }
            }
        }

        // Filter by date range
        if (startDate || endDate) {
            whereClause.updatedAt = {};
            if (startDate) {
                whereClause.updatedAt.gte = new Date(startDate);
            }
            if (endDate) {
                whereClause.updatedAt.lte = new Date(endDate);
            }
        }

        // Get posts with decisions
        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: whereClause,
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
                            name: true
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
                where: whereClause
            })
        ]);

        // Format posts with decision information
        const formattedPosts = posts.map(post => ({
            id: post.id,
            title: post.title,
            description: post.description,
            video_url: post.video_url,
            status: post.status,
            decision: post.status === 'active' ? 'approved' : 
                    post.status === 'suspended' ? 'rejected' : 
                    post.status === 'draft' ? 'pending' : post.status,
            reviewedAt: post.updatedAt,
            approvedAt: post.approved_at,
            user: post.user,
            category: post.category,
            views: post.views,
            likes: post.likes,
            shares: post.shares
        }));

        // Get decision statistics
        const [approvedCount, rejectedCount, suspendedCount] = await Promise.all([
            prisma.post.count({
                where: {
                    approver_id: approverId,
                    status: 'active',
                    ...(startDate || endDate ? {
                        updatedAt: {
                            ...(startDate ? { gte: new Date(startDate) } : {}),
                            ...(endDate ? { lte: new Date(endDate) } : {})
                        }
                    } : {})
                }
            }),
            prisma.post.count({
                where: {
                    approver_id: approverId,
                    status: 'suspended',
                    ...(startDate || endDate ? {
                        updatedAt: {
                            ...(startDate ? { gte: new Date(startDate) } : {}),
                            ...(endDate ? { lte: new Date(endDate) } : {})
                        }
                    } : {})
                }
            }),
            prisma.post.count({
                where: {
                    approver_id: approverId,
                    status: 'suspended',
                    ...(startDate || endDate ? {
                        updatedAt: {
                            ...(startDate ? { gte: new Date(startDate) } : {}),
                            ...(endDate ? { lte: new Date(endDate) } : {})
                        }
                    } : {})
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                approver: {
                    id: approver.id,
                    username: approver.username,
                    email: approver.email,
                    status: approver.status
                },
                posts: formattedPosts,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / limit),
                    totalCount,
                    hasNext: page * limit < totalCount,
                    hasPrev: page > 1
                },
                statistics: {
                    total: totalCount,
                    approved: approvedCount,
                    rejected: rejectedCount,
                    suspended: suspendedCount,
                    approvalRate: totalCount > 0 ? ((approvedCount / totalCount) * 100).toFixed(2) : 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching reviewed posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching reviewed posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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
            Post.count({ where: { status: 'draft' } }),
            Post.count({ where: { status: 'active' } })
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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
                phone2: true,
                last_active_date: true,
                profile_picture: true,
                bio: true,
                last_login: true,
                date_of_birth: true,
                country_id: true,
                follower_count: true,
                total_profile_views: true,
                interests: true,
                role: true
            }
        });

        // Get approved and pending post counts for all users
        const approvedCounts = await prisma.post.groupBy({
            by: ['user_id'],
            where: { status: 'active' },
            _count: {
                id: true
            }
        });

        const pendingCounts = await prisma.post.groupBy({
            by: ['user_id'],
            where: { status: 'draft' },
            _count: {
                id: true
            }
        });

        // Get total views for all users' posts
        const userViews = await prisma.post.groupBy({
            by: ['user_id'],
            _sum: {
                views: true
            }
        });

        // Create lookup maps for quick access
        const approvedCountMap = {};
        const pendingCountMap = {};
        const totalViewsMap = {};
            
        approvedCounts.forEach(count => {
            approvedCountMap[count.user_id] = count._count.id;
        });
            
        pendingCounts.forEach(count => {
            pendingCountMap[count.user_id] = count._count.id;
        });

        userViews.forEach(view => {
            totalViewsMap[view.user_id] = view._sum.views || 0;
        });

        // Get suspended posts count for all users
        const suspendedCounts = await prisma.post.groupBy({
            by: ['user_id'],
            where: { status: 'suspended' },
            _count: {
                id: true
            }
        });

        const suspendedCountMap = {};
        suspendedCounts.forEach(count => {
            suspendedCountMap[count.user_id] = count._count.id;
        });

        // Enhance user objects with post counts, total views, and suspended posts count
        const enhancedUsers = users.map(user => {
            const suspendedPostsCount = suspendedCountMap[user.id] || 0;
            return {
                ...user,
                postsApproved: approvedCountMap[user.id] || 0,
                postsPending: pendingCountMap[user.id] || 0,
                totalPostViews: totalViewsMap[user.id] || 0,
                suspendedPostsCount: suspendedPostsCount,
                isAtSuspensionThreshold: suspendedPostsCount >= 3 && user.status === 'active'
            };
        });

        res.json({
            message:'Users fetched successfully',
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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
            action: post.status === 'active' ? 'Video Approved' : 
                    post.status === 'suspended' ? 'Video Rejected' : 
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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
                        posts: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Get approved post counts for each approver
        const approverIds = approvers.map(a => a.id);
        const approvedCounts = await Promise.all(
            approverIds.map(approverId =>
                prisma.post.count({
                    where: {
                        approver_id: approverId,
                        status: 'active'
                    }
                })
            )
        );

        // Process approvers data
        const processedApprovers = approvers.map((approver, index) => ({
            id: approver.id,
            username: approver.username,
            email: approver.email,
            status: approver.status,
            joinedDate: approver.createdAt,
            lastActive: approver.last_login,
            totalApprovedPosts: approvedCounts[index] || 0,
            totalPosts: approver._count.posts || 0,
            performance: {
                approvalRate: approver._count.posts > 0 
                    ? ((approvedCounts[index] || 0) / approver._count.posts * 100).toFixed(2) 
                    : 0,
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
            message: 'Failed to fetch approvers',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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
                status: 'suspended'
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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
        const { page = 1, limit = 10, status } = req.query;
        const offset = (page - 1) * limit;

        // Check if the approver exists
        const approver = await prisma.approver.findUnique({
            where: { id: approverId },
            select: {
                id: true,
                username: true,
                email: true,
                status: true
            }
        });

        if (!approver) {
            return res.status(404).json({
                status: 'error',
                message: 'Approver not found'
            });
        }

        // Build where clause
        const whereClause = {
            approver_id: approverId
        };

        // Filter by status if provided (map user-friendly names to enum values)
        if (status === 'approved' || status === 'active') {
            whereClause.status = 'active';
        } else if (status === 'rejected' || status === 'suspended') {
            whereClause.status = 'suspended';
        } else {
            // Default: get both approved and rejected (active and suspended)
            whereClause.status = {
                in: ['active', 'suspended']
            };
        }

        // Get posts with pagination
        const [posts, totalCount, approvedCount, rejectedCount] = await Promise.all([
            prisma.post.findMany({
                where: whereClause,
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
                            name: true
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
                where: whereClause
            }),
            prisma.post.count({
                where: {
                    approver_id: approverId,
                    status: 'active'
                }
            }),
            prisma.post.count({
                where: {
                    approver_id: approverId,
                    status: 'suspended'
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                approver: {
                    id: approver.id,
                    username: approver.username,
                    email: approver.email,
                    status: approver.status
                },
                posts,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / limit),
                    totalCount,
                    hasNext: page * limit < totalCount,
                    hasPrev: page > 1
                },
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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
        const totalUsers = await prisma.user.count();

        // Get number of active users
        const activeUsers = await prisma.user.count({
            where: {
                status: 'active'
            }
        });

        // Get number of frozen users (user status, not post status)
        const frozenUsers = await prisma.user.count({
            where: {
                status: 'frozen'
            }
        });

        // Get total number of posts
        const totalPosts = await prisma.post.count();

        // Get number of approved posts (active status)
        const approvedPosts = await prisma.post.count({
            where: {
                status: 'active'
            }
        });

        // Get number of pending posts (draft status)
        const pendingPosts = await prisma.post.count({
            where: {
                status: 'draft'
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

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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
        const { period = '30d' } = req.query;
        
        // Calculate date range based on period
        const now = new Date();
        let startDate;
        
        switch (period) {
            case '1d':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            case '1y':
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Get user statistics using Prisma
        const [
            totalUsers,
            activeUsers,
            suspendedUsers,
            newUsersInPeriod,
            registrationRate,
            ageDistribution,
            topCountries,
            usersWithPosts,
            usersWithVerifiedEmail
        ] = await Promise.all([
            // Total Users
            prisma.user.count(),
            
            // Active Users
            prisma.user.count({ where: { status: 'active' } }),
            
            // Suspended Users
            prisma.user.count({ where: { status: 'suspended' } }),
            
            // New Users in Period
            prisma.user.count({
                where: { 
                    createdAt: { gte: startDate }
                }
            }),
            
            // Registration Rate (users per day in period)
            prisma.$queryRaw`
                SELECT 
                    COUNT(*) FILTER (WHERE "createdAt" >= ${startDate}) as total_registrations,
                    COUNT(*) FILTER (WHERE "createdAt" >= ${startDate})::float / NULLIF(EXTRACT(EPOCH FROM (NOW() - ${startDate})) / 86400, 0) as registrations_per_day,
                    (SELECT COUNT(*) FROM "users" WHERE DATE("createdAt") = CURRENT_DATE) as today_registrations
                FROM "users"
            `,
            
            // Age Distribution
            prisma.$queryRaw`
                WITH age_groups AS (
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
                        END as age_group
                    FROM "users"
                )
                SELECT 
                    age_group,
                    COUNT(*) as count,
                    ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM "users"), 0), 2) as percentage
                FROM age_groups
                GROUP BY age_group
                ORDER BY 
                    CASE age_group
                        WHEN 'Under 18' THEN 1
                        WHEN '18-24' THEN 2
                        WHEN '25-34' THEN 3
                        WHEN '35-44' THEN 5
                        WHEN '45-54' THEN 6
                        WHEN '55-64' THEN 7
                        WHEN '65+' THEN 8
                        WHEN 'Unknown' THEN 9
                        ELSE 10
                    END
            `,
            
            // Top 3 Countries with Most Users
            prisma.$queryRaw`
                SELECT 
                    c.id,
                    c.name as country,
                    c.flag_emoji,
                    COUNT(u.id) as user_count,
                    ROUND(COUNT(u.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM "users"), 0), 2) as percentage
                FROM "users" u
                JOIN "countries" c ON u.country_id = c.id
                GROUP BY c.id, c.name, c.flag_emoji
                ORDER BY user_count DESC
                LIMIT 3
            `,
            
            // Users with Posts
            prisma.user.count({
                where: {
                    posts_count: { gt: 0 }
                }
            }),
            
            // Users with Verified Email
            prisma.user.count({
                where: {
                    email_verified: true
                }
            })
        ]);

        // Calculate registration growth rate
        const daysInPeriod = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const regRate = registrationRate[0];
        const avgRegistrationsPerDay = regRate?.registrations_per_day || 0;

        res.json({
            status: 'success',
            data: {
                period,
                users: {
                    total: totalUsers,
                    active: activeUsers,
                    suspended: suspendedUsers,
                    newInPeriod: newUsersInPeriod,
                    withPosts: usersWithPosts,
                    withVerifiedEmail: usersWithVerifiedEmail,
                    withoutPosts: totalUsers - usersWithPosts
                },
                registration: {
                    newUsers: newUsersInPeriod,
                    periodDays: daysInPeriod,
                    averagePerDay: Math.round(avgRegistrationsPerDay * 100) / 100,
                    todayRegistrations: Number(regRate?.today_registrations || 0),
                    growthRate: totalUsers > 0 
                        ? Math.round((newUsersInPeriod / totalUsers) * 10000) / 100 
                        : 0
                },
                ageDistribution: ageDistribution.map(item => ({
                    ageGroup: item.age_group,
                    count: Number(item.count),
                    percentage: Number(item.percentage)
                })),
                topCountries: topCountries.map(item => ({
                    id: Number(item.id),
                    country: item.country,
                    flagEmoji: item.flag_emoji,
                    userCount: Number(item.user_count),
                    percentage: Number(item.percentage)
                })),
                engagement: {
                    usersWithPosts: usersWithPosts,
                    usersWithoutPosts: totalUsers - usersWithPosts,
                    postCreationRate: totalUsers > 0 
                        ? Math.round((usersWithPosts / totalUsers) * 10000) / 100 
                        : 0
                },
                verification: {
                    verified: usersWithVerifiedEmail,
                    unverified: totalUsers - usersWithVerifiedEmail,
                    verificationRate: totalUsers > 0 
                        ? Math.round((usersWithVerifiedEmail / totalUsers) * 10000) / 100 
                        : 0
                }
            }
        });
    } catch (error) {
        console.error('Error getting user stats:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching user statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get flagged posts (posts with 5+ reports or manually flagged by admin/approver)
// Flagged posts have status 'suspended' and is_frozen: true
exports.getFlaggedPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: { 
                    status: 'suspended',
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
                    status: 'suspended',
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
            
            // Total Videos (posts with video_url and type='video')
            prisma.post.count({
                where: {
                    video_url: { not: null },
                    type: 'video',
                    createdAt: { gte: startDate }
                }
            }),
            
            // Pending Reviews (draft posts awaiting approval)
            prisma.post.count({
                where: { status: 'draft' }
            }),
            
            // Flagged Contents (frozen posts)
            prisma.post.count({
                where: { 
                    status: 'suspended',
                    is_frozen: true
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
                    (SELECT COUNT(*) FROM "post_likes" WHERE "createdAt" >= ${startDate}) +
                    (SELECT COUNT(*) FROM "comments" WHERE "comment_date" >= ${startDate}) +
                    (SELECT COUNT(*) FROM "shares" WHERE "createdAt" >= ${startDate}) as total_engagements
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
        // Convert BigInt to Number for calculations
        const totalEngagementsCount = totalEngagements[0]?.total_engagements 
            ? Number(totalEngagements[0].total_engagements) 
            : 0;
        
        const engagementRate = totalPosts > 0 ? 
            (totalEngagementsCount / totalPosts) * 100 : 0;

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
                    totalEngagements: totalEngagementsCount,
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
                    (SELECT COUNT(*) FROM "post_likes" WHERE "createdAt" >= ${startDate}) +
                    (SELECT COUNT(*) FROM "comments" WHERE "comment_date" >= ${startDate}) +
                    (SELECT COUNT(*) FROM "shares" WHERE "createdAt" >= ${startDate}) as total_engagements
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
                FROM "users" 
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
                FROM "views" 
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
                    ROUND(COUNT(u.id) * 100.0 / (SELECT COUNT(*) FROM "users" WHERE "createdAt" >= ${startDate}), 2) as percentage
                FROM "users" u
                JOIN "countries" c ON u.country_id = c.id
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
                    ROUND(COUNT(p.id) * 100.0 / (SELECT COUNT(*) FROM "posts" WHERE "createdAt" >= ${startDate}), 2) as percentage
                FROM "posts" p
                JOIN "categories" cat ON p.category_id = cat.id
                WHERE p."createdAt" >= ${startDate}
                GROUP BY cat.id, cat.name
                ORDER BY post_count DESC
                LIMIT 10
            `,
            
            // Average Session Times (calculated as time between first and last view per user)
            prisma.$queryRaw`
                SELECT 
                    AVG(session_duration) as avg_session_seconds
                FROM (
                    SELECT 
                        "user_id",
                        EXTRACT(EPOCH FROM (MAX("createdAt") - MIN("createdAt"))) as session_duration
                    FROM "views" 
                    WHERE "createdAt" >= ${startDate} AND "user_id" IS NOT NULL
                    GROUP BY "user_id"
                    HAVING COUNT(*) > 1
                ) user_sessions
            `,
            
            // Bounce Rate (users with only 1 view)
            prisma.$queryRaw`
                SELECT 
                    COUNT(*) as single_view_users,
                    (SELECT COUNT(DISTINCT "user_id") FROM "views" WHERE "createdAt" >= ${startDate} AND "user_id" IS NOT NULL) as total_users,
                    ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(DISTINCT "user_id") FROM "views" WHERE "createdAt" >= ${startDate} AND "user_id" IS NOT NULL), 0), 2) as bounce_rate
                FROM (
                    SELECT "user_id", COUNT(*) as view_count
                    FROM "views" 
                    WHERE "createdAt" >= ${startDate} AND "user_id" IS NOT NULL
                    GROUP BY "user_id"
                    HAVING COUNT(*) = 1
                ) single_view
            `,
            
            // Completion Rate (posts with high engagement)
            prisma.$queryRaw`
                SELECT 
                    COUNT(*) as high_engagement_posts,
                    (SELECT COUNT(*) FROM "posts" WHERE "createdAt" >= ${startDate}) as total_posts,
                    ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM "posts" WHERE "createdAt" >= ${startDate}), 0), 2) as completion_rate
                FROM "posts" p
                WHERE p."createdAt" >= ${startDate}
                AND (p.likes + p.comment_count + p.shares) >= 10
            `
        ]);

        // Convert BigInt values to numbers for JSON serialization
        const convertBigInt = (value) => {
            if (typeof value === 'bigint') {
                return Number(value);
            }
            if (value === null || value === undefined) {
                return value;
            }
            if (typeof value === 'object') {
                if (Array.isArray(value)) {
                    return value.map(convertBigInt);
                }
                const converted = {};
                for (const key in value) {
                    converted[key] = convertBigInt(value[key]);
                }
                return converted;
            }
            return value;
        };

        res.json({
            status: 'success',
            data: {
                period,
                analytics: {
                    totalUsers: Number(totalUsers),
                    totalViews: Number(totalViews),
                    totalPosts: Number(totalPosts),
                    totalEngagements: totalEngagements[0]?.total_engagements 
                        ? Number(totalEngagements[0].total_engagements) 
                        : 0,
                    userDemographics: convertBigInt(userDemographics),
                    deviceUsage: convertBigInt(deviceUsage),
                    topCountries: convertBigInt(topCountries),
                    topCategories: convertBigInt(topCategories),
                    avgSessionTimes: avgSessionTimes[0]?.avg_session_seconds 
                        ? Math.round(Number(avgSessionTimes[0].avg_session_seconds) / 60)
                        : 0,
                    bounceRate: bounceRate[0]?.bounce_rate 
                        ? Number(bounceRate[0].bounce_rate) 
                        : 0,
                    completionRate: completionRate[0]?.completion_rate 
                        ? Number(completionRate[0].completion_rate) 
                        : 0
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
            prisma.post.count({ where: { video_url: { not: null }, type: 'video' } }),
            prisma.post.count({ where: { video_url: { not: null }, type: 'image' } }),
            prisma.post.count({ where: { status: 'draft' } }),
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

        // Clear cache for all posts and featured posts
        const { clearCacheByPattern, CACHE_KEYS } = require('../utils/cache');
        await clearCacheByPattern(CACHE_KEYS.ALL_POSTS);
        await clearCacheByPattern(CACHE_KEYS.FEATURED_POSTS);

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
                status: 'suspended', // Use suspended status when freezing
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
                status: 'active',
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
                        profile_picture: true,
                        bio: true
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

        // Get all active users with their IDs
        const users = await prisma.user.findMany({
            where: { status: 'active' },
            select: { id: true, username: true }
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

        const createdNotifications = await prisma.notification.createMany({
            data: notifications
        });

        // Emit real-time notification events for all users
        // Note: createMany doesn't return the created records, so we'll fetch them
        const notificationRecords = await prisma.notification.findMany({
            where: {
                userID: { in: users.map(u => u.username) },
                type: type,
                message: `${title}: ${message}`
            },
            orderBy: { createdAt: 'desc' },
            take: users.length
        });

        // Emit events for each user
        for (let i = 0; i < users.length && i < notificationRecords.length; i++) {
            const user = users[i];
            const notification = notificationRecords[i];
            
            emitEvent('notification:created', {
                userId: user.id,
                userID: user.username,
                notification: {
                    id: notification.id,
                    type: notification.type,
                    message: notification.message,
                    isRead: notification.isRead,
                    createdAt: notification.createdAt
                }
            });
        }

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
                            bio: true,
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
                viewCount: post.views, // Explicit view count
                viewCountFromTable: post._count.postViews, // View count from views table
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

// ===== CHALLENGE MANAGEMENT =====

// Get all challenge requests (pending, approved, rejected, active, ended)
exports.getAllChallenges = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = status ? { status } : {};

        const [challenges, total] = await Promise.all([
            prisma.challenge.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: {
                    createdAt: 'desc'
                },
                include: {
                    organizer: {
                        select: {
                            id: true,
                            username: true,
                            display_name: true,
                            email: true,
                            profile_picture: true
                        }
                    },
                    approver: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    _count: {
                        select: {
                            participants: true,
                            posts: true
                        }
                    }
                }
            }),
            prisma.challenge.count({ where })
        ]);

        res.json({
            status: 'success',
            data: challenges,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching challenges:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch challenges',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get pending challenge requests
exports.getPendingChallenges = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [challenges, total] = await Promise.all([
            prisma.challenge.findMany({
                where: { status: 'pending' },
                skip,
                take: parseInt(limit),
                orderBy: {
                    createdAt: 'desc'
                },
                include: {
                    organizer: {
                        select: {
                            id: true,
                            username: true,
                            display_name: true,
                            email: true,
                            profile_picture: true
                        }
                    },
                    _count: {
                        select: {
                            participants: true,
                            posts: true
                        }
                    }
                }
            }),
            prisma.challenge.count({ where: { status: 'pending' } })
        ]);

        res.json({
            status: 'success',
            data: challenges,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching pending challenges:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch pending challenges',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get a single challenge by ID
exports.getChallengeById = async (req, res) => {
    try {
        const { challengeId } = req.params;

        const challenge = await prisma.challenge.findUnique({
            where: { id: challengeId },
            include: {
                organizer: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        email: true,
                        profile_picture: true
                    }
                },
                approver: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                },
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                display_name: true,
                                profile_picture: true,
                                posts_count: true,
                                follower_count: true
                            }
                        }
                    },
                    orderBy: {
                        joined_at: 'desc'
                    }
                },
                posts: {
                    include: {
                        post: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        username: true,
                                        display_name: true,
                                        profile_picture: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: {
                        submitted_at: 'desc'
                    }
                },
                _count: {
                    select: {
                        participants: true,
                        posts: true
                    }
                }
            }
        });

        if (!challenge) {
            return res.status(404).json({
                status: 'error',
                message: 'Challenge not found'
            });
        }

        // Get post counts for each participant
        const participantsWithPostCounts = await Promise.all(
            challenge.participants.map(async (participant) => {
                const postCount = await prisma.challengePost.count({
                    where: {
                        challenge_id: challengeId,
                        user_id: participant.user_id
                    }
                });

                return {
                    ...participant,
                    post_count: postCount
                };
            })
        );

        // Get basic statistics
        const totalParticipants = challenge._count.participants;
        const totalPosts = challenge._count.posts;
        const participantsWithPosts = participantsWithPostCounts.filter(p => p.post_count > 0).length;
        const participantsWithoutPosts = totalParticipants - participantsWithPosts;
        const averagePostsPerParticipant = totalParticipants > 0 
            ? Math.round((totalPosts / totalParticipants) * 100) / 100 
            : 0;

        // Get recent activity (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const [recentParticipants, recentPosts] = await Promise.all([
            prisma.challengeParticipant.count({
                where: {
                    challenge_id: challengeId,
                    joined_at: {
                        gte: sevenDaysAgo
                    }
                }
            }),
            prisma.challengePost.count({
                where: {
                    challenge_id: challengeId,
                    submitted_at: {
                        gte: sevenDaysAgo
                    }
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                ...challenge,
                participants: participantsWithPostCounts,
                statistics: {
                    total_participants: totalParticipants,
                    total_posts: totalPosts,
                    participants_with_posts: participantsWithPosts,
                    participants_without_posts: participantsWithoutPosts,
                    average_posts_per_participant: averagePostsPerParticipant,
                    recent_activity: {
                        participants_last_7_days: recentParticipants,
                        posts_last_7_days: recentPosts
                    }
                },
                // Note: For detailed analytics and growth graphs, use GET /admin/challenges/:challengeId/analytics
                analytics_endpoint: `/admin/challenges/${challengeId}/analytics`
            }
        });
    } catch (error) {
        console.error('Error fetching challenge:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch challenge',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Approve a challenge
exports.approveChallenge = async (req, res) => {
    try {
        const { challengeId } = req.params;
        const adminId = req.user.id;

        const challenge = await prisma.challenge.findUnique({
            where: { id: challengeId },
            include: {
                organizer: {
                    select: {
                        username: true,
                        email: true
                    }
                }
            }
        });

        if (!challenge) {
            return res.status(404).json({
                status: 'error',
                message: 'Challenge not found'
            });
        }

        if (challenge.status !== 'pending') {
            return res.status(400).json({
                status: 'error',
                message: `Challenge is already ${challenge.status}`
            });
        }

        // Update challenge status to approved and set it to active
        const now = new Date();
        const startDate = new Date(challenge.start_date);
        const endDate = new Date(challenge.end_date);
        
        // Determine if challenge should be active (if start date has passed)
        const shouldBeActive = now >= startDate && now <= endDate;

        const updatedChallenge = await prisma.challenge.update({
            where: { id: challengeId },
            data: {
                status: shouldBeActive ? 'active' : 'approved',
                approved_by: adminId,
                approved_at: now
            },
            include: {
                organizer: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                },
                approver: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                }
            }
        });

        // Notify organizer
        await prisma.notification.create({
            data: {
                userID: challenge.organizer.username,
                message: `Your challenge "${challenge.name}" has been approved and is now ${shouldBeActive ? 'active' : 'approved'}.`,
                type: 'challenge_approved',
                isRead: false
            }
        });

        // Log admin action
        loggers.audit('approve_challenge', {
            adminId: adminId,
            challengeId: challengeId,
            challengeName: challenge.name
        });

        res.json({
            status: 'success',
            message: 'Challenge approved successfully',
            data: updatedChallenge
        });
    } catch (error) {
        console.error('Error approving challenge:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to approve challenge',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Reject a challenge
exports.rejectChallenge = async (req, res) => {
    try {
        const { challengeId } = req.params;
        const { reason } = req.body;
        const adminId = req.user.id;

        const challenge = await prisma.challenge.findUnique({
            where: { id: challengeId },
            include: {
                organizer: {
                    select: {
                        username: true,
                        email: true
                    }
                }
            }
        });

        if (!challenge) {
            return res.status(404).json({
                status: 'error',
                message: 'Challenge not found'
            });
        }

        if (challenge.status !== 'pending') {
            return res.status(400).json({
                status: 'error',
                message: `Challenge is already ${challenge.status}`
            });
        }

        const updatedChallenge = await prisma.challenge.update({
            where: { id: challengeId },
            data: {
                status: 'rejected',
                rejection_reason: reason || null
            }
        });

        // Notify organizer
        await prisma.notification.create({
            data: {
                userID: challenge.organizer.username,
                message: `Your challenge "${challenge.name}" has been rejected.${reason ? ' Reason: ' + reason : ''}`,
                type: 'challenge_rejected',
                isRead: false
            }
        });

        // Log admin action
        loggers.audit('reject_challenge', {
            adminId: adminId,
            challengeId: challengeId,
            challengeName: challenge.name,
            reason: reason
        });

        res.json({
            status: 'success',
            message: 'Challenge rejected successfully',
            data: updatedChallenge
        });
    } catch (error) {
        console.error('Error rejecting challenge:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to reject challenge',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Stop/End a challenge (admin only)
exports.stopChallenge = async (req, res) => {
    try {
        const { challengeId } = req.params;
        const adminId = req.user.id;

        const challenge = await prisma.challenge.findUnique({
            where: { id: challengeId },
            include: {
                organizer: {
                    select: {
                        username: true,
                        email: true
                    }
                }
            }
        });

        if (!challenge) {
            return res.status(404).json({
                status: 'error',
                message: 'Challenge not found'
            });
        }

        if (challenge.status === 'ended') {
            return res.status(400).json({
                status: 'error',
                message: 'Challenge is already ended'
            });
        }

        if (challenge.status !== 'active' && challenge.status !== 'approved') {
            return res.status(400).json({
                status: 'error',
                message: 'Only active or approved challenges can be stopped'
            });
        }

        const updatedChallenge = await prisma.challenge.update({
            where: { id: challengeId },
            data: {
                status: 'ended'
            }
        });

        // Notify organizer
        await prisma.notification.create({
            data: {
                userID: challenge.organizer.username,
                message: `Your challenge "${challenge.name}" has been ended by an administrator.`,
                type: 'challenge_ended',
                isRead: false
            }
        });

        // Notify all participants
        const participants = await prisma.challengeParticipant.findMany({
            where: { challenge_id: challengeId },
            include: {
                user: {
                    select: {
                        username: true
                    }
                }
            }
        });

        for (const participant of participants) {
            await prisma.notification.create({
                data: {
                    userID: participant.user.username,
                    message: `The challenge "${challenge.name}" has been ended.`,
                    type: 'challenge_ended',
                    isRead: false
                }
            });
        }

        // Log admin action
        loggers.audit('stop_challenge', {
            adminId: adminId,
            challengeId: challengeId,
            challengeName: challenge.name
        });

        res.json({
            status: 'success',
            message: 'Challenge stopped successfully',
            data: updatedChallenge
        });
    } catch (error) {
        console.error('Error stopping challenge:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to stop challenge',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get challenge dashboard statistics
exports.getChallengeDashboardStats = async (req, res) => {
    try {
        const [
            totalChallenges,
            pendingChallenges,
            approvedChallenges,
            activeChallenges,
            rejectedChallenges,
            endedChallenges,
            totalParticipants,
            totalPosts,
            challengesWithRewards,
            recentChallenges
        ] = await Promise.all([
            prisma.challenge.count(),
            prisma.challenge.count({ where: { status: 'pending' } }),
            prisma.challenge.count({ where: { status: 'approved' } }),
            prisma.challenge.count({ where: { status: 'active' } }),
            prisma.challenge.count({ where: { status: 'rejected' } }),
            prisma.challenge.count({ where: { status: 'ended' } }),
            prisma.challengeParticipant.count(),
            prisma.challengePost.count(),
            prisma.challenge.count({ where: { has_rewards: true } }),
            prisma.challenge.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: {
                    organizer: {
                        select: {
                            id: true,
                            username: true,
                            display_name: true
                        }
                    },
                    _count: {
                        select: {
                            participants: true,
                            posts: true
                        }
                    }
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                overview: {
                    total: totalChallenges,
                    pending: pendingChallenges,
                    approved: approvedChallenges,
                    active: activeChallenges,
                    rejected: rejectedChallenges,
                    ended: endedChallenges
                },
                engagement: {
                    total_participants: totalParticipants,
                    total_posts: totalPosts,
                    challenges_with_rewards: challengesWithRewards,
                    average_participants_per_challenge: totalChallenges > 0 ? Math.round(totalParticipants / totalChallenges) : 0,
                    average_posts_per_challenge: totalChallenges > 0 ? Math.round(totalPosts / totalChallenges) : 0
                },
                recent_challenges: recentChallenges.map(challenge => ({
                    id: challenge.id,
                    name: challenge.name,
                    status: challenge.status,
                    organizer: challenge.organizer,
                    participant_count: challenge._count.participants,
                    post_count: challenge._count.posts,
                    createdAt: challenge.createdAt
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching challenge dashboard stats:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch dashboard statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get challenge growth analytics (for graphs)
exports.getChallengeGrowthAnalytics = async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days));

        // Get challenges created over time
        const challengesByDate = await prisma.challenge.groupBy({
            by: ['createdAt'],
            where: {
                createdAt: {
                    gte: daysAgo
                }
            },
            _count: {
                id: true
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        // Get participants joined over time
        const participantsByDate = await prisma.challengeParticipant.groupBy({
            by: ['joined_at'],
            where: {
                joined_at: {
                    gte: daysAgo
                }
            },
            _count: {
                id: true
            },
            orderBy: {
                joined_at: 'asc'
            }
        });

        // Get posts submitted over time
        const postsByDate = await prisma.challengePost.groupBy({
            by: ['submitted_at'],
            where: {
                submitted_at: {
                    gte: daysAgo
                }
            },
            _count: {
                id: true
            },
            orderBy: {
                submitted_at: 'asc'
            }
        });

        // Format data for charts (group by day)
        const formatDate = (date) => {
            const d = new Date(date);
            return d.toISOString().split('T')[0];
        };

        const challengeGrowth = {};
        challengesByDate.forEach(item => {
            const date = formatDate(item.createdAt);
            challengeGrowth[date] = (challengeGrowth[date] || 0) + item._count.id;
        });

        const participantGrowth = {};
        participantsByDate.forEach(item => {
            const date = formatDate(item.joined_at);
            participantGrowth[date] = (participantGrowth[date] || 0) + item._count.id;
        });

        const postGrowth = {};
        postsByDate.forEach(item => {
            const date = formatDate(item.submitted_at);
            postGrowth[date] = (postGrowth[date] || 0) + item._count.id;
        });

        // Get all unique dates
        const allDates = new Set([
            ...Object.keys(challengeGrowth),
            ...Object.keys(participantGrowth),
            ...Object.keys(postGrowth)
        ]);

        // Create cumulative data
        const cumulativeData = Array.from(allDates).sort().map(date => {
            const challenges = challengeGrowth[date] || 0;
            const participants = participantGrowth[date] || 0;
            const posts = postGrowth[date] || 0;

            return {
                date,
                challenges,
                participants,
                posts
            };
        });

        // Calculate cumulative totals
        let cumulativeChallenges = 0;
        let cumulativeParticipants = 0;
        let cumulativePosts = 0;

        const cumulativeChartData = cumulativeData.map(item => {
            cumulativeChallenges += item.challenges;
            cumulativeParticipants += item.participants;
            cumulativePosts += item.posts;

            return {
                date: item.date,
                challenges: cumulativeChallenges,
                participants: cumulativeParticipants,
                posts: cumulativePosts
            };
        });

        res.json({
            status: 'success',
            data: {
                daily_data: cumulativeData,
                cumulative_data: cumulativeChartData,
                summary: {
                    total_challenges: cumulativeChallenges,
                    total_participants: cumulativeParticipants,
                    total_posts: cumulativePosts,
                    period_days: parseInt(days)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching challenge growth analytics:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch growth analytics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get challenge analytics by ID (with growth data)
exports.getChallengeAnalytics = async (req, res) => {
    try {
        const { challengeId } = req.params;
        const { days = 30 } = req.query;
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days));

        const challenge = await prisma.challenge.findUnique({
            where: { id: challengeId },
            include: {
                organizer: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        email: true,
                        profile_picture: true
                    }
                },
                approver: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                },
                _count: {
                    select: {
                        participants: true,
                        posts: true
                    }
                }
            }
        });

        if (!challenge) {
            return res.status(404).json({
                status: 'error',
                message: 'Challenge not found'
            });
        }

        // Get participants joined over time
        const participantsByDate = await prisma.challengeParticipant.findMany({
            where: {
                challenge_id: challengeId,
                joined_at: {
                    gte: daysAgo
                }
            },
            select: {
                joined_at: true
            },
            orderBy: {
                joined_at: 'asc'
            }
        });

        // Get posts submitted over time
        const postsByDate = await prisma.challengePost.findMany({
            where: {
                challenge_id: challengeId,
                submitted_at: {
                    gte: daysAgo
                }
            },
            select: {
                submitted_at: true
            },
            orderBy: {
                submitted_at: 'asc'
            }
        });

        // Format data for charts
        const formatDate = (date) => {
            const d = new Date(date);
            return d.toISOString().split('T')[0];
        };

        const participantGrowth = {};
        participantsByDate.forEach(item => {
            const date = formatDate(item.joined_at);
            participantGrowth[date] = (participantGrowth[date] || 0) + 1;
        });

        const postGrowth = {};
        postsByDate.forEach(item => {
            const date = formatDate(item.submitted_at);
            postGrowth[date] = (postGrowth[date] || 0) + 1;
        });

        // Get all unique dates
        const allDates = new Set([
            ...Object.keys(participantGrowth),
            ...Object.keys(postGrowth)
        ]);

        // Create daily data
        const dailyData = Array.from(allDates).sort().map(date => {
            const participants = participantGrowth[date] || 0;
            const posts = postGrowth[date] || 0;

            return {
                date,
                participants,
                posts
            };
        });

        // Calculate cumulative totals
        let cumulativeParticipants = 0;
        let cumulativePosts = 0;

        const cumulativeData = dailyData.map(item => {
            cumulativeParticipants += item.participants;
            cumulativePosts += item.posts;

            return {
                date: item.date,
                participants: cumulativeParticipants,
                posts: cumulativePosts
            };
        });

        // Get participant breakdown by post count
        const participantsWithPostCounts = await prisma.challengeParticipant.findMany({
            where: {
                challenge_id: challengeId
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        profile_picture: true
                    }
                }
            }
        });

        const participantStats = await Promise.all(
            participantsWithPostCounts.map(async (participant) => {
                const postCount = await prisma.challengePost.count({
                    where: {
                        challenge_id: challengeId,
                        user_id: participant.user_id
                    }
                });

                return {
                    user_id: participant.user_id,
                    username: participant.user.username,
                    display_name: participant.user.display_name,
                    profile_picture: participant.user.profile_picture,
                    post_count: postCount,
                    joined_at: participant.joined_at
                };
            })
        );

        // Sort by post count
        participantStats.sort((a, b) => b.post_count - a.post_count);

        res.json({
            status: 'success',
            data: {
                challenge: {
                    ...challenge,
                    participant_count: challenge._count.participants,
                    post_count: challenge._count.posts
                },
                growth: {
                    daily_data: dailyData,
                    cumulative_data: cumulativeData,
                    period_days: parseInt(days)
                },
                participant_stats: {
                    total: participantStats.length,
                    top_contributors: participantStats.slice(0, 10),
                    participants_with_posts: participantStats.filter(p => p.post_count > 0).length,
                    participants_without_posts: participantStats.filter(p => p.post_count === 0).length,
                    average_posts_per_participant: participantStats.length > 0
                        ? Math.round(participantStats.reduce((sum, p) => sum + p.post_count, 0) / participantStats.length)
                        : 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching challenge analytics:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch challenge analytics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
