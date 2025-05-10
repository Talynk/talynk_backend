const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const commentController = require('../controllers/commentController');
const { authenticate } = require('../middleware/auth');

// GET all posts
router.get('/', async (req, res) => {
  try {
    console.log('Fetching posts...');
    const posts = await Post.findAll({
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'name', 'username', 'profile_picture']
        }
      ]
    });
    
    console.log(`Found ${posts.length} posts`);
    
    // Transform posts to match frontend expectations
    const transformedPosts = posts.map(post => {
      const plainPost = post.get({ plain: true });
      return {
        id: plainPost.id.toString(),
        title: plainPost.title || '',
        caption: plainPost.description || '', // Map description to caption
        post_category: plainPost.category?.name || 'uncategorized',
        file_url: plainPost.videoUrl || '', // Map videoUrl to file_url
        user: {
          name: plainPost.author?.name || 'Anonymous',
          username: plainPost.author?.username || 'anonymous',
          avatar: plainPost.author?.profile_picture || '/placeholder.svg'
        },
        likes: plainPost.likes || 0,
        shares: plainPost.shares || 0,
        comments: plainPost.comments || 0,
        created_at: plainPost.created_at || plainPost.updatedAt || new Date().toISOString(),
        status: plainPost.status || 'pending'
      };
    });
    
    res.json(transformedPosts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch posts', 
      message: error.message 
    });
  }
});

// Get comments on the logged-in user's posts for the Inbox page
router.get('/comments/user', authenticate, commentController.getUserPostComments);

module.exports = router; 