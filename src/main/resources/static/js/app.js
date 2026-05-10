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
            loadSaved();
            loadHistory();
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
    const loggedIn = !!currentUser;
    // Navbar avatar
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    // Dropdown elements
    const dropdownAvatar = document.getElementById('dropdownAvatar');
    const dropdownUserName = document.getElementById('dropdownUserName');
    const userEmail = document.getElementById('userEmail');
    const myChannelLink = document.getElementById('myChannelLink');
    const loginSignupLink = document.getElementById('loginSignupLink');
    const logoutLink = document.getElementById('logoutLink');

    if (loggedIn) {
        const initial = currentUser.username.charAt(0).toUpperCase();
        userName.textContent = currentUser.username;
        if (userEmail) userEmail.textContent = currentUser.username;
        if (dropdownUserName) dropdownUserName.textContent = currentUser.username;

        // Try to load avatar image
        const userId = currentUser.id;
        const avatarUrl = `${API_BASE}/auth/users/${userId}/avatar`;

        [userAvatar, dropdownAvatar].forEach(el => {
            if (!el) return;
            el.innerHTML = `<img src="${avatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.parentElement.textContent='${initial}';this.parentElement.style.background='#667eea'">`;
            el.style.background = 'none';
        });

        if (myChannelLink) myChannelLink.style.display = '';
        if (loginSignupLink) loginSignupLink.style.display = 'none';
        if (logoutLink) logoutLink.style.display = '';
    } else {
        userName.textContent = 'Guest';
        if (userEmail) userEmail.textContent = 'Not logged in';
        if (dropdownUserName) dropdownUserName.textContent = 'Guest';
        [userAvatar, dropdownAvatar].forEach(el => {
            if (!el) { return; }
            el.textContent = '👤';
            el.style.background = 'none';
            el.innerHTML = '👤';
        });
        if (myChannelLink) myChannelLink.style.display = 'none';
        if (loginSignupLink) loginSignupLink.style.display = '';
        if (logoutLink) logoutLink.style.display = 'none';
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
            document.getElementById('playerInfo').dataset.channelId = ''; // Will be set from video data
            document.getElementById('videoPlayerModal').style.display = 'flex';
            document.getElementById('videoPlayer').play();
            
            // Set channel info
            const video = allVideos.find(v => v.id === videoId);
            if (video) {
                const channelId = video.userId;
                document.getElementById('playerInfo').dataset.channelId = channelId;
                document.getElementById('channelName').textContent = channelId.substring(0, 8) + '...';
                document.getElementById('channelAvatar').textContent = channelId.charAt(0).toUpperCase();
                loadSubscriberCount(channelId);
                if (authToken) {
                    checkSubscriptionStatus(channelId);
                    loadLikes(videoId);
                    loadComments(videoId);
                }
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

async function addComment(videoId, content) {
    try {
        const token = localStorage.getItem('authToken'); // Or replace with session storage
        const response = await fetch(`${API_BASE}/videos/${videoId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ content })
        });

        if (response.ok) {
            const newComment = await response.json();
            const commentsList = document.getElementById('commentsList');
            const commentHTML = `
                <div class="comment-item">
                    <div class="comment-user">${newComment.userId.substring(0, 8)}...</div>
                    <div class="comment-text">${newComment.content}</div>
                    <div class="comment-date">${new Date(newComment.createdAt).toLocaleString()}</div>
                </div>
            `;
            commentsList.insertAdjacentHTML('beforeend', commentHTML);
        } else {
            console.error(await response.json());
        }
    } catch (error) {
        console.error('Error adding comment:', error);
    }
}

function addCommentButtonListener() {
    const commentButton = document.getElementById('commentButton');
    if (commentButton) {
        if (!commentButton.dataset.listenerAdded) {
            commentButton.addEventListener('click', () => {
                const videoId = currentVideoId;
                const content = document.getElementById('commentInput').value.trim();
                if (content) {
                    addComment(videoId, content);
                    document.getElementById('commentInput').value = '';
                }
            });
            commentButton.dataset.listenerAdded = 'true';
        }
    }
}

// Ensure listener is added on DOMContentLoaded
document.addEventListener('DOMContentLoaded', addCommentButtonListener);

// Watch for dynamic addition of the button
(function handleDynamicButtonDetection() {
    const dynamicObserver = new MutationObserver(() => {
        const commentButton = document.getElementById('commentButton');
        if (commentButton) {
            addCommentButtonListener();
            dynamicObserver.disconnect(); // Stop observing once the button is found
        }
    });
    dynamicObserver.observe(document.body, { childList: true, subtree: true });
})();

function toggleProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
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

// ============ Saved / History ============

async function loadSaved() {
    const section = document.getElementById('savedSection');
    if (!section) return;
    if (!authToken) { section.style.display = 'none'; return; }
    const container = document.getElementById('savedContainer');
    try {
        const res = await fetch(`${API_BASE}/videos/saved`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            const saved = await res.json();
            if (saved.length === 0) {
                section.style.display = 'none';
            } else {
                section.style.display = 'block';
                container.innerHTML = '<div class="videos-grid">' + saved.map(v => `
                    <div class="video-card" onclick="window.location.href='watch.html?id=${v.videoId}'">
                        <div class="video-thumbnail">
                            <img src="${getThumbnail({id: v.videoId, thumbnailPath: v.thumbnailPath, originalFilename: v.videoTitle})}" alt="${escapeXml(v.videoTitle || 'Video')}">
                            <div class="play-overlay"></div>
                        </div>
                        <div class="video-info">
                            <div class="video-title">${escapeXml(v.videoTitle || 'Video')}</div>
                            <div class="channel-row" onclick="event.stopPropagation();window.location.href='profile.html?userId=${v.uploaderUserId}'">
                                <div class="channel-avatar" style="background:${v.avatarColor || '#667eea'}">${channelAvatarHtml(v)}</div>
                                <span class="channel-name">${escapeXml(v.username || 'Unknown')}</span>
                            </div>
                            <div class="video-meta"><span>Saved</span></div>
                        </div>
                    </div>
                `).join('') + '</div>';
            }
        } else {
            section.style.display = 'none';
        }
    } catch (e) { section.style.display = 'none'; }
}

async function loadHistory() {
    const section = document.getElementById('historySection');
    if (!section) return;
    if (!authToken) { section.style.display = 'none'; return; }
    const container = document.getElementById('historyContainer');
    try {
        const res = await fetch(`${API_BASE}/videos/history`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            const history = await res.json();
            if (history.length === 0) {
                section.style.display = 'none';
            } else {
                section.style.display = 'block';
                container.innerHTML = '<div class="videos-grid">' + history.map(v => `
                    <div class="video-card" onclick="window.location.href='watch.html?id=${v.videoId}'">
                        <div class="video-thumbnail">
                            <img src="${getThumbnail({id: v.videoId, thumbnailPath: v.thumbnailPath, originalFilename: v.videoTitle})}" alt="${escapeXml(v.videoTitle || 'Video')}">
                            <div class="play-overlay"></div>
                        </div>
                        <div class="video-info">
                            <div class="video-title">${escapeXml(v.videoTitle || 'Video')}</div>
                            <div class="channel-row" onclick="event.stopPropagation();window.location.href='profile.html?userId=${v.uploaderUserId}'">
                                <div class="channel-avatar" style="background:${v.avatarColor || '#667eea'}">${channelAvatarHtml(v)}</div>
                                <span class="channel-name">${escapeXml(v.username || 'Unknown')}</span>
                            </div>
                            <div class="video-meta"><span>Watched</span></div>
                        </div>
                    </div>
                `).join('') + '</div>';
            }
        } else {
            section.style.display = 'none';
        }
    } catch (e) { section.style.display = 'none'; }
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
    const titleInput = document.getElementById('uploadTitle');
    if (titleInput) titleInput.value = '';
    const descInput = document.getElementById('uploadDescription');
    if (descInput) descInput.value = '';
}

async function uploadFile() {
    if (!selectedFile) {
        showToast('Select a file first', 'error');
        return;
    }
    const titleInput = document.getElementById('uploadTitle');
    const title = titleInput ? titleInput.value.trim() : '';
    if (!title) {
        showToast('Please enter a video title', 'error');
        titleInput?.focus();
        return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', title);
    formData.append('userId', currentUser?.id || '123e4567-e89b-12d3-a456-426614174000');
    const descInput = document.getElementById('uploadDescription');
    if (descInput && descInput.value.trim()) {
        formData.append('description', descInput.value.trim());
    }
    const privacyInput = document.getElementById('uploadPrivacy');
    if (privacyInput) {
        formData.append('privacy', privacyInput.value);
    }

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

function getDisplayTitle(video) {
    return video.title || video.originalFilename || 'Video';
}

function channelAvatarHtml(item) {
    const name = item.username || '?';
    const initial = name.charAt(0).toUpperCase();
    const color = item.avatarColor || '#667eea';
    const uploaderId = item.uploaderUserId || item.userId;
    if (item.avatarPath) {
        return `<img src="${API_BASE}/auth/users/${uploaderId}/avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.style.display='none';this.parentElement.innerHTML='${initial}';this.parentElement.style.background='${color}'">`;
    }
    return initial;
}

function displayVideos(videos) {
    const container = document.getElementById('videosContainer');
    if (!container) return;
    if (videos.length === 0) {
        container.innerHTML = '<div class="loading">No videos found</div>';
        return;
    }

    let html = '<div class="videos-grid">';
    for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        const videoId = video.id;
        const displayTitle = getDisplayTitle(video);
        const filename = (displayTitle).replace(/'/g, "\\'");
        html += '<div class="video-card" data-video-id="' + videoId + '" data-video-title="' + escapeXml(filename) + '">' +
            '<div class="video-thumbnail">' +
                '<img src="' + getThumbnail(video) + '" alt="' + escapeXml(displayTitle) + '">' +
                '<div class="play-overlay"></div>' +
                '<div class="preview-overlay"></div>' +
                getStatusBadge(video.status) +
            '</div>' +
            '<div class="video-info">' +
                '<div class="video-title">' + escapeXml(displayTitle) + '</div>' +
                '<div class="channel-row" onclick="event.stopPropagation();window.location.href=\'profile.html?userId=' + video.userId + '\'">' +
                    '<div class="channel-avatar" style="background:' + (video.avatarColor || '#667eea') + '">' + channelAvatarHtml(video) + '</div>' +
                    '<span class="channel-name">' + escapeXml(video.username || 'Unknown') + '</span>' +
                '</div>' +

                '<div class="video-meta">' +
                    '<span>📅 ' + new Date(video.createdAt).toLocaleDateString() + '</span>' +
                '</div>' +
                (video.aiLabel ? '<div style="font-size: 11px; color: #888;">🏷️ ' + escapeXml(video.aiLabel) + '</div>' : '') +
            '</div>' +
        '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
    
    // Add click event listeners - navigate to watch page
    setTimeout(() => {
        const cards = container.querySelectorAll('.video-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const videoId = card.getAttribute('data-video-id');
                window.location.href = `watch.html?id=${videoId}`;
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
        const headers = {};
        if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
        const response = await fetch(`${API_BASE}/videos/all`, { headers });
        if (!response.ok) throw new Error('Failed to fetch');
        allVideos = await response.json();
        allVideos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        filterAndDisplayVideos();
    } catch (error) {
        console.error('Error loading videos:', error);
        const container = document.getElementById('videosContainer');
        if (container) container.innerHTML = '<div class="loading">❌ Error loading videos. Make sure the backend is running on port 8080.</div>';
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

if (uploadArea) {
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
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        selectedFile = e.target.files[0];
        if (selectedFile) showToast(`Selected: ${selectedFile.name}`, 'success');
    });
}

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
    const notifDropdown = document.getElementById('notificationsDropdown');
    const notifBell = document.getElementById('notificationBell');
    if (dropdown && profile && !profile.contains(event.target)) {
        dropdown.classList.remove('show');
    }
    if (notifDropdown && notifBell && !notifBell.contains(event.target) && !notifDropdown.contains(event.target)) {
        notifDropdown.classList.remove('show');
    }
});

// ============ SUBSCRIBE FUNCTIONS ============
async function subscribeChannel() {
    if (!checkAuth()) return;
    const channelId = document.getElementById('playerInfo').dataset.channelId;
    if (!channelId) return;
    
    try {
        const response = await fetch(`${API_BASE}/channels/${channelId}/subscribe`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        const btn = document.getElementById('subscribeBtn');
        if (data.subscribed) {
            btn.textContent = 'Subscribed';
            btn.classList.add('subscribed');
            showToast('Subscribed!', 'success');
        } else {
            btn.textContent = 'Subscribe';
            btn.classList.remove('subscribed');
            showToast('Unsubscribed', 'success');
        }
        loadSubscriberCount(channelId);
    } catch (error) {
        showToast('Error', 'error');
    }
}

async function checkSubscriptionStatus(channelId) {
    if (!authToken) return;
    try {
        const response = await fetch(`${API_BASE}/channels/${channelId}/is-subscribed`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        const btn = document.getElementById('subscribeBtn');
        if (data.subscribed) {
            btn.textContent = 'Subscribed';
            btn.classList.add('subscribed');
        } else {
            btn.textContent = 'Subscribe';
            btn.classList.remove('subscribed');
        }
    } catch (error) {
        console.error('Error checking subscription:', error);
    }
}

async function loadSubscriberCount(channelId) {
    try {
        const response = await fetch(`${API_BASE}/channels/${channelId}/subscribers`);
        const data = await response.json();
        document.getElementById('subscriberCount').textContent = `${data.count} subscriber${data.count !== 1 ? 's' : ''}`;
    } catch (error) {
        console.error('Error loading subscriber count:', error);
    }
}

// ============ NOTIFICATION FUNCTIONS ============
function toggleNotifications() {
    if (!checkAuth()) return;
    document.getElementById('notificationsDropdown').classList.toggle('show');
    loadNotifications();
}

async function loadNotifications() {
    if (!authToken) return;
    try {
        const response = await fetch(`${API_BASE}/notifications`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const notifications = await response.json();
        const list = document.getElementById('notificationsList');
        if (notifications.length === 0) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: #aaa;">No notifications</div>';
        } else {
            list.innerHTML = notifications.map(n => `
                <div class="notif-item ${!n.isRead ? 'unread' : ''}" onclick="markNotificationRead('${n.id}')">
                    <div class="notif-type">${n.type}</div>
                    <div class="notif-message">${n.message || 'New activity'}</div>
                    <div class="notif-time">${timeAgo(new Date(n.createdAt))}</div>
                </div>
            `).join('');
        }
        loadUnreadCount();
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

async function loadUnreadCount() {
    if (!authToken) return;
    try {
        const response = await fetch(`${API_BASE}/notifications/unread-count`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        const badge = document.getElementById('notificationBadge');
        if (data.count > 0) {
            badge.textContent = data.count > 99 ? '99+' : data.count;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading unread count:', error);
    }
}

async function markNotificationRead(id) {
    if (!authToken) return;
    try {
        await fetch(`${API_BASE}/notifications/${id}/read`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        loadNotifications();
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllNotificationsRead() {
    if (!authToken) return;
    try {
        await fetch(`${API_BASE}/notifications/read-all`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        loadNotifications();
    } catch (error) {
        console.error('Error marking all as read:', error);
    }
}

function timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

// ============ REPORT FUNCTIONS ============
function openReportModal() {
    if (!checkAuth()) return;
    document.getElementById('reportModal').style.display = 'flex';
}

function closeReportModal() {
    document.getElementById('reportModal').style.display = 'none';
}

async function submitReport() {
    if (!authToken || !currentVideoId) return;
    const reason = document.getElementById('reportReason').value;
    const description = document.getElementById('reportDescription').value;
    
    try {
        const response = await fetch(`${API_BASE}/videos/${currentVideoId}/report`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ reason, description })
        });
        
        if (response.ok) {
            showToast('Report submitted', 'success');
            closeReportModal();
        } else {
            const error = await response.json();
            showToast(error.error || 'Already reported', 'error');
        }
    } catch (error) {
        showToast('Error submitting report', 'error');
    }
}

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
if (!authToken) {
    const loginModal = document.getElementById('loginModal');
    const watchPage = document.getElementById('playerWrapper');
    if (loginModal && !watchPage) {
        showLogin();
    }
}
else updateUserUI();
loadSaved();
loadHistory();
setInterval(loadVideos, 15000);
setInterval(() => { if (authToken) { loadSaved(); loadHistory(); } }, 30000);

// ============ @Mention Autocomplete (for description fields) ============
let mentionTimeout = null;
let mentionUsers = [];
let mentionIndex = -1;

function setupMentionOnInput(input) {
    if (!input) return;
    input.addEventListener('input', function() {
        clearTimeout(mentionTimeout);
        const cursorPos = this.selectionStart;
        const text = this.value.substring(0, cursorPos);
        const match = text.match(/@(\w*)$/);
        const dropdown = document.getElementById('mentionDropdownDescription');

        if (match) {
            const term = match[1];
            mentionTimeout = setTimeout(async () => {
                try {
                    const res = await fetch(`${API_BASE}/auth/users/search?q=${encodeURIComponent(term)}`);
                    if (res.ok) {
                        mentionUsers = await res.json();
                        showMentionDropdownDesc(this, match[0]);
                    }
                } catch (e) {}
            }, 200);
        } else if (dropdown) {
            dropdown.remove();
            mentionUsers = [];
            mentionIndex = -1;
        }
    });

    input.addEventListener('keydown', function(e) {
        const dropdown = document.getElementById('mentionDropdownDescription');
        if (!dropdown) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            mentionIndex = Math.min(mentionIndex + 1, mentionUsers.length - 1);
            highlightMentionDesc();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            mentionIndex = Math.max(mentionIndex - 1, 0);
            highlightMentionDesc();
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (mentionIndex >= 0 && mentionUsers[mentionIndex]) {
                e.preventDefault();
                insertMentionDesc(this, mentionUsers[mentionIndex].username);
            }
        }
    });
}

function showMentionDropdownDesc(input, prefix) {
    let dropdown = document.getElementById('mentionDropdownDescription');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'mentionDropdownDescription';
        dropdown.style.cssText = 'position:absolute;background:#1a1a2e;border:1px solid #333;border-radius:6px;max-height:150px;overflow-y:auto;z-index:1000;min-width:180px;';
        input.parentElement.style.position = 'relative';
        input.parentElement.appendChild(dropdown);
    }
    if (mentionUsers.length === 0) {
        dropdown.innerHTML = '<div style="padding:8px 12px;color:#888;font-size:13px;">No users found</div>';
        return;
    }
    mentionIndex = 0;
    dropdown.innerHTML = mentionUsers.map((u, i) =>
        `<div class="mention-item ${i === 0 ? 'selected' : ''}" data-index="${i}" style="padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:13px;" onclick="selectMentionDesc(${i})">
            <div style="width:24px;height:24px;border-radius:50%;background:${u.avatarColor || '#667eea'};display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;flex-shrink:0;">${u.username.charAt(0).toUpperCase()}</div>
            <span>${u.username}</span>
        </div>`
    ).join('');
}

function highlightMentionDesc() {
    const dropdown = document.getElementById('mentionDropdownDescription');
    if (!dropdown) return;
    dropdown.querySelectorAll('.mention-item').forEach((el, i) => {
        el.classList.toggle('selected', i === mentionIndex);
        el.style.background = i === mentionIndex ? '#333' : 'transparent';
    });
}

function insertMentionDesc(input, username) {
    const cursorPos = input.selectionStart;
    const text = input.value;
    const before = text.substring(0, cursorPos);
    const after = text.substring(cursorPos);
    const match = before.match(/@(\w*)$/);
    if (match) {
        const newBefore = before.substring(0, before.length - match[0].length) + '@' + username + ' ';
        input.value = newBefore + after;
        const newPos = newBefore.length;
        input.setSelectionRange(newPos, newPos);
        input.focus();
    }
    const dropdown = document.getElementById('mentionDropdownDescription');
    if (dropdown) dropdown.remove();
    mentionUsers = [];
    mentionIndex = -1;
}

function selectMentionDesc(index) {
    const input = document.querySelector('#uploadDescription, #editVideoDescription');
    if (input && mentionUsers[index]) {
        insertMentionDesc(input, mentionUsers[index].username);
    }
}

function renderMentions(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/@(\w+)/g, '<a href="#" class="mention-link" onclick="event.preventDefault();goToUserProfile(\'$1\')">@$1</a>');
}

async function goToUserProfile(username) {
    try {
        const res = await fetch(`${API_BASE}/auth/users/search?q=${encodeURIComponent(username)}`);
        if (res.ok) {
            const users = await res.json();
            const match = users.find(u => u.username.toLowerCase() === username.toLowerCase());
            if (match) {
                window.location.href = `profile.html?userId=${match.id}`;
                return;
            }
        }
    } catch (e) {}
    showToast('User not found', 'error');
}

// Init mention autocomplete on description fields after DOM ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupMentionOnInput(document.getElementById('uploadDescription'));
        setupMentionOnInput(document.getElementById('editVideoDescription'));
    }, 500);
});
