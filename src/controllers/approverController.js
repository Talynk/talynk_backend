const prisma = require('../lib/prisma');
const {validate, parse} = require('uuid');
const { emitEvent } = require('../lib/realtime');

exports.getApproverStats = async (req, res) => {
    try {
        const approverId = req.user.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [pendingCount, approvedCount, rejectedCount, todayCount] = await Promise.all([
            prisma.post.count({ where: { status: 'pending' } }),
            prisma.post.count({ 
                where: { 
                    status: 'approved',
                    approver_id: approverId 
                } 
            }),
            prisma.post.count({ 
                where: { 
                    status: 'rejected',
                    approver_id: approverId 
                } 
            }),
            prisma.post.count({
                where: {
                    status: 'approved',
                    approver_id: approverId,
                    updatedAt: {
                        gte: today
                    }
                }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                pendingCount,
                approvedCount,
                rejectedCount,
                todayCount
            }
        });
    } catch (error) {
        console.error('Stats fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching approver statistics'
        });
    }
};

exports.getPendingPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [posts, total] = await Promise.all([
            prisma.post.findMany({
                where: { status: 'pending' },
                include: {
                    user: {
                        select: { username: true, email: true }
                    }
                },
                orderBy: { updatedAt: 'desc' },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: { status: 'pending' }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
                total,
                pages: Math.ceil(total / limit),
                currentPage: parseInt(page)
            }
        });
    } catch (error) {
        console.error('Pending posts fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching pending posts'
        });
    }
};

exports.getApprovedPosts = async (req, res) => {
    try {
        const { date, search, page = 1, limit = 10 } = req.query;
        const approverId = req.user.id;
        const whereClause = {
            status: 'approved',
            approver_id: approverId
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
                        select: { username: true, email: true }
                    }
                },
                orderBy: { approved_at: 'desc' },
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
                posts,
                total,
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

exports.getPostDetails = async (req, res) => {
    try {
        const { postId } = req.params;

        const post = await prisma.post.findFirst({
            where: { id: postId },
            include: {
                user: {
                    select: { username: true, email: true }
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
            data: { post }
        });
    } catch (error) {
        console.error('Post details fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching post details'
        });
    }
};

exports.approvePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { notes } = req.body;
        const approverId = req.user.id;
        console.log("Got id ----->" + postId + "Type of it is : ----->" + typeof postId)

        const post = await prisma.post.findFirst({
            where: { 
                id: postId,
                status: 'pending'
            },
            include: {
                user: {
                    select: { username: true, id: true }
                }
            }
        });

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found or already processed'
            });
        }

        await prisma.post.update({
            where: { id: postId },
            data: {
                status: 'approved',
                approver_id: approverId,
                approved_at: new Date(),
                review_notes: notes
            }
        });

        // Create notification
        if (post.user?.username) {
            const notification = await prisma.notification.create({
                data: {
                    userID: post.user.username,
                    message: 'Your post has been approved',
                    type: 'post_approved',
                    isRead: false
                }
            });
            
            // Emit real-time notification event
            emitEvent('notification:created', {
                userId: post.user.id,
                userID: post.user.username,
                notification: {
                    id: notification.id,
                    type: notification.type,
                    message: notification.message,
                    isRead: notification.isRead,
                    createdAt: notification.createdAt
                }
            });
        }

        res.json({
            status: 'success',
            message: 'Post approved successfully'
        });
    } catch (error) {
        console.error('Post approval error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error approving post'
        });
    }
};

exports.rejectPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { notes } = req.body;
        const approverId = req.user.id;

        const post = await prisma.post.findFirst({
            where: { 
                id: postId,
                status: 'pending'
            },
            include: {
                user: {
                    select: { username: true, id: true }
                }
            }
        });

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found or already processed'
            });
        }

        await prisma.post.update({
            where: { id: postId },
            data: {
                status: 'rejected',
                approver_id: approverId,
                rejected_at: new Date(),
                review_notes: notes
            }
        });

        // Create notification
        if (post.user?.username) {
            const notification = await prisma.notification.create({
                data: {
                    userID: post.user.username,
                    message: `Your post has been rejected. Reason: ${notes}`,
                    type: 'post_rejected',
                    isRead: false
                }
            });
            
            // Emit real-time notification event
            emitEvent('notification:created', {
                userId: post.user.id,
                userID: post.user.username,
                notification: {
                    id: notification.id,
                    type: notification.type,
                    message: notification.message,
                    isRead: notification.isRead,
                    createdAt: notification.createdAt
                }
            });
        }

        res.json({
            status: 'success',
            message: 'Post rejected successfully'
        });
    } catch (error) {
        console.error('Post rejection error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error rejecting post'
        });
    }
};

exports.getApproverNotifications = async (req, res) => {
    try {
        const approverId = req.user.id;

        const notifications = await prisma.notification.findMany({
            where: { user_id: approverId },
            orderBy: { notification_date: 'desc' },
            take: 50
        });

        res.json({
            status: 'success',
            data: { notifications }
        });
    } catch (error) {
        console.error('Notifications fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching notifications'
        });
    }
};

exports.searchPosts = async (req, res) => {
    try {
        const { query, type, page = 1, limit = 10 } = req.query;
        if (!query || !type) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_PARAMETERS',
                    message: 'Query and type parameters are required'
                }
            });
        }
        const validTypes = ['post_id', 'post_title', 'user_id', 'username', 'date', 'status'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_SEARCH_TYPE',
                    message: `Invalid search type. Must be one of: ${validTypes.join(', ')}`
                }
            });
        }
        let whereClause = {};
        switch (type) {
            case 'post_id':
                whereClause.id = query;
                break;
            case 'post_title':
                whereClause.title = { 
                    mode: 'insensitive', 
                    contains: query 
                };
                break;
            case 'user_id':
                whereClause.user_id = query;
                break;
            case 'username':
                whereClause.user = {
                    username: {
                        mode: 'insensitive',
                        contains: query
                    }
                };
                break;
            case 'date':
                const searchDate = new Date(query);
                if (isNaN(searchDate.getTime())) {
                    return res.status(400).json({
                        success: false,
                        error: {
                            code: 'INVALID_DATE',
                            message: 'Invalid date format. Use YYYY-MM-DD'
                        }
                    });
                }
                whereClause.createdAt = {
                    gte: searchDate,
                    lt: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000)
                };
                break;
            case 'status':
                const validStatuses = ['pending', 'approved', 'rejected'];
                if (!validStatuses.includes(query.toLowerCase())) {
                    return res.status(400).json({
                        success: false,
                        error: {
                            code: 'INVALID_STATUS',
                            message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                        }
                    });
                }
                whereClause.status = query.toLowerCase();
                break;
        }
        // Only allow approver to see posts they are allowed to see
        whereClause.OR = [
            { approver_id: req.user.id },
            { status: 'pending' }
        ];
        
        const offset = (page - 1) * limit;
        const [posts, total] = await Promise.all([
            prisma.post.findMany({
                where: whereClause,
                include: {
                    user: {
                        select: { id: true, username: true, email: true, status: true, profile_picture: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.post.count({
                where: whereClause
            })
        ]);
        
        const formattedPosts = posts.map(post => {
            return {
                id: post.id,
                title: post.title,
                description: post.description,
                status: post.status,
                created_at: post.createdAt,
                updated_at: post.updatedAt,
                user_id: post.user_id,
                user: post.user
            };
        });
        
        res.json({
            success: true,
            data: {
                posts: formattedPosts,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total_pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error searching posts:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred while searching posts'
            }
        });
    }
};

// Get all posts (for approvers to view all posts)
exports.getAllPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const offset = (page - 1) * limit;

        // Build where clause
        const whereClause = {};
        
        // Filter by status if provided (all, pending, approved, rejected, frozen)
        if (status && status !== 'all') {
            whereClause.status = status;
        }

        const [posts, total] = await Promise.all([
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
                    },
                    approver: {
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
            prisma.post.count({
                where: whereClause
            })
        ]);

        res.json({
            status: 'success',
            data: {
                posts,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalCount: total,
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            }
        });
    } catch (error) {
        console.error('Get all posts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get flagged posts (for approvers to review flagged posts)
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

// Review flagged post (approve or reject after review)
exports.reviewFlaggedPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { action, notes } = req.body; // action: 'approve' or 'reject'
        const approverId = req.user.id;

        // Validate action
        if (!action || !['approve', 'reject'].includes(action)) {
            return res.status(400).json({
                status: 'error',
                message: 'Action must be either "approve" or "reject"'
            });
        }

        // Find the flagged post
        const post = await prisma.post.findFirst({
            where: { 
                id: postId,
                status: 'frozen',
                is_frozen: true
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

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Flagged post not found'
            });
        }

        // Update post based on action
        const updateData = {
            approver_id: approverId,
            updatedAt: new Date()
        };

        if (action === 'approve') {
            updateData.status = 'approved';
            updateData.is_frozen = false;
            updateData.approved_at = new Date();
            updateData.frozen_at = null;
        } else if (action === 'reject') {
            updateData.status = 'rejected';
            updateData.is_frozen = false;
            updateData.frozen_at = null;
        }

        await prisma.post.update({
            where: { id: postId },
            data: updateData
        });

        // Create notification for the user
        if (post.user?.username) {
            const notificationMessage = action === 'approve' 
                ? 'Your flagged post has been reviewed and approved' 
                : `Your flagged post has been reviewed and rejected. Reason: ${notes || 'Violation of community guidelines'}`;

            await prisma.notification.create({
                data: {
                    userID: post.user.username,
                    message: notificationMessage,
                    type: 'post_review',
                    isRead: false
                }
            });
        }

        res.json({
            status: 'success',
            message: `Flagged post ${action}d successfully`,
            data: {
                postId,
                action,
                reviewedBy: approverId
            }
        });
    } catch (error) {
        console.error('Review flagged post error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error reviewing flagged post',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};