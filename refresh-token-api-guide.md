# Refresh Token API - Integration Guide

## Overview

The Refresh Token API allows clients to obtain a new access token without requiring users to re-authenticate. This mechanism enhances security by enabling short-lived access tokens while maintaining user sessions with longer-lived refresh tokens.

## API Endpoint

**Endpoint**: `POST /api/auth/refresh-token`  
**Content-Type**: `application/json`  
**Authentication**: None (uses refresh token in request body)

## How Refresh Tokens Work

1. When a user logs in, they receive both an access token and a refresh token
2. The access token is short-lived (typically 15-60 minutes)
3. When the access token expires, the client uses the refresh token to obtain a new access token
4. If the refresh token is valid, the server issues a new access token (and optionally a new refresh token)

## Request Format

```json
{
  "refreshToken": "your-refresh-token-here"
}
```

## Response Format

### Success Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "accessToken": "new-access-token",
    "refreshToken": "new-refresh-token", // Optional, some implementations reuse the original refresh token
    "expiresIn": 900 // Seconds until the new access token expires
  }
}
```

### Error Responses

**401 Unauthorized** - Invalid or expired refresh token
```json
{
  "status": "error",
  "message": "Invalid or expired refresh token"
}
```

**403 Forbidden** - Refresh token has been revoked or blacklisted
```json
{
  "status": "error",
  "message": "Refresh token has been revoked"
}
```

## Integration Steps

### Frontend Implementation

1. **Store tokens securely**:
   - Store the access token in memory (not in localStorage)
   - Store the refresh token in an HttpOnly cookie or secure storage

2. **Detect token expiration**:
   - Option 1: Proactively refresh before expiration using token expiry time
   - Option 2: Catch 401 errors and trigger refresh flow

3. **Implement refresh flow**:

```javascript
// Example refresh token flow
async function refreshAuthToken() {
  try {
    const response = await fetch('https://your-api.com/api/auth/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refreshToken: getStoredRefreshToken() // Get from secure storage
      })
    });

    const data = await response.json();
    
    if (data.status === 'success') {
      // Store the new tokens
      storeAccessToken(data.data.accessToken);
      if (data.data.refreshToken) {
        storeRefreshToken(data.data.refreshToken);
      }
      return data.data.accessToken;
    } else {
      // Handle refresh failure - usually redirect to login
      redirectToLogin();
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
    redirectToLogin();
  }
}
```

4. **Interceptor Implementation**:

```javascript
// Axios interceptor example
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't already tried to refresh
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Get new token
        const newToken = await refreshAuthToken();
        
        // Update header and retry
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh failed - redirect to login
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
```

## Security Best Practices

1. **Token Storage**:
   - Access tokens: Store in memory (or session storage if needed)
   - Refresh tokens: Use HttpOnly cookies or secure storage mechanisms

2. **Token Validation**:
   - Always validate tokens on the server
   - Check expiration, signature, and issuer

3. **Token Rotation**:
   - Issue a new refresh token with each refresh request
   - Invalidate old refresh tokens after use

4. **Token Revocation**:
   - Implement a token blacklist for revoked refresh tokens
   - Provide an endpoint for users to explicitly logout and revoke tokens

5. **Token Expiration**:
   - Access tokens: Short lifetime (15-60 minutes)
   - Refresh tokens: Longer but limited lifetime (1-2 weeks)

## Common Use Cases

### Logout Implementation

When a user logs out:

1. Clear the access token from memory/storage on the client
2. Send a request to revoke the refresh token on the server
3. Clear the refresh token from storage

```javascript
async function logout() {
  const refreshToken = getStoredRefreshToken();
  
  try {
    // Revoke the token on the server
    await fetch('https://your-api.com/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    });
  } catch (error) {
    console.error('Error during logout:', error);
  } finally {
    // Clear tokens regardless of server response
    clearTokens();
    redirectToLogin();
  }
}
```

### Session Timeout Handling

For handling extended inactivity:

```javascript
// Monitor user activity
let inactivityTimer;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    // Force logout after inactivity
    logout();
    showSessionExpiredMessage();
  }, 30 * 60 * 1000); // 30 minutes
}

// Add activity listeners
['mousedown', 'keypress', 'scroll', 'touchstart'].forEach(eventType => {
  document.addEventListener(eventType, resetInactivityTimer);
});

// Initialize timer
resetInactivityTimer();
```

## Troubleshooting

### Common Issues

1. **"Invalid refresh token" errors**:
   - Check token storage implementation
   - Verify token hasn't expired
   - Ensure token hasn't been revoked

2. **Infinite refresh loops**:
   - Ensure your interceptor correctly handles failed refresh attempts
   - Add retry limits to prevent infinite loops

3. **Cross-Origin Issues**:
   - Check CORS configuration for the refresh token endpoint
   - Ensure cookies are configured with correct settings if used

## Conclusion

A properly implemented refresh token flow enhances both security and user experience. By following these guidelines, you can implement a robust authentication system that minimizes user disruption while maintaining strong security practices. 