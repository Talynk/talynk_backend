// Authentication utilities
const auth = {
    // Check if user is authenticated
    isAuthenticated() {
        return !!localStorage.getItem('token');
    },

    // Get user role
    getRole() {
        return localStorage.getItem('role');
    },

    // Get auth token
    getToken() {
        return localStorage.getItem('token');
    },

    // Get headers for API requests
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.getToken()}`,
            'Content-Type': 'application/json'
        };
    },

    // Login function
    async login(email, password, role) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, role })
            });

            const data = await response.json();

            if (data.status === 'success') {
                localStorage.setItem('token', data.data.token);
                localStorage.setItem('role', role);
                return { success: true };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            return { success: false, message: 'An error occurred during login' };
        }
    },

    // Logout function
    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        window.location.href = '/login.html';
    },

    // Check authorization and redirect if needed
    checkAuth(requiredRole) {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html';
            return false;
        }

        const userRole = this.getRole();
        if (requiredRole && userRole !== requiredRole) {
            window.location.href = '/login.html';
            return false;
        }

        return true;
    }
};

// Export for use in other files
window.auth = auth; 