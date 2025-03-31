# Testing Post Routes with Curl

## Setup

Replace `your_auth_token_here` with an actual auth token obtained after login.

```powershell
$AUTH_TOKEN="your_auth_token_here"
```

## 1. Login to get auth token

```powershell
curl.exe -X POST "http://localhost:3000/api/auth/login" -H "Content-Type: application/json" -d "{\"username\": \"admin\", \"password\": \"admin123\"}"
```

## 2. Create a post with file upload

```powershell
curl.exe -X POST "http://localhost:3000/api/posts" -H "Authorization: Bearer $AUTH_TOKEN" -F "title=Test Post with File Upload" -F "caption=This is a test post with a file upload" -F "post_category=1" -F "file=@./test_files/test_image.jpg"
```

## 3. Get user's posts

```powershell
curl.exe -X GET "http://localhost:3000/api/posts/user" -H "Authorization: Bearer $AUTH_TOKEN"
```

## 4. Get a specific post (replace POST_ID with an actual post ID)

```powershell
curl.exe -X GET "http://localhost:3000/api/posts/POST_ID" -H "Authorization: Bearer $AUTH_TOKEN"
```

## 5. Update a post (replace POST_ID with an actual post ID)

```powershell
curl.exe -X PUT "http://localhost:3000/api/posts/POST_ID" -H "Authorization: Bearer $AUTH_TOKEN" -H "Content-Type: application/json" -d "{\"title\": \"Updated Test Post\", \"caption\": \"This post has been updated\"}"
```

## 6. Delete a post (replace POST_ID with an actual post ID)

```powershell
curl.exe -X DELETE "http://localhost:3000/api/posts/POST_ID" -H "Authorization: Bearer $AUTH_TOKEN"
```

## 7. Check if the file is accessible (replace FILE_PATH with actual path)

```powershell
curl.exe -X GET "http://localhost:3000/uploads/FILE_PATH"
```

## Creating a test image

If you need a test image, you can create one with this PowerShell script:

```powershell
# Create a test image
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
```
