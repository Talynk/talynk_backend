const db = require('../models');
const { Op } = require('sequelize');
const { updateFollowerCount } = require('./suggestionController');

/**
 * Create a notification for the followed user
 */
const createFollowNotification = async (followerId, followingId) => {
  try {
    // Get follower's username and profile picture for the notification
    const follower = await db.User.findByPk(followerId, {
      attributes: ['id', 'username', 'profile_picture']
    });
    
    if (!follower) return;
    
    // Create notification for the followed user with additional context data
    await db.Notification.create({
      user_id: followingId,
      notification_text: `${follower.username} started following you`,
      notification_date: new Date(),
      is_read: false,
      // Store additional context data for frontend use
      context_data: JSON.stringify({
        type: 'follow',
        follower_id: follower.id,
        follower_username: follower.username,
        follower_profile_picture: follower.profile_picture
      })
    });
    
    console.log(`Notification created: ${follower.username} followed user ${followingId}`);
  } catch (error) {
    console.error('Error creating follow notification:', error);
  }
};

// Follow a user
const followUser = async (req, res) => {
  try {
    const followerId = req.user.id;
    const { followingId } = req.body;

    // Validate input
    if (!followingId) {
      return res.status(400).json({
        status: 'error',
        message: 'Following ID is required'
      });
    }

    // Check if user is trying to follow themselves
    if (followerId === followingId) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot follow yourself'
      });
    }

    // Check if the user to follow exists
    const userToFollow = await db.User.findByPk(followingId);
    if (!userToFollow) {
      return res.status(404).json({
        status: 'error',
        message: 'User to follow not found'
      });
    }

    // Check if already following
    const existingFollow = await db.Follow.findOne({
      where: {
        followerId,
        followingId
      }
    });

    if (existingFollow) {
      return res.status(400).json({
        status: 'error',
        message: 'You are already following this user'
      });
    }

    // Create new follow relationship
    const follow = await db.Follow.create({
      followerId,
      followingId
    });

    // Update follower count for the followed user
    await updateFollowerCount(followingId);
    
    // Create a notification for the followed user
    await createFollowNotification(followerId, followingId);

    res.status(200).json({
      status: 'success',
      data: { follow }
    });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while processing follow request'
    });
  }
};

// Unfollow a user
const unfollowUser = async (req, res) => {
  try {
    const followerId = req.user.id;
    const { followingId } = req.params;

    // Validate input
    if (!followingId) {
      return res.status(400).json({
        status: 'error',
        message: 'Following ID is required'
      });
    }

    // Check if the follow relationship exists
    const follow = await db.Follow.findOne({
      where: {
        followerId,
        followingId
      }
    });

    if (!follow) {
      return res.status(404).json({
        status: 'error',
        message: 'You are not following this user'
      });
    }

    // Delete the follow relationship
    await follow.destroy();

    // Update follower count for the unfollowed user
    await updateFollowerCount(followingId);

    res.status(200).json({
      status: 'success',
      message: 'Successfully unfollowed user'
    });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while processing unfollow request'
    });
  }
};

// Get followers list
const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Check if user exists
    const user = await db.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Find followers
    const { count, rows: follows } = await db.Follow.findAndCountAll({
      where: { followingId: userId },
      limit,
      offset,
      include: [
        {
          model: db.User,
          as: 'follower',
          attributes: ['id', 'username', 'profile_picture', 'bio']
        }
      ]
    });

    // Extract follower information
    const followers = follows.map(follow => follow.follower);

    res.status(200).json({
      status: 'success',
      data: { 
        followers,
        totalCount: count
      }
    });
  } catch (error) {
    console.error('Error getting followers:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving followers'
    });
  }
};

// Get following list
const getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Check if user exists
    const user = await db.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Find following
    const { count, rows: follows } = await db.Follow.findAndCountAll({
      where: { followerId: userId },
      limit,
      offset,
      include: [
        {
          model: db.User,
          as: 'following',
          attributes: ['id', 'username', 'profile_picture', 'bio']
        }
      ]
    });

    // Extract following information
    const following = follows.map(follow => follow.following);

    res.status(200).json({
      status: 'success',
      data: { 
        following,
        totalCount: count
      }
    });
  } catch (error) {
    console.error('Error getting following:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving following users'
    });
  }
};

// Check if following
const checkFollowStatus = async (req, res) => {
  try {
    const followerId = req.user.id;
    const { followingId } = req.params;

    // Find following relationship
    const follow = await db.Follow.findOne({
      where: {
        followerId,
        followingId
      }
    });

    res.status(200).json({
      status: 'success',
      data: { 
        isFollowing: !!follow
      }
    });
  } catch (error) {
    console.error('Error checking follow status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while checking follow status'
    });
  }
};

module.exports = {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  checkFollowStatus
}; 