# API Integration: Inbox Page Comments

## Endpoint Overview

**Endpoint:** `GET /api/posts/comments/user`  
**Purpose:** Fetch all comments on the logged-in user's posts for the Inbox page  
**Authentication:** Required (Bearer token)

## Authentication

This endpoint requires authentication. Include a Bearer token in the Authorization header:

```
Authorization: Bearer <token>
```

## Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | integer | No | 1 | Page number for pagination |
| limit | integer | No | 20 | Number of comments per page |
| from | string | No | null | ISO8601 timestamp to filter comments from a certain date |

## Response Format

### Success Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "comments": [
      {
        "id": "string",
        "postId": "string",
        "postTitle": "string",
        "postThumbnail": "string",
        "content": "string",
        "createdAt": "ISO8601 timestamp",
        "user": {
          "id": "string",
          "name": "string",
          "username": "string",
          "avatar": "string URL (optional)"
        }
      }
    ]
  }
}
```

### Error Responses

**401 Unauthorized** - When user is not authenticated
```json
{
  "status": "error",
  "message": "Authentication required"
}
```

**500 Internal Server Error** - When server encounters an error
```json
{
  "status": "error",
  "message": "Failed to fetch comments"
}
```

## Example Usage

### Request

```
GET /api/posts/comments/user?page=1&limit=10&from=2023-01-01T00:00:00Z
```

### Response

```json
{
  "status": "success",
  "data": {
    "comments": [
      {
        "id": "42",
        "postId": "550e8400-e29b-41d4-a716-446655440000",
        "postTitle": "My awesome video",
        "postThumbnail": "https://example.com/thumbnails/video1.jpg",
        "content": "This is a great video!",
        "createdAt": "2023-04-15T14:30:45.123Z",
        "user": {
          "id": "98765432-abcd-efgh-ijkl-123456789012",
          "name": "Jane Smith",
          "username": "janesmith",
          "avatar": "https://example.com/avatars/jane.jpg"
        }
      }
    ]
  }
}
```

## Client-Side Implementation Notes

1. Comments are sorted by creation date (newest first)
2. For client-side filtering by time periods:
   - Use JavaScript date filtering for "All", "Today", "This Week" views
   - Alternatively, use the `from` parameter with appropriately calculated dates

## Performance Considerations

- Use pagination parameters (`page` and `limit`) for large datasets
- The endpoint uses database-level pagination for optimal performance
- Consider caching responses on the client side for frequently accessed data 