# Profile Update API - Integration Guide

## Overview

The Profile Update API allows users to update their profile information, focusing on contact information (phone numbers) and profile picture. This implementation avoids username updates to prevent foreign key constraint issues with related tables.

## API Endpoint

**Endpoint**: `PUT /api/user/profile`  
**Content-Type**: `multipart/form-data`  
**Authentication**: Required (Bearer token in Authorization header)

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phone1 | string | No | User's primary phone number |
| phone2 | string | No | User's secondary phone number |
| user_facial_image | file | No | User's profile picture (image file) |

## File Upload Requirements

- **Allowed file types**: JPEG, PNG, JPG
- **Maximum file size**: 5MB
- **Field name**: `user_facial_image`

## Response Format

### Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "uuid-string",
      "username": "username",
      "email": "user@example.com",
      "phone1": "0786564924",
      "phone2": "0786564924",
      "profile_picture": "https://example.com/storage/profiles/profile_uuid_timestamp.jpg",
      // Other user fields excluding password
    }
  }
}
```

### Error Responses

**400 Bad Request** - When no valid fields are provided
```json
{
  "status": "error",
  "message": "No valid fields provided for update"
}
```

**401 Unauthorized** - When user is not authenticated
```json
{
  "status": "error",
  "message": "Authentication required"
}
```

**404 Not Found** - When user is not found
```json
{
  "status": "error",
  "message": "User not found"
}
```

**500 Internal Server Error** - When server encounters an error
```json
{
  "status": "error",
  "message": "Failed to update profile"
}
```

## Integration Example

### Frontend Implementation (React with Fetch API)

```javascript
const updateProfile = async (formData) => {
  try {
    const token = localStorage.getItem('accessToken');
    
    const response = await fetch('https://your-api.com/api/user/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData // FormData object containing phone1, phone2, and/or user_facial_image
    });
    
    const data = await response.json();
    
    if (data.status === 'success') {
      // Handle success (update user info in state/context)
      return data.data.user;
    } else {
      // Handle error
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Profile update error:', error);
    throw error;
  }
};

// Example usage
const handleSubmit = async (event) => {
  event.preventDefault();
  
  const formData = new FormData();
  formData.append('phone1', '0786564924');
  formData.append('phone2', '0786564924');
  
  // Add profile picture if selected
  if (selectedFile) {
    formData.append('user_facial_image', selectedFile);
  }
  
  try {
    const updatedUser = await updateProfile(formData);
    console.log('Profile updated:', updatedUser);
  } catch (error) {
    console.error('Failed to update profile:', error);
  }
};
```

## Implementation Notes

1. **File Storage**: Profile pictures are stored in the Supabase storage bucket under the 'profile' folder
2. **URL Structure**: The URL for the profile picture follows the pattern `profile/profile_{userId}_{timestamp}.{extension}`
3. **Partial Updates**: You can update only phone numbers, only the profile picture, or both
4. **Authentication**: Make sure to include the Bearer token in the Authorization header

## Security Considerations

1. **File Validation**: Only allowed image formats and size under 5MB will be accepted
2. **Auth Required**: The endpoint requires authentication to prevent unauthorized updates
3. **Limited Fields**: Only specific fields can be updated to prevent potential security issues
4. **Safe Storage**: Images are stored in Supabase with proper access controls 