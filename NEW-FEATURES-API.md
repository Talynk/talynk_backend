# 🚀 New Features API Documentation

## 📋 Overview

Your Talynk backend now includes comprehensive reporting, categories, featured posts, and personalized recommendations. Here's the complete API documentation:

---

## 🚨 Reporting System

### Report a Post
```http
POST /api/reports/posts/:postId
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "SPAM|HARASSMENT|INAPPROPRIATE_CONTENT|COPYRIGHT_VIOLATION|FALSE_INFORMATION|VIOLENCE|HATE_SPEECH|OTHER",
  "description": "Optional description of the report"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Post reported successfully",
  "data": {
    "report": {
      "id": "uuid",
      "reason": "SPAM",
      "description": "Report description",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "postReportCount": 1,
    "isFrozen": false
  }
}
```

### Get All Reports (Admin Only)
```http
GET /api/reports?page=1&limit=10&status=pending&reason=SPAM
Authorization: Bearer <admin_token>
```

### Get Reports for Specific Post
```http
GET /api/reports/posts/:postId
Authorization: Bearer <token>
```

### Review Report (Admin Only)
```http
PUT /api/reports/:reportId/review
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "status": "reviewed|resolved|dismissed",
  "adminNotes": "Optional admin notes"
}
```

### Get Report Statistics (Admin Only)
```http
GET /api/reports/stats
Authorization: Bearer <admin_token>
```

---

## 📂 Categories System

### Get All Categories
```http
GET /api/categories?status=active
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "name": "Technology",
      "description": "Tech-related posts",
      "status": "active",
      "_count": {
        "posts": 15
      }
    }
  ]
}
```

### Get Popular Categories
```http
GET /api/categories/popular?limit=10
```

### Get Category by ID
```http
GET /api/categories/:id
```

### Create Category (Admin Only)
```http
POST /api/categories
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "New Category",
  "description": "Category description"
}
```

### Update Category (Admin Only)
```http
PUT /api/categories/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description",
  "status": "active"
}
```

### Delete Category (Admin Only)
```http
DELETE /api/categories/:id
Authorization: Bearer <admin_token>
```

---

## ⭐ Featured Posts System

### Get Featured Posts
```http
GET /api/featured?page=1&limit=10
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "featuredPosts": [
      {
        "id": "uuid",
        "post": {
          "id": "uuid",
          "title": "Featured Post",
          "description": "Post description",
          "user": {
            "id": "uuid",
            "username": "john_doe",
            "profile_picture": "url"
          },
          "category": {
            "id": 1,
            "name": "Technology"
          }
        },
        "reason": "High quality content",
        "featuredAt": "2024-01-01T00:00:00.000Z",
        "expiresAt": null,
        "featuredBy": "admin"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCount": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

### Feature a Post (Admin Only)
```http
POST /api/featured/posts/:postId
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "reason": "High quality content",
  "expiresAt": "2024-12-31T23:59:59.000Z"
}
```

### Unfeature a Post (Admin Only)
```http
DELETE /api/featured/posts/:postId
Authorization: Bearer <admin_token>
```

### Get All Featured Posts (Admin Only)
```http
GET /api/featured/admin?page=1&limit=10&active=true
Authorization: Bearer <admin_token>
```

---

## 🎯 Personalized Recommendations

### Get Personalized Feed
```http
GET /api/recommendations/feed?page=1&limit=10
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "posts": [
      {
        "id": "uuid",
        "title": "Recommended Post",
        "description": "Post description",
        "user": {
          "id": "uuid",
          "username": "jane_smith",
          "profile_picture": "url"
        },
        "category": {
          "id": 1,
          "name": "Technology"
        },
        "_count": {
          "comments": 5,
          "postLikes": 12
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCount": 1,
      "hasNext": false,
      "hasPrev": false
    },
    "userPreferences": [
      {
        "category": "Technology",
        "score": 0.8
      }
    ]
  }
}
```

### Get Trending Posts
```http
GET /api/recommendations/trending?page=1&limit=10&timeframe=7
```

### Get Recommended Categories
```http
GET /api/recommendations/categories
Authorization: Bearer <token>
```

### Record User Interaction
```http
POST /api/recommendations/interactions/:postId
Authorization: Bearer <token>
Content-Type: application/json

{
  "interactionType": "view|like|comment|share"
}
```

---

## 🔧 Business Logic

### Post Freezing Logic
- **Trigger**: When a post receives 5 or more reports
- **Action**: Post is automatically frozen and marked as `is_frozen: true`
- **Status**: Post status changes to `frozen`
- **Notification**: Post owner receives notification
- **Feed**: Frozen posts are excluded from all feeds

### Featured Posts Logic
- **Eligibility**: Only approved, non-frozen posts can be featured
- **Duration**: Featured posts can have expiration dates
- **Priority**: Featured posts appear first in feeds
- **Notification**: Post owner is notified when their post is featured

### User Preferences Logic
- **Tracking**: User interactions with posts are tracked
- **Scoring**: Different interaction types have different weights:
  - View: 0.1 points
  - Like: 0.3 points
  - Comment: 0.5 points
  - Share: 0.7 points
- **Recommendations**: Posts from preferred categories are prioritized

---

## 📊 Database Schema Updates

### New Models Added:
1. **PostReport** - Tracks post reports with reasons
2. **UserPreference** - Tracks user category preferences
3. **FeaturedPost** - Manages featured posts

### Updated Models:
1. **Post** - Added `is_featured`, `is_frozen`, `report_count`, `featured_at`, `frozen_at`
2. **User** - Added relations to reports and preferences
3. **Category** - Added relation to user preferences
4. **Admin** - Added relations to reports and featured posts

### New Enums:
- **ReportReason**: SPAM, HARASSMENT, INAPPROPRIATE_CONTENT, etc.
- **ReportStatus**: pending, reviewed, resolved, dismissed
- **PostStatus**: Added 'frozen' status

---

## 🚀 Getting Started

1. **Start your application:**
   ```bash
   npm start
   ```

2. **Test the new features:**
   ```bash
   node test-new-features.js
   ```

3. **Use Prisma Studio to explore data:**
   ```bash
   npx prisma studio
   ```

---

## 🎉 Features Summary

✅ **Post Reporting System**
- Users can report posts with specific reasons
- Automatic post freezing after 5 reports
- Admin review and management system

✅ **Categories Management**
- Full CRUD operations for categories
- Popular categories tracking
- Category-based post filtering

✅ **Featured Posts System**
- Admin can feature high-quality posts
- Featured posts appear first in feeds
- Expiration dates for featured posts

✅ **Personalized Recommendations**
- User preference tracking
- Personalized feed generation
- Trending posts algorithm
- Interaction-based scoring

✅ **Enhanced Business Logic**
- Post freezing mechanism
- User preference learning
- Content moderation tools
- Analytics and statistics

Your Talynk backend is now a comprehensive social media platform with advanced features! 🚀

