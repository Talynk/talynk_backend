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

// Follow a user with the userId in the request body
const followUser = async (req, res) => {
  try {
    const followerId = req.user.id;
    const { userId: followingId } = req.body;

    // Validate input
    if (!followingId) {
      return res.status(400).json({
        status: 'error',
        message: 'User ID is required'
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
    const [userToFollow] = await db.sequelize.query(
      `SELECT id FROM users WHERE id = $1 AND status = 'active'`,
      {
        bind: [followingId],
        type: db.sequelize.QueryTypes.SELECT
      }
    );

    if (!userToFollow) {
      return res.status(404).json({
        status: 'error',
        message: 'User to follow not found or account is inactive'
      });
    }

    // Check if already following
    const [existingFollow] = await db.sequelize.query(
      `SELECT id FROM follows 
       WHERE "followerId" = $1 AND "followingId" = $2`,
      {
        bind: [followerId, followingId],
        type: db.sequelize.QueryTypes.SELECT
      }
    );

    if (existingFollow) {
      return res.status(400).json({
        status: 'error',
        message: 'You are already following this user'
      });
    }

    // Create new follow relationship
    await db.sequelize.query(
      `INSERT INTO follows ("followerId", "followingId", "createdAt", "updatedAt")
       VALUES ($1, $2, NOW(), NOW())`,
      {
        bind: [followerId, followingId],
        type: db.sequelize.QueryTypes.INSERT
      }
    );

    // Update follower count for the followed user
    await db.sequelize.query(
      `UPDATE users 
       SET follower_count = follower_count + 1
       WHERE id = $1`,
      {
        bind: [followingId],
        type: db.sequelize.QueryTypes.UPDATE
      }
    );

    // Create a notification for the followed user
    const [follower] = await db.sequelize.query(
      `SELECT username FROM users WHERE id = $1`,
      {
        bind: [followerId],
        type: db.sequelize.QueryTypes.SELECT
      }
    );

    await db.sequelize.query(
      `INSERT INTO notifications (user_id, notification_text, notification_date, is_read, context_data)
       VALUES ($1, $2, NOW(), false, $3)`,
      {
        bind: [
          followingId, 
          `${follower.username} started following you`, 
          JSON.stringify({
            type: 'follow',
            follower_id: followerId
          })
        ],
        type: db.sequelize.QueryTypes.INSERT
      }
    );

    res.status(200).json({
      status: 'success',
      message: 'Successfully followed user'
    });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while processing follow request'
    });
  }
};

// Unfollow a user with the userId in the request body
const unfollowUser = async (req, res) => {
  try {
    const followerId = req.user.id;
    const { userId: followingId } = req.body;

    // Validate input
    if (!followingId) {
      return res.status(400).json({
        status: 'error',
        message: 'User ID is required'
      });
    }

    // Check if the follow relationship exists
    const [follow] = await db.sequelize.query(
      `SELECT id FROM follows 
       WHERE "followerId" = $1 AND "followingId" = $2`,
      {
        bind: [followerId, followingId],
        type: db.sequelize.QueryTypes.SELECT
      }
    );

    if (!follow) {
      return res.status(404).json({
        status: 'error',
        message: 'You are not following this user'
      });
    }

    // Delete the follow relationship
    await db.sequelize.query(
      `DELETE FROM follows 
       WHERE "followerId" = $1 AND "followingId" = $2`,
      {
        bind: [followerId, followingId],
        type: db.sequelize.QueryTypes.DELETE
      }
    );

    // Update follower count for the unfollowed user
    await db.sequelize.query(
      `UPDATE users 
       SET follower_count = GREATEST(follower_count - 1, 0)
       WHERE id = $1`,
      {
        bind: [followingId],
        type: db.sequelize.QueryTypes.UPDATE
      }
    );

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

// Get followers list with more complete user data and isFollowing flag
const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const currentUserId = req.user ? req.user.id : null;

    // Check if user exists
    const [user] = await db.sequelize.query(
      `SELECT id FROM users WHERE id = $1`,
      {
        bind: [userId],
        type: db.sequelize.QueryTypes.SELECT
      }
    );

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get total count
    const [countResult] = await db.sequelize.query(
      `SELECT COUNT(*) as count
       FROM follows
       WHERE "followingId" = $1`,
      {
        bind: [userId],
        type: db.sequelize.QueryTypes.SELECT
      }
    );
    
    const totalCount = parseInt(countResult.count);

    // Find followers with pagination
    const followers = await db.sequelize.query(
      `SELECT 
          u.id, 
          u.username, 
          u.profile_picture, 
          u.bio,
          CASE 
              WHEN u.role = 'admin' OR u.role = 'approver' THEN true
              ELSE false
          END AS "isVerified",
          CASE 
              WHEN EXISTS (
                  SELECT 1 FROM follows 
                  WHERE "followerId" = $1 AND "followingId" = u.id
              ) THEN true
              ELSE false
          END AS "isFollowing"
       FROM users u
       JOIN follows f ON u.id = f."followerId"
       WHERE f."followingId" = $2
       ORDER BY f."createdAt" DESC
       LIMIT $3 OFFSET $4`,
      {
        bind: [
          currentUserId || '00000000-0000-0000-0000-000000000000', // Use a dummy ID if not logged in
          userId,
          limit,
          offset
        ],
        type: db.sequelize.QueryTypes.SELECT
      }
    );

    const hasMore = offset + followers.length < totalCount;

    res.status(200).json({
      status: 'success',
      data: {
        followers,
        hasMore,
        totalCount
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

// Get following list with more complete user data and isFollowing flag
const getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const currentUserId = req.user ? req.user.id : null;

    // Check if user exists
    const [user] = await db.sequelize.query(
      `SELECT id FROM users WHERE id = $1`,
      {
        bind: [userId],
        type: db.sequelize.QueryTypes.SELECT
      }
    );

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get total count
    const [countResult] = await db.sequelize.query(
      `SELECT COUNT(*) as count
       FROM follows
       WHERE "followerId" = $1`,
      {
        bind: [userId],
        type: db.sequelize.QueryTypes.SELECT
      }
    );
    
    const totalCount = parseInt(countResult.count);

    // Find following with pagination
    const following = await db.sequelize.query(
      `SELECT 
          u.id, 
          u.username, 
          u.profile_picture, 
          u.bio,
          CASE 
              WHEN u.role = 'admin' OR u.role = 'approver' THEN true
              ELSE false
          END AS "isVerified",
          CASE 
              WHEN EXISTS (
                  SELECT 1 FROM follows 
                  WHERE "followerId" = $1 AND "followingId" = u.id
              ) THEN true
              ELSE false
          END AS "isFollowing"
       FROM users u
       JOIN follows f ON u.id = f."followingId"
       WHERE f."followerId" = $2
       ORDER BY f."createdAt" DESC
       LIMIT $3 OFFSET $4`,
      {
        bind: [
          currentUserId || '00000000-0000-0000-0000-000000000000', // Use a dummy ID if not logged in
          userId,
          limit,
          offset
        ],
        type: db.sequelize.QueryTypes.SELECT
      }
    );

    const hasMore = offset + following.length < totalCount;

    res.status(200).json({
      status: 'success',
      data: {
        following,
        hasMore,
        totalCount
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

    // Check follow status
    const [result] = await db.sequelize.query(
      `SELECT EXISTS(
          SELECT 1 FROM follows 
          WHERE "followerId" = $1 AND "followingId" = $2
      ) as "isFollowing"`,
      {
        bind: [followerId, followingId],
        type: db.sequelize.QueryTypes.SELECT
      }
    );

    res.status(200).json({
      status: 'success',
      data: { 
        isFollowing: result.isFollowing
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