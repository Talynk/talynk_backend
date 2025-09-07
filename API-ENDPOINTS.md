# Talynk Backend API Endpoints Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
- **Bearer Token**: Required for protected routes
- **Admin Role**: Required for admin-only routes
- **Approver Role**: Required for approver-only routes

---

## 🔐 Authentication Routes (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/login` | User login (email/username) | ❌ |
| POST | `/register` | User registration | ❌ |
| POST | `/refresh-token` | Refresh access token | ❌ |
| GET | `/profile` | Get user profile | ✅ |
| PUT | `/profile` | Update user profile | ✅ |

### Authentication API Examples

#### POST `/api/auth/register`
**Request Body:**
```json
{
  "username": "newuser",
  "email": "newuser@talynk.com",
  "password": "password123",
  "phone1": "+250788123456",
  "country": "Rwanda"
}
```

**Response (201):**
```json
{
  "status": "success",
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid-here",
      "username": "newuser",
      "email": "newuser@talynk.com",
      "role": "user",
      "status": "active",
      "country": {
        "id": 1,
        "name": "Rwanda",
        "code": "RW",
        "flag_emoji": "🇷🇼"
      },
      "createdAt": "2025-01-07T10:30:00.000Z"
    }
  }
}
```

#### POST `/api/auth/login`
**Request Body:**
```json
{
  "email": "newuser@talynk.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid-here",
      "username": "newuser",
      "email": "newuser@talynk.com",
      "role": "user",
      "status": "active",
      "country": {
        "id": 1,
        "name": "Rwanda",
        "code": "RW",
        "flag_emoji": "🇷🇼"
      }
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### POST `/api/auth/refresh-token`
**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### GET `/api/auth/profile`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "id": "uuid-here",
    "username": "newuser",
    "email": "newuser@talynk.com",
    "phone1": "+250788123456",
    "phone2": null,
    "profile_picture": null,
    "posts_count": 0,
    "follower_count": 0,
    "total_profile_views": 0,
    "likes": 0,
    "subscribers": 0,
    "status": "active",
    "role": "user",
    "last_login": "2025-01-07T10:30:00.000Z",
    "country": {
      "id": 1,
      "name": "Rwanda",
      "code": "RW",
      "flag_emoji": "🇷🇼"
    },
    "createdAt": "2025-01-07T10:30:00.000Z",
    "updatedAt": "2025-01-07T10:30:00.000Z"
  }
}
```

#### PUT `/api/auth/profile`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request Body:**
```json
{
  "phone1": "+250788999888",
  "country": "Kenya"
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Profile updated successfully",
  "data": {
    "id": "uuid-here",
    "username": "newuser",
    "email": "newuser@talynk.com",
    "phone1": "+250788999888",
    "phone2": null,
    "country_id": 2,
    "country": {
      "id": 2,
      "name": "Kenya",
      "code": "KE",
      "flag_emoji": "🇰🇪"
    },
    "updatedAt": "2025-01-07T10:35:00.000Z"
  }
}
```

---

## 👤 User Routes (`/api/user` & `/api/users`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/profile` | Get current user profile | ✅ |
| PUT | `/profile` | Update user profile with image | ✅ |
| PUT | `/interests` | Update user interests | ✅ |
| PUT | `/country` | Update user country | ✅ |
| GET | `/statistics` | Get user statistics | ✅ |
| GET | `/searches` | Get recent searches | ✅ |
| POST | `/searches` | Add search term | ✅ |
| PUT | `/notifications` | Toggle notifications | ✅ |
| GET | `/notifications` | Get user notifications | ✅ |
| PUT | `/notifications/read-all` | Mark all notifications as read | ✅ |
| GET | `/:id` | Get user profile by ID | ❌ |
| GET | `/:id/posts` | Get user posts by ID | ❌ |
| GET | `/:id/posts/approved` | Get user approved posts | ❌ |

### User API Examples

#### GET `/api/user/profile`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "id": "uuid-here",
    "username": "newuser",
    "email": "newuser@talynk.com",
    "profile_picture": "https://supabase.co/storage/v1/object/public/profiles/profile_uuid.jpg",
    "posts_count": 5,
    "follower_count": 120,
    "total_profile_views": 450,
    "likes": 89,
    "subscribers": 45,
    "recent_searches": ["music", "art", "dance"],
    "phone1": "+250788123456",
    "phone2": null,
    "selected_category": "Music",
    "status": "active",
    "role": "user",
    "last_login": "2025-01-07T10:30:00.000Z",
    "country_id": 1,
    "country": {
      "id": 1,
      "name": "Rwanda",
      "code": "RW",
      "flag_emoji": "🇷🇼"
    },
    "createdAt": "2025-01-07T10:30:00.000Z",
    "updatedAt": "2025-01-07T10:30:00.000Z"
  }
}
```

#### PUT `/api/user/profile`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**
```
phone1: +250788999888
phone2: +250788777666
file: [profile_image.jpg]
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Profile updated successfully",
  "data": {
    "id": "uuid-here",
    "username": "newuser",
    "email": "newuser@talynk.com",
    "phone1": "+250788999888",
    "phone2": "+250788777666",
    "profile_picture": "https://supabase.co/storage/v1/object/public/profiles/profile_uuid_updated.jpg",
    "updatedAt": "2025-01-07T10:35:00.000Z"
  }
}
```

#### PUT `/api/user/interests`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request Body:**
```json
{
  "interests": ["Music", "Arts", "Photography", "Dancing", "Cooking"]
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Interests updated successfully",
  "data": {
    "interests": ["Music", "Arts", "Photography", "Dancing", "Cooking"]
  }
}
```

#### PUT `/api/user/country`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request Body:**
```json
{
  "country": "Kenya"
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Country updated successfully",
  "data": {
    "country_id": 2,
    "country": {
      "id": 2,
      "name": "Kenya",
      "code": "KE",
      "flag_emoji": "🇰🇪"
    }
  }
}
```

#### GET `/api/user/statistics`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "posts_count": 15,
    "total_likes": 234,
    "total_views": 1250,
    "followers_count": 89,
    "following_count": 45,
    "total_comments": 67,
    "profile_views": 450,
    "engagement_rate": 0.18
  }
}
```

#### GET `/api/user/searches`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "recent_searches": [
      "music",
      "art",
      "dance",
      "photography",
      "cooking"
    ]
  }
}
```

#### POST `/api/user/searches`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request Body:**
```json
{
  "term": "guitar lessons"
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Search term added successfully"
}
```

#### PUT `/api/user/notifications`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Notifications disabled successfully"
}
```

#### GET `/api/user/notifications`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "notifications": [
      {
        "id": "notif-uuid-1",
        "type": "like",
        "message": "user123 liked your post",
        "related_id": "post-uuid-1",
        "is_read": false,
        "createdAt": "2025-01-07T10:30:00.000Z"
      },
      {
        "id": "notif-uuid-2",
        "type": "follow",
        "message": "user456 started following you",
        "related_id": "user-uuid-456",
        "is_read": true,
        "createdAt": "2025-01-07T09:15:00.000Z"
      }
    ],
    "unread_count": 1
  }
}
```

#### PUT `/api/user/notifications/read-all`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "status": "success",
  "message": "All notifications marked as read"
}
```

#### GET `/api/users/:id`
**Response (200):**
```json
{
  "status": "success",
  "data": {
    "id": "user-uuid-here",
    "username": "artist123",
    "email": "artist@talynk.com",
    "fullName": "artist123",
    "profilePicture": "https://supabase.co/storage/v1/object/public/profiles/artist_profile.jpg",
    "postsCount": 25,
    "followersCount": 500,
    "followingCount": 120,
    "coverPhoto": null,
    "country": {
      "id": 1,
      "name": "Rwanda",
      "code": "RW",
      "flag_emoji": "🇷🇼"
    },
    "isFollowing": false,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-07T10:30:00.000Z"
  }
}
```

#### GET `/api/users/:id/posts`
**Response (200):**
```json
{
  "status": "success",
  "data": {
    "posts": [
      {
        "id": "post-uuid-1",
        "title": "My Latest Song",
        "caption": "Check out this new track!",
        "file_url": "https://supabase.co/storage/v1/object/public/posts/song.mp4",
        "thumbnail_url": "https://supabase.co/storage/v1/object/public/posts/thumb.jpg",
        "status": "approved",
        "likes": 45,
        "views": 120,
        "shares": 8,
        "comments_count": 12,
        "category": {
          "id": 1,
          "name": "Music"
        },
        "user": {
          "id": "user-uuid-here",
          "username": "artist123"
        },
        "isLiked": false,
        "createdAt": "2025-01-07T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

#### GET `/api/users/:id/posts/approved`
**Response (200):**
```json
{
  "status": "success",
  "data": {
    "posts": [
      {
        "id": "post-uuid-1",
        "title": "My Latest Song",
        "caption": "Check out this new track!",
        "file_url": "https://supabase.co/storage/v1/object/public/posts/song.mp4",
        "thumbnail_url": "https://supabase.co/storage/v1/object/public/posts/thumb.jpg",
        "status": "approved",
        "likes": 45,
        "views": 120,
        "shares": 8,
        "comments_count": 12,
        "category": {
          "id": 1,
          "name": "Music"
        },
        "user": {
          "id": "user-uuid-here",
          "username": "artist123"
        },
        "isLiked": false,
        "createdAt": "2025-01-07T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 20,
      "totalPages": 2
    }
  }
}
```

---

## 📝 Post Routes (`/api/posts`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/` | Create new post | ✅ |
| GET | `/user` | Get current user's posts | ✅ |
| DELETE | `/:postId` | Delete post | ✅ |
| GET | `/all` | Get all approved posts | ❌ |
| GET | `/search` | Search posts | ❌ |
| GET | `/:postId` | Get post by ID | ❌ |

**Note**: Like functionality has been moved to dedicated `/api/likes` endpoints:
- `GET /api/likes/user/liked` - Get user's liked posts
- `POST /api/likes/posts/:postId/toggle` - Toggle like on post  
- `GET /api/likes/posts/:postId/status` - Check like status

### Post API Examples

#### POST `/api/posts`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**
```
title: My New Song
caption: Check out my latest track! #music #original
post_category: Music
subcategory: Afrobeats
type: video
content: Original music content
file: [song.mp4]
```

**Response (201):**
```json
{
  "status": "success",
  "message": "Post created successfully",
  "data": {
    "post": {
      "id": "post-uuid-here",
      "title": "My New Song",
      "caption": "Check out my latest track! #music #original",
      "file_url": "https://supabase.co/storage/v1/object/public/posts/song.mp4",
      "thumbnail_url": "https://supabase.co/storage/v1/object/public/posts/thumb.jpg",
      "status": "pending",
      "type": "video",
      "content": "Original music content",
      "category": {
        "id": 1,
        "name": "Music"
      },
      "user": {
        "id": "user-uuid-here",
        "username": "artist123"
      },
      "likes": 0,
      "views": 0,
      "shares": 0,
      "comments_count": 0,
      "createdAt": "2025-01-07T10:30:00.000Z"
    }
  }
}
```

#### GET `/api/posts/user`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "posts": [
      {
        "id": "post-uuid-1",
        "title": "My Latest Song",
        "caption": "Check out this new track!",
        "file_url": "https://supabase.co/storage/v1/object/public/posts/song.mp4",
        "thumbnail_url": "https://supabase.co/storage/v1/object/public/posts/thumb.jpg",
        "status": "approved",
        "type": "video",
        "likes": 45,
        "views": 120,
        "shares": 8,
        "comments_count": 12,
        "category": {
          "id": 1,
          "name": "Music"
        },
        "createdAt": "2025-01-07T10:00:00.000Z"
      },
      {
        "id": "post-uuid-2",
        "title": "Digital Art",
        "caption": "My latest artwork",
        "file_url": "https://supabase.co/storage/v1/object/public/posts/art.jpg",
        "thumbnail_url": "https://supabase.co/storage/v1/object/public/posts/art_thumb.jpg",
        "status": "pending",
        "type": "image",
        "likes": 0,
        "views": 0,
        "shares": 0,
        "comments_count": 0,
        "category": {
          "id": 2,
          "name": "Arts"
        },
        "createdAt": "2025-01-07T09:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 15,
      "totalPages": 2
    }
  }
}
```

#### DELETE `/api/posts/:postId`
**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Post deleted successfully"
}
```

#### GET `/api/posts/all`
**Query Parameters:**
```
?page=1&limit=10&category=Music
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "posts": [
      {
        "id": "post-uuid-1",
        "title": "Amazing Song",
        "caption": "This is incredible!",
        "file_url": "https://supabase.co/storage/v1/object/public/posts/song.mp4",
        "thumbnail_url": "https://supabase.co/storage/v1/object/public/posts/thumb.jpg",
        "status": "approved",
        "type": "video",
        "likes": 89,
        "views": 450,
        "shares": 23,
        "comments_count": 34,
        "category": {
          "id": 1,
          "name": "Music"
        },
        "user": {
          "id": "user-uuid-1",
          "username": "musician123"
        },
        "isLiked": false,
        "createdAt": "2025-01-07T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 150,
      "totalPages": 15
    }
  }
}
```

#### GET `/api/posts/search`
**Query Parameters:**
```
?q=music&category=Music&page=1&limit=10
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "posts": [
      {
        "id": "post-uuid-1",
        "title": "Guitar Lessons",
        "caption": "Learn guitar with me! #music #guitar",
        "file_url": "https://supabase.co/storage/v1/object/public/posts/guitar.mp4",
        "thumbnail_url": "https://supabase.co/storage/v1/object/public/posts/guitar_thumb.jpg",
        "status": "approved",
        "type": "video",
        "likes": 67,
        "views": 234,
        "shares": 12,
        "comments_count": 18,
        "category": {
          "id": 1,
          "name": "Music"
        },
        "user": {
          "id": "user-uuid-2",
          "username": "guitarist"
        },
        "isLiked": false,
        "createdAt": "2025-01-07T09:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    },
    "searchQuery": "music"
  }
}
```

#### GET `/api/posts/:postId`
**Response (200):**
```json
{
  "status": "success",
  "data": {
    "post": {
      "id": "post-uuid-1",
      "title": "My Latest Song",
      "caption": "Check out this new track!",
      "file_url": "https://supabase.co/storage/v1/object/public/posts/song.mp4",
      "thumbnail_url": "https://supabase.co/storage/v1/object/public/posts/thumb.jpg",
      "status": "approved",
      "type": "video",
      "content": "Original music content",
      "likes": 45,
      "views": 120,
      "shares": 8,
      "comments_count": 12,
      "category": {
        "id": 1,
        "name": "Music"
      },
      "user": {
        "id": "user-uuid-here",
        "username": "artist123",
        "profile_picture": "https://supabase.co/storage/v1/object/public/profiles/profile.jpg"
      },
      "isLiked": false,
      "createdAt": "2025-01-07T10:00:00.000Z",
      "updatedAt": "2025-01-07T10:00:00.000Z"
    }
  }
}
```

---

## 👑 Admin Routes (`/api/admin`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Register new admin | ❌ |
| GET | `/users` | Get all users | ✅ Admin |
| POST | `/accounts/manage` | Manage user account | ✅ Admin |
| POST | `/approvers` | Register new approver | ✅ Admin |
| DELETE | `/approvers/:id` | Remove approver | ✅ Admin |
| GET | `/videos` | Get all videos | ✅ Admin |
| PUT | `/approve` | Update post status | ✅ Admin |
| GET | `/approved/posts` | Get approved posts | ✅ Admin |
| GET | `/posts/pending` | Get pending posts | ✅ Admin |
| GET | `/posts/rejected` | Get rejected posts | ✅ Admin |
| GET | `/approvers/:approverId/approved-posts` | Get posts approved by specific approver | ✅ Admin |
| GET | `/dashboard/stats` | Get dashboard statistics | ✅ Admin |
| GET | `/users/stats` | Get user statistics | ✅ Admin |
| GET | `/posts/search` | Search posts (admin) | ✅ Admin |

---

## ✅ Approver Routes (`/api/approver`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/stats` | Get approver statistics | ✅ Approver |
| GET | `/posts/pending` | Get pending posts | ✅ Approver |
| GET | `/posts/approved` | Get approved posts | ✅ Approver |
| PUT | `/posts/:postId/approve` | Approve post | ✅ Approver |
| PUT | `/posts/:postId/reject` | Reject post | ✅ Approver |
| GET | `/notifications` | Get approver notifications | ✅ Approver |
| GET | `/posts/search` | Search posts (approver) | ✅ Approver |

---

## 📂 Category Routes (`/api/categories`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get all categories with hierarchy | ❌ |
| GET | `/:parentId/subcategories` | Get subcategories for main category | ❌ |
| GET | `/popular` | Get popular categories | ❌ |
| GET | `/:id` | Get category by ID | ❌ |
| POST | `/` | Create new category | ✅ Admin |
| PUT | `/:id` | Update category | ✅ Admin |
| DELETE | `/:id` | Delete category | ✅ Admin |

---

## 💬 Comment Routes (`/api/posts`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/:postId/comments` | Add comment to post | ✅ |
| GET | `/:postId/comments` | Get post comments | ❌ |
| DELETE | `/comments/:commentId` | Delete comment | ✅ |
| POST | `/comments/:commentId/report` | Report comment | ✅ |

---

## 👥 Follow Routes (`/api/follows`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/` | Follow user | ✅ |
| DELETE | `/:followingId` | Unfollow user | ✅ |
| GET | `/users/:userId/followers` | Get user followers | ❌ |
| GET | `/users/:userId/following` | Get user following | ❌ |
| GET | `/check/:followingId` | Check follow status | ✅ |

---

## ❤️ Like Routes (`/api/likes`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/posts/:postId/toggle` | Toggle like on post | ✅ |
| GET | `/posts/:postId/status` | Check like status | ✅ |
| POST | `/posts/batch-status` | Batch check like status | ✅ |
| GET | `/posts/:postId/stats` | Get post like statistics | ❌ |
| GET | `/user/liked` | Get user's liked posts | ✅ |

---

## 👀 View Routes (`/api/views`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/posts/:postId` | Record post view | ❌ |
| GET | `/posts/:postId/stats` | Get post view statistics | ❌ |
| GET | `/trending` | Get trending posts | ❌ |
| POST | `/batch-update` | Batch update view counts | ✅ |

---

## 🚨 Report Routes (`/api/reports`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/posts/:postId` | Report a post | ✅ |
| GET | `/` | Get all reports | ✅ Admin |
| GET | `/posts/:postId` | Get reports for specific post | ✅ |
| PUT | `/:reportId/review` | Review a report | ✅ Admin |
| GET | `/stats` | Get report statistics | ✅ Admin |

---

## ⭐ Featured Routes (`/api/featured`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get featured posts | ❌ |
| GET | `/admin` | Get all featured posts | ✅ Admin |
| POST | `/posts/:postId` | Feature a post | ✅ Admin |
| DELETE | `/posts/:postId` | Unfeature a post | ✅ Admin |

---

## 🎯 Recommendation Routes (`/api/recommendations`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/feed` | Get personalized feed | ✅ |
| GET | `/trending` | Get trending posts | ❌ |
| GET | `/categories` | Get recommended categories | ✅ |
| POST | `/interactions/:postId` | Record user interaction | ✅ |

---

## 🌍 Country Routes (`/api/countries`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get all countries | ❌ |
| GET | `/search` | Search countries | ❌ |
| GET | `/:id` | Get country by ID | ❌ |
| GET | `/:id/stats` | Get country statistics | ❌ |
| POST | `/` | Create country | ✅ Admin |
| PUT | `/:id` | Update country | ✅ Admin |
| DELETE | `/:id` | Delete country | ✅ Admin |

---

## 🔍 Suggestion Routes (`/api/`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users/suggestions/mutual` | Get mutual user suggestions | ✅ |
| GET | `/users/suggestions/discover` | Get discover user suggestions | ✅ |

---

## 💳 Subscription Routes (`/api/subscriptions`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/:userID` | Subscribe to user | ✅ |
| DELETE | `/:userId` | Unsubscribe from user | ✅ |
| GET | `/subscribers` | Get user's subscribers | ✅ |

---

## 📢 Advertisement Routes (`/api/ads`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get active advertisements | ✅ |
| DELETE | `/:adId` | Delete advertisement | ✅ Admin |

---

## 🧪 Test Route

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/test` | API health check | ❌ |

---

## 📊 Route Summary

### By Authentication Level:
- **Public Routes**: 25 endpoints
- **Authenticated Routes**: 35 endpoints  
- **Admin Only Routes**: 20 endpoints
- **Approver Only Routes**: 7 endpoints

### By Feature:
- **Authentication**: 5 endpoints
- **User Management**: 12 endpoints
- **Post Management**: 6 endpoints
- **Admin Functions**: 13 endpoints
- **Approver Functions**: 7 endpoints
- **Categories**: 7 endpoints
- **Comments**: 4 endpoints
- **Social Features**: 13 endpoints (follows, likes, views)
- **Content Management**: 8 endpoints (reports, featured, recommendations)
- **System Features**: 8 endpoints (countries, suggestions, subscriptions, ads)

### Total Endpoints: **84**

**Note**: 3 like-related endpoints were moved from `/api/posts` to `/api/likes` for better organization.

---

## 🔧 Usage Examples

### Authentication
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123", "role": "user"}'

# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "newuser", "email": "new@example.com", "password": "password123", "phone1": "+1234567890"}'
```

### Post Creation
```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "title=My Post" \
  -F "caption=Post description" \
  -F "post_category=Music" \
  -F "file=@video.mp4"
```

### Category Management
```bash
# Get all categories
curl -X GET http://localhost:3000/api/categories

# Get Music subcategories
curl -X GET http://localhost:3000/api/categories/63/subcategories
```

---

## 📝 Notes

1. **File Uploads**: Use `multipart/form-data` for routes that accept file uploads
2. **Pagination**: Many list endpoints support `page` and `limit` query parameters
3. **Filtering**: Post endpoints support category filtering via `category` query parameter
4. **Search**: Multiple endpoints support search functionality
5. **Hierarchical Categories**: Categories are organized in a 2-level hierarchy (main categories and subcategories)
6. **Flexible Authentication**: Login supports both email and username
7. **Role-Based Access**: Different user roles (user, admin, approver) have different permissions

---

## 📋 Detailed Endpoint Documentation

### Admin Registration

**POST** `/api/admin/register`

Register a new admin user.

**Request Body:**
```json
{
  "email": "admin@example.com",
  "username": "admin",
  "password": "securepassword123"
}
```

**Response (Success - 201):**
```json
{
  "status": "success",
  "message": "Admin registered successfully",
  "data": {
    "admin": {
      "id": "uuid",
      "email": "admin@example.com",
      "username": "admin",
      "status": "active",
      "createdAt": "2025-01-07T05:30:00.000Z"
    }
  }
}
```

**Response (Error - 400):**
```json
{
  "status": "error",
  "message": "Email, username, and password are required"
}
```

**Response (Error - 409):**
```json
{
  "status": "error",
  "message": "Admin with this email or username already exists"
}
```

**Validation Rules:**
- Email must be valid format
- Password must be at least 6 characters
- Email and username must be unique
- All fields are required

---

## 🧪 Test Data

### Test Users

#### Regular User
```json
{
  "username": "testuser",
  "email": "testuser@talynk.com",
  "password": "password123",
  "phone1": "+250788123456",
  "country": "Rwanda"
}
```

#### Admin User
```json
{
  "email": "admin@talynk.com",
  "username": "admin",
  "password": "admin123"
}
```

#### Approver User
```json
{
  "email": "approver@talynk.com",
  "username": "approver",
  "password": "approver123"
}
```

### Test Posts

#### Music Post
```json
{
  "title": "My New Song",
  "caption": "Check out my latest track! #music #original",
  "post_category": "Music",
  "subcategory": "Afrobeats",
  "type": "video",
  "content": "Original music content"
}
```

#### Art Post
```json
{
  "title": "Digital Artwork",
  "caption": "Just finished this digital painting #art #digital",
  "post_category": "Arts",
  "subcategory": "Digital Art",
  "type": "image",
  "content": "Digital art showcase"
}
```

#### Communication Post
```json
{
  "title": "Motivational Speech",
  "caption": "Inspiring words for the day #motivation #speech",
  "post_category": "Communication",
  "subcategory": "Motivational Speaking",
  "type": "video",
  "content": "Motivational content"
}
```

### Test Categories

#### Main Categories
```json
[
  {
    "id": 1,
    "name": "Music",
    "level": 1,
    "parent_id": null,
    "sort_order": 1
  },
  {
    "id": 2,
    "name": "Arts",
    "level": 1,
    "parent_id": null,
    "sort_order": 2
  },
  {
    "id": 3,
    "name": "Communication",
    "level": 1,
    "parent_id": null,
    "sort_order": 3
  }
]
```

#### Music Subcategories
```json
[
  {
    "id": 4,
    "name": "Rock",
    "level": 2,
    "parent_id": 1,
    "sort_order": 1
  },
  {
    "id": 5,
    "name": "Pop",
    "level": 2,
    "parent_id": 1,
    "sort_order": 2
  },
  {
    "id": 6,
    "name": "Hip Hop / Rap",
    "level": 2,
    "parent_id": 1,
    "sort_order": 3
  },
  {
    "id": 7,
    "name": "Afrobeats",
    "level": 2,
    "parent_id": 1,
    "sort_order": 12
  }
]
```

### Test Countries

```json
[
  {
    "id": 1,
    "name": "Rwanda",
    "code": "RW",
    "flag_emoji": "🇷🇼"
  },
  {
    "id": 2,
    "name": "Kenya",
    "code": "KE",
    "flag_emoji": "🇰🇪"
  },
  {
    "id": 3,
    "name": "Uganda",
    "code": "UG",
    "flag_emoji": "🇺🇬"
  },
  {
    "id": 4,
    "name": "Tanzania",
    "code": "TZ",
    "flag_emoji": "🇹🇿"
  },
  {
    "id": 5,
    "name": "Nigeria",
    "code": "NG",
    "flag_emoji": "🇳🇬"
  }
]
```

### Test Comments

```json
{
  "content": "Great post! Love the creativity 🔥",
  "post_id": "post-uuid-here"
}
```

### Test Reports

```json
{
  "reason": "inappropriate_content",
  "description": "This post contains inappropriate content",
  "post_id": "post-uuid-here"
}
```

### Test Notifications

```json
{
  "type": "like",
  "message": "user123 liked your post",
  "related_id": "post-uuid-here",
  "user_id": "user-uuid-here"
}
```

### Test Search Terms

```json
{
  "term": "music",
  "user_id": "user-uuid-here"
}
```

### Test User Interests

```json
{
  "interests": ["Music", "Arts", "Photography", "Dancing"]
}
```

### Test Follow Data

```json
{
  "followingId": "user-uuid-to-follow"
}
```

### Test Like Data

```json
{
  "postId": "post-uuid-here",
  "userId": "user-uuid-here"
}
```

### Test View Data

```json
{
  "postId": "post-uuid-here",
  "userId": "user-uuid-here",
  "duration": 30
}
```

### Test Subscription Data

```json
{
  "userId": "user-uuid-to-subscribe-to"
}
```

### Test Advertisement Data

```json
{
  "title": "Premium Music Course",
  "description": "Learn music production from professionals",
  "image_url": "https://example.com/ad-image.jpg",
  "target_url": "https://example.com/course",
  "is_active": true,
  "expires_at": "2025-12-31T23:59:59.000Z"
}
```

### Test Featured Post Data

```json
{
  "postId": "post-uuid-here",
  "reason": "High engagement and quality content",
  "expires_at": "2025-12-31T23:59:59.000Z"
}
```

### Test Recommendation Data

```json
{
  "postId": "post-uuid-here",
  "interaction_type": "like",
  "duration": 45
}
```

### Test User Preferences

```json
{
  "category_id": 1,
  "preference_score": 0.8,
  "interaction_count": 5
}
```

### Sample API Responses

#### Successful Login Response
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "user": {
      "id": "54ec683f-aa84-45f9-be7e-9a3894e6f13b",
      "username": "testuser",
      "email": "testuser@talynk.com",
      "role": "user",
      "status": "active",
      "country": {
        "id": 1,
        "name": "Rwanda",
        "code": "RW",
        "flag_emoji": "🇷🇼"
      }
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Successful Post Creation Response
```json
{
  "status": "success",
  "message": "Post created successfully",
  "data": {
    "post": {
      "id": "post-uuid-here",
      "title": "My New Song",
      "caption": "Check out my latest track! #music #original",
      "file_url": "https://supabase.co/storage/v1/object/public/posts/...",
      "status": "pending",
      "category": {
        "id": 1,
        "name": "Music"
      },
      "user": {
        "id": "user-uuid-here",
        "username": "testuser"
      },
      "createdAt": "2025-01-07T10:30:00.000Z"
    }
  }
}
```

#### Error Response Examples
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    },
    {
      "field": "password",
      "message": "Password must be at least 6 characters"
    }
  ]
}
```

```json
{
  "status": "error",
  "message": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

```json
{
  "status": "error",
  "message": "Post not found",
  "code": "NOT_FOUND"
}
```

### Test Environment Setup

#### Environment Variables
```bash
# Database
DATABASE_URL="postgresql://postgres:pll@localhost:5432/talynk"

# JWT
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-here"

# Supabase
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_BUCKET_NAME="posts"

# Server
PORT=3000
NODE_ENV="development"
```

#### Sample cURL Commands

```bash
# Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "testuser@talynk.com",
    "password": "password123",
    "phone1": "+250788123456",
    "country": "Rwanda"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@talynk.com",
    "password": "password123"
  }'

# Create a post (with file upload)
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=My New Song" \
  -F "caption=Check out my latest track!" \
  -F "post_category=Music" \
  -F "subcategory=Afrobeats" \
  -F "file=@song.mp4"

# Get all categories
curl -X GET http://localhost:3000/api/categories

# Get user profile
curl -X GET http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update user profile
curl -X PUT http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone1": "+250788123456",
    "country": "Kenya"
  }'
```

---

*Last Updated: January 2025*
*API Version: 1.0*
