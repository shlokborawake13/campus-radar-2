const express = require('express');
const router = express.Router();
const { query, withTransaction } = require('../db');
const { requireAdmin, logAdminAction } = require('../middleware/adminAuth');
const { revokeUserSessions } = require('../security');
const { formatTimeAgo } = require('../middleware/privacy');
const { adminLimiter } = require('../middleware/rateLimit');

// Apply admin rate limiting and admin authorization to all routes in this router
router.use(adminLimiter);
router.use(requireAdmin());

// ============================================================================
// 1. DASHBOARD OVERVIEW & AGGREGATE METRICS
// ============================================================================
router.get(['/overview', '/dashboard'], requireAdmin('dashboard.read'), async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;

    let intervalSql = "INTERVAL '7 days'";
    if (timeRange === 'today') intervalSql = "INTERVAL '1 day'";
    else if (timeRange === '30d') intervalSql = "INTERVAL '30 days'";
    else if (timeRange === '90d') intervalSql = "INTERVAL '90 days'";

    const [
      usersCount,
      verifiedUsers,
      unverifiedUsers,
      activeUsers,
      suspendedUsers,
      bannedUsers,
      newToday,
      newWeek,
      newMonth,
      postsCount,
      confessionsCount,
      commentsCount,
      eventsCount,
      reportsCount,
      pendingReports,
      deletedPosts,
      deletedConfessions,
      onlineUsers,
      dauRes,
      wauRes,
      mauRes,
      regTrendRes,
      postsTrendRes,
      activityTrendRes
    ] = await Promise.all([
      query('SELECT count(*) FROM users'),
      query('SELECT count(*) FROM users WHERE email_verified = true'),
      query('SELECT count(*) FROM users WHERE email_verified = false'),
      query("SELECT count(*) FROM users WHERE status = 'active'"),
      query("SELECT count(*) FROM users WHERE status = 'suspended'"),
      query("SELECT count(*) FROM users WHERE status = 'banned'"),
      query("SELECT count(*) FROM users WHERE created_at >= CURRENT_DATE"),
      query("SELECT count(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'"),
      query("SELECT count(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'"),
      query('SELECT count(*) FROM posts WHERE deleted_at IS NULL'),
      query('SELECT count(*) FROM confessions WHERE deleted_at IS NULL'),
      query('SELECT count(*) FROM comments WHERE deleted_at IS NULL'),
      query('SELECT count(*) FROM events WHERE deleted_at IS NULL'),
      query('SELECT count(*) FROM reports'),
      query("SELECT count(*) FROM reports WHERE LOWER(status) = 'pending'"),
      query('SELECT count(*) FROM posts WHERE deleted_at IS NOT NULL'),
      query('SELECT count(*) FROM confessions WHERE deleted_at IS NOT NULL'),
      // Online users: active session in last 15 minutes
      query("SELECT count(DISTINCT user_id) FROM user_sessions WHERE is_active = true AND last_active_at >= NOW() - INTERVAL '15 minutes'"),
      // DAU: users with session or activity today
      query("SELECT count(DISTINCT user_id) FROM login_activity WHERE status = 'SUCCESS' AND created_at >= CURRENT_DATE"),
      // WAU: users in last 7 days
      query("SELECT count(DISTINCT user_id) FROM login_activity WHERE status = 'SUCCESS' AND created_at >= CURRENT_DATE - INTERVAL '7 days'"),
      // MAU: users in last 30 days
      query("SELECT count(DISTINCT user_id) FROM login_activity WHERE status = 'SUCCESS' AND created_at >= CURRENT_DATE - INTERVAL '30 days'"),
      // Registration trend
      query(`
        SELECT to_char(created_at, 'YYYY-MM-DD') as date, count(*) as count
        FROM users
        WHERE created_at >= NOW() - ${intervalSql}
        GROUP BY date
        ORDER BY date ASC
      `),
      // Posts trend
      query(`
        SELECT to_char(created_at, 'YYYY-MM-DD') as date, count(*) as count
        FROM posts
        WHERE created_at >= NOW() - ${intervalSql}
        GROUP BY date
        ORDER BY date ASC
      `),
      // Active user sessions trend
      query(`
        SELECT to_char(created_at, 'YYYY-MM-DD') as date, count(*) as count
        FROM login_activity
        WHERE status = 'SUCCESS' AND created_at >= NOW() - ${intervalSql}
        GROUP BY date
        ORDER BY date ASC
      `)
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers: parseInt(usersCount.rows[0].count, 10),
        verifiedUsers: parseInt(verifiedUsers.rows[0].count, 10),
        unverifiedUsers: parseInt(unverifiedUsers.rows[0].count, 10),
        activeUsers: parseInt(activeUsers.rows[0].count, 10),
        suspendedUsers: parseInt(suspendedUsers.rows[0].count, 10),
        bannedUsers: parseInt(bannedUsers.rows[0].count, 10),
        newUsersToday: parseInt(newToday.rows[0].count, 10),
        newUsersThisWeek: parseInt(newWeek.rows[0].count, 10),
        newUsersThisMonth: parseInt(newMonth.rows[0].count, 10),
        totalPosts: parseInt(postsCount.rows[0].count, 10),
        totalConfessions: parseInt(confessionsCount.rows[0].count, 10),
        totalComments: parseInt(commentsCount.rows[0].count, 10),
        totalEvents: parseInt(eventsCount.rows[0].count, 10),
        totalReports: parseInt(reportsCount.rows[0].count, 10),
        pendingReports: parseInt(pendingReports.rows[0].count, 10),
        deletedContent: parseInt(deletedPosts.rows[0].count, 10) + parseInt(deletedConfessions.rows[0].count, 10),
        onlineUsers: parseInt(onlineUsers.rows[0].count, 10),
        dau: parseInt(dauRes.rows[0].count, 10),
        wau: parseInt(wauRes.rows[0].count, 10),
        mau: parseInt(mauRes.rows[0].count, 10)
      },
      charts: {
        registrations: regTrendRes.rows,
        posts: postsTrendRes.rows,
        logins: activityTrendRes.rows
      }
    });
  } catch (err) {
    console.error('[Admin Overview Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to generate overview statistics' });
  }
});

// ============================================================================
// 2. USER MANAGEMENT
// ============================================================================

// List Users with search, filtering, and pagination
router.get('/users', requireAdmin('users.read'), async (req, res) => {
  try {
    const { q, role, status, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const whereClauses = [];
    const params = [];

    if (q && q.trim()) {
      params.push(`%${q.trim().toLowerCase()}%`);
      whereClauses.push(`(
        LOWER(u.full_name) LIKE $${params.length} OR 
        LOWER(u.email) LIKE $${params.length} OR 
        LOWER(u.handle) LIKE $${params.length} OR 
        LOWER(u.anonymous_pseudonym) LIKE $${params.length} OR
        LOWER(COALESCE(u.department, '')) LIKE $${params.length}
      )`);
    }

    if (role && role !== 'all') {
      params.push(role.toLowerCase());
      whereClauses.push(`LOWER(u.role) = $${params.length}`);
    }

    if (status && status !== 'all') {
      params.push(status.toLowerCase());
      whereClauses.push(`LOWER(u.status) = $${params.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const safeSort = ['created_at', 'reputation_score', 'full_name', 'email'].includes(sortBy) ? sortBy : 'created_at';
    const safeOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countRes = await query(`SELECT count(*) FROM users u ${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const queryParams = [...params, take, offset];
    const usersRes = await query(`
      SELECT u.id, u.public_profile_id, u.full_name, u.email, u.phone_number,
             u.department, u.graduation_year, u.anonymous_pseudonym, u.handle,
             u.avatar_url, u.role, u.status, u.email_verified, u.phone_verified,
             u.reputation_score, u.created_at,
             (SELECT count(*) FROM posts WHERE author_id = u.id AND deleted_at IS NULL) as posts_count,
             (SELECT count(*) FROM confessions WHERE author_id = u.id AND deleted_at IS NULL) as confessions_count,
             (SELECT count(*) FROM reports WHERE target_type = 'user' AND target_id = u.id) as reports_count,
             (SELECT count(*) FROM follows WHERE following_id = u.id) as followers_count,
             (SELECT max(created_at) FROM login_activity WHERE user_id = u.id AND status = 'SUCCESS') as last_login_at
      FROM users u
      ${whereSql}
      ORDER BY u.${safeSort} ${safeOrder}
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `, queryParams);

    res.json({
      success: true,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take),
      users: usersRes.rows
    });
  } catch (err) {
    console.error('[Admin Users List Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve student directory' });
  }
});

// Get User Detail (Cleanly split into IDENTITY, ACCOUNT, ACTIVITY, SECURITY)
router.get('/users/:id', requireAdmin('users.read'), async (req, res) => {
  try {
    const { id } = req.params;

    const userRes = await query(`
      SELECT u.id, u.public_profile_id, u.full_name, u.email, u.phone_number,
             u.department, u.graduation_year, u.anonymous_pseudonym, u.handle,
             u.avatar_url, u.bio, u.role, u.status, u.email_verified, u.phone_verified,
             u.reputation_score, u.created_at, u.updated_at
      FROM users u
      WHERE u.id = $1
    `, [id]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const u = userRes.rows[0];

    // Gather Activity & Security metrics
    const [
      postsCountRes,
      confessionsCountRes,
      commentsCountRes,
      likesCountRes,
      savesCountRes,
      followersCountRes,
      followingCountRes,
      reportsAgainstRes,
      recentLoginsRes,
      activeSessionsRes
    ] = await Promise.all([
      query('SELECT count(*) FROM posts WHERE author_id = $1', [id]),
      query('SELECT count(*) FROM confessions WHERE author_id = $1', [id]),
      query('SELECT count(*) FROM comments WHERE author_id = $1', [id]),
      query('SELECT count(*) FROM post_likes WHERE user_id = $1', [id]),
      query('SELECT count(*) FROM saved_posts WHERE user_id = $1', [id]),
      query('SELECT count(*) FROM follows WHERE following_id = $1', [id]),
      query('SELECT count(*) FROM follows WHERE follower_id = $1', [id]),
      query("SELECT count(*) FROM reports WHERE target_type = 'user' AND target_id = $1", [id]),
      query('SELECT status, ip_address, user_agent, failure_reason, created_at FROM login_activity WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [id]),
      query('SELECT id, device_info, ip_address, is_active, last_active_at, created_at FROM user_sessions WHERE user_id = $1 AND is_active = true', [id])
    ]);

    // Structured User Object without any passwords, OTPs, or session secrets
    const userDetail = {
      identity: {
        id: u.id,
        publicProfileId: u.public_profile_id,
        fullName: u.full_name,
        email: u.email,
        phone: u.phone_number,
        department: u.department,
        graduationYear: u.graduation_year,
        anonymousPseudonym: u.anonymous_pseudonym,
        handle: u.handle,
        avatar: u.avatar_url,
        bio: u.bio
      },
      account: {
        createdAt: u.created_at,
        updatedAt: u.updated_at,
        emailVerified: u.email_verified,
        phoneVerified: u.phone_verified,
        status: u.status,
        role: u.role,
        reputationScore: u.reputation_score
      },
      activity: {
        postsCount: parseInt(postsCountRes.rows[0].count, 10),
        confessionsCount: parseInt(confessionsCountRes.rows[0].count, 10),
        commentsCount: parseInt(commentsCountRes.rows[0].count, 10),
        likesCount: parseInt(likesCountRes.rows[0].count, 10),
        savesCount: parseInt(savesCountRes.rows[0].count, 10),
        followersCount: parseInt(followersCountRes.rows[0].count, 10),
        followingCount: parseInt(followingCountRes.rows[0].count, 10),
        reportsAgainstCount: parseInt(reportsAgainstRes.rows[0].count, 10)
      },
      security: {
        recentLogins: recentLoginsRes.rows,
        activeSessions: activeSessionsRes.rows
      }
    };

    // Log admin view of sensitive profile
    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_VIEWED_USER',
      targetType: 'user',
      targetId: id,
      metadata: { inspectedEmail: u.email },
      req
    });

    res.json({ success: true, user: userDetail });
  } catch (err) {
    console.error('[Admin User Detail Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve student profile' });
  }
});

// Update Permitted User Fields (Controlled - No mass assignment)
router.patch('/users/:id', requireAdmin('users.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, department, graduation_year, bio, role, status } = req.body;

    // Check target existence
    const userRes = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const current = userRes.rows[0];

    const updates = [];
    const params = [];
    const changedFields = {};

    if (full_name !== undefined && typeof full_name === 'string' && full_name.trim().length > 0) {
      params.push(full_name.trim());
      updates.push(`full_name = $${params.length}`);
      changedFields.full_name = { old: current.full_name, new: full_name.trim() };
    }

    if (department !== undefined) {
      params.push(String(department).slice(0, 100));
      updates.push(`department = $${params.length}`);
      changedFields.department = { old: current.department, new: department };
    }

    if (graduation_year !== undefined) {
      params.push(parseInt(graduation_year, 10) || null);
      updates.push(`graduation_year = $${params.length}`);
      changedFields.graduation_year = { old: current.graduation_year, new: graduation_year };
    }

    if (bio !== undefined) {
      params.push(String(bio).slice(0, 300));
      updates.push(`bio = $${params.length}`);
      changedFields.bio = { old: current.bio, new: bio };
    }

    // Role changes require SUPER_ADMIN or ADMIN
    if (role !== undefined && ['student', 'admin', 'moderator', 'super_admin'].includes(role)) {
      if (req.user.role === 'super_admin' || req.user.role === 'admin') {
        params.push(role);
        updates.push(`role = $${params.length}`);
        changedFields.role = { old: current.role, new: role };
      }
    }

    // Status change
    if (status !== undefined && ['active', 'suspended', 'banned', 'deleted'].includes(status)) {
      params.push(status);
      updates.push(`status = $${params.length}`);
      changedFields.status = { old: current.status, new: status };
      if (status !== 'active') {
        revokeUserSessions(id);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid update fields supplied' });
    }

    params.push(id);
    await query(`
      UPDATE users 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${params.length}
    `, params);

    // Audit log
    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_UPDATED_USER',
      targetType: 'user',
      targetId: id,
      metadata: { changedFields },
      req
    });

    res.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    console.error('[Admin Update User Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to update student account' });
  }
});

// Dedicated Role Management Endpoint (Server-Side Authoritative & Audited)
router.patch('/users/:id/role', requireAdmin('users.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['student', 'admin', 'moderator', 'super_admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Valid role is required (student, admin, moderator, super_admin).' });
    }

    const actorRole = (req.authoritativeRole || req.user.role || '').toLowerCase();
    if (actorRole !== 'admin' && actorRole !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges to alter user roles.' });
    }

    // Prevent changing own role (separation of duties)
    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Self-role modification is strictly prevented.' });
    }

    const userRes = await query('SELECT id, role, email FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const targetUser = userRes.rows[0];

    // Update authoritative user_roles table
    await query(`
      INSERT INTO user_roles (user_id, role, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()
    `, [id, role]);

    // Update users table for consistency
    await query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [role, id]);

    // Revoke sessions of the user to force immediate re-authentication with new privileges
    revokeUserSessions(id);

    // Audit log
    await logAdminAction({
      actorId: req.user.id,
      adminRole: actorRole,
      action: 'USER_ROLE_CHANGED',
      targetType: 'user',
      targetId: id,
      metadata: { targetEmail: targetUser.email, oldRole: targetUser.role, newRole: role },
      req,
      status: 'SUCCESS'
    });

    res.json({ success: true, message: `User role successfully updated to ${role}.`, role });
  } catch (err) {
    console.error('[Admin Change Role Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to update user role.' });
  }
});

// Suspend User
router.post('/users/:id/suspend', requireAdmin('users.suspend'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Terms of service violation' } = req.body;

    await query("UPDATE users SET status = 'suspended', updated_at = NOW() WHERE id = $1", [id]);
    revokeUserSessions(id);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_SUSPENDED_USER',
      targetType: 'user',
      targetId: id,
      metadata: { reason },
      req
    });

    res.json({ success: true, message: 'User suspended and active sessions revoked' });
  } catch (err) {
    console.error('[Admin Suspend Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to suspend user' });
  }
});

// Unsuspend User
router.post('/users/:id/unsuspend', requireAdmin('users.suspend'), async (req, res) => {
  try {
    const { id } = req.params;

    await query("UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1", [id]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_UNSUSPENDED_USER',
      targetType: 'user',
      targetId: id,
      metadata: {},
      req
    });

    res.json({ success: true, message: 'User reinstated to active status' });
  } catch (err) {
    console.error('[Admin Unsuspend Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to unsuspend user' });
  }
});

// Remove Inappropriate Avatar (Admin Moderation)
router.delete('/users/:id/avatar', requireAdmin('users.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Inappropriate profile picture' } = req.body || {};

    const userRes = await query('SELECT avatar_url FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const oldAvatarUrl = userRes.rows[0].avatar_url;
    if (oldAvatarUrl) {
      const { deleteAvatarFromStorage } = require('../services/avatarService');
      await deleteAvatarFromStorage(oldAvatarUrl, id);
    }

    await query('UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1', [id]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_REMOVED_AVATAR',
      targetType: 'user',
      targetId: id,
      metadata: { reason, previousAvatar: oldAvatarUrl },
      req
    });

    res.json({ success: true, message: 'Student avatar removed and audited successfully' });
  } catch (err) {
    console.error('[Admin Remove Avatar Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to remove user avatar' });
  }
});

// Ban User
router.post('/users/:id/ban', requireAdmin('users.ban'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Severe conduct violation' } = req.body;

    await query("UPDATE users SET status = 'banned', updated_at = NOW() WHERE id = $1", [id]);
    revokeUserSessions(id);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_BANNED_USER',
      targetType: 'user',
      targetId: id,
      metadata: { reason },
      req
    });

    res.json({ success: true, message: 'User permanently banned' });
  } catch (err) {
    console.error('[Admin Ban Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to ban user' });
  }
});

// Unban User
router.post('/users/:id/unban', requireAdmin('users.ban'), async (req, res) => {
  try {
    const { id } = req.params;

    await query("UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1", [id]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_UNBANNED_USER',
      targetType: 'user',
      targetId: id,
      metadata: {},
      req
    });

    res.json({ success: true, message: 'User unbanned' });
  } catch (err) {
    console.error('[Admin Unban Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to unban user' });
  }
});

// Deactivate / Soft Delete User
router.delete('/users/:id', requireAdmin('users.delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Admin account removal' } = req.body;

    await query("UPDATE users SET status = 'deleted', updated_at = NOW() WHERE id = $1", [id]);
    revokeUserSessions(id);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_DELETED_USER',
      targetType: 'user',
      targetId: id,
      metadata: { reason },
      req
    });

    res.json({ success: true, message: 'User account deactivated' });
  } catch (err) {
    console.error('[Admin Delete User Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to deactivate user' });
  }
});

// Restore User
router.post('/users/:id/restore', requireAdmin('users.restore'), async (req, res) => {
  try {
    const { id } = req.params;

    await query("UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1", [id]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_RESTORED_USER',
      targetType: 'user',
      targetId: id,
      metadata: {},
      req
    });

    res.json({ success: true, message: 'User account restored' });
  } catch (err) {
    console.error('[Admin Restore User Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to restore user' });
  }
});

// User Chronological Activity Timeline
router.get('/users/:id/timeline', requireAdmin('users.read'), async (req, res) => {
  try {
    const { id } = req.params;

    const [eventsRes, loginsRes] = await Promise.all([
      query(`
        SELECT event_type, page, target_type, target_id, created_at, 'activity' as source
        FROM user_activity_events
        WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 50
      `, [id]),
      query(`
        SELECT 'LOGIN' as event_type, status as target_type, ip_address as target_id, created_at, 'auth' as source
        FROM login_activity
        WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 20
      `, [id])
    ]);

    const combined = [...eventsRes.rows, ...loginsRes.rows]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 50);

    res.json({ success: true, timeline: combined });
  } catch (err) {
    console.error('[Admin Timeline Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve timeline' });
  }
});

// ============================================================================
// 3. POSTS MANAGEMENT
// ============================================================================

router.get('/posts', requireAdmin('posts.read'), async (req, res) => {
  try {
    const { q, tag, status = 'active', page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const where = [];
    const params = [];

    if (status === 'active') {
      where.push('p.deleted_at IS NULL');
    } else if (status === 'deleted') {
      where.push('p.deleted_at IS NOT NULL');
    }

    if (q && q.trim()) {
      params.push(`%${q.trim().toLowerCase()}%`);
      where.push(`(LOWER(p.content) LIKE $${params.length} OR LOWER(p.tag) LIKE $${params.length} OR LOWER(u.full_name) LIKE $${params.length})`);
    }

    if (tag && tag !== 'all') {
      params.push(`%${tag.toLowerCase()}%`);
      where.push(`LOWER(p.tag) LIKE $${params.length}`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await query(`
      SELECT count(*) FROM posts p 
      JOIN users u ON u.id = p.author_id 
      ${whereSql}
    `, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const queryParams = [...params, take, offset];
    const postsRes = await query(`
      SELECT p.id, p.content, p.image_url, p.tag, p.likes_count, p.comments_count,
             p.created_at, p.updated_at, p.deleted_at, p.deletion_reason,
             u.id as author_id, u.full_name as author_name, u.email as author_email,
             u.anonymous_pseudonym, u.handle, u.department as author_department,
             (SELECT count(*) FROM reports WHERE target_type = 'post' AND target_id = p.id) as reports_count
      FROM posts p
      JOIN users u ON u.id = p.author_id
      ${whereSql}
      ORDER BY p.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `, queryParams);

    res.json({
      success: true,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take),
      posts: postsRes.rows
    });
  } catch (err) {
    console.error('[Admin Posts Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch posts' });
  }
});

// Edit Post Content
router.patch('/posts/:id', requireAdmin('posts.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Content cannot be empty' });
    }

    await query('UPDATE posts SET content = $1, is_edited = true, updated_at = NOW() WHERE id = $2', [content.trim(), id]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_EDITED_POST',
      targetType: 'post',
      targetId: id,
      metadata: { newLength: content.trim().length },
      req
    });

    res.json({ success: true, message: 'Post content updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update post' });
  }
});

// Soft Delete Post
router.delete('/posts/:id', requireAdmin('posts.delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Admin moderation removal' } = req.body;

    await query(`
      UPDATE posts 
      SET deleted_at = NOW(), deleted_by = $1, deletion_reason = $2 
      WHERE id = $3
    `, [req.user.id, reason, id]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_DELETED_POST',
      targetType: 'post',
      targetId: id,
      metadata: { reason },
      req
    });

    res.json({ success: true, message: 'Post removed from feed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete post' });
  }
});

// Restore Post
router.post('/posts/:id/restore', requireAdmin('posts.restore'), async (req, res) => {
  try {
    const { id } = req.params;

    await query('UPDATE posts SET deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL WHERE id = $1', [id]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_RESTORED_POST',
      targetType: 'post',
      targetId: id,
      metadata: {},
      req
    });

    res.json({ success: true, message: 'Post restored to feed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to restore post' });
  }
});

// ============================================================================
// 4. CONFESSIONS MANAGEMENT
// ============================================================================

router.get('/confessions', requireAdmin('confessions.read'), async (req, res) => {
  try {
    const { q, category, status = 'active', page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const where = [];
    const params = [];

    if (status === 'active') {
      where.push('c.deleted_at IS NULL');
    } else if (status === 'deleted') {
      where.push('c.deleted_at IS NOT NULL');
    }

    if (q && q.trim()) {
      params.push(`%${q.trim().toLowerCase()}%`);
      where.push(`(LOWER(c.content) LIKE $${params.length} OR LOWER(c.anonymous_pseudonym) LIKE $${params.length})`);
    }

    if (category && category !== 'all') {
      params.push(`%${category.toLowerCase()}%`);
      where.push(`LOWER(c.category) LIKE $${params.length}`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await query(`SELECT count(*) FROM confessions c ${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const queryParams = [...params, take, offset];
    const confRes = await query(`
      SELECT c.id, c.content, c.category, c.anonymous_pseudonym, c.likes_count, c.comments_count,
             c.created_at, c.deleted_at, c.deletion_reason,
             u.id as author_id, u.full_name as author_name, u.email as author_email,
             u.department as author_department,
             (SELECT count(*) FROM reports WHERE target_type = 'confession' AND target_id = c.id) as reports_count
      FROM confessions c
      JOIN users u ON u.id = c.author_id
      ${whereSql}
      ORDER BY c.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `, queryParams);

    res.json({
      success: true,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take),
      confessions: confRes.rows
    });
  } catch (err) {
    console.error('[Admin Confessions Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch confessions' });
  }
});

// Soft Delete Confession
router.delete('/confessions/:id', requireAdmin('confessions.delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Content policy violation' } = req.body;

    await query(`
      UPDATE confessions 
      SET deleted_at = NOW(), deleted_by = $1, deletion_reason = $2 
      WHERE id = $3
    `, [req.user.id, reason, id]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_DELETED_CONFESSION',
      targetType: 'confession',
      targetId: id,
      metadata: { reason },
      req
    });

    res.json({ success: true, message: 'Confession removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete confession' });
  }
});

// Restore Confession
router.post('/confessions/:id/restore', requireAdmin('confessions.restore'), async (req, res) => {
  try {
    const { id } = req.params;

    await query('UPDATE confessions SET deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL WHERE id = $1', [id]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_RESTORED_CONFESSION',
      targetType: 'confession',
      targetId: id,
      metadata: {},
      req
    });

    res.json({ success: true, message: 'Confession restored' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to restore confession' });
  }
});

// ============================================================================
// 5. COMMENTS MANAGEMENT
// ============================================================================

router.get('/comments', requireAdmin('comments.read'), async (req, res) => {
  try {
    const { q, status = 'active', page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const where = [];
    const params = [];

    if (status === 'active') {
      where.push('c.deleted_at IS NULL');
    } else if (status === 'deleted') {
      where.push('c.deleted_at IS NOT NULL');
    }

    if (q && q.trim()) {
      params.push(`%${q.trim().toLowerCase()}%`);
      where.push(`(LOWER(c.content) LIKE $${params.length} OR LOWER(u.full_name) LIKE $${params.length})`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await query(`
      SELECT count(*) FROM comments c 
      LEFT JOIN users u ON u.id = c.author_id 
      ${whereSql}
    `, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const queryParams = [...params, take, offset];
    const commentsRes = await query(`
      SELECT c.id, c.post_id, c.content, c.is_anonymous, c.anonymous_pseudonym,
             c.created_at, c.deleted_at, c.deletion_reason,
             u.id as author_id, u.full_name as author_name, u.email as author_email,
             u.anonymous_pseudonym as user_pseudonym, u.handle,
             (SELECT count(*) FROM reports WHERE target_type = 'comment' AND target_id = c.id) as reports_count
      FROM comments c
      LEFT JOIN users u ON u.id = c.author_id
      ${whereSql}
      ORDER BY c.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `, queryParams);

    res.json({
      success: true,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take),
      comments: commentsRes.rows
    });
  } catch (err) {
    console.error('[Admin Comments Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch comments' });
  }
});

// Delete Comment
router.delete('/comments/:id', requireAdmin('comments.delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Moderator removal' } = req.body;

    const commRes = await query('SELECT post_id FROM comments WHERE id = $1', [id]);
    if (commRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    const postId = commRes.rows[0].post_id;

    await query(`
      UPDATE comments 
      SET deleted_at = NOW(), deleted_by = $1, deletion_reason = $2 
      WHERE id = $3
    `, [req.user.id, reason, id]);

    // Decrement counters safely on both posts and confessions
    await query('UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1', [postId]);
    await query('UPDATE confessions SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1', [postId]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_DELETED_COMMENT',
      targetType: 'comment',
      targetId: id,
      metadata: { postId, reason },
      req
    });

    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete comment' });
  }
});

// Restore Comment
router.post('/comments/:id/restore', requireAdmin('comments.restore'), async (req, res) => {
  try {
    const { id } = req.params;

    const commRes = await query('SELECT post_id FROM comments WHERE id = $1', [id]);
    if (commRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    const postId = commRes.rows[0].post_id;

    await query('UPDATE comments SET deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL WHERE id = $1', [id]);

    await query('UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1', [postId]);
    await query('UPDATE confessions SET comments_count = comments_count + 1 WHERE id = $1', [postId]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_RESTORED_COMMENT',
      targetType: 'comment',
      targetId: id,
      metadata: { postId },
      req
    });

    res.json({ success: true, message: 'Comment restored' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to restore comment' });
  }
});

// ============================================================================
// 6. EVENTS MANAGEMENT
// ============================================================================

router.get('/events', requireAdmin('events.read'), async (req, res) => {
  try {
    const eventsRes = await query(`
      SELECT e.*, u.full_name as organizer_name, u.email as organizer_email
      FROM events e
      LEFT JOIN users u ON u.id = e.organizer_id
      ORDER BY e.event_date DESC
    `);
    res.json({ success: true, events: eventsRes.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load events' });
  }
});

router.post('/events', requireAdmin('events.create'), async (req, res) => {
  try {
    const { title, description, category, location, event_date, end_date, image_url, is_published } = req.body;

    if (!title || !description || !location || !event_date) {
      return res.status(400).json({ success: false, message: 'Title, description, location, and date are required' });
    }

    const insRes = await query(`
      INSERT INTO events (title, description, category, location, event_date, end_date, image_url, organizer_id, is_published)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      title.trim(),
      description.trim(),
      category || 'Campus Life',
      location.trim(),
      event_date,
      end_date || null,
      image_url || null,
      req.user.id,
      is_published !== false
    ]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_CREATED_EVENT',
      targetType: 'event',
      targetId: insRes.rows[0].id,
      metadata: { title },
      req
    });

    res.status(201).json({ success: true, event: insRes.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create event' });
  }
});

router.patch('/events/:id', requireAdmin('events.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, location, event_date, end_date, image_url, is_published } = req.body;

    await query(`
      UPDATE events 
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          category = COALESCE($3, category),
          location = COALESCE($4, location),
          event_date = COALESCE($5, event_date),
          end_date = COALESCE($6, end_date),
          image_url = COALESCE($7, image_url),
          is_published = COALESCE($8, is_published),
          updated_at = NOW()
      WHERE id = $9
    `, [title, description, category, location, event_date, end_date, image_url, is_published, id]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_UPDATED_EVENT',
      targetType: 'event',
      targetId: id,
      metadata: { title },
      req
    });

    res.json({ success: true, message: 'Event updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update event' });
  }
});

router.delete('/events/:id', requireAdmin('events.delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Cancelled event' } = req.body;

    await query(`
      UPDATE events 
      SET deleted_at = NOW(), deleted_by = $1, deletion_reason = $2 
      WHERE id = $3
    `, [req.user.id, reason, id]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_DELETED_EVENT',
      targetType: 'event',
      targetId: id,
      metadata: { reason },
      req
    });

    res.json({ success: true, message: 'Event removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete event' });
  }
});

router.post('/events/:id/restore', requireAdmin('events.restore'), async (req, res) => {
  try {
    const { id } = req.params;

    await query('UPDATE events SET deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL WHERE id = $1', [id]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_RESTORED_EVENT',
      targetType: 'event',
      targetId: id,
      metadata: {},
      req
    });

    res.json({ success: true, message: 'Event restored' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to restore event' });
  }
});

// ============================================================================
// 7. REPORTS / MODERATION CENTER
// ============================================================================

router.get('/reports', requireAdmin('reports.read'), async (req, res) => {
  try {
    const { status = 'all', page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const where = [];
    const params = [];

    if (status && status !== 'all') {
      params.push(status.toLowerCase());
      where.push(`LOWER(r.status) = $${params.length}`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await query(`SELECT count(*) FROM reports r ${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const queryParams = [...params, take, offset];
    const reportsRes = await query(`
      SELECT r.id, r.target_type, r.target_id, r.reason, r.details, r.status,
             r.resolution, r.resolved_at, r.created_at,
             u.id as reporter_id, u.full_name as reporter_name, u.email as reporter_email,
             u.anonymous_pseudonym as reporter_pseudonym,
             m.full_name as reviewer_name,
             a.full_name as assigned_name
      FROM reports r
      LEFT JOIN users u ON u.id = r.reporter_id
      LEFT JOIN users m ON m.id = r.reviewed_by
      LEFT JOIN users a ON a.id = r.assigned_to
      ${whereSql}
      ORDER BY r.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `, queryParams);

    res.json({
      success: true,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take),
      reports: reportsRes.rows
    });
  } catch (err) {
    console.error('[Admin Reports Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch moderation reports' });
  }
});

// Assign Moderator
router.patch('/reports/:id/assign', requireAdmin('reports.assign'), async (req, res) => {
  try {
    const { id } = req.params;
    const { moderator_id } = req.body;

    await query(`
      UPDATE reports 
      SET assigned_to = $1, status = 'under_review' 
      WHERE id = $2
    `, [moderator_id || req.user.id, id]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_ASSIGNED_REPORT',
      targetType: 'report',
      targetId: id,
      metadata: { assignedTo: moderator_id || req.user.id },
      req
    });

    res.json({ success: true, message: 'Report assigned to moderator' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to assign report' });
  }
});

// Resolve Report (Optionally taking moderation content action)
router.patch('/reports/:id/resolve', requireAdmin('reports.resolve'), async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution = 'Violation verified and addressed', deleteContent = false } = req.body;

    const repRes = await query('SELECT * FROM reports WHERE id = $1', [id]);
    if (repRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    const report = repRes.rows[0];

    // If requested, take content action
    if (deleteContent && report.target_id) {
      if (report.target_type === 'post') {
        await query("UPDATE posts SET deleted_at = NOW(), deletion_reason = 'Report resolved' WHERE id = $1", [report.target_id]);
      } else if (report.target_type === 'confession') {
        await query("UPDATE confessions SET deleted_at = NOW(), deletion_reason = 'Report resolved' WHERE id = $1", [report.target_id]);
      } else if (report.target_type === 'comment') {
        await query("UPDATE comments SET deleted_at = NOW(), deletion_reason = 'Report resolved' WHERE id = $1", [report.target_id]);
      }
    }

    await query(`
      UPDATE reports 
      SET status = 'resolved', resolution = $1, reviewed_by = $2, resolved_at = NOW() 
      WHERE id = $3
    `, [resolution, req.user.id, id]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_RESOLVED_REPORT',
      targetType: 'report',
      targetId: id,
      metadata: { resolution, deleteContent },
      req
    });

    res.json({ success: true, message: 'Report marked as resolved' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to resolve report' });
  }
});

// Dismiss Report
router.patch('/reports/:id/dismiss', requireAdmin('reports.dismiss'), async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution = 'No policy violation found' } = req.body;

    await query(`
      UPDATE reports 
      SET status = 'dismissed', resolution = $1, reviewed_by = $2, resolved_at = NOW() 
      WHERE id = $3
    `, [resolution, req.user.id, id]);

    await logAdminAction({
      actorId: req.user.id,
      adminRole: req.user.role,
      action: 'ADMIN_DISMISSED_REPORT',
      targetType: 'report',
      targetId: id,
      metadata: { resolution },
      req
    });

    res.json({ success: true, message: 'Report dismissed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to dismiss report' });
  }
});

// ============================================================================
// 8. DEDICATED IMMUTABLE ADMIN AUDIT LOG
// ============================================================================

router.get('/audit', requireAdmin('audit.read'), async (req, res) => {
  try {
    const { q, action, target_type, page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const where = [];
    const params = [];

    if (q && q.trim()) {
      params.push(`%${q.trim().toLowerCase()}%`);
      where.push(`(LOWER(l.action) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR LOWER(u.full_name) LIKE $${params.length})`);
    }

    if (action && action !== 'all') {
      params.push(action);
      where.push(`l.action = $${params.length}`);
    }

    if (target_type && target_type !== 'all') {
      params.push(target_type);
      where.push(`l.target_type = $${params.length}`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await query(`
      SELECT count(*) FROM admin_audit_logs l 
      LEFT JOIN users u ON u.id = l.actor_id 
      ${whereSql}
    `, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const queryParams = [...params, take, offset];
    const logsRes = await query(`
      SELECT l.id, l.actor_id, l.admin_role, l.action, l.target_type, l.target_id,
             l.metadata, l.ip_address, l.user_agent, l.request_id, l.status, l.created_at,
             u.full_name as admin_name, u.email as admin_email
      FROM admin_audit_logs l
      LEFT JOIN users u ON u.id = l.actor_id
      ${whereSql}
      ORDER BY l.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `, queryParams);

    res.json({
      success: true,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take),
      logs: logsRes.rows
    });
  } catch (err) {
    console.error('[Admin Audit Log Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve audit trail' });
  }
});

// ============================================================================
// 9. USER BEHAVIOR ANALYTICS & TIME SPENT ENGINE
// ============================================================================

router.get(['/analytics', '/analytics/overview'], requireAdmin('analytics.read'), async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;

    let intervalSql = "INTERVAL '7 days'";
    if (timeRange === 'today') intervalSql = "INTERVAL '1 day'";
    else if (timeRange === '30d') intervalSql = "INTERVAL '30 days'";
    else if (timeRange === '90d') intervalSql = "INTERVAL '90 days'";

    const [
      totalPageViews,
      uniqueVisitors,
      activeTimeRes,
      actionsBreakdown,
      pageViewsTrend,
      topPages
    ] = await Promise.all([
      query(`SELECT count(*) FROM page_views WHERE created_at >= NOW() - ${intervalSql}`),
      query(`SELECT count(DISTINCT user_id) FROM page_views WHERE created_at >= NOW() - ${intervalSql}`),
      query(`SELECT COALESCE(sum(active_duration_ms), 0) as total_active_ms, COALESCE(avg(active_duration_ms), 0) as avg_active_ms FROM page_views WHERE created_at >= NOW() - ${intervalSql}`),
      query(`
        SELECT event_type, count(*) as count
        FROM user_activity_events
        WHERE created_at >= NOW() - ${intervalSql}
        GROUP BY event_type
        ORDER BY count DESC
      `),
      query(`
        SELECT to_char(created_at, 'YYYY-MM-DD') as date, count(*) as count
        FROM page_views
        WHERE created_at >= NOW() - ${intervalSql}
        GROUP BY date
        ORDER BY date ASC
      `),
      query(`
        SELECT page, count(*) as views, count(DISTINCT user_id) as unique_users,
               COALESCE(round(avg(active_duration_ms) / 1000.0, 1), 0) as avg_active_seconds,
               COALESCE(round(sum(active_duration_ms) / 60000.0, 1), 0) as total_active_minutes
        FROM page_views
        WHERE created_at >= NOW() - ${intervalSql}
        GROUP BY page
        ORDER BY views DESC
        LIMIT 10
      `)
    ]);

    const totalActiveMs = parseInt(activeTimeRes.rows[0].total_active_ms, 10);
    const avgActiveMs = parseInt(activeTimeRes.rows[0].avg_active_ms, 10);

    res.json({
      success: true,
      metrics: {
        totalPageViews: parseInt(totalPageViews.rows[0].count, 10),
        uniqueVisitors: parseInt(uniqueVisitors.rows[0].count, 10),
        totalActiveMinutes: Math.round(totalActiveMs / 60000),
        avgActiveSecondsPerPage: Math.round(avgActiveMs / 1000)
      },
      actions: actionsBreakdown.rows,
      pageViewsTrend: pageViewsTrend.rows,
      topPages: topPages.rows
    });
  } catch (err) {
    console.error('[Admin Analytics Overview Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to generate analytics overview' });
  }
});

// Detailed Page Analytics
router.get('/analytics/pages', requireAdmin('analytics.read'), async (req, res) => {
  try {
    const pagesRes = await query(`
      SELECT page, route, count(*) as views,
             count(DISTINCT user_id) as unique_users,
             COALESCE(round(avg(active_duration_ms) / 1000.0, 1), 0) as avg_active_seconds,
             COALESCE(round(sum(active_duration_ms) / 60000.0, 1), 0) as total_active_minutes
      FROM page_views
      GROUP BY page, route
      ORDER BY views DESC
      LIMIT 50
    `);
    res.json({ success: true, pages: pagesRes.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve page analytics' });
  }
});

// Raw Activity Events Stream (Sanitized)
router.get('/analytics/events', requireAdmin('analytics.read'), async (req, res) => {
  try {
    const { event_type, page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const where = [];
    const params = [];

    if (event_type && event_type !== 'all') {
      params.push(event_type);
      where.push(`e.event_type = $${params.length}`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await query(`SELECT count(*) FROM user_activity_events e ${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const queryParams = [...params, take, offset];
    const eventsRes = await query(`
      SELECT e.id, e.user_id, e.session_id, e.event_type, e.page, e.target_type,
             e.target_id, e.element_id, e.metadata, e.created_at,
             u.anonymous_pseudonym, u.handle
      FROM user_activity_events e
      LEFT JOIN users u ON u.id = e.user_id
      ${whereSql}
      ORDER BY e.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `, queryParams);

    res.json({
      success: true,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take),
      events: eventsRes.rows
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve activity stream' });
  }
});

// ============================================================================
// 10. SECURITY ANALYTICS
// ============================================================================

router.get('/security/overview', requireAdmin('security.read'), async (req, res) => {
  try {
    const [
      successLogins,
      failedLogins,
      suspendedCount,
      activeSessions,
      recentSecurityEvents
    ] = await Promise.all([
      query("SELECT count(*) FROM login_activity WHERE status = 'SUCCESS' AND created_at >= NOW() - INTERVAL '30 days'"),
      query("SELECT count(*) FROM login_activity WHERE status = 'FAILED' AND created_at >= NOW() - INTERVAL '30 days'"),
      query("SELECT count(*) FROM users WHERE status IN ('suspended', 'banned')"),
      query("SELECT count(*) FROM user_sessions WHERE is_active = true"),
      query(`
        SELECT status, failure_reason, email, ip_address, user_agent, created_at
        FROM login_activity
        WHERE status = 'FAILED'
        ORDER BY created_at DESC
        LIMIT 20
      `)
    ]);

    res.json({
      success: true,
      stats: {
        successfulLogins30d: parseInt(successLogins.rows[0].count, 10),
        failedLogins30d: parseInt(failedLogins.rows[0].count, 10),
        suspendedOrBannedUsers: parseInt(suspendedCount.rows[0].count, 10),
        activeSessions: parseInt(activeSessions.rows[0].count, 10)
      },
      recentFailures: recentSecurityEvents.rows
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load security metrics' });
  }
});

module.exports = router;
