const { Op, QueryTypes, literal } = require('sequelize');
const db = require('../models');
const sequelize = db.sequelize;

/**
 * Get mutual connection suggestions (Tier 1)
 * Users who follow the current user but current user is not following back
 */
const getMutualSuggestions = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    // Find users who follow the current user but the current user is not following back
    const { count, rows: suggestions } = await db.User.findAndCountAll({
      attributes: [
        'id', 'username', 'profile_picture', 'bio', 'follower_count', 'posts_count'
      ],
      include: [
        {
          model: db.Follow,
          as: 'followers',
          required: true,
          where: {
            followingId: userId
          },
          attributes: [
            'createdAt' // When they started following the current user
          ]
        }
      ],
      where: {
        id: {
          [Op.ne]: userId, // Not the current user
          [Op.notIn]: sequelize.literal(`(
            SELECT "followingId" FROM "follows"
            WHERE "followerId" = '${userId}'
          )`) // Not already being followed by current user
        },
        status: 'active' // Only active users
      },
      order: [
        [{ model: db.Follow, as: 'followers' }, 'createdAt', 'DESC'] // Most recent followers first
      ],
      subQuery: false,
      limit,
      offset,
      distinct: true
    });

    // Get mutual follower counts for each suggestion
    const suggestionsWithMutualCounts = await Promise.all(
      suggestions.map(async (user) => {
        // Count mutual followers (users who follow both the current user and the suggested user)
        const mutualFollowersCount = await db.Follow.count({
          where: {
            followingId: user.id,
            followerId: {
              [Op.in]: sequelize.literal(`(
                SELECT "followerId" FROM "follows"
                WHERE "followingId" = '${userId}'
              )`)
            }
          }
        });

        // Check if the suggested user follows the current user (mutual connection)
        const followsSince = user.followers && user.followers.length > 0 
          ? user.followers[0].createdAt 
          : null;

        return {
          id: user.id,
          username: user.username,
          profile_picture: user.profile_picture,
          bio: user.bio,
          follower_count: user.follower_count,
          posts_count: user.posts_count,
          mutualFollowersCount,
          followsSince
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: { 
        suggestions: suggestionsWithMutualCounts,
        totalCount: count
      }
    });
  } catch (error) {
    console.error('Error getting mutual suggestions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching mutual suggestions'
    });
  }
};

/**
 * Get discover users suggestions (Tier 2)
 * Active users the current user is not following
 */
const getDiscoverSuggestions = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 12;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    
    // Parse excluded user IDs from query param
    const excludeIds = req.query.exclude_ids 
      ? req.query.exclude_ids.split(',') 
      : [];
    
    // Add current user ID to excluded list
    excludeIds.push(userId);

    // Get the current user's interests
    const currentUser = await db.User.findByPk(userId, {
      attributes: ['interests', 'selected_category']
    });
    
    // Combine interests and selected category
    const userInterests = [
      ...(currentUser.interests || []),
      currentUser.selected_category
    ].filter(Boolean);

    // Find users that current user is not following
    const { count, rows: suggestions } = await db.User.findAndCountAll({
      attributes: [
        'id', 'username', 'profile_picture', 'bio', 'follower_count', 
        'posts_count', 'last_active_date', 'interests', 'selected_category'
      ],
      where: {
        id: {
          [Op.notIn]: excludeIds,
          [Op.notIn]: sequelize.literal(`(
            SELECT "followingId" FROM "follows"
            WHERE "followerId" = '${userId}'
          )`)
        },
        status: 'active'
      },
      order: [
        ['last_active_date', 'DESC'],
        ['follower_count', 'DESC'],
        sequelize.literal('RANDOM()')
      ],
      limit,
      offset
    });

    // Calculate relevance scores based on activity, popularity, and interest overlap
    const suggestionsWithRelevance = suggestions.map(user => {
      // Calculate days since last activity (max 30 days)
      const daysSinceActive = user.last_active_date 
        ? Math.min(30, Math.floor((new Date() - new Date(user.last_active_date)) / (1000 * 60 * 60 * 24)))
        : 30;
      
      // Activity score (0-40): more recent activity = higher score
      const activityScore = 40 - Math.floor(daysSinceActive * 1.33);
      
      // Popularity score (0-40): more followers = higher score (logarithmic scale)
      const popularityScore = Math.min(40, Math.floor(Math.log(user.follower_count + 1) * 10));
      
      // Interest overlap score (0-20): matching interests = higher score
      const userInterestList = [
        ...(user.interests || []),
        user.selected_category
      ].filter(Boolean);
      
      const interestOverlap = userInterests.filter(interest => 
        userInterestList.includes(interest)).length;
      
      const interestScore = Math.min(20, interestOverlap * 10);
      
      // Calculate total relevance score (0-100)
      const relevanceScore = activityScore + popularityScore + interestScore;
      
      return {
        id: user.id,
        username: user.username,
        profile_picture: user.profile_picture,
        bio: user.bio,
        follower_count: user.follower_count,
        posts_count: user.posts_count,
        lastActive: user.last_active_date,
        relevanceScore,
        interestOverlap: interestOverlap > 0 ? userInterests.filter(interest => 
          userInterestList.includes(interest)) : []
      };
    });

    // Sort by relevance score (highest first)
    suggestionsWithRelevance.sort((a, b) => b.relevanceScore - a.relevanceScore);

    res.status(200).json({
      status: 'success',
      data: { 
        suggestions: suggestionsWithRelevance,
        totalCount: count
      }
    });
  } catch (error) {
    console.error('Error getting discover suggestions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching discover suggestions'
    });
  }
};

/**
 * Update user activity and relevance metrics
 * This should be called periodically to update last_active_date
 */
const updateUserActivityMetrics = async (userId) => {
  try {
    if (!userId) return;
    
    await db.User.update(
      { last_active_date: new Date() },
      { where: { id: userId } }
    );
  } catch (error) {
    console.error('Error updating user activity metrics:', error);
  }
};

/**
 * Update follower counts for users
 * This should be called when follow/unfollow events occur
 */
const updateFollowerCount = async (followingId) => {
  try {
    if (!followingId) return;
    
    // Count the actual followers
    const followerCount = await db.Follow.count({
      where: { followingId }
    });
    
    // Update the user's follower_count field
    await db.User.update(
      { follower_count: followerCount },
      { where: { id: followingId } }
    );
  } catch (error) {
    console.error('Error updating follower count:', error);
  }
};

module.exports = {
  getMutualSuggestions,
  getDiscoverSuggestions,
  updateUserActivityMetrics,
  updateFollowerCount
}; 