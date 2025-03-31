// Check authentication
const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'admin') {
    window.location.href = '/login.html';
}

// API headers
const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
};

// Load dashboard stats
async function loadDashboardStats() {
    try {
        const response = await fetch('/api/admin/dashboard/stats', { headers });
        const data = await response.json();
        
        if (data.status === 'success') {
            const stats = data.data;
            document.getElementById('statsCards').innerHTML = `
                <div class="col-md-4">
                    <div class="stats-card">
                        <h3>${stats.totalUsers}</h3>
                        <p>Total Users</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="stats-card">
                        <h3>${stats.totalPosts}</h3>
                        <p>Total Videos</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="stats-card">
                        <h3>${stats.pendingPosts}</h3>
                        <p>Pending Approvals</p>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load users
async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users', { headers });
        const data = await response.json();
        
        if (data.status === 'success') {
            const usersHTML = data.data.users.map(user => `
                <tr>
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td>${user.account_status || 'active'}</td>
                    <td>
                        <button class="btn btn-warning btn-sm" onclick="manageAccount('${user.username}', 'freezed')">
                            Freeze
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="manageAccount('${user.username}', 'deleted')">
                            Delete
                        </button>
                    </td>
                </tr>
            `).join('');
            
            document.getElementById('usersTableBody').innerHTML = usersHTML;
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Manage user account
async function manageAccount(username, action) {
    try {
        const response = await fetch('/api/admin/accounts/manage', {
            method: 'POST',
            headers,
            body: JSON.stringify({ username, action })
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            loadUsers();
        }
    } catch (error) {
        console.error('Error managing account:', error);
    }
}

// Load videos
async function loadVideos() {
    const status = document.getElementById('statusFilter').value;
    const date = document.getElementById('dateFilter').value;
    
    try {
        const response = await fetch(`/api/admin/videos?status=${status}&date=${date}`, { headers });
        const data = await response.json();
        
        if (data.status === 'success') {
            const videosHTML = data.data.videos.map(video => `
                <tr>
                    <td>${video.title}</td>
                    <td>${video.uploaderID}</td>
                    <td>${video.post_status}</td>
                    <td>${new Date(video.uploadDate).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="viewVideo('${video.uniqueTraceability_id}')">
                            View
                        </button>
                    </td>
                </tr>
            `).join('');
            
            document.getElementById('videosTableBody').innerHTML = videosHTML;
        }
    } catch (error) {
        console.error('Error loading videos:', error);
    }
}

// Navigation
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
        if (this.id === 'logoutBtn') {
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            window.location.href = '/login.html';
            return;
        }
        
        e.preventDefault();
        const page = this.dataset.page;
        
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
        // Show selected page
        document.getElementById(`${page}Page`).style.display = 'block';
        
        // Update active state
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        
        // Load page data
        switch(page) {
            case 'dashboard':
                loadDashboardStats();
                break;
            case 'users':
                loadUsers();
                break;
            case 'videos':
                loadVideos();
                break;
            case 'approvers':
                loadApprovers();
                break;
        }
    });
});

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
});

// Event listeners for filters
document.getElementById('statusFilter').addEventListener('change', loadVideos);
document.getElementById('dateFilter').addEventListener('change', loadVideos); 