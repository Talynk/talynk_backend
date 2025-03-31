const Subscription = require('../models/Subscription.js');
const User = require('../models/User.js');
const Notification = require('../models/Notification.js');

exports.subscribe = async (req, res) => {
    try {
        const subscriberID = req.user.username;
        const { username: subscribed_to } = req.params;

        if (subscriberID === subscribed_to) {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot subscribe to yourself'
            });
        }

        const [subscription, created] = await Subscription.findOrCreate({
            where: {
                subscriberID,
                subscribed_to
            },
            defaults: {
                subscription_date: new Date()
            }
        });

        if (created) {
            // Increment subscriber count
            await User.increment('subscribers', {
                where: { username: subscribed_to }
            });

            // Notify user
            await Notification.create({
                userID: subscribed_to,
                notification_text: `${subscriberID} subscribed to your channel`,
                notification_date: new Date()
            });
        }

        res.json({
            status: 'success',
            message: created ? 'Subscribed successfully' : 'Already subscribed'
        });
    } catch (error) {
        console.error('Subscription error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error processing subscription'
        });
    }
};

exports.unsubscribe = async (req, res) => {
    try {
        const subscriberID = req.user.username;
        const { username: subscribed_to } = req.params;

        const subscription = await Subscription.findOne({
            where: {
                subscriberID,
                subscribed_to
            }
        });

        if (subscription) {
            await subscription.destroy();
            
            // Decrement subscriber count
            await User.decrement('subscribers', {
                where: { username: subscribed_to }
            });
        }

        res.json({
            status: 'success',
            message: 'Unsubscribed successfully'
        });
    } catch (error) {
        console.error('Unsubscribe error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error processing unsubscribe'
        });
    }
};

exports.getSubscribers = async (req, res) => {
    try {
        const username = req.user.username;

        const subscribers = await Subscription.findAll({
            where: { subscribed_to: username },
            include: [{
                model: User,
                as: 'subscriber',
                attributes: ['username', 'email', 'user_facial_image']
            }],
            order: [['subscription_date', 'DESC']]
        });

        res.json({
            status: 'success',
            data: { subscribers }
        });
    } catch (error) {
        console.error('Subscribers fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching subscribers'
        });
    }
}; 