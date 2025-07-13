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
const Category = require('../models/Category.js');
const Follow = require('../models/Follow.js');

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

/**
 * Update user profile - handles profile picture upload and phone number updates
 * @route PUT /api/user/profile
 * @access Private
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone1, phone2 } = req.body;
    
    // Create an update object with only allowed fields
    const updateData = {};
    if (phone1 !== undefined) updateData.phone1 = phone1;
    if (phone2 !== undefined) updateData.phone2 = phone2;
    
    // Get Supabase instance from app locals
    const supabase = req.app.locals.supabase;
    
    // Handle profile picture upload if it exists
    if (req.file) {
      try {
        const file = req.file;
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `profile/profile_${userId}_${Date.now()}.${fileExtension}`;
        const bucketName = process.env.SUPABASE_BUCKET_NAME || 'profiles';
        
        // Upload to Supabase
        const { data, error } = await supabase.storage
          .from(bucketName)
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: true
          });
          
        if (error) {
          console.error('Error uploading to Supabase:', error);
          throw new Error('Failed to upload profile picture');
        }
        
        // Get the public URL
        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);
          
        // Add profile picture URL to update data
        updateData.profile_picture = urlData.publicUrl;
        
      } catch (uploadError) {
        console.error('File upload error:', uploadError);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to upload profile picture',
          error: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
        });
      }
    }
    
    // Only proceed if there are fields to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No valid fields provided for update'
      });
    }
    
    // Update the user with the restricted fields
    const [updated, updatedUsers] = await User.update(updateData, {
      where: { id: userId },
      returning: true
    });
    
    if (!updated) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    // Get the updated user object without sensitive fields
    const updatedUser = updatedUsers[0].get({ plain: true });
    delete updatedUser.password;
    
    res.status(200).json({
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
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

        // Get user with Sequelize models
        const user = await User.findOne({
            where: {
                id: userId,
                status: 'active'
            },
            attributes: [
                'id',
                'username',
                'email',
                'bio',
                'profile_picture',
                'posts_count',
                'follower_count'
            ]
        });

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found or account is inactive'
            });
        }

        // Convert to plain object for easier manipulation
        const userData = user.toJSON();
        
        // Rename fields to match expected format
        userData.fullName = userData.username;
        userData.profilePicture = userData.profile_picture;
        userData.postsCount = userData.posts_count;
        userData.followersCount = userData.follower_count;
        userData.coverPhoto = null;

        // Get following count
        const followingCount = await Follow.count({
            where: {
                followerId: userId
            }
        });
        
        userData.followingCount = followingCount;

        // Check if current user is following this profile
        let isFollowing = false;
        if (currentUserId) {
            const followExists = await Follow.findOne({
                where: {
                    followerId: currentUserId,
                    followingId: userId
                }
            });
            isFollowing = !!followExists;
        }

        userData.isFollowing = isFollowing;
        
        // Add timestamps
        userData.createdAt = userData.createdAt || new Date().toISOString();
        userData.updatedAt = userData.updatedAt || new Date().toISOString();

        // Update profile view count if not viewing own profile
        if (currentUserId !== userId) {
            await User.increment('total_profile_views', {
                by: 1,
                where: { id: userId }
            });
        }

        // Remove underscore fields that were renamed
        delete userData.profile_picture;
        delete userData.posts_count;
        delete userData.follower_count;

        res.json({
            status: 'success',
            data: userData
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
        const status = req.query.status || 'approved'; // Default to approved if no status specified

        // Validate status parameter
        const validStatuses = ['approved', 'pending', 'rejected'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid status parameter. Must be one of: approved, pending, rejected'
            });
        }

        // Build where clause based on status parameter
        const whereClause = { user_id: userId };
        if (status) {
            whereClause.status = status;
        }

        // Use Sequelize model queries rather than raw SQL
        // Find the count first
        const { count: totalCount } = await Post.findAndCountAll({
            where: whereClause
        });

        // Get the posts with all needed data
        const posts = await Post.findAll({
            where: whereClause,
            include: [
                {
                    model: Category,
                    as: 'category',
                    attributes: ['name']
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['username', 'profile_picture']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: limit,
            offset: offset
        });

        // Transform to match the expected format
        const formattedPosts = posts.map(post => {
            const postData = post.toJSON();
            return {
                id: postData.id,
                title: postData.title,
                description: postData.description,
                videoUrl: postData.video_url,
                mediaType: postData.video_url ? 'video' : 'image',
                created_at: postData.created_at,
                likesCount: postData.likes || 0,
                category_id: postData.category_id,
                categoryName: postData.category?.name,
                commentsCount: postData.comment_count || 0,
                authorName: postData.user?.username,
                authorProfilePicture: postData.user?.profile_picture
            };
        });

        // Check if user liked these posts
        if (currentUserId && formattedPosts.length > 0) {
            const postIds = formattedPosts.map(post => post.id);
            
            const likedPosts = await PostLike.findAll({
                where: {
                    user_id: currentUserId,
                    post_id: {
                        [Op.in]: postIds
                    }
                },
                attributes: ['post_id']
            });
            
            const likedPostIdSet = new Set(likedPosts.map(like => like.post_id));
            
            // Add isLiked flag to each post
            formattedPosts.forEach(post => {
                post.isLiked = likedPostIdSet.has(post.id);
            });
        }

        const hasMore = offset + formattedPosts.length < totalCount;

        res.json({
            status: 'success',
            data: {
                posts: formattedPosts,
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

// Get user approved posts only (for external profiles)
exports.getUserApprovedPosts = async (req, res) => {
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

        // Use Sequelize model queries rather than raw SQL
        // Find the count first - only approved posts
        const { count: totalCount } = await Post.findAndCountAll({
            where: { 
                user_id: userId,
                status: 'approved'
            }
        });

        // Get the posts with all needed data - only approved posts
        const posts = await Post.findAll({
            where: {
                user_id: userId,
                status: 'approved'
            },
            include: [
                {
                    model: Category,
                    as: 'category',
                    attributes: ['name']
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['username', 'profile_picture']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: limit,
            offset: offset
        });

        // Transform to match the expected format
        const formattedPosts = posts.map(post => {
            const postData = post.toJSON();
            return {
                id: postData.id,
                title: postData.title,
                description: postData.description,
                videoUrl: postData.video_url,
                mediaType: postData.video_url ? 'video' : 'image',
                created_at: postData.created_at,
                likesCount: postData.likes || 0,
                category_id: postData.category_id,
                categoryName: postData.category?.name,
                commentsCount: postData.comment_count || 0,
                authorName: postData.user?.username,
                authorProfilePicture: postData.user?.profile_picture
            };
        });

        // Check if user liked these posts
        if (currentUserId && formattedPosts.length > 0) {
            const postIds = formattedPosts.map(post => post.id);
            
            const likedPosts = await PostLike.findAll({
                where: {
                    user_id: currentUserId,
                    post_id: {
                        [Op.in]: postIds
                    }
                },
                attributes: ['post_id']
            });
            
            const likedPostIdSet = new Set(likedPosts.map(like => like.post_id));
            
            // Add isLiked flag to each post
            formattedPosts.forEach(post => {
                post.isLiked = likedPostIdSet.has(post.id);
            });
        }

        const hasMore = offset + formattedPosts.length < totalCount;

        res.json({
            status: 'success',
            data: formattedPosts
        });
    } catch (error) {
        console.error('Error fetching user approved posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching user approved posts'
        });
    }
};
