const prisma = require('../lib/prisma');

// Report a post
exports.reportPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { reason, description } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!reason) {
            return res.status(400).json({
                status: 'error',
                message: 'Report reason is required'
            });
        }

        // Check if post exists
        const post = await prisma.post.findUnique({
            where: { id: postId }
        });

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found'
            });
        }

        // Check if user already reported this post
        const existingReport = await prisma.postReport.findUnique({
            where: {
                post_id_user_id: {
                    post_id: postId,
                    user_id: userId
                }
            }
        });

        if (existingReport) {
            return res.status(400).json({
                status: 'error',
                message: 'You have already reported this post'
            });
        }

        // Create the report
        const report = await prisma.postReport.create({
            data: {
                post_id: postId,
                user_id: userId,
                reason: reason,
                description: description || null
            }
        });

        // Increment report count on the post
        const updatedPost = await prisma.post.update({
            where: { id: postId },
            data: {
                report_count: {
                    increment: 1
                }
            }
        });

        // Check if post should be frozen (5+ reports)
        if (updatedPost.report_count >= 5 && !updatedPost.is_frozen) {
            await prisma.post.update({
                where: { id: postId },
                data: {
                    is_frozen: true,
                    frozen_at: new Date(),
                    status: 'frozen'
                }
            });

            // Create notification for post owner
            await prisma.notification.create({
                data: {
                    userID: post.user_id,
                    message: 'Your post has been frozen due to multiple reports',
                    type: 'post_frozen',
                    isRead: false
                }
            });
        }

        res.status(201).json({
            status: 'success',
            message: 'Post reported successfully',
            data: {
                report: {
                    id: report.id,
                    reason: report.reason,
                    description: report.description,
                    createdAt: report.createdAt
                },
                postReportCount: updatedPost.report_count,
                isFrozen: updatedPost.report_count >= 5
            }
        });

    } catch (error) {
        console.error('Report post error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error reporting post',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get all reports (Admin only)
exports.getAllReports = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, reason } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {};
        if (status) whereClause.status = status;
        if (reason) whereClause.reason = reason;

        const [reports, totalCount] = await Promise.all([
            prisma.postReport.findMany({
                where: whereClause,
                include: {
                    post: {
                        select: {
                            id: true,
                            title: true,
                            status: true,
                            is_frozen: true,
                            report_count: true
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
                orderBy: {
                    createdAt: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.postReport.count({
                where: whereClause
            })
        ]);

        res.json({
            status: 'success',
            data: {
                reports,
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
        console.error('Get reports error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching reports',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Review a report (Admin only)
exports.reviewReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const { status, adminNotes } = req.body;
        const adminId = req.user.id;

        // Validate status
        const validStatuses = ['reviewed', 'resolved', 'dismissed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid status. Must be one of: reviewed, resolved, dismissed'
            });
        }

        // Update the report
        const report = await prisma.postReport.update({
            where: { id: reportId },
            data: {
                status: status,
                reviewed_by: adminId,
                reviewed_at: new Date(),
                description: adminNotes ? `${report.description}\n\nAdmin Notes: ${adminNotes}` : report.description
            },
            include: {
                post: {
                    select: {
                        id: true,
                        title: true,
                        user_id: true
                    }
                },
                user: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            }
        });

        // If report is resolved, unfreeze the post if it was frozen
        if (status === 'resolved') {
            await prisma.post.update({
                where: { id: report.post_id },
                data: {
                    is_frozen: false,
                    frozen_at: null,
                    status: 'approved'
                }
            });

            // Notify post owner
            await prisma.notification.create({
                data: {
                    userID: report.post.user_id,
                    message: 'Your post has been reviewed and unfrozen',
                    type: 'post_unfrozen',
                    isRead: false
                }
            });
        }

        res.json({
            status: 'success',
            message: 'Report reviewed successfully',
            data: { report }
        });

    } catch (error) {
        console.error('Review report error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error reviewing report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get reports for a specific post
exports.getPostReports = async (req, res) => {
    try {
        const { postId } = req.params;

        const reports = await prisma.postReport.findMany({
            where: { post_id: postId },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true
                    }
                },
                reviewer: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
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

// Get report statistics (Admin only)
exports.getReportStats = async (req, res) => {
    try {
        const stats = await Promise.all([
            prisma.postReport.count(),
            prisma.postReport.count({ where: { status: 'pending' } }),
            prisma.postReport.count({ where: { status: 'reviewed' } }),
            prisma.postReport.count({ where: { status: 'resolved' } }),
            prisma.postReport.count({ where: { status: 'dismissed' } }),
            prisma.post.count({ where: { is_frozen: true } }),
            prisma.postReport.groupBy({
                by: ['reason'],
                _count: {
                    reason: true
                }
            })
        ]);

        const [totalReports, pendingReports, reviewedReports, resolvedReports, dismissedReports, frozenPosts, reportsByReason] = stats;

        res.json({
            status: 'success',
            data: {
                totalReports,
                pendingReports,
                reviewedReports,
                resolvedReports,
                dismissedReports,
                frozenPosts,
                reportsByReason: reportsByReason.map(item => ({
                    reason: item.reason,
                    count: item._count.reason
                }))
            }
        });

    } catch (error) {
        console.error('Get report stats error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching report statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

