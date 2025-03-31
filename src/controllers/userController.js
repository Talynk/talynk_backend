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

// Get user profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.username, {
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
            data: { user }
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching profile'
        });
    }
};

// Update user profile
exports.updateProfile = async (req, res) => {
    try {
        const { phone1, phone2, selected_category } = req.body;
        const username = req.user.username;

        const user = await User.findByPk(username);
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Update user
        await user.update({
            phone1: phone1 || user.phone1,
            phone2: phone2 || user.phone2,
            selected_category: selected_category || user.selected_category,
            user_facial_image: req.file ? req.file.buffer : user.user_facial_image
        });

        res.json({
            status: 'success',
            message: 'Profile updated successfully',
            data: {
                user: {
                    username: user.username,
                    email: user.email,
                    phone1: user.phone1,
                    phone2: user.phone2,
                    selected_category: user.selected_category
                }
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating profile'
        });
    }
};

// Get user statistics
exports.getStatistics = async (req, res) => {
    try {
        const username = req.user.username;

        const [user, posts, comments, likes] = await Promise.all([
            User.findByPk(username),
            Post.count({ where: { uploaderID: username } }),
            Comment.count({ where: { commentorID: username } }),
            PostLike.count({ where: { userID: username } })
        ]);

        res.json({
            status: 'success',
            data: {
                statistics: {
                    posts_count: posts,
                    total_profile_views: user.total_profile_views,
                    total_likes: user.likes,
                    total_subscribers: user.subscribers,
                    total_comments: comments,
                    total_likes_given: likes
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
    try {
        const username = req.user.username;
        const { searchTerm } = req.body;
        
        // Create a new search record using Sequelize
        await RecentSearch.create({
            user_id: username,
            search_term: searchTerm,
            search_date: new Date()
        });

        // Update user's recent_searches array using Sequelize
        const user = await User.findByPk(username);
        
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
            
            // Update the user
            await user.update({ recent_searches: recentSearches });
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
    try {
        const user = await User.findByPk(req.user.username);
        await user.update({ notification: !user.notification });

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
    try {
        const notifications = await Notification.findAll({
            where: { userID: req.user.username },
            order: [['notification_date', 'DESC']]
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
