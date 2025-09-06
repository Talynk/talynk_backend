# Hierarchical Categories API Documentation

## Overview
The category system now supports a hierarchical structure with main categories and subcategories. This allows for better organization and filtering of content.

## Category Structure

### Main Categories (Level 1)
1. **Music** - All music-related content
2. **Arts** - All visual and creative arts
3. **Communication** - All communication and speaking-related content

### Subcategories (Level 2)

#### Music Subcategories
- Rock, Pop, Hip Hop / Rap, R&B / Soul, Gospel, Jazz, Classical
- Reggae, Country, Traditional, Electronic/Dance, Afrobeats, Blues
- Folk, Latin, K-Pop, Other

#### Arts Subcategories
- Drawing, Painting, Sculpture, Photography, Graphic Design
- Fashion Design, Interior Design, Ceramics, Architecture
- Calligraphy, Crafts, Other

#### Communication Subcategories
- Preaching, Public Speaking, Motivational Speaking, Storytelling
- Poetry, Teaching & Training, Other

## API Endpoints

### 1. Get All Categories with Hierarchy

**GET** `/api/categories`

Returns all main categories with their subcategories in a hierarchical structure.

**Query Parameters:**
- `status` (optional): Filter by status (default: 'active')
- `include_subcategories` (optional): Include subcategories (default: 'true')

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": 63,
      "name": "Music",
      "description": "All music-related content including various genres and styles",
      "status": "active",
      "level": 1,
      "sort_order": 1,
      "_count": {
        "posts": 15
      },
      "children": [
        {
          "id": 66,
          "name": "Rock",
          "description": "Rock music and related content",
          "status": "active",
          "level": 2,
          "sort_order": 1,
          "_count": {
            "posts": 5
          }
        },
        {
          "id": 67,
          "name": "Pop",
          "description": "Pop music and mainstream content",
          "status": "active",
          "level": 2,
          "sort_order": 2,
          "_count": {
            "posts": 3
          }
        }
        // ... more subcategories
      ]
    },
    {
      "id": 64,
      "name": "Arts",
      "description": "All visual and creative arts including various artistic disciplines",
      "status": "active",
      "level": 1,
      "sort_order": 2,
      "_count": {
        "posts": 8
      },
      "children": [
        // ... Arts subcategories
      ]
    },
    {
      "id": 65,
      "name": "Communication",
      "description": "All communication and speaking-related content",
      "status": "active",
      "level": 1,
      "sort_order": 3,
      "_count": {
        "posts": 12
      },
      "children": [
        // ... Communication subcategories
      ]
    }
  ]
}
```

### 2. Get Subcategories for a Main Category

**GET** `/api/categories/:parentId/subcategories`

Returns all subcategories for a specific main category.

**Parameters:**
- `parentId` (required): ID of the main category

**Query Parameters:**
- `status` (optional): Filter by status (default: 'active')

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": 66,
      "name": "Rock",
      "description": "Rock music and related content",
      "status": "active",
      "level": 2,
      "sort_order": 1,
      "parent_id": 63,
      "_count": {
        "posts": 5
      }
    },
    {
      "id": 67,
      "name": "Pop",
      "description": "Pop music and mainstream content",
      "status": "active",
      "level": 2,
      "sort_order": 2,
      "parent_id": 63,
      "_count": {
        "posts": 3
      }
    }
    // ... more subcategories
  ]
}
```

### 3. Get Category by ID

**GET** `/api/categories/:id`

Returns a specific category with its details and post count.

**Parameters:**
- `id` (required): Category ID

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 66,
    "name": "Rock",
    "description": "Rock music and related content",
    "status": "active",
    "level": 2,
    "sort_order": 1,
    "parent_id": 63,
    "posts": [
      // ... posts in this category
    ]
  }
}
```

### 4. Get Popular Categories

**GET** `/api/categories/popular`

Returns categories sorted by post count (most popular first).

**Query Parameters:**
- `limit` (optional): Number of categories to return (default: 10)

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": 63,
      "name": "Music",
      "description": "All music-related content including various genres and styles",
      "status": "active",
      "level": 1,
      "sort_order": 1,
      "_count": {
        "posts": 15
      }
    }
    // ... more popular categories
  ]
}
```

## Post Upload with Categories

### Creating Posts with Categories

When creating a post, you can specify either a main category or a subcategory:

**POST** `/api/posts`

**Request Body:**
```json
{
  "title": "My Rock Music Video",
  "caption": "Check out this amazing rock performance!",
  "post_category": "Rock"  // Can be main category or subcategory
}
```

**Available Categories:**
- **Main Categories**: Music, Arts, Communication
- **Subcategories**: Rock, Pop, Hip Hop / Rap, R&B / Soul, Gospel, Jazz, Classical, Reggae, Country, Traditional, Electronic/Dance, Afrobeats, Blues, Folk, Latin, K-Pop, Drawing, Painting, Sculpture, Photography, Graphic Design, Fashion Design, Interior Design, Ceramics, Architecture, Calligraphy, Crafts, Preaching, Public Speaking, Motivational Speaking, Storytelling, Poetry, Teaching & Training, Other

**Error Response (Invalid Category):**
```json
{
  "status": "error",
  "message": "Invalid category",
  "received_category": "InvalidCategory",
  "available_categories": [
    {
      "name": "Music",
      "level": "main",
      "parent_id": null
    },
    {
      "name": "Rock",
      "level": "subcategory",
      "parent_id": 63
    }
    // ... all available categories
  ]
}
```

## Filtering Posts by Categories

### Get Posts by Category

**GET** `/api/posts`

**Query Parameters:**
- `category` (optional): Category ID to filter by
- `page` (optional): Page number (default: 1)
- `limit` (optional): Posts per page (default: 12)
- `sort` (optional): Sort order - 'latest' or 'oldest' (default: 'latest')

**Examples:**
```bash
# Get all posts
GET /api/posts

# Get posts from Music category (main category)
GET /api/posts?category=63

# Get posts from Rock subcategory
GET /api/posts?category=66

# Get latest posts from Arts category
GET /api/posts?category=64&sort=latest&limit=20
```

## Frontend Integration Examples

### 1. Category Selection Dropdown

```javascript
// Fetch categories for dropdown
const fetchCategories = async () => {
  const response = await fetch('/api/categories');
  const data = await response.json();
  
  // Group categories by main category
  const groupedCategories = data.data.map(mainCategory => ({
    label: mainCategory.name,
    options: mainCategory.children.map(sub => ({
      value: sub.id,
      label: sub.name
    }))
  }));
  
  return groupedCategories;
};
```

### 2. Category Filter Component

```javascript
// Filter posts by category
const filterPostsByCategory = async (categoryId) => {
  const response = await fetch(`/api/posts?category=${categoryId}`);
  const data = await response.json();
  return data.data;
};
```

### 3. Dynamic Category Loading

```javascript
// Load subcategories when main category is selected
const loadSubcategories = async (parentId) => {
  const response = await fetch(`/api/categories/${parentId}/subcategories`);
  const data = await response.json();
  return data.data;
};
```

## Database Schema

### Category Model
```prisma
model Category {
  id          Int      @id @default(autoincrement())
  name        String   @unique
  description String?  @db.Text
  status      CategoryStatus @default(active)
  parent_id   Int?     // Reference to parent category
  level       Int      @default(1) // 1 for main categories, 2 for subcategories
  sort_order  Int      @default(0) // For ordering categories

  // Relations
  posts       Post[]
  userPreferences UserPreference[]
  parent      Category? @relation("CategoryHierarchy", fields: [parent_id], references: [id])
  children    Category[] @relation("CategoryHierarchy")

  @@map("categories")
}
```

## Usage Examples

### cURL Examples

#### Get all categories with hierarchy
```bash
curl -X GET "http://localhost:3000/api/categories"
```

#### Get Music subcategories
```bash
curl -X GET "http://localhost:3000/api/categories/63/subcategories"
```

#### Create a post with Rock category
```bash
curl -X POST "http://localhost:3000/api/posts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Amazing Rock Performance",
    "caption": "Check out this incredible rock music!",
    "post_category": "Rock"
  }'
```

#### Get posts from Arts category
```bash
curl -X GET "http://localhost:3000/api/posts?category=64&limit=10"
```

## Benefits of Hierarchical Categories

1. **Better Organization**: Content is organized in a logical hierarchy
2. **Flexible Filtering**: Users can filter by main categories or specific subcategories
3. **Scalable**: Easy to add new subcategories under existing main categories
4. **User-Friendly**: Clear categorization makes content discovery easier
5. **Analytics**: Better insights into content distribution across categories
6. **SEO**: Improved content categorization for search engines

## Migration Notes

- All existing posts will continue to work with the new category system
- Categories are backward compatible
- The system supports both main category and subcategory selection for posts
- Post counts are calculated for both main categories and subcategories
