// ============ API Configuration ============
const API_BASE = 'http://localhost:8080/api';
let allVideos = [];
let currentVideoId = null;
let currentCategory = 'all';
let searchTerm = '';
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

// ============ Auth Functions ============
function checkAuth() {
    if (!authToken) {
        showToast('Please login first!', 'error');
        return false;
    }
    return true;
}

async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            const data = await response.json();
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            currentUser = { username, id: data.userId };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateUserUI();
            closeLoginModal();
            showToast('Login successful!', 'success');
            loadVideos();
        } else {
            const error = await response.text();
            showToast('Login failed: ' + error, 'error');
        }
    } catch (error) {
        showToast('Login error', 'error');
    }
}

async function register() {
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        if (response.ok) {
            showToast('Registration successful! Please login.', 'success');
            showLogin();
        } else {
            const error = await response.text();
            showToast('Registration failed: ' + error, 'error');
        }
    } catch (error) {
        showToast('Registration error', 'error');
    }
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    authToken = null;
    currentUser = null;
    updateUserUI();
    showToast('Logged out', 'success');
    loadVideos();
}

function updateUserUI() {
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.username;
        document.getElementById('userEmail').textContent = currentUser.username;
        document.getElementById('userAvatar').textContent = currentUser.username.charAt(0).toUpperCase();
    } else {
        document.getElementById('userName').textContent = 'Guest';
        document.getElementById('userEmail').textContent = 'Not logged in';
        document.getElementById('userAvatar').textContent = '👤';
    }
}

function showLogin() {
    closeRegisterModal();
    document.getElementById('loginModal').style.display = 'flex';
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

function showRegister() {
    closeLoginModal();
    document.getElementById('registerModal').style.display = 'flex';
}

function closeRegisterModal() {
    document.getElementById('registerModal').style.display = 'none';
}

// ============ Video Player Functions ============
async function playVideo(videoId, title) {
    currentVideoId = videoId;
    try {
        const response = await fetch(`${API_BASE}/videos/${videoId}/stream`);
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            document.getElementById('videoPlayer').src = url;
            document.getElementById('playerInfo').innerHTML = `<h3>${escapeXml(title)}</h3>`;
            document.getElementById('videoPlayerModal').style.display = 'flex';
            document.getElementById('videoPlayer').play();
            if (authToken) {
                loadLikes(videoId);
                loadComments(videoId);
            }
        }
    } catch (error) {
        showToast('Error playing video', 'error');
    }
}

async function likeVideo() {
    if (!checkAuth()) return;
    try {
        const response = await fetch(`${API_BASE}/videos/${currentVideoId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) {
            const error = await response.text();
            showToast('Error: ' + error, 'error');
            return;
        }
        loadLikes(currentVideoId);
    } catch (error) {
        showToast('Error liking video', 'error');
    }
}

async function dislikeVideo() {
    if (!checkAuth()) return;
    try {
        const response = await fetch(`${API_BASE}/videos/${currentVideoId}/dislike`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) {
            const error = await response.text();
            showToast('Error: ' + error, 'error');
            return;
        }
        loadLikes(currentVideoId);
    } catch (error) {
        showToast('Error disliking video', 'error');
    }
}

async function loadLikes(videoId) {
    try {
        const response = await fetch(`${API_BASE}/videos/${videoId}/likes`);
        const data = await response.json();
        document.getElementById('likeCount').textContent = data.likes;
        document.getElementById('dislikeCount').textContent = data.dislikes;
    } catch (error) {
        console.error('Error loading likes:', error);
    }
}

async function loadComments(videoId) {
    try {
        const response = await fetch(`${API_BASE}/videos/${videoId}/comments`);
        const comments = await response.json();
        const commentsList = document.getElementById('commentsList');
        if (comments.length === 0) {
            commentsList.innerHTML = '<div style="color: #aaa;">No comments yet.</div>';
        } else {
            commentsList.innerHTML = comments.map(c => `
                    <div class="comment-item">
                        <div class="comment-user">${c.userId.substring(0, 8)}...</div>
                        <div class="comment-text">${c.content}</div>
                        <div class="comment-date">${new Date(c.createdAt).toLocaleString()}</div>
                    </div>
                `).join('');
        }
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

async function addComment() {
    if (!checkAuth()) return;
    const content = document.getElementById('commentInput').value;
    if (!content.trim()) return;

    try {
        const response = await fetch(`${API_BASE}/videos/${currentVideoId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ content })
        });
        if (response.ok) {
            document.getElementById('commentInput').value = '';
            loadComments(currentVideoId);
            showToast('Comment added!', 'success');
        } else {
            const error = await response.text();
            showToast('Error: ' + error, 'error');
        }
    } catch (error) {
        showToast('Error adding comment', 'error');
    }
}

// ============ Upload Functions ============
let selectedFile = null;

function openUploadModal() {
    if (!checkAuth()) return;
    document.getElementById('uploadModal').style.display = 'flex';
}

function closeUploadModal() {
    document.getElementById('uploadModal').style.display = 'none';
    selectedFile = null;
}

async function uploadFile() {
    if (!selectedFile) {
        showToast('Select a file first', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('userId', currentUser?.id || '123e4567-e89b-12d3-a456-426614174000');

    showToast('Uploading...', 'success');

    try {
        const response = await fetch(`${API_BASE}/videos/upload`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            showToast('Uploaded! Processing...', 'success');
            closeUploadModal();
            refreshVideos();
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        showToast('Upload failed', 'error');
    }
}

// ============ Thumbnail & Display Functions ============
function getThumbnail(video) {
    // Use actual thumbnail if available, otherwise fallback to SVG
    if (video.thumbnailPath) {
        return `${API_BASE}/videos/${video.id}/thumbnail`;
    }
    
    const colors = ['#667eea', '#e50914', '#4caf50', '#2196f3', '#ff9800', '#9c27b0', '#f44336', '#00bcd4'];
    const colorIndex = Math.abs(hashCode(video.id) % colors.length);
    const color = colors[colorIndex];

    let icon = '🎬';
    if (video.status === 'APPROVED') icon = '✅';
    else if (video.status === 'PENDING_AI') icon = '⏳';
    else if (video.status === 'REJECTED') icon = '❌';
    else if (video.status === 'PUBLISHED') icon = '▶️';
    else if (video.status === 'PROCESSING') icon = '⚙️';

    let displayName = video.originalFilename.replace(/\.[^/.]+$/, '').substring(0, 25);
    if (displayName.length === 0) displayName = 'Video';

    const svg = `<?xml version="1.0" encoding="utf-8"?>
<svg width="400" height="225" viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="225" fill="${color}"/>
    <text x="200" y="95" font-family="Arial, sans-serif" font-size="52" text-anchor="middle" dominant-baseline="middle" fill="white">${icon}</text>
    <text x="200" y="140" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="white">${escapeXml(displayName)}</text>
    <text x="200" y="165" font-family="Arial, sans-serif" font-size="11" text-anchor="middle" dominant-baseline="middle" fill="rgba(255,255,255,0.7)">${video.aiLabel || 'Processing...'}</text>
</svg>`;

    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function escapeXml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function getStatusBadge(status) {
    return `<span class="status-badge status-${status.toLowerCase()}">${status}</span>`;
}

function displayVideos(videos) {
    const container = document.getElementById('videosContainer');
    if (videos.length === 0) {
        container.innerHTML = '<div class="loading">No videos found</div>';
        return;
    }

    let html = '<div class="videos-grid">';
    for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        const videoId = video.id;
        const filename = (video.originalFilename || 'Video').replace(/'/g, "\\'");
        html += '<div class="video-card" data-video-id="' + videoId + '" data-video-title="' + escapeXml(filename) + '">' +
            '<div class="video-thumbnail">' +
                '<img src="' + getThumbnail(video) + '" alt="' + escapeXml(video.originalFilename || 'Video') + '">' +
                '<div class="play-overlay"></div>' +
                '<div class="preview-overlay"></div>' +
                getStatusBadge(video.status) +
            '</div>' +
            '<div class="video-info">' +
                '<div class="video-title">' + escapeXml(video.originalFilename || 'Video') + '</div>' +
                '<div class="video-meta">' +
                    '<span>👤 ' + video.userId.substring(0, 8) + '...</span>' +
                    '<span>📅 ' + new Date(video.createdAt).toLocaleDateString() + '</span>' +
                '</div>' +
                (video.aiLabel ? '<div style="font-size: 11px; color: #888;">🏷️ ' + escapeXml(video.aiLabel) + '</div>' : '') +
            '</div>' +
        '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
    
    // Add click event listeners properly
    setTimeout(() => {
        const cards = container.querySelectorAll('.video-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const videoId = card.getAttribute('data-video-id');
                const title = card.getAttribute('data-video-title');
                playVideo(videoId, title);
            });
        });
    }, 0);
}

function filterAndDisplayVideos() {
    let filtered = [...allVideos];
    if (searchTerm) {
        filtered = filtered.filter(v =>
            v.originalFilename.toLowerCase().includes(searchTerm) ||
            (v.aiLabel && v.aiLabel.toLowerCase().includes(searchTerm))
        );
    }
    if (currentCategory === 'trending') {
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        filtered = filtered.slice(0, 10);
    }
    displayVideos(filtered);
}

function searchVideos() {
    searchTerm = document.getElementById('searchInput').value.toLowerCase();
    filterAndDisplayVideos();
}

function showCategory(category) {
    currentCategory = category;
    const titles = { all: '🎬 All Videos', trending: '🔥 Trending Now' };
    document.getElementById('sectionTitle').textContent = titles[category] || '🎬 Videos';
    filterAndDisplayVideos();
}

async function loadVideos() {
    try {
        const response = await fetch(`${API_BASE}/videos/all`);
        if (!response.ok) throw new Error('Failed to fetch');
        allVideos = await response.json();
        allVideos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        filterAndDisplayVideos();
    } catch (error) {
        console.error('Error loading videos:', error);
        document.getElementById('videosContainer').innerHTML = '<div class="loading">❌ Error loading videos. Make sure the backend is running on port 8080.</div>';
    }
}

function refreshVideos() {
    loadVideos();
    showToast('Refreshed!', 'success');
}

function closeVideoPlayer() {
    document.getElementById('videoPlayerModal').style.display = 'none';
    document.getElementById('videoPlayer').pause();
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function toggleProfileDropdown() {
    document.getElementById('profileDropdown').classList.toggle('show');
}

// ============ Drag and Drop ============
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    selectedFile = e.dataTransfer.files[0];
    showToast(`Selected: ${selectedFile.name}`, 'success');
});

fileInput.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) showToast(`Selected: ${selectedFile.name}`, 'success');
});

// ============ YouTube-like Hover Preview ============
let hoverTimers = {};
let previewActive = {};
let hoverVideoElements = {};

document.addEventListener('mouseover', (e) => {
    const videoCard = e.target.closest('.video-card');
    if (!videoCard) return;
    
    const videoId = videoCard.getAttribute('data-video-id');
    if (!videoId || previewActive[videoId]) return;
    
    // Clear any existing timer for this card
    if (hoverTimers[videoId]) clearTimeout(hoverTimers[videoId]);
    
    // Start hover timer (YouTube-like: 500ms delay before preview)
    hoverTimers[videoId] = setTimeout(async () => {
        previewActive[videoId] = true;
        videoCard.classList.add('hover-preview');
        
        // Create a hidden video element for preview
        const thumbnail = videoCard.querySelector('.video-thumbnail');
        if (thumbnail && !hoverVideoElements[videoId]) {
            const videoPreview = document.createElement('video');
            videoPreview.src = `${API_BASE}/videos/${videoId}/stream`;
            videoPreview.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:1;';
            videoPreview.muted = true;
            videoPreview.playsInline = true;
            
            // Replace image with video preview
            const img = thumbnail.querySelector('img');
            if (img) {
                img.style.display = 'none';
            }
            thumbnail.appendChild(videoPreview);
            hoverVideoElements[videoId] = videoPreview;
            
            try {
                await videoPreview.play();
            } catch (err) {
                console.log('Preview play failed:', err);
            }
        }
    }, 500);
});

document.addEventListener('mouseout', (e) => {
    const videoCard = e.target.closest('.video-card');
    if (!videoCard) return;
    
    const videoId = videoCard.getAttribute('data-video-id');
    if (!videoId) return;
    
    // Clear timer
    if (hoverTimers[videoId]) {
        clearTimeout(hoverTimers[videoId]);
        delete hoverTimers[videoId];
    }
    
    // Remove preview
    if (previewActive[videoId]) {
        previewActive[videoId] = false;
        videoCard.classList.remove('hover-preview');
        
        // Restore thumbnail image, remove video preview
        const thumbnail = videoCard.querySelector('.video-thumbnail');
        if (thumbnail) {
            const img = thumbnail.querySelector('img');
            if (img) img.style.display = 'block';
            
            if (hoverVideoElements[videoId]) {
                hoverVideoElements[videoId].pause();
                hoverVideoElements[videoId].remove();
                delete hoverVideoElements[videoId];
            }
        }
    }
});

// Click outside to close dropdown
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('profileDropdown');
    const profile = document.querySelector('.user-profile');
    if (dropdown && profile && !profile.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});

// ============ Initialize ============
const searchInput = document.getElementById('searchInput');

// Clear search bar immediately and repeatedly to defeat browser autofill
searchInput.value = '';
searchInput.blur();
searchTerm = '';

// Clear multiple times with increasing delays
setTimeout(() => { searchInput.value = ''; searchTerm = ''; }, 0);
setTimeout(() => { searchInput.value = ''; searchTerm = ''; }, 50);
setTimeout(() => { searchInput.value = ''; searchTerm = ''; }, 100);
setTimeout(() => { searchInput.value = ''; searchTerm = ''; }, 300);
setTimeout(() => { searchInput.value = ''; searchTerm = ''; }, 500);
setTimeout(() => { searchInput.value = ''; searchTerm = ''; }, 1000);
setTimeout(() => { searchInput.value = ''; searchTerm = ''; }, 2000);
setTimeout(() => { searchInput.value = ''; searchTerm = ''; }, 5000);

loadVideos();
if (!authToken) showLogin();
else updateUserUI();
setInterval(loadVideos, 15000);
