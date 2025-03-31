// Create an auth module for handling authentication
const auth = {
    // Storage keys
    TOKEN_KEY: 'adminToken',
    USER_KEY: 'adminUser',
    REFRESH_TOKEN_KEY: 'adminRefreshToken',
    
    // Initialize auth state
    init() {
        this.token = localStorage.getItem(this.TOKEN_KEY);
        this.user = JSON.parse(localStorage.getItem(this.USER_KEY) || 'null');
    },

    // Check if user is authenticated
    isAuthenticated() {
        const token = localStorage.getItem(this.TOKEN_KEY);
        const user = JSON.parse(localStorage.getItem(this.USER_KEY) || 'null');
        return !!token && !!user;
    },

    // Get user role
    getRole() {
        const user = JSON.parse(localStorage.getItem(this.USER_KEY) || 'null');
        return user ? user.role : null;
    },

    // Check authentication and redirect if needed
    checkAuth() {
        const isLoginPage = window.location.pathname.includes('login.html');
        const isAuthenticated = this.isAuthenticated();
        const userRole = this.getRole();

        console.log('Auth Check:', { 
            isLoginPage, 
            isAuthenticated, 
            userRole, 
            path: window.location.pathname 
        });

        if (!isAuthenticated && !isLoginPage) {
            // Not authenticated and not on login page - redirect to login
            window.location.href = '/login.html';
            return false;
        }

        if (isAuthenticated && isLoginPage) {
            // Authenticated but on login page - redirect to appropriate dashboard
            window.location.href = `/${userRole}/dashboard.html`;
            return false;
        }

        if (isAuthenticated && !isLoginPage) {
            // Check if user is on the correct dashboard for their role
            const correctPath = window.location.pathname.includes(`/${userRole}/`);
            if (!correctPath) {
                window.location.href = `/${userRole}/dashboard.html`;
                return false;
            }
        }

        return true;
    },

    // Get authentication headers
    getHeaders() {
        const token = localStorage.getItem(this.TOKEN_KEY);
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    },

    // Get current user
    getUser() {
        return this.user;
    },

    // Login function
    async login(email, password, role) {
        try {
            if (!email || !password || !role) {
                throw new Error('Please provide email, password and role');
            }

            console.log('Login attempt:', { email, role }); // Debug log

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, role })
            });

            const data = await response.json();
            console.log('Login response:', data); // Debug log

            if (data.status === 'success' && data.data.token) {
                // Clear any existing auth data
                localStorage.clear();
                
                // Save new token and user data
                localStorage.setItem(this.TOKEN_KEY, data.data.token);
                localStorage.setItem(this.USER_KEY, JSON.stringify({
                    ...data.data.user,
                    role: role // Ensure role is saved
                }));

                return true;
            } else {
                throw new Error(data.message || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    // Logout function
    logout() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        window.location.href = '/login.html';
    },

    // Check specific permissions
    hasPermission(permission) {
        if (!this.user || !this.user.permissions) return false;
        return this.user.permissions.includes(permission);
    },

    // Refresh token
    async refreshToken() {
        try {
            const response = await fetch('/api/admin/refresh-token', {
                method: 'POST',
                headers: this.getHeaders()
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.token = data.token;
                localStorage.setItem(this.TOKEN_KEY, this.token);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Token refresh error:', error);
            return false;
        }
    },

    // Update user profile
    async updateProfile(profileData) {
        try {
            const response = await fetch('/api/admin/profile', {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(profileData)
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.user = { ...this.user, ...data.user };
                localStorage.setItem(this.USER_KEY, JSON.stringify(this.user));
                return true;
            }
            return false;
        } catch (error) {
            console.error('Profile update error:', error);
            return false;
        }
    },

    // Change password
    async changePassword(currentPassword, newPassword) {
        try {
            const response = await fetch('/api/admin/change-password', {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();
            return data.status === 'success';
        } catch (error) {
            console.error('Password change error:', error);
            return false;
        }
    },
    async refreshToken() {
        try {
            const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
            
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }

            const response = await fetch('/api/auth/refresh-token', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${refreshToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.status === 'success') {
                localStorage.setItem(this.TOKEN_KEY, data.data.accessToken);
                localStorage.setItem(this.REFRESH_TOKEN_KEY, data.data.refreshToken);
                localStorage.setItem(this.USER_KEY, JSON.stringify(data.data.user));
                return true;
            }
            return false;
        } catch (error) {
            console.error('Token refresh error:', error);
            this.logout();
            return false;
        }
    }
};

// Initialize auth when the script loads
auth.init();

// Export the auth object
window.auth = auth; 