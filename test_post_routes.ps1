# Set the base URL
$BASE_URL = "http://localhost:3000"

# Set the auth token (you'll need to get this by logging in first)
$AUTH_TOKEN = "your_auth_token_here"

# Test 1: Login to get auth token
Write-Host "Test 1: Login to get auth token"
$loginBody = @{
    username = "your_username"
    password = "your_password"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Method Post -Uri "$BASE_URL/api/auth/login" -ContentType "application/json" -Body $loginBody -ErrorAction SilentlyContinue
Write-Host "Login Response: $($loginResponse | ConvertTo-Json -Depth 3)"

# If login successful, extract token
if ($loginResponse.status -eq "success") {
    $AUTH_TOKEN = $loginResponse.data.token
    Write-Host "Auth Token: $AUTH_TOKEN"
}

# Create a test image if it doesn't exist
if (-not (Test-Path -Path ".\test_files\test_image.jpg")) {
    Write-Host "Creating test image..."
    # Create a simple test image using .NET
    Add-Type -AssemblyName System.Drawing
    $bitmap = New-Object System.Drawing.Bitmap 200, 200
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.FillRectangle([System.Drawing.Brushes]::Blue, 0, 0, 200, 200)
    $graphics.DrawString("Test Image", [System.Drawing.Font]::new("Arial", 16), [System.Drawing.Brushes]::White, 40, 80)
    $graphics.Dispose()
    
    # Save the image
    if (-not (Test-Path -Path ".\test_files")) {
        New-Item -Path ".\test_files" -ItemType Directory
    }
    $bitmap.Save(".\test_files\test_image.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $bitmap.Dispose()
    Write-Host "Test image created at .\test_files\test_image.jpg"
}

# Test 2: Create a post with file upload
Write-Host "`nTest 2: Create a post with file upload"
$createPostForm = @{
    title = "Test Post with File Upload"
    caption = "This is a test post with a file upload"
    post_category = "1"
    file = Get-Item ".\test_files\test_image.jpg"
}

try {
    $createResponse = curl.exe -X POST "$BASE_URL/api/posts" `
        -H "Authorization: Bearer $AUTH_TOKEN" `
        -F "title=Test Post with File Upload" `
        -F "caption=This is a test post with a file upload" `
        -F "post_category=1" `
        -F "file=@.\test_files\test_image.jpg"
    
    Write-Host "Create Post Response: $createResponse"
    
    # Extract post ID from response for later tests
    # This is a simplified example - adjust based on your actual response format
    if ($createResponse -match '"id":"([^"]+)"') {
        $postId = $matches[1]
        Write-Host "Created Post ID: $postId"
    }
} catch {
    Write-Host "Error creating post: $_"
}

# Test 3: Get user's posts
Write-Host "`nTest 3: Get user's posts"
try {
    $userPostsResponse = curl.exe -X GET "$BASE_URL/api/posts/user" -H "Authorization: Bearer $AUTH_TOKEN"
    Write-Host "User Posts Response: $userPostsResponse"
} catch {
    Write-Host "Error getting user posts: $_"
}

# Test 4: Get a specific post
Write-Host "`nTest 4: Get a specific post"
if ($postId) {
    try {
        $postResponse = curl.exe -X GET "$BASE_URL/api/posts/$postId" -H "Authorization: Bearer $AUTH_TOKEN"
        Write-Host "Post Response: $postResponse"
    } catch {
        Write-Host "Error getting post: $_"
    }
} else {
    Write-Host "Skipping test 4 - no post ID available"
}

# Test 5: Update a post
Write-Host "`nTest 5: Update a post"
if ($postId) {
    try {
        $updateResponse = curl.exe -X PUT "$BASE_URL/api/posts/$postId" `
            -H "Authorization: Bearer $AUTH_TOKEN" `
            -H "Content-Type: application/json" `
            -d "{\"title\": \"Updated Test Post\", \"caption\": \"This post has been updated\"}"
        Write-Host "Update Response: $updateResponse"
    } catch {
        Write-Host "Error updating post: $_"
    }
} else {
    Write-Host "Skipping test 5 - no post ID available"
}

# Test 6: Check if the file is accessible
Write-Host "`nTest 6: Check if the file is accessible"
if ($createResponse -match '"/uploads/([^"]+)"') {
    $fileUrl = $matches[1]
    Write-Host "File URL: $fileUrl"
    try {
        $fileResponse = curl.exe -X GET "$BASE_URL/uploads/$fileUrl"
        Write-Host "File accessible: Yes"
    } catch {
        Write-Host "Error accessing file: $_"
    }
} else {
    Write-Host "Skipping test 6 - no file URL available"
}

# Test 7: Delete a post
Write-Host "`nTest 7: Delete a post"
if ($postId) {
    try {
        $deleteResponse = curl.exe -X DELETE "$BASE_URL/api/posts/$postId" -H "Authorization: Bearer $AUTH_TOKEN"
        Write-Host "Delete Response: $deleteResponse"
    } catch {
        Write-Host "Error deleting post: $_"
    }
} else {
    Write-Host "Skipping test 7 - no post ID available"
}

Write-Host "`nTests completed!" 