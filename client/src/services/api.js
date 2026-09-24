// client/src/services/api.js

// ============================================================
// API BASE URL
// ============================================================
// Local development:
//   VITE_API_URL=http://localhost:5001
//
// Production:
//   VITE_API_URL=https://campus-radar-2.onrender.com
//
// IMPORTANT:
// Vite exposes VITE_* variables at build time.
// After changing VITE_API_URL in Vercel, redeploy the frontend.

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Remove trailing slash so:
//   https://example.com/
// becomes:
//   https://example.com
const API_BASE = API_BASE_URL.replace(/\/+$/, '');

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

function getStoredToken() {
  try {
    return (
      localStorage.getItem('campusradar_token') ||
      sessionStorage.getItem('campusradar_token')
    );
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
      // Remove old session token if switching to persistent login.
      sessionStorage.removeItem('campusradar_token');
      localStorage.setItem('campusradar_token', token);
    } else {
      // Remove old persistent token if switching to session login.
      localStorage.removeItem('campusradar_token');
      sessionStorage.setItem('campusradar_token', token);
    }
  } catch (e) {
    console.warn('Storage warning:', e);
  }
}

// ============================================================
// COMMON REQUEST HANDLER
// ============================================================

async function request(endpoint, options = {}) {
  const token = getStoredToken();

  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${API_BASE}${endpoint}`;

  let res;

  try {
    res = await fetch(url, {
      ...options,
      headers
    });
  } catch (error) {
    console.error('[API Network Error]', {
      url,
      method: options.method || 'GET',
      error: error.message
    });

    throw new Error(
      'Unable to connect to the Campus Radar server. Please check your internet connection or try again.'
    );
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // If 401 Unauthorized, dispatch global unauthorized event.
    if (
      res.status === 401 &&
      !endpoint.startsWith('/auth/login') &&
      !endpoint.startsWith('/auth/register')
    ) {
      setStoredToken(null);
      window.dispatchEvent(new Event('campusradar:unauthorized'));
    }

    const errorMsg =
      data.message ||
      data.error ||
      `Request failed with status ${res.status}`;

    throw new Error(errorMsg);
  }

  return data;
}

// ============================================================
// FILE UPLOAD REQUEST HELPER
// ============================================================

async function uploadRequest(endpoint, fieldName, file) {
  const token = getStoredToken();

  if (!file) {
    throw new Error('No file selected.');
  }

  const formData = new FormData();
  formData.append(fieldName, file);

  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${API_BASE}${endpoint}`;

  let res;

  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData
    });
  } catch (error) {
    console.error('[Upload Network Error]', {
      url,
      error: error.message
    });

    throw new Error(
      'Unable to connect to the Campus Radar server.'
    );
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (
      res.status === 401 &&
      !endpoint.startsWith('/auth/login') &&
      !endpoint.startsWith('/auth/register')
    ) {
      setStoredToken(null);
      window.dispatchEvent(new Event('campusradar:unauthorized'));
    }

    throw new Error(
      data.message ||
        data.error ||
        `Upload failed with status ${res.status}`
    );
  }

  return data;
}

// ============================================================
// API SERVICE
// ============================================================

export const apiService = {
  // ==========================================================
  // TOKEN MANAGEMENT
  // ==========================================================

  getToken: getStoredToken,

  setToken: setStoredToken,

  // ==========================================================
  // AUTHENTICATION
  // ==========================================================

  async login({ email, password, remember = true }) {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        remember
      })
    });

    if (data.token) {
      setStoredToken(data.token, remember);
    }

    return data;
  },

  async registerInitiate(payload) {
    return request('/api/auth/register/initiate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async verifyEmailOtp({ email, otp }) {
    return request('/api/auth/register/verify-email', {
      method: 'POST',
      body: JSON.stringify({
        email,
        otp
      })
    });
  },

  async verifyPhoneOtp({ email, otp }) {
    const data = await request('/api/auth/register/verify-phone', {
      method: 'POST',
      body: JSON.stringify({
        email,
        otp
      })
    });

    if (data.token) {
      setStoredToken(data.token, true);
    }

    return data;
  },

  async resendRegistrationOtp({
    email,
    type = 'email'
  }) {
    return request('/api/auth/register/resend-otp', {
      method: 'POST',
      body: JSON.stringify({
        email,
        type
      })
    });
  },

  async forgotPasswordInitiate(email) {
    return request('/api/auth/forgot-password/initiate', {
      method: 'POST',
      body: JSON.stringify({
        email
      })
    });
  },

  async resetPassword({
    email,
    otp,
    newPassword,
    confirmPassword
  }) {
    return request('/api/auth/forgot-password/verify-and-reset', {
      method: 'POST',
      body: JSON.stringify({
        email,
        otp,
        newPassword,
        confirmPassword
      })
    });
  },

  async changePassword({
    currentPassword,
    newPassword,
    confirmPassword
  }) {
    return request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmPassword
      })
    });
  },

  async changePhone(newPhoneNumber) {
    return request('/api/auth/change-phone', {
      method: 'POST',
      body: JSON.stringify({
        newPhoneNumber
      })
    });
  },

  async getSessions() {
    return request('/api/auth/sessions');
  },

  async logout() {
    try {
      await request('/api/auth/logout', {
        method: 'POST'
      });
    } catch (e) {
      console.warn('Logout API warning:', e);
    } finally {
      setStoredToken(null);
    }
  },

  async logoutOthers() {
    return request('/api/auth/logout-others', {
      method: 'POST'
    });
  },

  // ==========================================================
  // PROFILE & ACCOUNT
  // ==========================================================

  async getMe() {
    return request('/api/me');
  },

  async getPublicProfile(publicProfileId) {
    return request(
      `/api/profiles/${encodeURIComponent(publicProfileId)}`
    );
  },

  async followProfile(publicProfileId) {
    return request(
      `/api/profiles/${encodeURIComponent(publicProfileId)}/follow`,
      {
        method: 'POST'
      }
    );
  },

  async unfollowProfile(publicProfileId) {
    return request(
      `/api/profiles/${encodeURIComponent(publicProfileId)}/follow`,
      {
        method: 'DELETE'
      }
    );
  },

  // ==========================================================
  // FEED & POSTS
  // ==========================================================

  async getPosts({
    category,
    search,
    type,
    cursor,
    limit
  } = {}) {
    const params = new URLSearchParams();

    if (category && category !== 'All') {
      params.append('category', category);
    }

    if (search) {
      params.append('search', search);
    }

    if (type) {
      params.append('type', type);
    }

    if (cursor) {
      params.append('cursor', cursor);
    }

    if (limit) {
      params.append('limit', limit);
    }

    const queryString = params.toString();

    return request(
      `/api/posts${queryString ? `?${queryString}` : ''}`
    );
  },

  // ==========================================================
  // IMAGE UPLOAD
  // ==========================================================

  async uploadImage(file) {
    return uploadRequest(
      '/api/upload/image',
      'image',
      file
    );
  },

  // ==========================================================
  // AVATAR UPLOAD
  // ==========================================================

  async uploadAvatar(file) {
    return uploadRequest(
      '/api/user/avatar',
      'avatar',
      file
    );
  },

  async removeAvatar() {
    return request('/api/user/avatar', {
      method: 'DELETE'
    });
  },

  // ==========================================================
  // POSTS
  // ==========================================================

  async createPost(payload) {
    return request('/api/posts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async editPost(id, content) {
    return request(
      `/api/posts/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          content
        })
      }
    );
  },

  async deletePost(id) {
    return request(
      `/api/posts/${encodeURIComponent(id)}`,
      {
        method: 'DELETE'
      }
    );
  },

  async toggleLike(id) {
    return request(
      `/api/posts/${encodeURIComponent(id)}/like`,
      {
        method: 'POST'
      }
    );
  },

  async toggleBookmark(id) {
    return request(
      `/api/posts/${encodeURIComponent(id)}/bookmark`,
      {
        method: 'POST'
      }
    );
  },

  async hidePost(id) {
    return request(
      `/api/posts/${encodeURIComponent(id)}/hide`,
      {
        method: 'POST'
      }
    );
  },

  async getSavedPosts() {
    return request('/api/user/saved');
  },

  // ==========================================================
  // COMMENTS
  // ==========================================================

  async getComments(postId) {
    return request(
      `/api/posts/${encodeURIComponent(postId)}/comments`
    );
  },

  async addComment(
    postId,
    {
      text,
      isAnonymous,
      parent_comment_id
    }
  ) {
    return request(
      `/api/posts/${encodeURIComponent(postId)}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({
          text,
          isAnonymous,
          parent_comment_id
        })
      }
    );
  },

  async deleteComment(postId, commentId) {
    return request(
      `/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
      {
        method: 'DELETE'
      }
    );
  },

  // ==========================================================
  // NOTIFICATIONS
  // ==========================================================

  async getNotifications() {
    return request('/api/notifications');
  },

  async markAllNotificationsRead() {
    return request('/api/notifications/read-all', {
      method: 'POST'
    });
  },

  // ==========================================================
  // ORGANIZATIONS & CLUBS
  // ==========================================================

  async getOrganizations() {
    return request('/api/organizations');
  },

  async toggleFollowOrg(orgId, isFollowing) {
    return request(
      `/api/organizations/${encodeURIComponent(orgId)}/follow`,
      {
        method: isFollowing ? 'DELETE' : 'POST'
      }
    );
  },

  // ==========================================================
  // SEARCH
  // ==========================================================

  async search(query) {
    return request(
      `/api/search?q=${encodeURIComponent(query)}`
    );
  },

  // ==========================================================
  // SETTINGS
  // ==========================================================

  async getSettings() {
    return request('/api/settings');
  },

  async updateSettings(payload) {
    return request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  // ==========================================================
  // BLOCKING
  // ==========================================================

  async getBlockedUsers() {
    return request('/api/blocks');
  },

  async blockUser(publicProfileId) {
    return request('/api/blocks', {
      method: 'POST',
      body: JSON.stringify({
        publicProfileId
      })
    });
  },

  async unblockUser(publicProfileId) {
    return request(
      `/api/blocks/${encodeURIComponent(publicProfileId)}`,
      {
        method: 'DELETE'
      }
    );
  },

  // ==========================================================
  // REPORTS
  // ==========================================================

  async reportItem({
    target_type,
    target_id,
    reason,
    details
  }) {
    return request('/api/reports', {
      method: 'POST',
      body: JSON.stringify({
        target_type,
        target_id,
        reason,
        details
      })
    });
  },

  // ==========================================================
  // DELETE ACCOUNT
  // ==========================================================

  async deleteAccount(confirmation) {
    return request('/api/user/delete-account', {
      method: 'POST',
      body: JSON.stringify({
        confirmation
      })
    });
  },

  // ==========================================================
  // EVENTS
  // ==========================================================

  async getEvents({
    category,
    search,
    upcoming
  } = {}) {
    const params = new URLSearchParams();

    if (category && category !== 'All') {
      params.append('category', category);
    }

    if (search) {
      params.append('search', search);
    }

    if (upcoming) {
      params.append('upcoming', 'true');
    }

    const queryString = params.toString();

    return request(
      `/api/events${queryString ? `?${queryString}` : ''}`
    );
  },

  // ==========================================================
  // ADMIN PORTAL
  // ==========================================================

  async getAdminOverview(timeRange = '7d') {
    return request(
      `/api/admin/overview?timeRange=${encodeURIComponent(timeRange)}`
    );
  },

  // ----------------------------------------------------------
  // ADMIN USERS
  // ----------------------------------------------------------

  async getAdminUsers({
    q = '',
    role = 'all',
    status = 'all',
    page = 1,
    limit = 20,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = {}) {
    const params = new URLSearchParams({
      q,
      role,
      status,
      page: String(page),
      limit: String(limit),
      sortBy,
      sortOrder
    });

    return request(
      `/api/admin/users?${params.toString()}`
    );
  },

  async getAdminUserDetail(id) {
    return request(
      `/api/admin/users/${encodeURIComponent(id)}`
    );
  },

  async updateAdminUser(id, payload) {
    return request(
      `/api/admin/users/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }
    );
  },

  async suspendAdminUser(id, reason = '') {
    return request(
      `/api/admin/users/${encodeURIComponent(id)}/suspend`,
      {
        method: 'POST',
        body: JSON.stringify({
          reason
        })
      }
    );
  },

  async unsuspendAdminUser(id) {
    return request(
      `/api/admin/users/${encodeURIComponent(id)}/unsuspend`,
      {
        method: 'POST'
      }
    );
  },

  async banAdminUser(id, reason = '') {
    return request(
      `/api/admin/users/${encodeURIComponent(id)}/ban`,
      {
        method: 'POST',
        body: JSON.stringify({
          reason
        })
      }
    );
  },

  async unbanAdminUser(id) {
    return request(
      `/api/admin/users/${encodeURIComponent(id)}/unban`,
      {
        method: 'POST'
      }
    );
  },

  async deleteAdminUser(id, reason = '') {
    return request(
      `/api/admin/users/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        body: JSON.stringify({
          reason
        })
      }
    );
  },

  async restoreAdminUser(id) {
    return request(
      `/api/admin/users/${encodeURIComponent(id)}/restore`,
      {
        method: 'POST'
      }
    );
  },

  async getAdminUserTimeline(id) {
    return request(
      `/api/admin/users/${encodeURIComponent(id)}/timeline`
    );
  },

  // ----------------------------------------------------------
  // ADMIN POSTS
  // ----------------------------------------------------------

  async getAdminPosts({
    q = '',
    tag = 'all',
    status = 'active',
    page = 1,
    limit = 20
  } = {}) {
    const params = new URLSearchParams({
      q,
      tag,
      status,
      page: String(page),
      limit: String(limit)
    });

    return request(
      `/api/admin/posts?${params.toString()}`
    );
  },

  async editAdminPost(id, content) {
    return request(
      `/api/admin/posts/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          content
        })
      }
    );
  },

  async deleteAdminPost(id, reason = '') {
    return request(
      `/api/admin/posts/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        body: JSON.stringify({
          reason
        })
      }
    );
  },

  async restoreAdminPost(id) {
    return request(
      `/api/admin/posts/${encodeURIComponent(id)}/restore`,
      {
        method: 'POST'
      }
    );
  },

  // ----------------------------------------------------------
  // ADMIN CONFESSIONS
  // ----------------------------------------------------------

  async getAdminConfessions({
    q = '',
    category = 'all',
    status = 'active',
    page = 1,
    limit = 20
  } = {}) {
    const params = new URLSearchParams({
      q,
      category,
      status,
      page: String(page),
      limit: String(limit)
    });

    return request(
      `/api/admin/confessions?${params.toString()}`
    );
  },

  async deleteAdminConfession(id, reason = '') {
    return request(
      `/api/admin/confessions/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        body: JSON.stringify({
          reason
        })
      }
    );
  },

  async restoreAdminConfession(id) {
    return request(
      `/api/admin/confessions/${encodeURIComponent(id)}/restore`,
      {
        method: 'POST'
      }
    );
  },

  // ----------------------------------------------------------
  // ADMIN COMMENTS
  // ----------------------------------------------------------

  async getAdminComments({
    q = '',
    status = 'active',
    page = 1,
    limit = 20
  } = {}) {
    const params = new URLSearchParams({
      q,
      status,
      page: String(page),
      limit: String(limit)
    });

    return request(
      `/api/admin/comments?${params.toString()}`
    );
  },

  async deleteAdminComment(id, reason = '') {
    return request(
      `/api/admin/comments/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        body: JSON.stringify({
          reason
        })
      }
    );
  },

  async restoreAdminComment(id) {
    return request(
      `/api/admin/comments/${encodeURIComponent(id)}/restore`,
      {
        method: 'POST'
      }
    );
  },

  // ----------------------------------------------------------
  // ADMIN EVENTS
  // ----------------------------------------------------------

  async getAdminEvents() {
    return request('/api/admin/events');
  },

  async createAdminEvent(payload) {
    return request('/api/admin/events', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateAdminEvent(id, payload) {
    return request(
      `/api/admin/events/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }
    );
  },

  async deleteAdminEvent(id, reason = '') {
    return request(
      `/api/admin/events/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        body: JSON.stringify({
          reason
        })
      }
    );
  },

  async restoreAdminEvent(id) {
    return request(
      `/api/admin/events/${encodeURIComponent(id)}/restore`,
      {
        method: 'POST'
      }
    );
  },

  // ----------------------------------------------------------
  // ADMIN REPORTS
  // ----------------------------------------------------------

  async getAdminReports({
    status = 'all',
    page = 1,
    limit = 50
  } = {}) {
    const params = new URLSearchParams({
      status,
      page: String(page),
      limit: String(limit)
    });

    return request(
      `/api/admin/reports?${params.toString()}`
    );
  },

  async assignAdminReport(id, moderator_id) {
    return request(
      `/api/admin/reports/${encodeURIComponent(id)}/assign`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          moderator_id
        })
      }
    );
  },

  async resolveAdminReport(
    id,
    {
      resolution,
      deleteContent = false
    } = {}
  ) {
    return request(
      `/api/admin/reports/${encodeURIComponent(id)}/resolve`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          resolution,
          deleteContent
        })
      }
    );
  },

  async dismissAdminReport(id, resolution = '') {
    return request(
      `/api/admin/reports/${encodeURIComponent(id)}/dismiss`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          resolution
        })
      }
    );
  },

  // ----------------------------------------------------------
  // ADMIN AUDIT LOG
  // ----------------------------------------------------------

  async getAdminAuditLogs({
    q = '',
    action = 'all',
    target_type = 'all',
    page = 1,
    limit = 50
  } = {}) {
    const params = new URLSearchParams({
      q,
      action,
      target_type,
      page: String(page),
      limit: String(limit)
    });

    return request(
      `/api/admin/audit?${params.toString()}`
    );
  },

  // ----------------------------------------------------------
  // USER BEHAVIOR ANALYTICS
  // ----------------------------------------------------------

  async getAdminAnalyticsOverview(
    timeRange = '7d'
  ) {
    return request(
      `/api/admin/analytics/overview?timeRange=${encodeURIComponent(
        timeRange
      )}`
    );
  },

  async getAdminAnalyticsPages() {
    return request('/api/admin/analytics/pages');
  },

  async getAdminAnalyticsEvents({
    event_type = 'all',
    page = 1,
    limit = 50
  } = {}) {
    const params = new URLSearchParams({
      event_type,
      page: String(page),
      limit: String(limit)
    });

    return request(
      `/api/admin/analytics/events?${params.toString()}`
    );
  },

  // ----------------------------------------------------------
  // SECURITY ANALYTICS
  // ----------------------------------------------------------

  async getAdminSecurityOverview() {
    return request('/api/admin/security/overview');
  }
};