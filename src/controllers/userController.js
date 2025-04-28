// const { User, Post, Comment, Notification, Subscription, PostLike, RecentSearch } = require('../models');
const User = require('../models/User.js');
const Post = require('../models/Post.js');
const Comment = require('../models/Comment.js');
const Notification = require('../models/Notification.js');
const Subscription = require('../models/Subscription.js');
const PostLike = require('../models/PostLike.js');
const RecentSearch = require('../models/RecentSearch.js');
const { Op } = require('sequelize');
const db = require('../config/db');
const sequelize = require('../config/database');
const { updateUserActivityMetrics } = require('./suggestionController');

// Get user profile
exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Update user activity timestamp
        await updateUserActivityMetrics(userId);
        
        // Get user using raw SQL to avoid field naming issues
        const [user] = await sequelize.query(
            `SELECT 
                id, 
                username,
                username as "fullName", 
                email,
                bio,
                profile_picture as "profilePicture",
                posts_count as "postsCount",
                follower_count as "followersCount",
                total_profile_views, 
                likes, 
                subscribers, 
                recent_searches, 
                phone1,
                phone2, 
                selected_category,
                status, 
                role, 
                last_login
             FROM users 
             WHERE id = $1`,
            {
                bind: [userId],
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Get following count
        const [followingCount] = await sequelize.query(
            `SELECT COUNT(*) as count
             FROM follows
             WHERE "followerId" = $1`,
            {
                bind: [userId],
                type: sequelize.QueryTypes.SELECT
            }
        );
        
        user.followingCount = parseInt(followingCount.count);
        user.coverPhoto = null; // Add coverPhoto field for consistency
        
        // Add timestamps
        user.createdAt = new Date().toISOString();
        user.updatedAt = new Date().toISOString();

        res.json({
            status: 'success',
            data: user
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching profile',
            details: error.message
        });
    }
};

// Update user profile
exports.updateProfile = async (req, res) => {
    try {
        const { phone1, phone2, selected_category } = req.body;
        const user_id = req.user.id;

        // Get user using raw SQL to avoid field naming issues
        const [user] = await sequelize.query(
            `SELECT * FROM users WHERE id = $1`,
            {
                bind: [user_id],
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Handle facial image upload
        let facialImageBuffer = null;
        if (req.file) {
            console.log("File received:", req.file.originalname, req.file.mimetype, req.file.size);
            
            // Validate file type
            const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (!allowedMimeTypes.includes(req.file.mimetype)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid file type. Only JPEG, PNG, and JPG images are allowed.'
                });
            }

            // Validate file size (max 5MB)
            const maxSize = 5 * 1024 * 1024; // 5MB in bytes
            if (req.file.size > maxSize) {
                return res.status(400).json({
                    status: 'error',
                    message: 'File size too large. Maximum size is 5MB.'
                });
            }

            // Read the file from disk
            try {
                const fs = require('fs');
                facialImageBuffer = fs.readFileSync(req.file.path);
                
                // Clean up the temporary file
                fs.unlinkSync(req.file.path);
            } catch (err) {
                console.error('Error reading file:', err);
                return res.status(500).json({
                    status: 'error',
                    message: 'Error processing uploaded file',
                    details: err.message
                });
            }
        }

        // Prepare update data
        const updateData = {
            phone1: phone1 || user.phone1,
            phone2: phone2 || user.phone2,
            selected_category: selected_category || user.selected_category
        };

        // Only update facial image if a new one was uploaded
        if (facialImageBuffer) {
            updateData.user_facial_image = facialImageBuffer;
        }

        // Update user using raw SQL
        await sequelize.query(
            `UPDATE users 
             SET phone1 = $1, phone2 = $2, selected_category = $3${facialImageBuffer ? ', user_facial_image = $4' : ''}
             WHERE id = $${facialImageBuffer ? '5' : '4'}`,
            {
                bind: facialImageBuffer 
                    ? [updateData.phone1, updateData.phone2, updateData.selected_category, facialImageBuffer, user_id]
                    : [updateData.phone1, updateData.phone2, updateData.selected_category, user_id],
                type: sequelize.QueryTypes.UPDATE
            }
        );

        // Get updated user data
        const [updatedUser] = await sequelize.query(
            `SELECT id, username, email, phone1, phone2, selected_category FROM users WHERE id = $1`,
            {
                bind: [user_id],
                type: sequelize.QueryTypes.SELECT
            }
        );
        
        console.log("Updated data -------->", updatedUser);

        res.json({
            status: 'success',
            message: 'Profile updated successfully',
            data: {
                user: updatedUser
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating profile',
            details: error.message
        });
    }
};

// Get user statistics
exports.getStatistics = async (req, res) => {
    try {
        const userId = req.user.id;
        const username = req.user.username;

        // Get user data
        const [user] = await sequelize.query(
            `SELECT * FROM users WHERE id = $1`,
            {
                bind: [userId],
                type: sequelize.QueryTypes.SELECT
            }
        );

        // Get post count
        const [postCount] = await sequelize.query(
            `SELECT COUNT(*) as count FROM posts WHERE user_id = $1`,
            {
                bind: [userId],
                type: sequelize.QueryTypes.SELECT
            }
        );

        // Get comment count
        const [commentCount] = await sequelize.query(
            `SELECT COUNT(*) as count FROM comments WHERE commentor_id = $1`,
            {
                bind: [req.user.id],
                type: sequelize.QueryTypes.SELECT
            }
        );

        // Get like count
        const [likeCount] = await sequelize.query(
            `SELECT COUNT(*) as count FROM post_likes WHERE user_id = $1`,
            {
                bind: [userId],
                type: sequelize.QueryTypes.SELECT
            }
        );

        res.json({
            status: 'success',
            data: {
                statistics: {
                    posts_count: parseInt(postCount.count),
                    total_profile_views: user.total_profile_views,
                    total_likes: user.likes,
                    total_subscribers: user.subscribers,
                    total_comments: parseInt(commentCount.count),
                    total_likes_given: parseInt(likeCount.count)
                }
            }
        });
    } catch (error) {
        console.error('Statistics fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching statistics'
        });
    }
};

// Get user's recent searches
exports.getRecentSearches = async (req, res) => {
    try {
        const username = req.user.username;
        
        // Use Sequelize model instead of raw query
        const searches = await RecentSearch.findAll({
            where: { user_id: username },
            attributes: ['search_term', 'search_date'],
            order: [['search_date', 'DESC']],
            limit: 10
        });

        res.json({
            status: 'success',
            data: {
                searches: searches
            }
        });
    } catch (error) {
        console.error('Error fetching recent searches:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching recent searches'
        });
    }
};

// Add a search term
exports.addSearchTerm = async (req, res) => {
    console.log(req.body);
    try {

        const username = req.user.username;
        const searchTerm = req.body.search_term;
        console.log(searchTerm);
        
        // Create a new search record using raw SQL
        await sequelize.query(
            `INSERT INTO recent_searches (user_id, search_term, search_date)
             VALUES ($1, $2, $3)`,
            {
                bind: [username, searchTerm, new Date()],
                type: sequelize.QueryTypes.INSERT
            }
        );

        // Update user's recent_searches array using raw SQL
        const [user] = await sequelize.query(
            `SELECT recent_searches FROM users WHERE username = $1`,
            {
                bind: [username],
                type: sequelize.QueryTypes.SELECT
            }
        );
        
        if (user) {
            // Get current recent searches or initialize empty array
            let recentSearches = user.recent_searches || [];
            
            // If array is not valid, initialize it
            if (!Array.isArray(recentSearches)) {
                recentSearches = [];
            }
            
            // Remove oldest search if we already have 10
            if (recentSearches.length >= 10) {
                recentSearches = recentSearches.slice(1);
            }
            
            // Add new search term
            recentSearches.push(searchTerm);
            
            // Update the user with raw SQL
            await sequelize.query(
                `UPDATE users SET recent_searches = $1 WHERE username = $2`,
                {
                    bind: [recentSearches, username],
                    type: sequelize.QueryTypes.UPDATE
                }
            );
        }

        res.json({
            status: 'success',
            message: 'Search term added successfully'
        });
    } catch (error) {
        console.error('Error adding search term:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error adding search term',
            details: error.message
        });
    }
};

// Toggle notifications
exports.toggleNotifications = async (req, res) => {
    console.log(req.body);
    try {
        const user = await User.findByPk(req.user.username);
        await user.update({ notification: !user.notification });
e
        res.json({
            status: 'success',
            message: `Notifications ${user.notification ? 'enabled' : 'disabled'} successfully`
        });
    } catch (error) {

        console.error('Notification toggle error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error toggling notifications'
        });
    }
};

// Get user notifications
exports.getNotifications = async (req, res) => {
    console.log("Hiitting User id -------> " + req.user.id);
    try {
        const notifications = await sequelize.query(
            `SELECT * FROM notifications 
             WHERE user_id = :userId 
             ORDER BY notification_date DESC`,
            {
                replacements: { userId: req.user.id },
                type: sequelize.QueryTypes.SELECT
            }
        );
console.log("User id -------> " + req.user.id);
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

exports.getCurrentUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
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
            data: user
        });
    } catch (error) {
        console.error('Error getting current user:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching user data'
        });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: { exclude: ['password'] }
        });

        res.json({
            status: 'success',
            data: users
        });
    } catch (error) {
        console.error('Error getting all users:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching users'
        });
    }
};

exports.getUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
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
            data: user
        });
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching user'
        });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        const { username, primaryPhone, secondaryPhone, isAdmin } = req.body;
        await user.update({
            username,
            primaryPhone,
            secondaryPhone,
            isAdmin
        });

        res.json({
            status: 'success',
            message: 'User updated successfully',
            data: {
                id: user.id,
                username: user.username,
                primaryPhone: user.primaryPhone,
                secondaryPhone: user.secondaryPhone,
                isAdmin: user.isAdmin
            }
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating user'
        });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        await user.destroy();

        res.json({
            status: 'success',
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error deleting user'
        });
    }
};

exports.markAllNotificationsAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`Marking all notifications as read for user ID: ${userId}`);
        
        // Update all unread notifications for the user
        const result = await sequelize.query(
            `UPDATE notifications 
             SET is_read = true 
             WHERE user_id = $1 AND is_read = false`,
            {
                bind: [userId],
                type: sequelize.QueryTypes.UPDATE
            }
        );
        
        res.json({
            status: 'success',
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error marking notifications as read',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Update user interests
exports.updateUserInterests = async (req, res) => {
    try {
        const userId = req.user.id;
        const { interests } = req.body;

        if (!interests || !Array.isArray(interests)) {
            return res.status(400).json({
                status: 'error',
                message: 'Interests must be provided as an array'
            });
        }

        // Limit the number of interests to 10
        const limitedInterests = interests.slice(0, 10);

        // Update user interests using raw SQL
        await sequelize.query(
            `UPDATE users SET interests = $1, "updatedAt" = NOW(), last_active_date = NOW() WHERE id = $2`,
            {
                bind: [limitedInterests, userId],
                type: sequelize.QueryTypes.UPDATE
            }
        );

        res.json({
            status: 'success',
            message: 'Interests updated successfully',
            data: {
                interests: limitedInterests
            }
        });
    } catch (error) {
        console.error('Error updating interests:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating interests',
            details: error.message
        });
    }
};

// Get user profile by ID (for public profile viewing)
exports.getUserProfileById = async (req, res) => {
    try {
        let userId = req.params.id;
        
        // Validate UUID format - ensure it's a proper UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid user ID format'
            });
        }
        
        const currentUserId = req.user ? req.user.id : null;

        // Get basic user data
        const [user] = await sequelize.query(
            `SELECT 
                id, 
                username,
                username as "fullName", 
                email,
                bio,
                profile_picture as "profilePicture",
                posts_count as "postsCount",
                follower_count as "followersCount"
             FROM users
             WHERE id = $1 AND status = 'active'`,
            {
                bind: [userId],
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found or account is inactive'
            });
        }

        // Get following count
        const [followingCount] = await sequelize.query(
            `SELECT COUNT(*) as count
             FROM follows
             WHERE "followerId" = $1`,
            {
                bind: [userId],
                type: sequelize.QueryTypes.SELECT
            }
        );
        
        user.followingCount = parseInt(followingCount.count);
        user.coverPhoto = null; // Add coverPhoto field even though it's not in the database

        // Check if current user is following this profile
        let isFollowing = false;
        if (currentUserId) {
            const [followStatus] = await sequelize.query(
                `SELECT EXISTS(
                    SELECT 1 FROM follows 
                    WHERE "followerId" = $1 AND "followingId" = $2
                ) as "isFollowing"`,
                {
                    bind: [currentUserId, userId],
                    type: sequelize.QueryTypes.SELECT
                }
            );
            isFollowing = followStatus.isFollowing;
        }

        user.isFollowing = isFollowing;
        
        // Add timestamps (even if not in the database)
        user.createdAt = new Date().toISOString();
        user.updatedAt = new Date().toISOString();

        // Update profile view count if not viewing own profile
        if (currentUserId !== userId) {
            await sequelize.query(
                `UPDATE users 
                 SET total_profile_views = total_profile_views + 1
                 WHERE id = $1`,
                {
                    bind: [userId],
                    type: sequelize.QueryTypes.UPDATE
                }
            );
        }

        res.json({
            status: 'success',
            data: user
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching user profile'
        });
    }
};

// Get user posts
exports.getUserPostsById = async (req, res) => {
    try {
        let userId = req.params.id;
        
        // Validate UUID format - ensure it's a proper UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid user ID format'
            });
        }
        
        const currentUserId = req.user ? req.user.id : null;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Get total count of user's public posts
        const [countResult] = await sequelize.query(
            `SELECT COUNT(*) as count
             FROM posts
             WHERE user_id = $1 AND status = 'approved'`,
            {
                bind: [userId],
                type: sequelize.QueryTypes.SELECT
            }
        );
        
        const totalCount = parseInt(countResult.count);
        
        // Get posts with pagination
        const posts = await sequelize.query(
            `SELECT 
                p.id,
                p.title,
                p.caption,
                p.media_url as "media",
                p.media_type as "mediaType",
                p.created_at as "createdAt",
                p.likes_count as "likesCount",
                p.category_id,
                c.name as "categoryName",
                (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as "commentsCount",
                u.username as "authorName",
                u.profile_picture as "authorProfilePicture"
             FROM posts p
             LEFT JOIN categories c ON p.category_id = c.id
             JOIN users u ON p.user_id = u.id
             WHERE p.user_id = $1 AND p.status = 'approved'
             ORDER BY p.created_at DESC
             LIMIT $2 OFFSET $3`,
            {
                bind: [userId, limit, offset],
                type: sequelize.QueryTypes.SELECT
            }
        );

        // If user is authenticated, check if they liked each post
        if (currentUserId && posts.length > 0) {
            const likedPostIds = await sequelize.query(
                `SELECT post_id 
                 FROM post_likes 
                 WHERE user_id = $1 AND post_id IN (${posts.map((_, i) => `$${i + 2}`).join(',')})`,
                {
                    bind: [currentUserId, ...posts.map(post => post.id)],
                    type: sequelize.QueryTypes.SELECT
                }
            );
            
            const likedPostIdSet = new Set(likedPostIds.map(item => item.post_id));
            
            // Add isLiked flag to each post
            posts.forEach(post => {
                post.isLiked = likedPostIdSet.has(post.id);
            });
        }

        const hasMore = offset + posts.length < totalCount;

        res.json({
            status: 'success',
            data: {
                posts,
                hasMore,
                totalCount
            }
        });
    } catch (error) {
        console.error('Error fetching user posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching user posts'
        });
    }
};
