const User = require('../models/User.js');
const Post = require('../models/Post.js');
const Category = require('../models/Category.js');
const { Op } = require('sequelize');

exports.searchPosts = async (req, res) => {
    try {
        const { query, type, page = 1, limit = 10 } = req.query;

        // Validate required parameters
        if (!query || !type) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_PARAMETERS',
                    message: 'Query and type parameters are required'
                }
            });
        }

        // Validate search type
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

        // Build where clause based on search type
        let whereClause = {};
        switch (type) {
            case 'post_id':
                whereClause.id = query;
                break;
            case 'post_title':
                whereClause.title = {
                    [Op.iLike]: `%${query}%`
                };
                break;
            case 'user_id':
                whereClause.user_id = query;
                break;
            case 'username':
                whereClause['$user.username$'] = {
                    [Op.iLike]: `%${query}%`
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
                whereClause.created_at = {
                    [Op.gte]: searchDate,
                    [Op.lt]: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000)
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

        // Calculate pagination
        const offset = (page - 1) * limit;

        // Perform the search with pagination
        const { count, rows: posts } = await Post.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'username', 'email', 'status', 'profile_picture']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        // Format the response
        const formattedPosts = posts.map(post => {
            const postData = post.toJSON();
            return {
                id: postData.id,
                title: postData.title,
                description: postData.description,
                status: postData.status,
                created_at: postData.created_at,
                updated_at: postData.updated_at,
                user_id: postData.user_id,
                user: postData.user
            };
        });

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