// Test script to verify Prisma migration
require('dotenv').config();
const prisma = require('./src/lib/prisma');

async function testMigration() {
    console.log('🧪 Testing Prisma Migration...\n');
    
    try {
        // Test 1: Database Connection
        console.log('1. Testing database connection...');
        await prisma.$connect();
        console.log('✅ Database connection successful\n');
        
        // Test 2: Basic User Query
        console.log('2. Testing user query...');
        const userCount = await prisma.user.count();
        console.log(`✅ Found ${userCount} users in database\n`);
        
        // Test 3: Basic Post Query
        console.log('3. Testing post query...');
        const postCount = await prisma.post.count();
        console.log(`✅ Found ${postCount} posts in database\n`);
        
        // Test 4: Category Query
        console.log('4. Testing category query...');
        const categories = await prisma.category.findMany({
            select: { id: true, name: true }
        });
        console.log(`✅ Found ${categories.length} categories:`, categories.map(c => c.name).join(', '));
        console.log('');
        
        // Test 5: Complex Query with Relations
        console.log('5. Testing complex query with relations...');
        const postsWithUsers = await prisma.post.findMany({
            take: 3,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true
                    }
                },
                category: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        console.log(`✅ Found ${postsWithUsers.length} posts with user and category data\n`);
        
        console.log('🎉 All tests passed! Prisma migration is working correctly.');
        
    } catch (error) {
        console.error('❌ Migration test failed:', error.message);
        console.error('Full error:', error);
        
        if (error.code === 'P1001') {
            console.log('\n💡 Tip: Make sure your DATABASE_URL is correctly set in your .env file');
        } else if (error.code === 'P2021') {
            console.log('\n💡 Tip: Run "npx prisma db pull" to generate the schema from your database');
        }
    } finally {
        await prisma.$disconnect();
    }
}

// Run the test
testMigration();

