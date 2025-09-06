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

---

## 📝 Post Routes (`/api/posts`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/` | Create new post | ✅ |
| GET | `/user` | Get current user's posts | ✅ |
| GET | `/liked` | Get user's liked posts | ✅ |
| DELETE | `/:postId` | Delete post | ✅ |
| POST | `/:postId/like` | Like/unlike post | ✅ |
| GET | `/:postId/like-status` | Check like status | ✅ |
| GET | `/all` | Get all approved posts | ❌ |
| GET | `/search` | Search posts | ❌ |
| GET | `/:postId` | Get post by ID | ❌ |

---

## 👑 Admin Routes (`/api/admin`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
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
- **Post Management**: 9 endpoints
- **Admin Functions**: 13 endpoints
- **Approver Functions**: 7 endpoints
- **Categories**: 7 endpoints
- **Comments**: 4 endpoints
- **Social Features**: 13 endpoints (follows, likes, views)
- **Content Management**: 8 endpoints (reports, featured, recommendations)
- **System Features**: 8 endpoints (countries, suggestions, subscriptions, ads)

### Total Endpoints: **87**

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

*Last Updated: January 2025*
*API Version: 1.0*
