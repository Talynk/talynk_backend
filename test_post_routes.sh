#!/bin/bash

# Set the base URL
BASE_URL="http://localhost:3000"

# Set the auth token (you'll need to get this by logging in first)
AUTH_TOKEN="your_auth_token_here"

# Test 1: Login to get auth token
echo "Test 1: Login to get auth token"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}')

echo "Login Response: $LOGIN_RESPONSE"
# Extract token from response (adjust this based on your API response format)
# AUTH_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')
# echo "Auth Token: $AUTH_TOKEN"

# Test 2: Create a post with file upload
echo "Test 2: Create a post with file upload"
curl -X POST "$BASE_URL/api/posts" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -F "title=Test Post with File Upload" \
  -F "caption=This is a test post with a file upload" \
  -F "post_category=1" \
  -F "file=@./test_files/test_image.jpg"

echo -e "\n"

# Test 3: Get user's posts
echo "Test 3: Get user's posts"
curl -X GET "$BASE_URL/api/posts/user" \
  -H "Authorization: Bearer $AUTH_TOKEN"

echo -e "\n"

# Test 4: Get a specific post (replace POST_ID with an actual post ID)
echo "Test 4: Get a specific post"
curl -X GET "$BASE_URL/api/posts/POST_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN"

echo -e "\n"

# Test 5: Update a post (replace POST_ID with an actual post ID)
echo "Test 5: Update a post"
curl -X PUT "$BASE_URL/api/posts/POST_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Test Post", "caption": "This post has been updated"}'

echo -e "\n"

# Test 6: Delete a post (replace POST_ID with an actual post ID)
echo "Test 6: Delete a post"
curl -X DELETE "$BASE_URL/api/posts/POST_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN"

echo -e "\n"

# Test 7: Check if the file is accessible
echo "Test 7: Check if the file is accessible (replace FILE_URL with actual URL)"
curl -X GET "$BASE_URL/uploads/file-TIMESTAMP.jpg"

echo -e "\n"

echo "Tests completed!" 