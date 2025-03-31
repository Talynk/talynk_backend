// Check authentication
const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'approver') {
    window.location.href = '/login.html';
}

// API headers
const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
};

let currentVideoId = null;

// Load dashboard stats
async function loadDashboardStats() {
    try {
        const response = await fetch('/api/approver/stats', { headers });
        const data = await response.json();
        
        if (data.status === 'success') {
            const stats = data.data;
            document.getElementById('statsCards').innerHTML = `
                <div class="col-md-4">
                    <div class="stats-card">
                        <h3>${stats.pendingCount}</h3>
                        <p>Pending Videos</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="stats-card">
                        <h3>${stats.approvedCount}</h3>
                        <p>Videos Approved</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="stats-card">
                        <h3>${stats.todayCount}</h3>
                        <p>Approved Today</p>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load pending videos
async function loadPendingVideos() {
    try {
        const response = await fetch('/api/approver/posts/pending', { headers });
        const data = await response.json();
        
        if (data.status === 'success') {
            const videosHTML = data.data.posts.map(video => `
                <div class="col-md-6 col-lg-4">
                    <div class="card video-card">
                        <div class="card-body">
                            <h5 class="card-title">${video.title}</h5>
                            <p class="card-text">
                                <small>Uploaded by: ${video.uploaderID}</small><br>
                                <small>Date: ${new Date(video.uploadDate).toLocaleDateString()}</small>
                            </p>
                            <button class="btn btn-primary" onclick="reviewVideo('${video.uniqueTraceability_id}')">
                                Review
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
            
            document.getElementById('pendingVideos').innerHTML = videosHTML;
        }
    } catch (error) {
        console.error('Error loading pending videos:', error);
    }
}

// Load approved videos
async function loadApprovedVideos() {
    const date = document.getElementById('dateFilter').value;
    const search = document.getElementById('searchFilter').value;
    
    try {
        const response = await fetch(`/api/approver/posts/approved?date=${date}&search=${search}`, { headers });
        const data = await response.json();
        
        if (data.status === 'success') {
            const videosHTML = data.data.posts.map(video => `
                <div class="col-md-6 col-lg-4">
                    <div class="card video-card">
                        <div class="card-body">
                            <h5 class="card-title">${video.title}</h5>
                            <p class="card-text">
                                <small>Approved on: ${new Date(video.approvedDate).toLocaleDateString()}</small><br>
                                <small>Uploaded by: ${video.uploaderID}</small>
                            </p>
                            <button class="btn btn-info" onclick="viewVideo('${video.uniqueTraceability_id}')">
                                View
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
            
            document.getElementById('approvedVideos').innerHTML = videosHTML;
        }
    } catch (error) {
        console.error('Error loading approved videos:', error);
    }
}

// Load notifications
async function loadNotifications() {
    try {
        const response = await fetch('/api/approver/notifications', { headers });
        const data = await response.json();
        
        if (data.status === 'success') {
            const notificationsHTML = data.data.notifications.map(notification => `
                <div class="list-group-item">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${notification.notification_text}</h6>
                        <small>${new Date(notification.notification_date).toLocaleDateString()}</small>
                    </div>
                </div>
            `).join('');
            
            document.getElementById('notificationsList').innerHTML = notificationsHTML;
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Review video
async function reviewVideo(videoId) {
    try {
        const response = await fetch(`/api/approver/posts/${videoId}`, { headers });
        const data = await response.json();
        
        if (data.status === 'success') {
            currentVideoId = videoId;
            const video = data.data.post;
            
            // Update modal content
            document.querySelector('.video-container').innerHTML = `
                <video class="video-preview" controls>
                    <source src="${video.video_url}" type="video/mp4">
                </video>
            `;
            
            document.querySelector('.video-details').innerHTML = `
                <h5>${video.title}</h5>
                <p>${video.caption || 'No caption provided'}</p>
                <p><small>Category: ${video.post_category}</small></p>
                <p><small>Uploaded by: ${video.uploaderID}</small></p>
            `;
            
            // Show modal
            new bootstrap.Modal(document.getElementById('videoReviewModal')).show();
        }
    } catch (error) {
        console.error('Error loading video details:', error);
    }
}

// Approve video
async function approveVideo() {
    if (!currentVideoId) return;
    
    try {
        const response = await fetch(`/api/approver/posts/${currentVideoId}/approve`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                notes: document.getElementById('reviewNotes').value
            })
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('videoReviewModal')).hide();
            // Refresh pending videos
            loadPendingVideos();
            // Refresh stats
            loadDashboardStats();
        }
    } catch (error) {
        console.error('Error approving video:', error);
    }
}

// Reject video
async function rejectVideo() {
    if (!currentVideoId) return;
    
    try {
        const response = await fetch(`/api/approver/posts/${currentVideoId}/reject`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                notes: document.getElementById('reviewNotes').value
            })
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('videoReviewModal')).hide();
            // Refresh pending videos
            loadPendingVideos();
            // Refresh stats
            loadDashboardStats();
        }
    } catch (error) {
        console.error('Error rejecting video:', error);
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
            case 'pending':
                loadPendingVideos();
                break;
            case 'approved':
                loadApprovedVideos();
                break;
            case 'notifications':
                loadNotifications();
                break;
        }
    });
});

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
});

// Event listeners for filters
document.getElementById('dateFilter')?.addEventListener('change', loadApprovedVideos);
document.getElementById('searchFilter')?.addEventListener('input', loadApprovedVideos); 