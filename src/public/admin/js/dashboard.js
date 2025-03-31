// Check authentication
if (!auth.checkAuth('admin')) {
    window.location.href = '/login.html';
}

// First, define all page templates
const pages = {
    overview: `
        <div class="container-fluid">
            <h1 class="h3 mb-4">Dashboard Overview</h1>
            <div class="row">
                <div class="col-xl-3 col-md-6 mb-4">
                    <div class="card border-left-primary shadow h-100 py-2">
                        <div class="card-body">
                            <div class="row no-gutters align-items-center">
                                <div class="col mr-2">
                                    <div class="text-xs font-weight-bold text-primary text-uppercase mb-1">Total Users</div>
                                    <div class="h5 mb-0 font-weight-bold text-gray-800" id="totalUsers">0</div>
                                </div>
                                <div class="col-auto">
                                    <i class="bx bxs-user fa-2x text-gray-300"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-xl-3 col-md-6 mb-4">
                    <div class="card border-left-success shadow h-100 py-2">
                        <div class="card-body">
                            <div class="row no-gutters align-items-center">
                                <div class="col mr-2">
                                    <div class="text-xs font-weight-bold text-success text-uppercase mb-1">Active Approvers</div>
                                    <div class="h5 mb-0 font-weight-bold text-gray-800" id="totalApprovers">0</div>
                                </div>
                                <div class="col-auto">
                                    <i class="bx bxs-user-check fa-2x text-gray-300"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-xl-3 col-md-6 mb-4">
                    <div class="card border-left-info shadow h-100 py-2">
                        <div class="card-body">
                            <div class="row no-gutters align-items-center">
                                <div class="col mr-2">
                                    <div class="text-xs font-weight-bold text-info text-uppercase mb-1">Pending Videos</div>
                                    <div class="h5 mb-0 font-weight-bold text-gray-800" id="pendingVideos">0</div>
                                </div>
                                <div class="col-auto">
                                    <i class="bx bxs-time fa-2x text-gray-300"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-xl-3 col-md-6 mb-4">
                    <div class="card border-left-warning shadow h-100 py-2">
                        <div class="card-body">
                            <div class="row no-gutters align-items-center">
                                <div class="col mr-2">
                                    <div class="text-xs font-weight-bold text-warning text-uppercase mb-1">Approved Videos</div>
                                    <div class="h5 mb-0 font-weight-bold text-gray-800" id="approvedVideos">0</div>
                                </div>
                                <div class="col-auto">
                                    <i class="bx bxs-check-circle fa-2x text-gray-300"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-lg-6">
                    <div class="card shadow mb-4">
                        <div class="card-header py-3">
                            <h6 class="m-0 font-weight-bold text-primary">Recent Uploads</h6>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table" id="recentUploadsTable">
                                    <thead>
                                        <tr>
                                            <th>Title</th>
                                            <th>User</th>
                                            <th>Status</th>
                                            <th>Date</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <!-- Recent uploads will be loaded here -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-lg-6">
                    <div class="card shadow mb-4">
                        <div class="card-header py-3">
                            <h6 class="m-0 font-weight-bold text-primary">Most Viewed</h6>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table" id="mostViewedTable">
                                    <thead>
                                        <tr>
                                            <th>Title</th>
                                            <th>Views</th>
                                            <th>User</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <!-- Most viewed videos will be loaded here -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,

    videos: `
        <div class="container-fluid">
            <h1 class="h3 mb-4">Videos Management</h1>
            
            <div class="card shadow mb-4">
                <div class="card-header py-3 d-flex justify-content-between align-items-center">
                    <h6 class="m-0 font-weight-bold text-primary">All Videos</h6>
                    <div class="d-flex">
                        <input type="text" id="videoSearch" class="form-control form-control-sm mr-2" placeholder="Search videos...">
                        <select id="statusFilter" class="form-control form-control-sm mr-2">
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                        <button class="btn btn-primary btn-sm" onclick="searchVideos()">Search</button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-bordered" id="videosTable">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Title</th>
                                    <th>Author</th>
                                    <th>Status</th>
                                    <th>Views</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- Videos will be loaded here -->
                            </tbody>
                        </table>
                        <div id="pagination" class="d-flex justify-content-center mt-3">
                            <!-- Pagination will be loaded here -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,

    categories: `
        <div class="container-fluid">
            <h1 class="h3 mb-4">Categories Management</h1>
            <div class="card shadow mb-4">
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-bordered">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Videos Count</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="categoriesTableBody">
                                <!-- Categories will be loaded here -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `,

    users: `
        <div class="container-fluid">
            <h1 class="h3 mb-4">Users Management</h1>
            <div class="card shadow mb-4">
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-bordered">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Email</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="usersTableBody">
                                <!-- Users will be loaded here -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `,

    approvers: `
        <div class="container-fluid">
            <h1 class="h3 mb-4">Approvers Management</h1>
            <div class="card shadow mb-4">
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-bordered">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Email</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="approversTableBody">
                                <!-- Approvers will be loaded here -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `,

    settings: `
        <div class="container-fluid">
            <h1 class="h3 mb-4">Settings</h1>
            <div class="row">
                <div class="col-lg-6">
                    <div class="card shadow mb-4">
                        <div class="card-header py-3">
                            <h6 class="m-0 font-weight-bold text-primary">Site Settings</h6>
                        </div>
                        <div class="card-body">
                            <form id="settingsForm">
                                <!-- Settings form will be loaded here -->
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,

    logs: `
        <div class="container-fluid">
            <h1 class="h3 mb-4">Activity Logs</h1>
            <div class="card shadow mb-4">
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-bordered">
                            <thead>
                                <tr>
                                    <th>Action</th>
                                    <th>User</th>
                                    <th>Date</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody id="logsTableBody">
                                <!-- Logs will be loaded here -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `
};

// Update the loadPage function
function loadPage(pageName) {
    console.log('Loading page:', pageName); // Debug log

    // Get the content container
    const content = document.getElementById('content');
    if (!content) {
        console.error('Content container not found');
        return;
    }

    // Remove 'active' class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Add 'active' class to current nav link
    const currentLink = document.querySelector(`a[href="#${pageName}"]`);
    if (currentLink) {
        currentLink.classList.add('active');
    }

    // Load the page content
    if (pages[pageName]) {
        content.innerHTML = pages[pageName];
        
        // Initialize page-specific functionality
        switch(pageName) {
            case 'overview':
                loadDashboardStats();
                loadRecentUploads();
                loadMostViewed();
                break;
            case 'videos':
                loadVideos();
                break;
            case 'categories':
                loadCategories();
                break;
            case 'users':
                loadUsers();
                break;
            case 'approvers':
                loadApprovers();
                break;
            case 'settings':
                loadSettings();
                break;
            case 'logs':
                loadLogs();
                break;
        }
    } else {
        content.innerHTML = pages.overview; // Default to overview if page not found
        loadDashboardStats();
    }
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Load initial page based on hash
    const hash = window.location.hash.slice(1);
    loadPage(hash || 'overview');

    // Add click event listeners to nav items
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.getAttribute('href').slice(1); // Remove the # from href
            loadPage(page);
        });
    });
});

// Listen for hash changes
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1);
    loadPage(hash || 'overview');
});

// Add this function to handle page loads
function initializePage() {
    const hash = window.location.hash.slice(1);
    loadPage(hash || 'overview');
}

// Call initializePage when the page loads
window.onload = initializePage;

// Load dashboard data
async function loadDashboardData() {
    try {
        const response = await fetch('/api/admin/dashboard/stats', {
            headers: auth.getHeaders()
        });

        if (!response.ok) throw new Error('Failed to fetch dashboard data');
        
        const data = await response.json();
        updateDashboardStats(data);
        await loadRecentUploads();
        await loadMostViewed();
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load dashboard data', 'danger');
    }
}

// Update dashboard statistics
function updateDashboardStats(data) {
    document.getElementById('totalUsers').textContent = data.totalUsers || 0;
    document.getElementById('totalApprovers').textContent = data.totalApprovers || 0;
    document.getElementById('pendingVideos').textContent = data.pendingVideos || 0;
    document.getElementById('approvedVideos').textContent = data.approvedVideos || 0;
}

// Load recent uploads
async function loadRecentUploads() {
    try {
        const response = await fetch('/api/admin/posts/recent', {
            headers: auth.getHeaders()
        });

        if (!response.ok) throw new Error('Failed to fetch recent uploads');
        
        const data = await response.json();
        const tbody = document.querySelector('#recentUploadsTable tbody');
        
        // Check if element exists before setting innerHTML
        if (!tbody) {
            console.warn('Recent uploads table not found in DOM');
            return;
        }
        
        tbody.innerHTML = data.posts.map(post => `
            <tr>
                <td>${post.title}</td>
                <td>${post.author?.username || 'Unknown'}</td>
                <td><span class="badge bg-${getStatusColor(post.status)}">${post.status}</span></td>
                <td>${formatDate(post.createdAt)}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="viewPost('${post.id}')">
                        View
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load recent uploads', 'danger');
    }
}

// Load most viewed videos
async function loadMostViewed() {
    try {
        const response = await fetch('/api/admin/posts/most-viewed', {
            headers: auth.getHeaders()
        });

        if (!response.ok) throw new Error('Failed to fetch most viewed videos');
        
        const data = await response.json();
        const tbody = document.querySelector('#mostViewedTable tbody');
        
        // Check if element exists before setting innerHTML
        if (!tbody) {
            console.warn('Most viewed table not found in DOM');
            return;
        }
        
        tbody.innerHTML = data.posts.map(post => `
            <tr>
                <td>${post.title}</td>
                <td>${post.views || 0}</td>
                <td>${post.author?.username || 'Unknown'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="viewPost('${post.id}')">
                        View
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load most viewed videos', 'danger');
    }
}

// Handle traceability search
document.getElementById('searchBtn').addEventListener('click', async () => {
    const searchId = document.getElementById('searchTraceId').value;
    const searchType = document.getElementById('searchType').value;
    
    if (!searchId) {
        showAlert('Please enter a traceability ID', 'warning');
        return;
    }

    try {
        const response = await fetch(`/api/admin/search/${searchType}/${searchId}`, {
            headers: auth.getHeaders()
        });

        if (!response.ok) throw new Error('Item not found');
        
        const data = await response.json();
        
        if (searchType === 'post') {
            viewPost(data.post.uniqueTraceability_id);
        } else {
            viewUser(data.user.id);
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Item not found', 'danger');
    }
});

// Helper functions
function getStatusColor(status) {
    switch (status?.toLowerCase()) {
        case 'pending': return 'warning';
        case 'approved': return 'success';
        case 'rejected': return 'danger';
        default: return 'secondary';
    }
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.container-fluid').prepend(alertDiv);
}

// Load dashboard data when page loads
document.addEventListener('DOMContentLoaded', loadDashboardData);

// API calls
async function loadDashboardStats() {
    try {
        console.log('Fetching dashboard data...'); // Debug log
        
        // Check authentication first
        if (!auth.isAuthenticated()) {
            window.location.href = '/login.html';
            return;
        }

        const headers = auth.getHeaders();
        console.log('Auth headers:', headers); // Debug headers

        // Use the correct API endpoint
        const response = await fetch('/api/admin/dashboard/stats', {
            method: 'GET',
            headers: headers
        });
        
        console.log('Response:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
        });

        // Check if response is ok before parsing JSON
        if (!response.ok) {
            if (response.status === 401) {
                // Unauthorized - redirect to login
                auth.logout();
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Dashboard data:', data); // Debug data

        if (data.status === 'success') {
            // Update dashboard UI with data
            document.getElementById('totalUsers').textContent = data.data.totalUsers || 0;
            document.getElementById('totalApprovers').textContent = data.data.totalApprovers || 0;
            document.getElementById('pendingVideos').textContent = data.data.pendingVideos || 0;
            document.getElementById('approvedVideos').textContent = data.data.approvedVideos || 0;
        } else {
            throw new Error(data.message || 'Failed to fetch dashboard data');
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        showError(`Error loading stats: ${error.message}`);
    }
}

async function loadApprovers() {
    try {
        const response = await fetch('/api/admin/approvers', {
            headers: auth.getHeaders()
        });
        const data = await response.json();
        
        if (data.status === 'success') {
            const approversList = document.getElementById('approversTableBody');
            approversList.innerHTML = data.data.approvers.map(approver => `
                <tr>
                    <td>${approver.username}</td>
                    <td>${approver.email}</td>
                    <td>
                        <span class="badge bg-${approver.status === 'active' ? 'success' : 'danger'}">
                            ${approver.status}
                        </span>
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-${approver.status === 'active' ? 'warning' : 'success'}"
                                    onclick="toggleApproverStatus('${approver.id}', '${approver.status}')">
                                ${approver.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                            <button class="btn btn-danger" onclick="deleteApprover('${approver.id}')">
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading approvers:', error);
        showAlert('Failed to load approvers', 'danger');
    }
}

async function loadRecentActivity() {
    try {
        const response = await fetch('/api/admin/recent-activity', {
            headers: auth.getHeaders()
        });
        const data = await response.json();
        
        if (data.status === 'success') {
            const activityList = document.getElementById('recentActivity');
            activityList.innerHTML = data.data.map(activity => `
                <tr>
                    <td>
                        <span class="badge bg-${
                            activity.action.includes('Approved') ? 'success' :
                            activity.action.includes('Rejected') ? 'danger' : 
                            'info'
                        }">
                            ${activity.action}
                        </span>
                    </td>
                    <td>${activity.user}</td>
                    <td>${activity.details}</td>
                    <td>${new Date(activity.date).toLocaleString()}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading recent activity:', error);
        showAlert('Failed to load recent activity', 'danger');
    }
}

function refreshStats() {
    loadDashboardStats();
    loadRecentActivity();
}

// Event listeners
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = e.target.dataset.page;
        if (page) {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
            loadPage(page);
        }
    });
});

// Load overview by default
loadPage('overview');

async function addApprover() {
    try {
        const form = document.getElementById('addApproverForm');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        const response = await fetch('/api/admin/approvers', {
            method: 'POST',
            headers: {
                ...auth.getHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.status === 'success') {
            // Close modal and refresh list
            bootstrap.Modal.getInstance(document.getElementById('addApproverModal')).hide();
            form.reset();
            loadApprovers();
            showAlert('Approver added successfully', 'success');
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        console.error('Error adding approver:', error);
        showAlert('Failed to add approver', 'danger');
    }
}

async function toggleApproverStatus(approverId, currentStatus) {
    try {
        const response = await fetch(`/api/admin/approvers/${approverId}/status`, {
            method: 'PUT',
            headers: auth.getHeaders()
        });

        const result = await response.json();

        if (result.status === 'success') {
            loadApprovers();
            showAlert('Approver status updated successfully', 'success');
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        console.error('Error toggling approver status:', error);
        showAlert('Failed to update approver status', 'danger');
    }
}

async function deleteApprover(approverId) {
    if (!confirm('Are you sure you want to delete this approver?')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/approvers/${approverId}`, {
            method: 'DELETE',
            headers: auth.getHeaders()
        });

        const result = await response.json();

        if (result.status === 'success') {
            loadApprovers();
            showAlert('Approver deleted successfully', 'success');
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        console.error('Error deleting approver:', error);
        showAlert('Failed to delete approver', 'danger');
    }
}

// Add this utility function for showing alerts
function showError(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.container-fluid').prepend(alertDiv);
}

async function loadUsers() {
    try {
        const statusFilter = document.getElementById('statusFilter').value;
        const searchQuery = document.getElementById('userSearch').value;

        const response = await fetch(`/api/admin/users?status=${statusFilter}&search=${searchQuery}`, {
            headers: auth.getHeaders()
        });
        const data = await response.json();
        
        if (data.status === 'success') {
            const usersList = document.getElementById('usersTableBody');
            usersList.innerHTML = data.data.users.map(user => `
                <tr>
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td>
                        <span class="badge bg-${user.status === 'active' ? 'success' : 'danger'}">
                            ${user.status}
                        </span>
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-${user.status === 'active' ? 'warning' : 'success'}"
                                    onclick="toggleUserStatus('${user.id}', '${user.status}')">
                                ${user.status === 'active' ? 'Suspend' : 'Activate'}
                            </button>
                            <button class="btn btn-danger" onclick="deleteUser('${user.id}')">
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('Failed to load users', 'danger');
    }
}

async function showUserVideos(userId, username) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/videos`, {
            headers: auth.getHeaders()
        });
        const data = await response.json();
        
        if (data.status === 'success') {
            const videosList = document.getElementById('userVideosList');
            videosList.innerHTML = data.data.videos.map(video => `
                <tr>
                    <td>${video.title}</td>
                    <td>
                        <span class="badge bg-${
                            video.status === 'approved' ? 'success' :
                            video.status === 'rejected' ? 'danger' : 'warning'
                        }">
                            ${video.status}
                        </span>
                    </td>
                    <td>${video.Approver ? video.Approver.username : 'Pending'}</td>
                    <td>${new Date(video.createdAt).toLocaleString()}</td>
                </tr>
            `).join('');
            
            document.querySelector('#userVideosModal .modal-title').textContent = 
                `Videos by ${username}`;
            
            new bootstrap.Modal(document.getElementById('userVideosModal')).show();
        }
    } catch (error) {
        console.error('Error loading user videos:', error);
        showAlert('Failed to load user videos', 'danger');
    }
}

async function toggleUserStatus(userId, currentStatus) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/status`, {
            method: 'PUT',
            headers: auth.getHeaders()
        });

        const result = await response.json();

        if (result.status === 'success') {
            loadUsers();
            showAlert('User status updated successfully', 'success');
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        console.error('Error toggling user status:', error);
        showAlert('Failed to update user status', 'danger');
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: auth.getHeaders()
        });

        const result = await response.json();

        if (result.status === 'success') {
            loadUsers();
            showAlert('User deleted successfully', 'success');
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showAlert('Failed to delete user', 'danger');
    }
}

let currentVideoId = null;

let currentPage = 1;
let totalPages = 1;

async function loadVideos(page = 1, search = '', status = '') {
    try {
        const response = await fetch(`/api/admin/videos/all?page=${page}&search=${search}&status=${status}`, {
            headers: auth.getHeaders()
        });

        if (!response.ok) throw new Error('Failed to fetch videos');
        
        const data = await response.json();
        const tbody = document.querySelector('#videosTable tbody');
        
        if (!tbody) {
            console.warn('Videos table not found');
            return;
        }

        currentPage = data.data.currentPage;
        totalPages = data.data.pages;
        
        tbody.innerHTML = data.data.videos.map(video => `
            <tr>
                <td>${video.id}</td>
                <td>${video.title}</td>
                <td>${video.author?.username || 'Unknown'}</td>
                <td>
                    <span class="badge bg-${getStatusColor(video.status)}">
                        ${video.status}
                    </span>
                </td>
                <td>${video.views || 0}</td>
                <td>${formatDate(video.createdAt)}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-primary" onclick="viewVideoDetails(${video.id})">
                            View
                        </button>
                        <button class="btn btn-${video.status === 'approved' ? 'warning' : 'success'}"
                                onclick="updateVideoStatus(${video.id}, '${video.status === 'approved' ? 'pending' : 'approved'}')">
                            ${video.status === 'approved' ? 'Unapprove' : 'Approve'}
                        </button>
                        <button class="btn btn-danger" onclick="deleteVideo(${video.id})">
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        updatePagination();
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load videos', 'danger');
    }
}

function updatePagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    let html = `
        <nav>
            <ul class="pagination">
                <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                    <a class="page-link" href="#" onclick="loadVideos(${currentPage - 1})">Previous</a>
                </li>
    `;

    for (let i = 1; i <= totalPages; i++) {
        html += `
            <li class="page-item ${currentPage === i ? 'active' : ''}">
                <a class="page-link" href="#" onclick="loadVideos(${i})">${i}</a>
            </li>
        `;
    }

    html += `
                <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                    <a class="page-link" href="#" onclick="loadVideos(${currentPage + 1})">Next</a>
                </li>
            </ul>
        </nav>
    `;

    pagination.innerHTML = html;
}

function searchVideos() {
    const search = document.getElementById('videoSearch').value;
    const status = document.getElementById('statusFilter').value;
    loadVideos(1, search, status);
}

async function viewVideoDetails(id) {
    try {
        const response = await fetch(`/api/admin/videos/${id}`, {
            headers: auth.getHeaders()
        });

        if (!response.ok) throw new Error('Failed to fetch video details');
        
        const data = await response.json();
        // Implement your video details view here
        // You might want to show this in a modal or navigate to a details page
        console.log('Video details:', data.video);
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load video details', 'danger');
    }
}

async function updateVideoStatus(videoId, status) {
    try {
        const reason = status === 'rejected' ? 
            document.getElementById('rejectionReason').value : null;

        const response = await fetch(`/api/admin/videos/${videoId}/status`, {
            method: 'PUT',
            headers: {
                ...auth.getHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status, reason })
        });

        const result = await response.json();

        if (result.status === 'success') {
            bootstrap.Modal.getInstance(document.getElementById('videoPreviewModal')).hide();
            loadVideos();
            showAlert('Video status updated successfully', 'success');
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        console.error('Error updating video status:', error);
        showAlert('Failed to update video status', 'danger');
    }
}

async function deleteVideo(videoId) {
    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/videos/${videoId}`, {
            method: 'DELETE',
            headers: auth.getHeaders()
        });

        const result = await response.json();

        if (result.status === 'success') {
            loadVideos();
            showAlert('Video deleted successfully', 'success');
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        console.error('Error deleting video:', error);
        showAlert('Failed to delete video', 'danger');
    }
}

async function loadSettings() {
    try {
        const response = await fetch('/api/admin/settings', {
            headers: auth.getHeaders()
        });
        const data = await response.json();
        
        if (data.status === 'success') {
            // Fill profile form
            document.getElementById('profileUsername').value = data.data.settings.username;
            document.getElementById('profileEmail').value = data.data.settings.email;

            // Set permissions
            const permissions = data.data.settings.permissions;
            document.getElementById('canViewApproved').checked = permissions.canViewApproved;
            document.getElementById('canViewPending').checked = permissions.canViewPending;
            document.getElementById('canManageApprovers').checked = permissions.canManageApprovers;
            document.getElementById('canManageUsers').checked = permissions.canManageUsers;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        showAlert('Failed to load settings', 'danger');
    }
}

function initializeSettingsPage() {
    // Profile form submission
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData(e.target);
            const response = await fetch('/api/admin/profile', {
                method: 'PUT',
                headers: {
                    ...auth.getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(Object.fromEntries(formData))
            });

            const result = await response.json();
            if (result.status === 'success') {
                showAlert('Profile updated successfully', 'success');
            } else {
                showAlert(result.message, 'danger');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showAlert('Failed to update profile', 'danger');
        }
    });

    // Password form submission
    document.getElementById('passwordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        if (formData.get('newPassword') !== formData.get('confirmPassword')) {
            showAlert('New passwords do not match', 'danger');
            return;
        }

        try {
            const response = await fetch('/api/admin/password', {
                method: 'PUT',
                headers: {
                    ...auth.getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    currentPassword: formData.get('currentPassword'),
                    newPassword: formData.get('newPassword')
                })
            });

            const result = await response.json();
            if (result.status === 'success') {
                showAlert('Password updated successfully', 'success');
                e.target.reset();
            } else {
                showAlert(result.message, 'danger');
            }
        } catch (error) {
            console.error('Error updating password:', error);
            showAlert('Failed to update password', 'danger');
        }
    });

    // Permissions form submission
    document.getElementById('permissionsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const permissions = {
                canViewApproved: document.getElementById('canViewApproved').checked,
                canViewPending: document.getElementById('canViewPending').checked,
                canManageApprovers: document.getElementById('canManageApprovers').checked,
                canManageUsers: document.getElementById('canManageUsers').checked
            };

            const response = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: {
                    ...auth.getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ permissions })
            });

            const result = await response.json();
            if (result.status === 'success') {
                showAlert('Permissions updated successfully', 'success');
            } else {
                showAlert(result.message, 'danger');
            }
        } catch (error) {
            console.error('Error updating permissions:', error);
            showAlert('Failed to update permissions', 'danger');
        }
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Set current user
    const user = auth.getUser();
    if (user) {
        document.getElementById('currentUser').textContent = user.username;
    }

    // Load default page
    const hash = window.location.hash.slice(1);
    loadPage(hash || 'overview');

    // Add search input event listener
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', debounce(loadUsers, 300));
    }
});

// Initialize the dashboard
loadPage('overview');

async function loadCategories() {
    try {
        const response = await fetch('/api/admin/categories', {
            headers: auth.getHeaders()
        });
        const data = await response.json();
        
        if (data.status === 'success') {
            const categoriesList = document.getElementById('categoriesTableBody');
            categoriesList.innerHTML = data.data.categories.map(category => `
                <tr>
                    <td>${category.name}</td>
                    <td>${category.videosCount}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-primary" onclick="editCategory('${category.id}')">
                                Edit
                            </button>
                            <button class="btn btn-danger" onclick="deleteCategory('${category.id}')">
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        showAlert('Failed to load categories', 'danger');
    }
}

async function loadReports() {
    try {
        const status = document.getElementById('reportStatusFilter').value;
        const response = await fetch(`/api/admin/reports?status=${status}`, {
            headers: auth.getHeaders()
        });
        const data = await response.json();
        
        if (data.status === 'success') {
            const reportsList = document.getElementById('reportsList');
            reportsList.innerHTML = data.data.reports.map(report => `
                <tr>
                    <td>${report.contentTitle}</td>
                    <td>${report.reason}</td>
                    <td>${report.reportedBy}</td>
                    <td>
                        <span class="badge bg-${
                            report.status === 'pending' ? 'warning' :
                            report.status === 'resolved' ? 'success' : 'secondary'
                        }">
                            ${report.status}
                        </span>
                    </td>
                    <td>${new Date(report.createdAt).toLocaleDateString()}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-primary" onclick="viewReport('${report.id}')">
                                View
                            </button>
                            <button class="btn btn-success" onclick="resolveReport('${report.id}')">
                                Resolve
                            </button>
                            <button class="btn btn-danger" onclick="dismissReport('${report.id}')">
                                Dismiss
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading reports:', error);
        showAlert('Failed to load reports', 'danger');
    }
}

async function loadLogs() {
    try {
        const date = document.getElementById('logDateFilter').value;
        const type = document.getElementById('logTypeFilter').value;
        const response = await fetch(`/api/admin/logs?date=${date}&type=${type}`, {
            headers: auth.getHeaders()
        });
        const data = await response.json();
        
        if (data.status === 'success') {
            const logsList = document.getElementById('logsTableBody');
            logsList.innerHTML = data.data.logs.map(log => `
                <tr>
                    <td>${log.event}</td>
                    <td>${log.user}</td>
                    <td>${new Date(log.timestamp).toLocaleString()}</td>
                    <td>${log.details}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading logs:', error);
        showAlert('Failed to load logs', 'danger');
    }
}

// Add event listeners for navigation
document.addEventListener('DOMContentLoaded', () => {
    // Handle navigation clicks
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.currentTarget.dataset.page;
            loadPage(page);
        });
    });

    // Load initial page
    const hash = window.location.hash.slice(1);
    loadPage(hash || 'overview');
});

function showError(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.container-fluid').prepend(alertDiv);
} 