const axios = require('axios');

async function testUrlFix() {
    try {
        console.log('Testing URL fix...');
        
        // Login to get a valid token
        const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
            email: 'testuser@talynk.com',
            password: 'password123',
            role: 'user'
        });
        
        const token = loginResponse.data.data.accessToken;
        console.log('✅ Login successful');
        
        // Get user posts to check the fullUrl
        const postsResponse = await axios.get('http://localhost:3000/api/posts/user', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('✅ Posts retrieved successfully');
        
        if (postsResponse.data.data.posts.length > 0) {
            const post = postsResponse.data.data.posts[0];
            console.log('\n📋 Post details:');
            console.log('Title:', post.title);
            console.log('Video URL:', post.video_url);
            console.log('Full URL:', post.fullUrl);
            
            // Check if fullUrl is correct (should not have localhost:3000 prefix)
            if (post.fullUrl && post.fullUrl.includes('localhost:3000')) {
                console.log('❌ URL fix failed - still has localhost:3000 prefix');
            } else if (post.fullUrl && post.fullUrl.startsWith('https://')) {
                console.log('✅ URL fix successful - fullUrl is a proper Supabase URL');
            } else {
                console.log('⚠️  URL format unclear');
            }
        } else {
            console.log('No posts found to test');
        }
        
    } catch (error) {
        console.log('❌ Error:', error.response?.data || error.message);
    }
}

testUrlFix();
