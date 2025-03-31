# Talynk Backend Repository

Welcome to the **Talynk Backend** repository! This project powers the backend services for Talynk, a platform for emerging talents to showcase their skills via videos. The backend is built using **Node.js** and **PostgreSQL** and includes features such as user authentication, video management, and traceability.

## Features

### User Features

- 📱 Share images and videos
- 🏠 Browse approved content in home feed
- 👤 Personal profile management
- 📊 Track post status (pending/approved/rejected)
- 🔍 Filter content by categories
- ⏱️ Load more content functionality

### Admin Features

- ✅ Content moderation system
- 📺 Video watch-time verification (50% of video)
- ❌ Post rejection with reason
- 📁 Category management
- 📊 Post statistics dashboard

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with Sequelize ORM
- **Authentication**: JWT (JSON Web Tokens)
- **File Handling**: Multer for media uploads

## Installation

1. Clone the repository:

```bash
git clone https://github.com/ihirwepatrick/talynk.git
cd talynk
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following:

```env
PORT=3000
DB_HOST=localhost
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=talynk_db
JWT_SECRET=your_jwt_secret
```

4. Set up the database:

```bash
npx sequelize-cli db:create
npx sequelize-cli db:migrate
```

5. Start the server:

```bash
npm start
```

## Project Structure

```
talynk/
├── src/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   └── app.js
├── public/
│   ├── css/
│   ├── js/
│   └── uploads/
├── .env
└── package.json
```

## API Documentation

### Authentication Endpoints

#### Register User

```http
POST /api/auth/register
```

**Request Body:**

```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "phone1": "string",
  "phone2": "string (optional)"
}
```

**Response:** `201 Created`

```json
{
  "status": "success",
  "message": "User registered successfully",
  "data": {
    "id": "integer",
    "username": "string",
    "email": "string",
    "role": "string"
  }
}
```

#### Login

```http
POST /api/auth/login
```

**Request Body:**

```json
{
  "email": "string",
  "password": "string",
  "rememberMe": "boolean (optional)"
}
```

**Response:** `200 OK`

```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "token": "string",
    "user": {
      "id": "integer",
      "username": "string",
      "email": "string",
      "role": "string"
    }
  }
}
```

### Posts Endpoints

#### Get All Posts (Paginated)

```http
GET /api/posts?page=1&limit=10&category=1
```

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `category`: Category ID (optional)

**Response:** `200 OK`

```json
{
  "status": "success",
  "data": {
    "posts": [],
    "currentPage": "integer",
    "totalPages": "integer",
    "totalItems": "integer"
  }
}
```

#### Create New Post

```http
POST /api/posts
```

**Request Body (multipart/form-data):**

- `title`: "string"
- `caption`: "string"
- `media`: File (image/video)
- `categoryId`: "integer"

**Response:** `201 Created`

```json
{
  "status": "success",
  "message": "Post created successfully",
  "data": {
    "id": "integer",
    "title": "string",
    "mediaUrl": "string",
    "status": "pending"
  }
}
```

#### Get Post Details

```http
GET /api/posts/:id
```

**Response:** `200 OK`

```json
{
  "status": "success",
  "data": {
    "id": "integer",
    "title": "string",
    "caption": "string",
    "mediaUrl": "string",
    "mediaType": "string",
    "status": "string",
    "uploader": {
      "id": "integer",
      "username": "string"
    },
    "category": {
      "id": "integer",
      "name": "string"
    }
  }
}
```

### Admin Endpoints

#### Get Pending Posts

```http
GET /api/admin/posts/pending
```

**Headers:**




```
Authorization: Bearer <token>
```

**Response:** `200 OK`

```json
{
  "status": "success",
  "data": {
    "posts": [
      {
        "id": "integer",
        "title": "string",
        "mediaUrl": "string",
        "uploader": {
          "id": "integer",
          "username": "string"
        },
        "uploadedAt": "datetime"
      }
    ]
  }
}
```

#### Approve/Reject Post

```http
PATCH /api/admin/posts/:id/status
```

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "status": "approved|rejected",
  "rejectionReason": "string (required if status is rejected)"
}
```

**Response:** `200 OK`

```json
{
  "status": "success",
  "message": "Post status updated successfully"
}
```

### Category Endpoints

#### Get All Categories

```http
GET /api/categories
```

**Response:** `200 OK`

```json
{
  "status": "success",
  "data": {
    "categories": [
      {
        "id": "integer",
        "name": "string",
        "description": "string"
      }
    ]
  }
}
```

#### Create Category (Admin only)

```http
POST /api/categories
```

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "name": "string",
  "description": "string"
}
```

**Response:** `201 Created`

```json
{
  "status": "success",
  "message": "Category created successfully",
  "data": {
    "id": "integer",
    "name": "string",
    "description": "string"
  }
}
```

### User Profile Endpoints

#### Get User Profile

```http
GET /api/users/profile
```

**Headers:**

```
Authorization: Bearer <token>
```

**Response:** `200 OK`

```json
{
  "status": "success",
  "data": {
    "id": "integer",
    "username": "string",
    "email": "string",
    "phone1": "string",
    "phone2": "string",
    "facialImage": "string",
    "totalProfileViews": "integer",
    "selectedCategory": {
      "id": "integer",
      "name": "string"
    },
    "stats": {
      "totalPosts": "integer",
      "approvedPosts": "integer",
      "pendingPosts": "integer"
    }
  }
}
```

#### Update User Profile

```http
PUT /api/users/profile
```

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "username": "string (optional)",
  "phone1": "string (optional)",
  "phone2": "string (optional)",
  "selectedCategoryId": "integer (optional)"
}
```

**Response:** `200 OK`

```json
{
  "status": "success",
  "message": "Profile updated successfully",
  "data": {
    "username": "string",
    "phone1": "string",
    "phone2": "string",
    "selectedCategoryId": "integer"
  }
}
```

### Error Responses

All endpoints may return the following error responses:

#### 400 Bad Request

```json
{
  "status": "error",
  "message": "Validation error message"
}
```

#### 401 Unauthorized

```json
{
  "status": "error",
  "message": "Authentication required"
}
```

#### 403 Forbidden

```json
{
  "status": "error",
  "message": "You don't have permission to perform this action"
}
```

#### 404 Not Found

```json
{
  "status": "error",
  "message": "Resource not found"
}
```

#### 500 Internal Server Error

```json
{
  "status": "error",
  "message": "Internal server error"
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

LinkedIn - [@Patrick Ihirwe](https://www.linkedin.com/in/patrick-ihirwe-b105b6337/)

Project Link: [https://github.com/ihirwepatrick/talynk](https://github.com/patrickihirwe/talynk)
