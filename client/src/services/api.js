const API_BASE = '/api';

function getStoredToken() {
  try {
    return localStorage.getItem('campusradar_token') || sessionStorage.getItem('campusradar_token');
  } catch {
    return null;
  }
}

function setStoredToken(token, remember = true) {
  try {
    if (!token) {
      localStorage.removeItem('campusradar_token');
      sessionStorage.removeItem('campusradar_token');
    } else if (remember) {
      localStorage.setItem('campusradar_token', token);
    } else {
      sessionStorage.setItem('campusradar_token', token);
    }
  } catch (e) {
    console.warn('Storage warning:', e);
  }
}

async function request(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // If 401 Unauthorized, dispatch global unauthorized event
    if (res.status === 401 && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/register')) {
      setStoredToken(null);
      window.dispatchEvent(new Event('campusradar:unauthorized'));
    }
    const errorMsg = data.message || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const apiService = {
  // Token management
  getToken: getStoredToken,
  setToken: setStoredToken,

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  async login({ email, password, remember = true }) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, remember })
    });
    if (data.token) {
      setStoredToken(data.token, remember);
    }
    return data;
  },

  async registerInitiate(payload) {
    return request('/auth/register/initiate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async verifyEmailOtp({ email, otp }) {
    return request('/auth/register/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, otp })
    });
  },

  async verifyPhoneOtp({ email, otp }) {
    const data = await request('/auth/register/verify-phone', {
      method: 'POST',
      body: JSON.stringify({ email, otp })
    });
    if (data.token) {
      setStoredToken(data.token, true);
    }
    return data;
  },

  async resendRegistrationOtp({ email, type = 'email' }) {
    return request('/auth/register/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email, type })
    });
  },

  async forgotPasswordInitiate(email) {
    return request('/auth/forgot-password/initiate', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  async resetPassword({ email, otp, newPassword, confirmPassword }) {
    return request('/auth/forgot-password/verify-and-reset', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword, confirmPassword })
    });
  },

  async changePassword({ currentPassword, newPassword, confirmPassword }) {
    return request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });
  },

  async changePhone(newPhoneNumber) {
    return request('/auth/change-phone', {
      method: 'POST',
      body: JSON.stringify({ newPhoneNumber })
    });
  },

  async getSessions() {
    return request('/auth/sessions');
  },

  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Logout API warning:', e);
    } finally {
      setStoredToken(null);
    }
  },

  async logoutOthers() {
    return request('/auth/logout-others', { method: 'POST' });
  },

  // ==========================================
  // PROFILE & ACCOUNT
  // ==========================================

  async getMe() {
    return request('/me');
  },

  async getPublicProfile(publicProfileId) {
    return request(`/profiles/${publicProfileId}`);
  },

  async followProfile(publicProfileId) {
    return request(`/profiles/${publicProfileId}/follow`, { method: 'POST' });
  },

  async unfollowProfile(publicProfileId) {
    return request(`/profiles/${publicProfileId}/follow`, { method: 'DELETE' });
  },

  // ==========================================
  // FEED & POSTS
  // ==========================================

  async getPosts({ category, search, type, cursor, limit } = {}) {
    const params = new URLSearchParams();
    if (category && category !== 'All') params.append('category', category);
    if (search) params.append('search', search);
    if (type) params.append('type', type);
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', limit);

    return request(`/posts?${params.toString()}`);
  },

  async uploadImage(file) {
    const token = getStoredToken();
    const formData = new FormData();
    formData.append('image', file);

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/upload/image`, {
      method: 'POST',
      headers,
      body: formData
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Image upload failed');
    }
    return data;
  },

  async uploadAvatar(file) {
    const token = getStoredToken();
    const formData = new FormData();
    formData.append('avatar', file);

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/user/avatar`, {
      method: 'POST',
      headers,
      body: formData
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Avatar upload failed');
    }
    return data;
  },

  async removeAvatar() {
    return request('/user/avatar', { method: 'DELETE' });
  },

  async createPost(payload) {
    return request('/posts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async editPost(id, content) {
    return request(`/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content })
    });
  },

  async deletePost(id) {
    return request(`/posts/${id}`, { method: 'DELETE' });
  },

  async toggleLike(id) {
    return request(`/posts/${id}/like`, { method: 'POST' });
  },

  async toggleBookmark(id) {
    return request(`/posts/${id}/bookmark`, { method: 'POST' });
  },

  async hidePost(id) {
    return request(`/posts/${id}/hide`, { method: 'POST' });
  },

  async getSavedPosts() {
    return request('/user/saved');
  },

  // ==========================================
  // COMMENTS
  // ==========================================

  async getComments(postId) {
    return request(`/posts/${postId}/comments`);
  },

  async addComment(postId, { text, isAnonymous, parent_comment_id }) {
    return request(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text, isAnonymous, parent_comment_id })
    });
  },

  async deleteComment(postId, commentId) {
    return request(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
  },

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  async getNotifications() {
    return request('/notifications');
  },

  async markAllNotificationsRead() {
    return request('/notifications/read-all', { method: 'POST' });
  },

  // ==========================================
  // ORGANIZATIONS & CLUBS
  // ==========================================

  async getOrganizations() {
    return request('/organizations');
  },

  async toggleFollowOrg(orgId, isFollowing) {
    return request(`/organizations/${orgId}/follow`, {
      method: isFollowing ? 'DELETE' : 'POST'
    });
  },

  // ==========================================
  // SEARCH
  // ==========================================

  async search(query) {
    return request(`/search?q=${encodeURIComponent(query)}`);
  },

  // ==========================================
  // SETTINGS & BLOCKING & DANGER ZONE
  // ==========================================

  async getSettings() {
    return request('/settings');
  },

  async updateSettings(payload) {
    return request('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async getBlockedUsers() {
    return request('/blocks');
  },

  async blockUser(publicProfileId) {
    return request('/blocks', {
      method: 'POST',
      body: JSON.stringify({ publicProfileId })
    });
  },

  async unblockUser(publicProfileId) {
    return request(`/blocks/${publicProfileId}`, { method: 'DELETE' });
  },

  async reportItem({ target_type, target_id, reason, details }) {
    return request('/reports', {
      method: 'POST',
      body: JSON.stringify({ target_type, target_id, reason, details })
    });
  },

  async deleteAccount(confirmation) {
    return request('/user/delete-account', {
      method: 'POST',
      body: JSON.stringify({ confirmation })
    });
  },

  // ==========================================
  // EVENTS (STUDENT & PUBLIC VIEW)
  // ==========================================

  async getEvents({ category, search, upcoming } = {}) {
    const params = new URLSearchParams();
    if (category && category !== 'All') params.append('category', category);
    if (search) params.append('search', search);
    if (upcoming) params.append('upcoming', 'true');
    return request(`/events?${params.toString()}`);
  },

  // ==========================================
  // ADMIN PORTAL (SERVER AUTHORIZED)
  // ==========================================

  // Dashboard & Metrics
  async getAdminOverview(timeRange = '7d') {
    return request(`/admin/overview?timeRange=${timeRange}`);
  },

  // User Management
  async getAdminUsers({ q = '', role = 'all', status = 'all', page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC' } = {}) {
    const params = new URLSearchParams({ q, role, status, page, limit, sortBy, sortOrder });
    return request(`/admin/users?${params.toString()}`);
  },

  async getAdminUserDetail(id) {
    return request(`/admin/users/${id}`);
  },

  async updateAdminUser(id, payload) {
    return request(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async suspendAdminUser(id, reason = '') {
    return request(`/admin/users/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  async unsuspendAdminUser(id) {
    return request(`/admin/users/${id}/unsuspend`, {
      method: 'POST'
    });
  },

  async banAdminUser(id, reason = '') {
    return request(`/admin/users/${id}/ban`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  async unbanAdminUser(id) {
    return request(`/admin/users/${id}/unban`, {
      method: 'POST'
    });
  },

  async deleteAdminUser(id, reason = '') {
    return request(`/admin/users/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    });
  },

  async restoreAdminUser(id) {
    return request(`/admin/users/${id}/restore`, {
      method: 'POST'
    });
  },

  async getAdminUserTimeline(id) {
    return request(`/admin/users/${id}/timeline`);
  },

  // Posts Management
  async getAdminPosts({ q = '', tag = 'all', status = 'active', page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams({ q, tag, status, page, limit });
    return request(`/admin/posts?${params.toString()}`);
  },

  async editAdminPost(id, content) {
    return request(`/admin/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content })
    });
  },

  async deleteAdminPost(id, reason = '') {
    return request(`/admin/posts/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    });
  },

  async restoreAdminPost(id) {
    return request(`/admin/posts/${id}/restore`, {
      method: 'POST'
    });
  },

  // Confessions Management
  async getAdminConfessions({ q = '', category = 'all', status = 'active', page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams({ q, category, status, page, limit });
    return request(`/admin/confessions?${params.toString()}`);
  },

  async deleteAdminConfession(id, reason = '') {
    return request(`/admin/confessions/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    });
  },

  async restoreAdminConfession(id) {
    return request(`/admin/confessions/${id}/restore`, {
      method: 'POST'
    });
  },

  // Comments Management
  async getAdminComments({ q = '', status = 'active', page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams({ q, status, page, limit });
    return request(`/admin/comments?${params.toString()}`);
  },

  async deleteAdminComment(id, reason = '') {
    return request(`/admin/comments/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    });
  },

  async restoreAdminComment(id) {
    return request(`/admin/comments/${id}/restore`, {
      method: 'POST'
    });
  },

  // Events Management
  async getAdminEvents() {
    return request('/admin/events');
  },

  async createAdminEvent(payload) {
    return request('/admin/events', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateAdminEvent(id, payload) {
    return request(`/admin/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async deleteAdminEvent(id, reason = '') {
    return request(`/admin/events/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    });
  },

  async restoreAdminEvent(id) {
    return request(`/admin/events/${id}/restore`, {
      method: 'POST'
    });
  },

  // Reports / Moderation Center
  async getAdminReports({ status = 'all', page = 1, limit = 50 } = {}) {
    const params = new URLSearchParams({ status, page, limit });
    return request(`/admin/reports?${params.toString()}`);
  },

  async assignAdminReport(id, moderator_id) {
    return request(`/admin/reports/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ moderator_id })
    });
  },

  async resolveAdminReport(id, { resolution, deleteContent = false } = {}) {
    return request(`/admin/reports/${id}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ resolution, deleteContent })
    });
  },

  async dismissAdminReport(id, resolution = '') {
    return request(`/admin/reports/${id}/dismiss`, {
      method: 'PATCH',
      body: JSON.stringify({ resolution })
    });
  },

  // Admin Audit Log (Dedicated & Immutable)
  async getAdminAuditLogs({ q = '', action = 'all', target_type = 'all', page = 1, limit = 50 } = {}) {
    const params = new URLSearchParams({ q, action, target_type, page, limit });
    return request(`/admin/audit?${params.toString()}`);
  },

  // User Behavior Analytics & Time Spent
  async getAdminAnalyticsOverview(timeRange = '7d') {
    return request(`/admin/analytics/overview?timeRange=${timeRange}`);
  },

  async getAdminAnalyticsPages() {
    return request('/admin/analytics/pages');
  },

  async getAdminAnalyticsEvents({ event_type = 'all', page = 1, limit = 50 } = {}) {
    const params = new URLSearchParams({ event_type, page, limit });
    return request(`/admin/analytics/events?${params.toString()}`);
  },

  // Security Analytics
  async getAdminSecurityOverview() {
    return request('/admin/security/overview');
  }
};
