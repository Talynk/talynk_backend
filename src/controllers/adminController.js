const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');

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
        const offset = (page - 1) * limit;
        const [posts, count] = await Promise.all([
            prisma.post.findMany({
                where: whereClause,
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            status: true,
                            profile_picture: true
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
                where: whereClause
            })
        ]);
        
        const formattedPosts = posts.map(post => ({
            id: post.id,
            title: post.title,
            description: post.description,
            status: post.status,
            created_at: post.createdAt,
            updated_at: post.updatedAt,
            user_id: post.user_id,
            user: post.user
        }));
        res.json({
            success: true,
            data: {
                posts: formattedPosts,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total_pages: Math.ceil(count / limit)
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

exports.getDashboardData = async (req, res) => {
    try {
        // Get counts for different post statuses
        const totalPosts = await Post.count();
        const pendingPosts = await Post.count({ where: { status: 'pending' } });
        const approvedPosts = await Post.count({ where: { status: 'approved' } });
        const rejectedPosts = await Post.count({ where: { status: 'rejected' } });

        // Get recent posts with their authors and categories
        const recentPosts = await Post.findAll({
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username']
                },
                {
                    model: Category,
                    as: 'category'
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: 10
        });

        // Process media URLs for recent posts
        const processedPosts = recentPosts.map(post => {
            const postObj = post.toJSON();
            if (postObj.mediaUrl && !postObj.mediaUrl.startsWith('http')) {
                postObj.mediaUrl = `/uploads/${postObj.mediaUrl.replace(/^uploads\//, '')}`;
            }
            return postObj;
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

exports.getPosts = async (req, res) => {
    try {
        const { status = 'all' } = req.query;
        
        const where = {};
        if (status !== 'all') {
            where.status = status;
        }

        const posts = await Post.findAll({
            where,
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'approver',
                    attributes: ['id', 'username']
                },
                {
                    model: Category,
                    as: 'category'
                },
                {
                    model: Like,
                    as: 'likes',
                    include: [{
                        model: User,
                        attributes: ['id', 'username']
                    }]
                },
                {
                    model: Comment,
                    as: 'comments',
                    include: [{
                        model: User,
                        attributes: ['id', 'username']
                    }]
                },
                {
                    model: Share,
                    as: 'shares',
                    include: [{
                        model: User,
                        attributes: ['id', 'username']
                    }]
                },
                {
                    model: View,
                    as: 'views',
                    include: [{
                        model: User,
                        attributes: ['id', 'username']
                    }]
                }
            ],
            order: [['createdAt', 'DESC']]
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

// Get pending posts
exports.getPendingPosts = async (req, res) => {
    try {
        const posts = await Post.findAll({
            where: { status: 'pending' },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'username']
                },
                {
                    model: Category,
                    as: 'category',
                    attributes: ['id', 'name']
                }
            ],
            order: [['created_at', 'DESC']]
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

// Update post status (approve/reject)
exports.updatePostStatus = async (req, res) => {
    try {
        console.log(req.body)
        const { status, rejectionReason } = req.body;
        console.log("Post: --------> " + req.body)
        
        // Find post with user information
        const post = await Post.findByPk(req.body.id, {
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'username']
            }]
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

        await post.update({
            status,
            rejectionReason: status === 'rejected' ? rejectionReason : null,
            approverId: req.user.id,
            approvedAt: status === 'approved' ? new Date() : null
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
            await sequelize.query(
                `INSERT INTO notifications (user_id, notification_text, notification_date, is_read)
                 VALUES ($1, $2, $3, $4)`,
                {
                    bind: [
                        post.user.id,
                        notificationText,
                        new Date(),
                        false
                    ],
                    type: sequelize.QueryTypes.INSERT
                }
            );
            
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

// Get admin dashboard stats
exports.getDashboardStats = async (req, res) => {
    try {
        // Verify models are loaded
        console.log('Models:', { User, Approver, Post });

        // Get counts with error handling for each query
        const stats = await Promise.all([
            User ? User.count().catch(err => {
                console.error('Error counting users:', err);
                return 0;
            }) : 0,
            Approver ? Approver.count().catch(err => {
                console.error('Error counting approvers:', err);
                return 0;
            }) : 0,
            Post ? Post.count({ where: { status: 'pending' } }).catch(err => {
                console.error('Error counting pending posts:', err);
                return 0;
            }) : 0,
            Post ? Post.count({ where: { status: 'approved' } }).catch(err => {
                console.error('Error counting approved posts:', err);
                return 0;
            }) : 0,
            Post ? Post.count({ where: { status: 'rejected' } }).catch(err => {
                console.error('Error counting rejected posts:', err);
                return 0;
            }) : 0,
            User ? User.count({ where: { status: 'active' } }).catch(err => {
                console.error('Error counting active users:', err);
                return 0;
            }) : 0,
            User ? User.count({ where: { status: 'frozen' } }).catch(err => {
                console.error('Error counting frozen users:', err);
                return 0;
            }) : 0
        ]);

        const [totalUsers, totalApprovers, pendingVideos, approvedVideos, rejectedVideos, activeUsers, frozenUsers] = stats;

        res.json({
            status: 'success',
            data: {
                totalUsers,
                totalApprovers,
                pendingVideos,
                approvedVideos,
                rejectedVideos,
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

// Account Management
exports.manageUserAccount = async (req, res) => {
    try {
        const { id, action } = req.body;

        // First, get the current user status
        const user = await User.findByPk(id);
        
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
        await User.update(
            { status: newStatus },
            { where: { id } }
        );

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
                [Op.gte]: searchDate,
                [Op.lt]: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000)
            };
        }

        if (search) {
            whereClause.title = {
                [Op.like]: `%${search}%`
            };
        }

        const posts = await Post.findAndCountAll({
            where: whereClause,
            include: [{
                model: User,
                as: 'user',
                attributes: ['username', 'email']
            }],
            order: [['approved_at', 'DESC']],
            limit: parseInt(limit),
            offset: (page - 1) * limit
        });

        res.json({
            status: 'success',
            data: {
                posts: posts.rows,
                total: posts.count,
                pages: Math.ceil(posts.count / limit),
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

// Video Management
exports.getAllVideos = async (req, res) => {
    try {
        const videos = await Post.findAll({
            include: [{
                model: User,
                attributes: ['username']
            }]
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
            approvedCountMap[count.user_id] = parseInt(count.dataValues.count, 10);
        });
            
        pendingCounts.forEach(count => {
            pendingCountMap[count.user_id] = parseInt(count.dataValues.count, 10);
        });

        // Enhance user objects with post counts
        const enhancedUsers = users.map(user => {
            const userData = user.toJSON();
            userData.postsApproved = approvedCountMap[userData.id] || 0;
            userData.postsPending = pendingCountMap[userData.id] || 0;
            return userData;
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

exports.getApprovers = async (req, res) => {
    try {
        const approvers = await Approver.findAll({
            attributes: [
                'id',
                'username',
                'email',
                'status',
                'createdAt',
                'lastLoginAt',
                [
                    sequelize.literal('(SELECT COUNT(*) FROM posts WHERE posts.approver_id = "Approver".id)'),
                    'totalApprovedPosts'
                ]
            ],
            order: [
                ['createdAt', 'DESC']
            ]
        });

        // Process approvers data
        const processedApprovers = approvers.map(approver => ({
            id: approver.id,
            username: approver.username,
            email: approver.email,
            status: approver.status,
            joinedDate: approver.createdAt,
            lastActive: approver.lastLoginAt,
            totalApprovedPosts: approver.getDataValue('totalApprovedPosts') || 0,
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
        const recentPosts = await Post.findAll({
            where: { approver_id: id },
            attributes: ['id', 'title', 'status', 'createdAt'],
            limit: 10,
            order: [['createdAt', 'DESC']]
        });

        // Get statistics
        const stats = await Post.findAll({
            where: { approver_id: id },
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['status']
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

exports.getRejectedPosts = async (req, res) => {
    try {
        const posts = await Post.findAll({
            where: {
                status: 'rejected'
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
            order: [['createdAt', 'DESC']]
        });

        // Add full URLs for files
        const postsWithUrls = posts.map(post => {
            const postData = post.toJSON();
            if (postData.video_url) {
                postData.fullUrl = `${process.env.API_BASE_URL || 'http://localhost:3000'}${postData.video_url}`;
            }
            return postData;
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

        // Add full URLs for files
        const postsWithUrls = posts.map(post => {
            const postData = post.toJSON();
            if (postData.video_url) {
                postData.fullUrl = `${process.env.API_BASE_URL || 'http://localhost:3000'}${postData.video_url}`;
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