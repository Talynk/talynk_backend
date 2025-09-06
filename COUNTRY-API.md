# 🌍 Country-Based Content Filtering API

This document describes the country-based content filtering system that allows users to select their origin country and filter content by different countries in the feeds.

## 📋 Overview

The country filtering system provides:
- **User Country Selection**: Users can set their origin country in their profile
- **Content Filtering**: Filter posts by country in feeds
- **Country Management**: Admin endpoints for managing countries
- **Geographic Analytics**: Statistics and insights by country

## 🗄️ Database Schema

### Country Model
```prisma
model Country {
  id          Int      @id @default(autoincrement())
  name        String   @unique @db.VarChar(100)
  code        String   @unique @db.VarChar(3) // ISO 3166-1 alpha-3 code
  flag_emoji  String?  @db.VarChar(10) // Flag emoji
  is_active   Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  users       User[]

  @@map("countries")
}
```

### Updated User Model
```prisma
model User {
  // ... existing fields
  country_id  Int?     // Reference to country
  // ... other fields

  // Relations
  country     Country? @relation(fields: [country_id], references: [id])
  // ... other relations
}
```

## 🔗 API Endpoints

### 1. Country Management

#### Get All Countries
```http
GET /api/countries
```

**Query Parameters:**
- `active_only` (optional): Filter only active countries (default: true)

**Response:**
```json
{
  "status": "success",
  "data": {
    "countries": [
      {
        "id": 1,
        "name": "United States",
        "code": "USA",
        "flag_emoji": "🇺🇸",
        "is_active": true
      },
      {
        "id": 2,
        "name": "Canada",
        "code": "CAN",
        "flag_emoji": "🇨🇦",
        "is_active": true
      }
    ]
  }
}
```

#### Search Countries
```http
GET /api/countries/search?q=united&limit=10
```

**Query Parameters:**
- `q` (required): Search query (minimum 2 characters)
- `limit` (optional): Maximum results (default: 20)

**Response:**
```json
{
  "status": "success",
  "data": {
    "countries": [
      {
        "id": 1,
        "name": "United States",
        "code": "USA",
        "flag_emoji": "🇺🇸"
      },
      {
        "id": 3,
        "name": "United Kingdom",
        "code": "GBR",
        "flag_emoji": "🇬🇧"
      }
    ],
    "query": "united",
    "count": 2
  }
}
```

#### Get Country by ID
```http
GET /api/countries/:id
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "country": {
      "id": 1,
      "name": "United States",
      "code": "USA",
      "flag_emoji": "🇺🇸",
      "is_active": true,
      "users": [
        {
          "id": "uuid1",
          "username": "john_doe",
          "profile_picture": "profile1.jpg"
        }
      ]
    }
  }
}
```

#### Get Country Statistics
```http
GET /api/countries/:id/stats
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "userCount": 150,
    "postCount": 1250
  }
}
```

### 2. Admin Country Management

#### Create Country (Admin Only)
```http
POST /api/countries
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "New Country",
  "code": "NEW",
  "flag_emoji": "🏳️"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Country created successfully",
  "data": {
    "country": {
      "id": 100,
      "name": "New Country",
      "code": "NEW",
      "flag_emoji": "🏳️",
      "is_active": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### Update Country (Admin Only)
```http
PUT /api/countries/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Updated Country Name",
  "is_active": false
}
```

#### Delete Country (Admin Only)
```http
DELETE /api/countries/:id
Authorization: Bearer <admin_token>
```

### 3. User Country Management

#### Update User's Country
```http
PUT /api/users/country
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "country_id": 1
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Country updated successfully",
  "data": {
    "user": {
      "id": "user_uuid",
      "username": "john_doe",
      "country_id": 1,
      "country": {
        "id": 1,
        "name": "United States",
        "code": "USA",
        "flag_emoji": "🇺🇸"
      }
    }
  }
}
```

#### Get User Profile (with Country)
```http
GET /api/users/profile
Authorization: Bearer <user_token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "user_uuid",
    "username": "john_doe",
    "email": "john@example.com",
    "country_id": 1,
    "country": {
      "id": 1,
      "name": "United States",
      "code": "USA",
      "flag_emoji": "🇺🇸"
    }
    // ... other user fields
  }
}
```

### 4. Content Filtering

#### Get Posts with Country Filter
```http
GET /api/posts?country_id=1&page=1&limit=20
```

**Query Parameters:**
- `country_id` (optional): Filter posts by country
- `page` (optional): Page number (default: 1)
- `limit` (optional): Posts per page (default: 20)

**Response:**
```json
{
  "status": "success",
  "data": {
    "posts": [
      {
        "id": "post_uuid",
        "title": "Sample Post",
        "description": "Post description",
        "video_url": "/uploads/video.mp4",
        "fullUrl": "http://localhost:3000/uploads/video.mp4",
        "user": {
          "id": "user_uuid",
          "username": "john_doe",
          "profile_picture": "profile.jpg",
          "country": {
            "id": 1,
            "name": "United States",
            "code": "USA",
            "flag_emoji": "🇺🇸"
          }
        },
        "category": {
          "id": 1,
          "name": "Technology"
        }
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8
    },
    "filters": {
      "country_id": 1
    }
  }
}
```

## 🚀 Usage Examples

### Frontend Implementation

#### Country Selection Component
```javascript
// Get all countries for dropdown
const fetchCountries = async () => {
  const response = await fetch('/api/countries');
  const data = await response.json();
  return data.data.countries;
};

// Update user's country
const updateUserCountry = async (countryId) => {
  const response = await fetch('/api/users/country', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ country_id: countryId })
  });
  return response.json();
};
```

#### Feed with Country Filter
```javascript
// Get posts filtered by country
const fetchPostsByCountry = async (countryId, page = 1) => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '20'
  });
  
  if (countryId) {
    params.append('country_id', countryId.toString());
  }
  
  const response = await fetch(`/api/posts?${params}`);
  return response.json();
};

// Usage
const posts = await fetchPostsByCountry(1); // Posts from USA
const allPosts = await fetchPostsByCountry(null); // All posts
```

#### Country Search Component
```javascript
// Search countries
const searchCountries = async (query) => {
  if (query.length < 2) return [];
  
  const response = await fetch(`/api/countries/search?q=${encodeURIComponent(query)}`);
  const data = await response.json();
  return data.data.countries;
};
```

## 🗃️ Database Seeding

### Seed Countries Script
```bash
# Run the country seeding script
node seed-countries.js
```

This script will:
- Clear existing countries
- Insert 60+ countries with ISO codes and flag emojis
- Display seeding statistics

### Sample Countries Included
- 🇺🇸 United States (USA)
- 🇨🇦 Canada (CAN)
- 🇬🇧 United Kingdom (GBR)
- 🇩🇪 Germany (DEU)
- 🇫🇷 France (FRA)
- 🇮🇹 Italy (ITA)
- 🇪🇸 Spain (ESP)
- 🇳🇱 Netherlands (NLD)
- 🇧🇷 Brazil (BRA)
- 🇯🇵 Japan (JPN)
- 🇨🇳 China (CHN)
- 🇮🇳 India (IND)
- 🇦🇺 Australia (AUS)
- And many more...

## 🔍 Advanced Features

### Country-Based Analytics
```javascript
// Get country statistics
const getCountryStats = async (countryId) => {
  const response = await fetch(`/api/countries/${countryId}/stats`);
  return response.json();
};
```

### Multi-Country Filtering
```javascript
// Filter posts from multiple countries
const fetchPostsFromMultipleCountries = async (countryIds) => {
  const posts = await Promise.all(
    countryIds.map(id => fetchPostsByCountry(id))
  );
  return posts.flat();
};
```

### Geographic Content Discovery
```javascript
// Discover content from user's country
const discoverLocalContent = async (userId) => {
  // Get user's country
  const user = await fetch('/api/users/profile');
  const userCountry = user.data.country_id;
  
  // Get local posts
  return fetchPostsByCountry(userCountry);
};
```

## 🛡️ Security & Validation

### Input Validation
- Country IDs must be valid integers
- Country codes must be 3-character ISO codes
- Country names must be unique
- Flag emojis are optional but validated

### Access Control
- Public endpoints: Country listing, search, statistics
- User endpoints: Country selection (authenticated users only)
- Admin endpoints: Country management (admin role required)

### Error Handling
```json
{
  "status": "error",
  "message": "Invalid country ID"
}
```

## 📊 Performance Considerations

### Database Indexes
- Index on `country_id` in users table
- Index on `name` and `code` in countries table
- Composite indexes for filtering queries

### Caching Strategy
- Cache country list (rarely changes)
- Cache country statistics
- Use Redis for frequently accessed country data

### Query Optimization
- Use `select` to limit returned fields
- Implement pagination for large datasets
- Use efficient joins for related data

## 🧪 Testing

### Test Country Endpoints
```bash
# Get all countries
curl -X GET http://localhost:3000/api/countries

# Search countries
curl -X GET "http://localhost:3000/api/countries/search?q=united"

# Update user country
curl -X PUT http://localhost:3000/api/users/country \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"country_id": 1}'

# Get posts by country
curl -X GET "http://localhost:3000/api/posts?country_id=1&page=1&limit=10"
```

### Test Admin Endpoints
```bash
# Create country (admin only)
curl -X POST http://localhost:3000/api/countries \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Country", "code": "TST", "flag_emoji": "🏳️"}'
```

## 🔄 Migration Notes

### Database Migration
1. Run `npx prisma db push` to apply schema changes
2. Run `node seed-countries.js` to populate countries
3. Update existing users to set country_id (optional)

### API Versioning
- All endpoints are backward compatible
- Country filtering is optional in existing endpoints
- New endpoints follow existing API patterns

## 📈 Future Enhancements

### Planned Features
- **Regional Grouping**: Group countries by regions/continents
- **Language Support**: Multi-language country names
- **Timezone Integration**: Country-based timezone handling
- **Geographic Analytics**: Advanced country-based insights
- **Content Localization**: Country-specific content recommendations

### Integration Opportunities
- **Maps Integration**: Visual country selection
- **Currency Support**: Country-based currency display
- **Localization**: Country-specific date/time formats
- **Content Moderation**: Country-specific content policies
