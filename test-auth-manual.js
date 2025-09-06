const http = require('http');

// Test data
const testData = {
    register: {
        username: 'testuser123',
        email: 'testuser123@example.com',
        password: 'password123',
        phone1: '+1234567890'
    },
    loginEmail: {
        email: 'testuser123@example.com',
        password: 'password123',
        role: 'user'
    },
    loginUsername: {
        username: 'testuser123',
        password: 'password123',
        role: 'user'
    }
};

function makeRequest(path, method, data) {
    return new Promise((resolve, reject) => {
        const postData = data ? JSON.stringify(data) : '';
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: responseData });
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

async function testFlexibleAuth() {
    console.log('🧪 Testing Flexible Authentication System\n');

    try {
        // Test 1: Register with both email and username
        console.log('1️⃣ Testing registration with both email and username...');
        const registerResponse = await makeRequest('/api/auth/register', 'POST', testData.register);
        console.log(`Status: ${registerResponse.status}`);
        console.log('Response:', registerResponse.data);
        console.log();

        if (registerResponse.status === 201) {
            // Test 2: Login with email
            console.log('2️⃣ Testing login with email...');
            const loginEmailResponse = await makeRequest('/api/auth/login', 'POST', testData.loginEmail);
            console.log(`Status: ${loginEmailResponse.status}`);
            console.log('Response:', loginEmailResponse.data);
            console.log();

            // Test 3: Login with username
            console.log('3️⃣ Testing login with username...');
            const loginUsernameResponse = await makeRequest('/api/auth/login', 'POST', testData.loginUsername);
            console.log(`Status: ${loginUsernameResponse.status}`);
            console.log('Response:', loginUsernameResponse.data);
            console.log();

            // Test 4: Test duplicate registration
            console.log('4️⃣ Testing duplicate username registration...');
            const duplicateResponse = await makeRequest('/api/auth/register', 'POST', testData.register);
            console.log(`Status: ${duplicateResponse.status}`);
            console.log('Response:', duplicateResponse.data);
            console.log();
        }

        console.log('🎉 Authentication tests completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the tests
testFlexibleAuth();

