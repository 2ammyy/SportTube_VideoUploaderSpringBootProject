// watch.js - uses API_BASE, authToken, currentUser from app.js
currentVideoId = null;
let currentVideo = null;
let channelInfo = null;
let isOwner = false;
let recommendedVideos = [];

const urlParams = new URLSearchParams(window.location.search);
const idParam = urlParams.get('id');
if (!idParam || idParam === 'null' || idParam === 'undefined') {
    window.location.href = 'index.html';
} else {
    currentVideoId = idParam;
}

function requireAuth() {
    if (!authToken) {
        showToast('Please login to continue', 'error');
        return false;
    }
    return true;
}

async function handleAuthRes(res) {
    if (res.status === 400) {
        try {
            const clone = res.clone();
            const text = await clone.text();
            if (text.includes('Invalid token')) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('currentUser');
                authToken = null;
                currentUser = null;
                showToast('Session expired, please login again', 'error');
                return false;
            }
        } catch (e) {}
    }
    return true;
}

function doLogout() {
    if (typeof logout === 'function') {
        logout();
    } else {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        location.reload();
    }
}

function updateNavUI() {
    // Use the shared updateUserUI from app.js for consistent avatar/logged-in state
    if (typeof updateUserUI === 'function') updateUserUI();
}

function toggleProfileDropdown() {
    document.getElementById('profileDropdown').classList.toggle('show');
}

async function loadVideo() {
    if (!currentVideoId) return;

    try {
        const metaRes = await fetch(`${API_BASE}/videos/${currentVideoId}`);
        if (!metaRes.ok) {
            document.getElementById('videoTitle').textContent = 'Video not found';
            return;
        }
        currentVideo = await metaRes.json();

        const title = currentVideo.title || currentVideo.originalFilename || 'Untitled';
        document.getElementById('videoTitle').textContent = title;
        document.getElementById('videoStats').textContent =
            `Published ${new Date(currentVideo.publishedAt || currentVideo.createdAt).toLocaleDateString()}`;

        const videoEl = document.getElementById('videoPlayer');
        videoEl.src = `${API_BASE}/videos/${currentVideoId}/stream`;
        videoEl.autoplay = true;
        videoEl.muted = true;
        videoEl.play().catch(() => {});

        if (currentVideo.description) {
            document.getElementById('descriptionText').innerHTML = renderMentions(currentVideo.description);
        }

        const currentUserId = currentUser && (currentUser.id || currentUser.userId);
        isOwner = currentUserId && currentUserId === currentVideo.userId;

        await loadChannelInfo(currentVideo.userId);
        loadSubscriberCount(currentVideo.userId);

        if (isOwner) {
            document.getElementById('subscribeBtn').style.display = 'none';
            document.getElementById('reportBtn').style.display = 'none';
            document.getElementById('commentInputSection').style.display = 'none';
            const editBtn = document.createElement('button');
            editBtn.className = 'btn-secondary';
            editBtn.textContent = 'Edit Video';
            editBtn.onclick = openSettings;
            editBtn.id = 'editVideoBtn';
            const channelBar = document.getElementById('channelBar');
            if (!document.getElementById('editVideoBtn')) {
                channelBar.appendChild(editBtn);
            }
        } else {
            document.getElementById('subscribeBtn').style.display = 'block';
            if (authToken) {
                checkSubscriptionStatus(currentVideo.userId);
                document.getElementById('commentInputSection').style.display = 'flex';
            }
        }

        document.getElementById('saveBtn').style.display = 'inline-block';
        checkSaved();
        recordWatch();

        // Show playlist button if logged in
        if (authToken) {
            document.getElementById('playlistBtn').style.display = 'inline-block';
        }

        loadLikes(currentVideoId);
        loadComments(currentVideoId);

        // Load playlist sidebar if playlistId in URL
        const plId = getQueryParam('playlistId');
        if (plId) loadPlaylistSidebar(plId, currentVideoId);
    } catch (e) {
        console.error('Error loading video:', e);
        document.getElementById('videoTitle').textContent = 'Error loading video';
    }
}

async function loadPlaylistSidebar(playlistId, currentVideoId) {
    try {
        const playlist = await loadPlaylist(playlistId);
        if (!playlist || !playlist.videos) return;
        const sidebar = document.getElementById('playlistSidebar');
        sidebar.style.display = 'block';
        document.getElementById('playlistSidebarName').textContent = playlist.name;
        document.getElementById('playlistSidebarMeta').textContent = (playlist.videoCount || 0) + ' videos';

        const container = document.getElementById('playlistSidebarVideos');
        let html = '';
        let foundCurrent = false;
        let nextVideoId = null;
        playlist.videos.forEach(function(v, i) {
            if (v.id === currentVideoId) {
                foundCurrent = true;
                html += '<div class="playlist-sidebar-item current">';
            } else {
                if (foundCurrent && !nextVideoId) nextVideoId = v.id;
                html += '<div class="playlist-sidebar-item">';
            }
            html +=
                '<div class="pl-sidebar-num">' + (i + 1) + '</div>' +
                '<div class="pl-sidebar-thumb">' +
                (v.thumbnailPath ? '<img src="' + API_BASE + '/videos/' + v.id + '/thumbnail" alt="">' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1a1a2e;">🎬</div>') +
                '</div>' +
                '<div class="pl-sidebar-info">' +
                '<div class="pl-sidebar-title">' + esc(v.title || v.originalFilename) + '</div>' +
                '<div class="pl-sidebar-channel">' + esc(v.username || '') + '</div>' +
                '</div>' +
                '</div>';
        });
        container.innerHTML = html;

        // Click handler
        container.querySelectorAll('.playlist-sidebar-item').forEach(function(el, i) {
            el.addEventListener('click', function() {
                const vid = playlist.videos[i].id;
                window.location.href = 'watch.html?id=' + vid + '&playlistId=' + playlistId;
            });
        });

        // Autoplay next video
        if (nextVideoId) {
            const videoEl = document.getElementById('videoPlayer');
            videoEl.addEventListener('ended', function() {
                window.location.href = 'watch.html?id=' + nextVideoId + '&playlistId=' + playlistId;
            });
        }
        
        // Record playlist view
        if (authToken) recordPlaylistView(playlistId);
    } catch (e) {
        console.error('Error loading playlist sidebar:', e);
    }
}

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

async function loadChannelInfo(userId) {
    if (!userId) return;
    try {
        const res = await fetch(`${API_BASE}/auth/users/${userId}`);
        if (res.ok) {
            channelInfo = await res.json();
            document.getElementById('channelName').textContent = channelInfo.username;
            const avatar = document.getElementById('channelAvatar');
            avatar.textContent = channelInfo.username.charAt(0).toUpperCase();
            avatar.style.background = channelInfo.avatarColor || '#667eea';
        }
    } catch (e) {
        document.getElementById('channelName').textContent = 'Channel';
    }
}

function toggleFullscreen() {
    const player = document.getElementById('playerWrapper');
    if (!document.fullscreenElement) {
        player.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
}

async function loadAllVideos() {
    try {
        const res = await fetch(`${API_BASE}/videos/all`);
        if (res.ok) {
            recommendedVideos = (await res.json()).filter(v => v.id !== currentVideoId);
            displayRecommended();
        }
    } catch (e) {}
}

function displayRecommended() {
    const container = document.getElementById('recommendedVideos');
    if (recommendedVideos.length === 0) {
        container.innerHTML = '<div style="color:#aaa;padding:20px;text-align:center;">No recommendations</div>';
        return;
    }

    container.innerHTML = recommendedVideos.map(v => `
        <div class="recommended-card" onclick="window.location.href='watch.html?id=${v.id}'">
            <div class="recommended-thumbnail">
                <img src="${getThumbnail(v)}" alt="">
            </div>
            <div class="recommended-info">
                <div class="recommended-title">${esc(v.title || v.originalFilename || 'Video')}</div>
                <div class="recommended-meta">${timeAgo(new Date(v.createdAt))}</div>
            </div>
        </div>
    `).join('');
}

function getThumbnail(video) {
    if (video.thumbnailPath) {
        return `${API_BASE}/videos/${video.id}/thumbnail`;
    }
    const colors = ['#667eea', '#e50914', '#4caf50', '#2196f3', '#ff9800', '#9c27b0'];
    const color = colors[Math.abs(hashCode(video.id)) % colors.length];
    const name = (video.originalFilename || 'Video').replace(/\.[^/.]+$/, '').substring(0, 15);
    const svg = `<svg width="168" height="94" xmlns="http://www.w3.org/2000/svg"><rect width="168" height="94" fill="${color}"/><text x="84" y="52" font-family="Arial" font-size="12" text-anchor="middle" fill="white">${esc(name)}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

async function subscribeChannel() {
    if (!requireAuth()) return;
    const channelId = currentVideo?.userId;
    if (!channelId) return;

    try {
        const res = await fetch(`${API_BASE}/channels/${channelId}/subscribe`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!(await handleAuthRes(res))) return;
        const data = await res.json();
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
    } catch (e) {
        showToast('Error', 'error');
    }
}

async function checkSubscriptionStatus(channelId) {
    if (!authToken || !channelId) return;
    try {
        const res = await fetch(`${API_BASE}/channels/${channelId}/is-subscribed`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            const data = await res.json();
            const btn = document.getElementById('subscribeBtn');
            if (data.subscribed) {
                btn.textContent = 'Subscribed';
                btn.classList.add('subscribed');
            }
        }
    } catch (e) {}
}

async function loadSubscriberCount(channelId) {
    if (!channelId) return;
    try {
        const res = await fetch(`${API_BASE}/channels/${channelId}/subscribers`);
        if (res.ok) {
            const data = await res.json();
            document.getElementById('subscriberCount').textContent = `${data.count} subscriber${data.count !== 1 ? 's' : ''}`;
        }
    } catch (e) {}
}

// ============ SAVE / BOOKMARK ============

async function toggleSave() {
    if (!requireAuth()) return;
    if (!currentVideoId) return;
    try {
        const res = await fetch(`${API_BASE}/videos/${currentVideoId}/save`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!(await handleAuthRes(res))) return;
        const data = await res.json();
        const btn = document.getElementById('saveBtn');
        if (data.saved) {
            btn.textContent = 'Saved';
            btn.classList.add('saved');
            showToast('Video saved', 'success');
        } else {
            btn.textContent = 'Save';
            btn.classList.remove('saved');
            showToast('Video removed from saved', 'success');
        }
    } catch (e) {
        showToast('Error', 'error');
    }
}

async function checkSaved() {
    if (!authToken || !currentVideoId) return;
    try {
        const res = await fetch(`${API_BASE}/videos/${currentVideoId}/is-saved`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            const data = await res.json();
            const btn = document.getElementById('saveBtn');
            if (data.saved) {
                btn.textContent = 'Saved';
                btn.classList.add('saved');
            }
        }
    } catch (e) {}
}

async function recordWatch() {
    if (!authToken || !currentVideoId) return;
    try {
        await fetch(`${API_BASE}/videos/${currentVideoId}/watch`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
    } catch (e) {}
}

async function likeVideo() {
    if (!requireAuth()) return;
    if (!currentVideoId) return;
    try {
        const res = await fetch(`${API_BASE}/videos/${currentVideoId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!(await handleAuthRes(res))) return;
        loadLikes(currentVideoId);
    } catch (e) {
        showToast('Error liking video', 'error');
    }
}

async function dislikeVideo() {
    if (!requireAuth()) return;
    if (!currentVideoId) return;
    try {
        const res = await fetch(`${API_BASE}/videos/${currentVideoId}/dislike`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!(await handleAuthRes(res))) return;
        loadLikes(currentVideoId);
    } catch (e) {
        showToast('Error', 'error');
    }
}

async function loadLikes(videoId) {
    if (!videoId) return;
    try {
        const res = await fetch(`${API_BASE}/videos/${videoId}/likes`);
        if (res.ok) {
            const data = await res.json();
            document.getElementById('likeCount').textContent = data.likes;
            document.getElementById('dislikeCount').textContent = data.dislikes;
        }
    } catch (e) {}
}

// These are declared in app.js (loaded first) — do not use let here
mentionTimeout = null;
mentionUsers = [];
mentionIndex = -1;
currentMentionInput = null;

function attachMentionHandlers(inputEl, onEnter) {
    if (!inputEl) return;
    inputEl.addEventListener('focus', function() {
        currentMentionInput = this;
    });
    inputEl.addEventListener('input', function() {
        clearTimeout(mentionTimeout);
        const cursorPos = this.selectionStart;
        const text = this.value.substring(0, cursorPos);
        const match = text.match(/@(\w*)$/);
        const dropdown = document.getElementById('mentionDropdown');

        if (match) {
            const term = match[1];
            mentionTimeout = setTimeout(async () => {
                try {
                    const res = await fetch(`${API_BASE}/auth/users/search?q=${encodeURIComponent(term)}`);
                    if (res.ok) {
                        mentionUsers = await res.json();
                        showMentionDropdown(this, match[0]);
                    }
                } catch (e) {}
            }, 200);
        } else if (dropdown) {
            dropdown.remove();
            mentionUsers = [];
            mentionIndex = -1;
        }
    });

    inputEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const dropdown = document.getElementById('mentionDropdown');
            if (dropdown && mentionIndex >= 0 && mentionUsers[mentionIndex]) {
                e.preventDefault();
                insertMention(this, mentionUsers[mentionIndex].username);
                return;
            }
            e.preventDefault();
            if (onEnter) onEnter();
            return;
        }
        const dropdown = document.getElementById('mentionDropdown');
        if (!dropdown) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            mentionIndex = Math.min(mentionIndex + 1, mentionUsers.length - 1);
            highlightMention();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            mentionIndex = Math.max(mentionIndex - 1, 0);
            highlightMention();
        } else if (e.key === 'Tab') {
            if (mentionIndex >= 0 && mentionUsers[mentionIndex]) {
                e.preventDefault();
                insertMention(this, mentionUsers[mentionIndex].username);
            }
        }
    });
}

function setupMentionAutocomplete() {
    attachMentionHandlers(document.getElementById('commentInput'), addComment);
    const commentInput = document.getElementById('commentInput');
    if (commentInput) {
        commentInput.addEventListener('input', function() {
            const warning = document.getElementById('commentWarning');
            if (warning) warning.style.display = 'none';
        });
    }
}

function showMentionDropdown(input, prefix) {
    let dropdown = document.getElementById('mentionDropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'mentionDropdown';
        dropdown.style.cssText = 'position:absolute;background:#1a1a2e;border:1px solid #333;border-radius:6px;max-height:150px;overflow-y:auto;z-index:1000;min-width:180px;';
        input.parentElement.style.position = 'relative';
        input.parentElement.appendChild(dropdown);
    }
    if (mentionUsers.length === 0) {
        dropdown.innerHTML = '<div style="padding:8px;color:#888;font-size:13px;">No users found</div>';
        mentionIndex = -1;
        return;
    }
    mentionIndex = 0;
    dropdown.innerHTML = mentionUsers.map((u, i) =>
        `<div class="mention-item" data-index="${i}" style="padding:8px 12px;cursor:pointer;color:#fff;font-size:13px;${i === 0 ? 'background:#333' : ''}" onclick="selectMention(${i})">@${u.username}</div>`
    ).join('');
}

function highlightMention() {
    const items = document.querySelectorAll('#mentionDropdown .mention-item');
    items.forEach((el, i) => {
        el.style.background = i === mentionIndex ? '#333' : '';
    });
}

function selectMention(index) {
    const input = currentMentionInput;
    if (input && mentionUsers[index]) {
        insertMention(input, mentionUsers[index].username);
    }
}

function insertMention(input, username) {
    const cursorPos = input.selectionStart;
    const text = input.value;
    const before = text.substring(0, cursorPos);
    const after = text.substring(cursorPos);
    const match = before.match(/@(\w*)$/);
    if (match) {
        const start = before.lastIndexOf('@', cursorPos - 1);
        input.value = text.substring(0, start) + '@' + username + ' ' + after;
        const newPos = start + username.length + 2;
        input.setSelectionRange(newPos, newPos);
        input.focus();
    }
    const dropdown = document.getElementById('mentionDropdown');
    if (dropdown) dropdown.remove();
    mentionUsers = [];
    mentionIndex = -1;
}

// Close mention dropdown on outside click
document.addEventListener('click', function(e) {
    if (!e.target.closest('#mentionDropdown') && !e.target.closest('#commentInput') && !e.target.closest('.edit-comment-input')) {
        const dropdown = document.getElementById('mentionDropdown');
        if (dropdown) dropdown.remove();
        mentionUsers = [];
        mentionIndex = -1;
    }
});

async function addComment() {
    const warning = document.getElementById('commentWarning');
    if (warning) warning.style.display = 'none';
    if (!requireAuth()) return;
    if (!currentVideoId) return;
    const input = document.getElementById('commentInput');
    const content = input.value.trim();
    if (!content) return;

    if (await checkContent(content)) {
        if (warning) warning.style.display = 'block';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/videos/${currentVideoId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ content })
        });
        if (res.ok) {
            input.value = '';
            loadComments(currentVideoId);
            showToast('Comment added', 'success');
        } else {
            let errMsg = 'Failed to add comment';
            try {
                const errData = await res.json();
                errMsg = errData.error || errMsg;
            } catch (_) {}
            if (errMsg.includes('Invalid token')) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('currentUser');
                authToken = null;
                currentUser = null;
                showToast('Session expired, please login again', 'error');
            } else if (errMsg.includes('guidelines')) {
                if (warning) warning.style.display = 'block';
            } else {
                showToast(errMsg, 'error');
            }
        }
    } catch (e) {
        showToast('Error adding comment', 'error');
    }
}

const commentContents = {};

async function loadComments(videoId) {
    if (!videoId) return;
    try {
        const res = await fetch(`${API_BASE}/videos/${videoId}/comments`);
        if (res.ok) {
            const comments = await res.json();
            document.getElementById('commentCount').textContent = `(${comments.length})`;
            const list = document.getElementById('commentsList');
            if (comments.length === 0) {
                list.innerHTML = '<div style="color:#aaa;padding:10px;">No comments yet</div>';
            } else {
                const currentUserId = currentUser && (currentUser.id || currentUser.userId);
                list.innerHTML = comments.map(c => {
                    commentContents[c.id] = c.content;
                    const isOwn = currentUserId && c.userId === currentUserId;
                    const avatarStyle = c.avatarColor ? 'style="background:' + c.avatarColor + '"' : '';
                    const avatarHtml = c.avatarPath
                        ? '<img src="' + API_BASE + '/auth/users/' + c.userId + '/avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">'
                        : (c.username ? c.username.charAt(0).toUpperCase() : 'U');
                    return '<div class="comment-item">' +
                        '<div class="comment-user-avatar" ' + avatarStyle + '>' + avatarHtml + '</div>' +
                        '<div class="comment-content">' +
                            '<div class="comment-user">' + esc(c.username || 'Unknown') + '</div>' +
                            '<div class="comment-text" id="commentText_' + c.id + '">' + renderMentions(c.content) + '</div>' +
                            '<div class="comment-meta-row">' +
                                '<span class="comment-date">' + timeAgo(new Date(c.createdAt)) + '</span>' +
                                (c.updatedAt ? '<span class="comment-edited">(edited)</span>' : '') +
                                (isOwn ? '<button class="btn-comment-edit" data-cid="' + c.id + '">Edit</button>' : '') +
                                (isOwn ? '<button class="btn-comment-delete" data-cid="' + c.id + '">Delete</button>' : '') +
                            '</div>' +
                        '</div>' +
                    '</div>';
                }).join('');
            }
        }
    } catch (e) {}
}

function startEditComment(commentId) {
    const content = commentContents[commentId];
    if (content === undefined) return;
    const textDiv = document.getElementById('commentText_' + commentId);
    textDiv.innerHTML = '<input type="text" class="edit-comment-input" id="editCommentInput_' + commentId + '" value="' + escAttr(content) + '" style="width:100%;padding:8px;border:1px solid #555;border-radius:4px;background:#1a1a2e;color:#fff;font-size:13px;">' +
        '<div style="margin-top:6px;display:flex;gap:8px;">' +
        '<button class="btn-primary" style="padding:4px 12px;font-size:12px;" onclick="saveEditComment(\'' + commentId + '\')">Save</button>' +
        '<button class="btn-secondary" style="padding:4px 12px;font-size:12px;" onclick="cancelEditComment(\'' + commentId + '\')">Cancel</button>' +
        '</div>';
    const editInput = textDiv.querySelector('input');
    editInput.focus();
    attachMentionHandlers(editInput, function() { saveEditComment(commentId); });
}

function escAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cancelEditComment(commentId) {
    const content = commentContents[commentId];
    if (content === undefined) return;
    const textDiv = document.getElementById('commentText_' + commentId);
    textDiv.innerHTML = renderMentions(content);
}

async function saveEditComment(commentId) {
    const input = document.getElementById('editCommentInput_' + commentId);
    const content = input.value.trim();
    if (!content) return;
    try {
        const res = await fetch(`${API_BASE}/videos/comments/${commentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ content })
        });
        if (res.ok) {
            loadComments(currentVideoId);
            showToast('Comment updated', 'success');
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.error || 'Failed to update comment', 'error');
        }
    } catch (e) {
        showToast('Error updating comment', 'error');
    }
}

async function deleteComment(commentId) {
    if (!confirm('Delete this comment?')) return;
    try {
        const res = await fetch(`${API_BASE}/videos/comments/${commentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            loadComments(currentVideoId);
            showToast('Comment deleted', 'success');
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.error || 'Failed to delete comment', 'error');
        }
    } catch (e) {
        showToast('Error deleting comment', 'error');
    }
}

function shareVideo() {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href);
        showToast('Link copied to clipboard', 'success');
    }
}

function openSettings() {
    if (!isOwner) return;
    document.getElementById('settingsPanel').style.display = 'block';
    document.getElementById('editTitle').value = currentVideo.title || currentVideo.originalFilename || '';
    document.getElementById('editPrivacy').value = currentVideo.privacy || 'public';
    document.getElementById('editDescriptionFull').value = currentVideo.description || '';
    document.getElementById('settingsPanel').scrollIntoView({ behavior: 'smooth' });
    const warn = document.getElementById('descriptionWarning');
    if (warn) warn.style.display = 'none';
}

function closeSettings() {
    document.getElementById('settingsPanel').style.display = 'none';
}

async function saveSettings() {
    if (!requireAuth() || !isOwner) return;
    const warning = document.getElementById('descriptionWarning');
    if (warning) warning.style.display = 'none';
    const title = document.getElementById('editTitle').value.trim();
    const privacy = document.getElementById('editPrivacy').value;
    const description = document.getElementById('editDescriptionFull').value.trim();

    if (description && await checkContent(description)) {
        if (warning) warning.style.display = 'block';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/videos/${currentVideoId}/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ title, privacy, description })
        });
        if (res.ok) {
            const updated = await res.json();
            currentVideo = updated;
            document.getElementById('videoTitle').textContent = updated.title || updated.originalFilename;
            if (updated.description) {
                document.getElementById('descriptionText').innerHTML = renderMentions(updated.description);
            } else {
                document.getElementById('descriptionText').innerHTML = 'No description';
            }
            closeSettings();
            showToast('Settings saved', 'success');
        } else {
            let errMsg = 'Failed to save settings';
            try {
                const errData = await res.json();
                errMsg = errData.error || errMsg;
            } catch (_) {}
            if (errMsg.includes('guidelines')) {
                if (warning) warning.style.display = 'block';
            } else {
                showToast(errMsg, 'error');
            }
        }
    } catch (e) {
        showToast('Error saving settings', 'error');
    }
}

function openReportModal() {
    if (!requireAuth()) return;
    document.getElementById('reportModal').style.display = 'flex';
}

function closeReportModal() {
    document.getElementById('reportModal').style.display = 'none';
}

async function submitReport() {
    if (!requireAuth() || !currentVideoId) return;
    const reason = document.getElementById('reportReason').value;
    const description = document.getElementById('reportDescription').value;

    try {
        const res = await fetch(`${API_BASE}/videos/${currentVideoId}/report`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ reason, description })
        });
        if (res.ok) {
            showToast('Report submitted', 'success');
            closeReportModal();
        } else {
            const err = await res.json().catch(() => ({}));
            if (err.error && err.error.includes('Invalid token')) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('currentUser');
                authToken = null;
                currentUser = null;
                showToast('Session expired, please login again', 'error');
                return;
            }
            showToast(err.error || 'Already reported', 'error');
        }
    } catch (e) {
        showToast('Error', 'error');
    }
}

function toggleNotifications() {
    if (!requireAuth()) return;
    document.getElementById('notificationsDropdown').classList.toggle('show');
    loadNotifications();
}

async function loadNotifications() {
    if (!authToken) return;
    try {
        const res = await fetch(`${API_BASE}/notifications`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            const notifications = await res.json();
            const list = document.getElementById('notificationsList');
            if (notifications.length === 0) {
                list.innerHTML = '<div style="padding:20px;text-align:center;color:#aaa;">No notifications</div>';
            } else {
                list.innerHTML = notifications.slice(0, 20).map(n => `
                    <div class="notif-item ${!n.read ? 'unread' : ''}" onclick="markNotificationRead('${n.id}')">
                        <div class="notif-message">${n.message || 'New activity'}</div>
                        <div class="notif-time">${timeAgo(new Date(n.createdAt))}</div>
                    </div>
                `).join('');
            }
            loadUnreadCount();
        }
    } catch (e) {}
}

async function loadUnreadCount() {
    if (!authToken) return;
    try {
        const res = await fetch(`${API_BASE}/notifications/unread-count`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            const data = await res.json();
            const badge = document.getElementById('notificationBadge');
            if (data.count > 0) {
                badge.textContent = data.count > 99 ? '99+' : data.count;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (e) {}
}

async function markNotificationRead(id) {
    if (!authToken) return;
    try {
        await fetch(`${API_BASE}/notifications/${id}/read`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        loadNotifications();
    } catch (e) {}
}

async function markAllNotificationsRead() {
    if (!authToken) return;
    try {
        await fetch(`${API_BASE}/notifications/read-all`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        loadNotifications();
    } catch (e) {}
}

function handleSearch(e) {
    if (e.key === 'Enter') {
        const term = document.getElementById('searchInput').value.trim();
        if (term) window.location.href = `search.html?q=${encodeURIComponent(term)}`;
    }
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return hash;
}

function renderMentions(text) {
    if (!text) return '';
    return esc(text).replace(/@(\w+)/g, '<a href="#" class="mention-link" onclick="event.preventDefault();goToUserProfile(\'$1\')">@$1</a>');
}

function timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

document.addEventListener('click', function(e) {
    const profile = document.querySelector('.user-profile');
    const dropdown = document.getElementById('profileDropdown');
    const bell = document.getElementById('notificationBell');
    const notifDropdown = document.getElementById('notificationsDropdown');

    if (dropdown && profile && !profile.contains(e.target)) dropdown.classList.remove('show');
    if (notifDropdown && bell && !bell.contains(e.target) && !notifDropdown.contains(e.target)) {
        notifDropdown.classList.remove('show');
    }
});

if (authToken && currentUser) {
    updateNavUI();
}

setupMentionAutocomplete();

// Comment button click handler
const commentBtn = document.getElementById('submitCommentBtn');
if (commentBtn) commentBtn.addEventListener('click', addComment);

// Event delegation for edit/delete comment buttons
const commentsList = document.getElementById('commentsList');
if (commentsList) {
    commentsList.addEventListener('click', function(e) {
        const target = e.target;
        if (target.classList.contains('btn-comment-edit')) {
            startEditComment(target.dataset.cid);
        } else if (target.classList.contains('btn-comment-delete')) {
            deleteComment(target.dataset.cid);
        }
    });
}

loadVideo();
loadAllVideos();
setInterval(() => { if (authToken) loadUnreadCount(); }, 60000);
