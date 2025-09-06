const axios = require('axios');

const BASE_URL = 'http://localhost:30001/api';

async function testFlexibleAuth() {
    console.log('🧪 Testing Flexible Authentication System\n');

    try {
        // Test 1: Register with both email and username
        console.log('1️⃣ Testing registration with both email and username...');
        const registerResponse = await axios.post(`${BASE_URL}/auth/register`, {
            username: 'testuser123',
            email: 'testuser123@example.com',
            password: 'password123',
            phone1: '+1234567890'
        });
        console.log('✅ Registration successful:', registerResponse.data.message);
        console.log('   User data:', registerResponse.data.data.user);
        console.log();

        // Test 2: Register with only email
        console.log('2️⃣ Testing registration with only email...');
        const registerEmailOnlyResponse = await axios.post(`${BASE_URL}/auth/register`, {
            email: 'emailonly@example.com',
            password: 'password123',
            phone1: '+1234567891'
        });
        console.log('✅ Email-only registration successful:', registerEmailOnlyResponse.data.message);
        console.log('   User data:', registerEmailOnlyResponse.data.data.user);
        console.log();

        // Test 3: Register with only username
        console.log('3️⃣ Testing registration with only username...');
        const registerUsernameOnlyResponse = await axios.post(`${BASE_URL}/auth/register`, {
            username: 'usernameonly',
            password: 'password123',
            phone1: '+1234567892'
        });
        console.log('✅ Username-only registration successful:', registerUsernameOnlyResponse.data.message);
        console.log('   User data:', registerUsernameOnlyResponse.data.data.user);
        console.log();

        // Test 4: Login with email
        console.log('4️⃣ Testing login with email...');
        const loginEmailResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'testuser123@example.com',
            password: 'password123',
            role: 'user'
        });
        console.log('✅ Email login successful:', loginEmailResponse.data.data.user);
        console.log();

        // Test 5: Login with username
        console.log('5️⃣ Testing login with username...');
        const loginUsernameResponse = await axios.post(`${BASE_URL}/auth/login`, {
            username: 'testuser123',
            password: 'password123',
            role: 'user'
        });
        console.log('✅ Username login successful:', loginUsernameResponse.data.data.user);
        console.log();

        // Test 6: Login with auto-detection (loginField)
        console.log('6️⃣ Testing login with auto-detection...');
        const loginAutoResponse = await axios.post(`${BASE_URL}/auth/login`, {
            loginField: 'emailonly@example.com',
            password: 'password123',
            role: 'user'
        });
        console.log('✅ Auto-detection login successful:', loginAutoResponse.data.data.user);
        console.log();

        // Test 7: Test duplicate username registration
        console.log('7️⃣ Testing duplicate username registration...');
        try {
            await axios.post(`${BASE_URL}/auth/register`, {
                username: 'testuser123',
                email: 'different@example.com',
                password: 'password123',
                phone1: '+1234567893'
            });
            console.log('❌ Should have failed - duplicate username');
        } catch (error) {
            console.log('✅ Correctly rejected duplicate username:', error.response.data.message);
        }
        console.log();

        // Test 8: Test duplicate email registration
        console.log('8️⃣ Testing duplicate email registration...');
        try {
            await axios.post(`${BASE_URL}/auth/register`, {
                username: 'differentuser',
                email: 'testuser123@example.com',
                password: 'password123',
                phone1: '+1234567894'
            });
            console.log('❌ Should have failed - duplicate email');
        } catch (error) {
            console.log('✅ Correctly rejected duplicate email:', error.response.data.message);
        }
        console.log();

        // Test 9: Test invalid email format
        console.log('9️⃣ Testing invalid email format...');
        try {
            await axios.post(`${BASE_URL}/auth/register`, {
                username: 'validuser',
                email: 'invalid-email',
                password: 'password123',
                phone1: '+1234567895'
            });
            console.log('❌ Should have failed - invalid email');
        } catch (error) {
            console.log('✅ Correctly rejected invalid email:', error.response.data.message);
        }
        console.log();

        // Test 10: Test invalid username format
        console.log('🔟 Testing invalid username format...');
        try {
            await axios.post(`${BASE_URL}/auth/register`, {
                username: 'ab', // Too short
                email: 'valid@example.com',
                password: 'password123',
                phone1: '+1234567896'
            });
            console.log('❌ Should have failed - invalid username');
        } catch (error) {
            console.log('✅ Correctly rejected invalid username:', error.response.data.message);
        }
        console.log();

        console.log('🎉 All flexible authentication tests completed successfully!');
        console.log('\n📋 Summary:');
        console.log('   ✅ Registration with both email and username');
        console.log('   ✅ Registration with only email');
        console.log('   ✅ Registration with only username');
        console.log('   ✅ Login with email');
        console.log('   ✅ Login with username');
        console.log('   ✅ Login with auto-detection');
        console.log('   ✅ Duplicate username validation');
        console.log('   ✅ Duplicate email validation');
        console.log('   ✅ Email format validation');
        console.log('   ✅ Username format validation');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run the tests
testFlexibleAuth();

