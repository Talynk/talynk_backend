const Subscription = require('../models/Subscription.js');
const User = require('../models/User.js');
const Notification = require('../models/Notification.js');
const { validate } = require('uuid');
const  sequelize  = require('../config/database');

exports.subscribe = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const subscriberId = req.user.id;
        const { userID: subscribedToId } = req.params;

        console.log(`Attempting subscription: ${subscriberId} -> ${subscribedToId}`);

        // 1. Validate Input
        if (!validate(subscriberId) || !validate(subscribedToId)) {
            await transaction.rollback();
            return res.status(400).json({
                status: 'error',
                message: 'Invalid user ID format'
            });
        }

        if (subscriberId === subscribedToId) {
            await transaction.rollback();
            return res.status(400).json({
                status: 'error',
                message: 'Cannot subscribe to yourself'
            });
        }

        // 2. Check if Target User Exists
        const userToSubscribe = await User.findByPk(subscribedToId, { transaction });
        if (!userToSubscribe) {
            await transaction.rollback();
            return res.status(404).json({
                status: 'error',
                message: 'User to subscribe to not found'
            });
        }
        
        // 3. Check if Subscriber User Exists (important check)
        const subscriberUser = await User.findByPk(subscriberId, { transaction });
        if (!subscriberUser) {
            await transaction.rollback();
            console.error(`Subscriber user with ID ${subscriberId} not found in users table.`);
            // Return a generic error for security, but log the specific issue
            return res.status(401).json({ 
                status: 'error', 
                message: 'Authentication error' 
            }); 
        }

        // 4. Check if subscription already exists
        const existingSubscription = await sequelize.query(
            `SELECT * FROM "subscriptions" 
             WHERE "subscriber_id" = :subscriberId 
             AND "subscribed_to" = :subscribedToId 
             LIMIT 1`,
            {
                replacements: { subscriberId, subscribedToId },
                type: sequelize.QueryTypes.SELECT,
                transaction
            }
        );

        let subscriptionResult;
        let created = false;

        if (!existingSubscription || existingSubscription.length === 0) {
            console.log('Subscription does not exist, creating new one...');
            // 5. Create new subscription
            const creationTime = new Date();
            const newSubscriptionResult = await sequelize.query(
                `INSERT INTO "subscriptions" ("subscriber_id", "subscribed_to", "subscription_date") 
                 VALUES (:subscriberId, :subscribedToId, :subscriptionDate) 
                 RETURNING *`,
                {
                    replacements: { 
                        subscriberId, 
                        subscribedToId, 
                        subscriptionDate: creationTime
                    },
                    type: sequelize.QueryTypes.INSERT,
                    transaction
                }
            );
            
            // sequelize.query with INSERT might return [[result], metadata]
            subscriptionResult = newSubscriptionResult[0][0]; 
            created = true;
            console.log('Subscription created:', subscriptionResult);

            // 6. Increment subscriber count
            await sequelize.query(
                `UPDATE "users" 
                 SET "subscribers" = "subscribers" + 1 
                 WHERE "id" = :subscribedToId`,
                {
                    replacements: { subscribedToId }, // Corrected variable name
                    type: sequelize.QueryTypes.UPDATE,
                    transaction
                }
            );
            console.log(`Incremented subscriber count for ${subscribedToId}`);

            // 7. Notify user
            await sequelize.query(
                `INSERT INTO "notifications" ("user_id", "notification_text", "notification_date") 
                 VALUES (:userId, :notificationText, :notificationDate)`,
                {
                    replacements: { 
                        userId: subscribedToId, 
                        notificationText: `${req.user.username} subscribed to your channel`,
                        notificationDate: creationTime // Use same timestamp
                    },
                    type: sequelize.QueryTypes.INSERT,
                    transaction
                }
            );
            console.log(`Notification created for ${subscribedToId}`);

        } else {
            console.log('Subscription already exists.');
            subscriptionResult = existingSubscription[0];
        }

        // Commit transaction
        await transaction.commit();
        console.log('Transaction committed.');

        res.json({
            status: 'success',
            message: created ? 'Subscribed successfully' : 'Already subscribed',
            data: {
                subscription: {
                    subscriber_id: subscriptionResult.subscriber_id,
                    subscribed_to: subscriptionResult.subscribed_to,
                    subscription_date: subscriptionResult.subscription_date
                }
            }
        });

    } catch (error) {
        // Rollback transaction if any error occurs
        await transaction.rollback();
        console.error('Subscription error:', error);
        // Check for specific foreign key constraint error
        if (error.name === 'SequelizeForeignKeyConstraintError') {
             console.error('Foreign key constraint violation details:', error.parent);
             return res.status(400).json({
                 status: 'error',
                 message: 'Invalid user ID provided for subscription.' 
             });
        }
        res.status(500).json({
            status: 'error',
            message: 'Error processing subscription',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
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