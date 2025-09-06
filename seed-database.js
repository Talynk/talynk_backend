// Seed database with test data to verify all relations
require('dotenv').config();
const prisma = require('./src/lib/prisma');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
    console.log('🌱 Seeding database with test data...\n');
    
    try {
        // Clear existing data
        console.log('1. Clearing existing data...');
        await prisma.notification.deleteMany();
        await prisma.recentSearch.deleteMany();
        await prisma.comment.deleteMany();
        await prisma.postLike.deleteMany();
        await prisma.share.deleteMany();
        await prisma.view.deleteMany();
        await prisma.follow.deleteMany();
        await prisma.subscription.deleteMany();
        await prisma.post.deleteMany();
        await prisma.user.deleteMany();
        await prisma.category.deleteMany();
        await prisma.admin.deleteMany();
        await prisma.approver.deleteMany();
        console.log('✅ Existing data cleared\n');
        
        // Create categories
        console.log('2. Creating categories...');
        const categories = await Promise.all([
            prisma.category.create({
                data: {
                    name: 'Technology',
                    description: 'Tech-related posts',
                    status: 'active'
                }
            }),
            prisma.category.create({
                data: {
                    name: 'Entertainment',
                    description: 'Entertainment content',
                    status: 'active'
                }
            }),
            prisma.category.create({
                data: {
                    name: 'Sports',
                    description: 'Sports content',
                    status: 'active'
                }
            })
        ]);
        console.log(`✅ Created ${categories.length} categories\n`);
        
        // Create users
        console.log('3. Creating users...');
        const hashedPassword = await bcrypt.hash('password123', 10);
        
        const users = await Promise.all([
            prisma.user.create({
                data: {
                    username: 'john_doe',
                    email: 'john@example.com',
                    password: hashedPassword,
                    phone1: '+1234567890',
                    profile_picture: 'https://example.com/john.jpg',
                    interests: ['Technology', 'Sports'],
                    role: 'user',
                    status: 'active'
                }
            }),
            prisma.user.create({
                data: {
                    username: 'jane_smith',
                    email: 'jane@example.com',
                    password: hashedPassword,
                    phone1: '+1234567891',
                    profile_picture: 'https://example.com/jane.jpg',
                    interests: ['Entertainment', 'Technology'],
                    role: 'user',
                    status: 'active'
                }
            }),
            prisma.user.create({
                data: {
                    username: 'mike_wilson',
                    email: 'mike@example.com',
                    password: hashedPassword,
                    phone1: '+1234567892',
                    profile_picture: 'https://example.com/mike.jpg',
                    interests: ['Sports'],
                    role: 'user',
                    status: 'active'
                }
            })
        ]);
        console.log(`✅ Created ${users.length} users\n`);
        
        // Create admin and approver
        console.log('4. Creating admin and approver...');
        const admin = await prisma.admin.create({
            data: {
                username: 'admin',
                email: 'admin@talynk.com',
                password: hashedPassword,
                status: 'active'
            }
        });
        
        const approver = await prisma.approver.create({
            data: {
                username: 'approver',
                email: 'approver@talynk.com',
                password: hashedPassword,
                status: 'active'
            }
        });
        console.log('✅ Created admin and approver\n');
        
        // Create posts
        console.log('5. Creating posts...');
        const posts = await Promise.all([
            prisma.post.create({
                data: {
                    title: 'Amazing Tech Innovation',
                    description: 'This is a revolutionary technology that will change everything!',
                    status: 'approved',
                    user_id: users[0].id,
                    approver_id: approver.id,
                    category_id: categories[0].id,
                    views: 150,
                    likes: 25,
                    shares: 5,
                    comment_count: 8
                }
            }),
            prisma.post.create({
                data: {
                    title: 'Funny Cat Video',
                    description: 'Check out this hilarious cat doing tricks!',
                    status: 'approved',
                    user_id: users[1].id,
                    approver_id: approver.id,
                    category_id: categories[1].id,
                    views: 300,
                    likes: 45,
                    shares: 12,
                    comment_count: 15
                }
            }),
            prisma.post.create({
                data: {
                    title: 'Football Match Highlights',
                    description: 'Best moments from yesterday\'s match',
                    status: 'pending',
                    user_id: users[2].id,
                    category_id: categories[2].id,
                    views: 75,
                    likes: 10,
                    shares: 2,
                    comment_count: 3
                }
            })
        ]);
        console.log(`✅ Created ${posts.length} posts\n`);
        
        // Create comments
        console.log('6. Creating comments...');
        const comments = await Promise.all([
            prisma.comment.create({
                data: {
                    commentor_id: users[1].id,
                    post_id: posts[0].id,
                    comment_text: 'This is amazing! Great work!',
                    comment_reports: 0
                }
            }),
            prisma.comment.create({
                data: {
                    commentor_id: users[2].id,
                    post_id: posts[0].id,
                    comment_text: 'I agree, this is revolutionary!',
                    comment_reports: 0
                }
            }),
            prisma.comment.create({
                data: {
                    commentor_id: users[0].id,
                    post_id: posts[1].id,
                    comment_text: 'Haha, that cat is so funny!',
                    comment_reports: 0
                }
            })
        ]);
        console.log(`✅ Created ${comments.length} comments\n`);
        
        // Create follows
        console.log('7. Creating follows...');
        const follows = await Promise.all([
            prisma.follow.create({
                data: {
                    followerId: users[1].id,
                    followingId: users[0].id
                }
            }),
            prisma.follow.create({
                data: {
                    followerId: users[2].id,
                    followingId: users[0].id
                }
            }),
            prisma.follow.create({
                data: {
                    followerId: users[0].id,
                    followingId: users[1].id
                }
            })
        ]);
        console.log(`✅ Created ${follows.length} follows\n`);
        
        // Create post likes
        console.log('8. Creating post likes...');
        const postLikes = await Promise.all([
            prisma.postLike.create({
                data: {
                    user_id: users[1].username,
                    post_id: posts[0].id
                }
            }),
            prisma.postLike.create({
                data: {
                    user_id: users[2].username,
                    post_id: posts[0].id
                }
            }),
            prisma.postLike.create({
                data: {
                    user_id: users[0].username,
                    post_id: posts[1].id
                }
            })
        ]);
        console.log(`✅ Created ${postLikes.length} post likes\n`);
        
        // Create notifications
        console.log('9. Creating notifications...');
        const notifications = await Promise.all([
            prisma.notification.create({
                data: {
                    userID: users[0].username,
                    message: 'jane_smith started following you',
                    type: 'follow',
                    isRead: false
                }
            }),
            prisma.notification.create({
                data: {
                    userID: users[0].username,
                    message: 'jane_smith commented on your post',
                    type: 'comment',
                    isRead: false
                }
            })
        ]);
        console.log(`✅ Created ${notifications.length} notifications\n`);
        
        // Create subscriptions
        console.log('10. Creating subscriptions...');
        const subscriptions = await Promise.all([
            prisma.subscription.create({
                data: {
                    user_id: users[0].id,
                    plan: 'premium',
                    status: 'active'
                }
            }),
            prisma.subscription.create({
                data: {
                    user_id: users[1].id,
                    plan: 'basic',
                    status: 'active'
                }
            })
        ]);
        console.log(`✅ Created ${subscriptions.length} subscriptions\n`);
        
        // Test complex relations
        console.log('11. Testing complex relations...');
        
        // Test post with all relations
        const postWithAllRelations = await prisma.post.findUnique({
            where: { id: posts[0].id },
            include: {
                user: true,
                approver: true,
                category: true,
                comments: {
                    include: {
                        user: true
                    }
                },
                postLikes: true,
                postShares: true,
                postViews: true
            }
        });
        
        console.log(`✅ Post with all relations loaded successfully`);
        console.log(`   - User: ${postWithAllRelations.user.username}`);
        console.log(`   - Category: ${postWithAllRelations.category.name}`);
        console.log(`   - Comments: ${postWithAllRelations.comments.length}`);
        console.log(`   - Likes: ${postWithAllRelations.postLikes.length}`);
        
        // Test user with all relations
        const userWithAllRelations = await prisma.user.findUnique({
            where: { id: users[0].id },
            include: {
                posts: true,
                comments: true,
                postLikes: true,
                notifications: true,
                recentSearches: true,
                following: {
                    include: {
                        following: true
                    }
                },
                followers: {
                    include: {
                        follower: true
                    }
                },
                subscriptions: true,
                shares: true,
                views: true
            }
        });
        
        console.log(`✅ User with all relations loaded successfully`);
        console.log(`   - Posts: ${userWithAllRelations.posts.length}`);
        console.log(`   - Comments: ${userWithAllRelations.comments.length}`);
        console.log(`   - Following: ${userWithAllRelations.following.length}`);
        console.log(`   - Followers: ${userWithAllRelations.followers.length}`);
        console.log(`   - Notifications: ${userWithAllRelations.notifications.length}`);
        
        console.log('\n🎉 Database seeding completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   - Categories: ${categories.length}`);
        console.log(`   - Users: ${users.length}`);
        console.log(`   - Admin: 1`);
        console.log(`   - Approver: 1`);
        console.log(`   - Posts: ${posts.length}`);
        console.log(`   - Comments: ${comments.length}`);
        console.log(`   - Follows: ${follows.length}`);
        console.log(`   - Post Likes: ${postLikes.length}`);
        console.log(`   - Notifications: ${notifications.length}`);
        console.log(`   - Subscriptions: ${subscriptions.length}`);
        
        console.log('\n✨ All relations are working perfectly!');
        
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the seeding
seedDatabase();

