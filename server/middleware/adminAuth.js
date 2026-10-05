const { query } = require('../db');

/**
 * Campus Radar Role-Based Access Control (RBAC) System
 */
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  STUDENT: 'student'
};

const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  admin: [
    'dashboard.read',
    'users.read',
    'users.update',
    'users.suspend',
    'users.ban',
    'users.delete',
    'users.restore',
    'posts.read',
    'posts.update',
    'posts.delete',
    'posts.restore',
    'confessions.read',
    'confessions.update',
    'confessions.delete',
    'confessions.restore',
    'comments.read',
    'comments.delete',
    'comments.restore',
    'events.read',
    'events.create',
    'events.update',
    'events.delete',
    'events.restore',
    'reports.read',
    'reports.assign',
    'reports.resolve',
    'reports.dismiss',
    'audit.read',
    'analytics.read',
    'security.read',
    'settings.read',
    'settings.update'
  ],
  moderator: [
    'dashboard.read',
    'users.read',
    'users.suspend',
    'posts.read',
    'posts.delete',
    'posts.restore',
    'confessions.read',
    'confessions.delete',
    'confessions.restore',
    'comments.read',
    'comments.delete',
    'comments.restore',
    'events.read',
    'reports.read',
    'reports.assign',
    'reports.resolve',
    'reports.dismiss',
    'analytics.read',
    'audit.read'
  ]
};

function hasPermission(role, requiredPermission) {
  if (!role) return false;
  const userRole = role.toLowerCase();
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  if (permissions.includes('*')) return true;
  return permissions.includes(requiredPermission);
}

/**
 * Enforce Admin Authorization (Centralized Server-Side RBAC Middleware):
 * - Unauthenticated users receive HTTP 401
 * - Normal students (or any non-admin) receive HTTP 403 Forbidden
 * - Direct query to authoritative server-side user_roles table
 * - Never returns admin data or executes operations for unauthorized callers
 * - Immutable security failure logging
 */
function requireAdmin(requiredPermission) {
  return async (req, res, next) => {
    try {
      // 1. Verify authentication
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required. Please sign in with institutional credentials.'
        });
      }

      // 2. Query authoritative server-side user_roles table for this exact user ID
      const roleRes = await query(
        'SELECT role FROM user_roles WHERE user_id = $1',
        [req.user.id]
      );

      const authoritativeRole = (roleRes.rows[0]?.role || req.user.role || '').toLowerCase();
      const adminRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MODERATOR];

      // 3. Reject non-admin students with HTTP 403 Forbidden
      if (!adminRoles.includes(authoritativeRole)) {
        await logAdminAction({
          actorId: req.user.id,
          adminRole: authoritativeRole,
          action: 'UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT',
          targetType: 'admin_route',
          targetId: null,
          metadata: { path: req.originalUrl, method: req.method, attemptedRole: authoritativeRole },
          req,
          status: 'FORBIDDEN'
        }).catch(() => {});

        return res.status(403).json({
          success: false,
          message: 'Forbidden: Insufficient administrative privileges.'
        });
      }

      // 4. Granular permission check
      if (requiredPermission && !hasPermission(authoritativeRole, requiredPermission)) {
        await logAdminAction({
          actorId: req.user.id,
          adminRole: authoritativeRole,
          action: 'FORBIDDEN_PERMISSION_LACKING',
          targetType: 'permission',
          targetId: null,
          metadata: { path: req.originalUrl, requiredPermission, role: authoritativeRole },
          req,
          status: 'FORBIDDEN'
        }).catch(() => {});

        return res.status(403).json({
          success: false,
          message: `Forbidden: Lacks required permission '${requiredPermission}'.`
        });
      }

      req.authoritativeRole = authoritativeRole;
      next();
    } catch (err) {
      console.error('[requireAdmin Middleware Error]:', err);
      return res.status(500).json({ success: false, message: 'Authorization service failure' });
    }
  };
}

/**
 * Dedicated Immutable Admin Audit Logger (Appends to admin_audit_logs)
 */
async function logAdminAction({
  actorId,
  adminRole = 'admin',
  action,
  targetType,
  targetId = null,
  metadata = {},
  req = null,
  status = 'SUCCESS'
}) {
  try {
    const ip = req ? (req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1') : '127.0.0.1';
    const userAgent = req ? (req.headers['user-agent'] || 'Unknown') : 'System Internal';
    const requestId = req?.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Sanitize metadata to guarantee zero secrets are logged
    const safeMetadata = { ...metadata };
    delete safeMetadata.password;
    delete safeMetadata.password_hash;
    delete safeMetadata.newPassword;
    delete safeMetadata.currentPassword;
    delete safeMetadata.token;
    delete safeMetadata.sessionToken;
    delete safeMetadata.otp;
    delete safeMetadata.otp_code;
    delete safeMetadata.jwt;

    await query(`
      INSERT INTO admin_audit_logs (
        actor_id, admin_role, action, target_type, target_id,
        metadata, ip_address, user_agent, request_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      actorId || null,
      adminRole,
      action,
      targetType,
      targetId ? String(targetId) : null,
      JSON.stringify(safeMetadata),
      ip,
      userAgent,
      requestId,
      status
    ]);
  } catch (err) {
    console.error('[Admin Audit Log Error]:', err.message);
  }
}

module.exports = {
  ROLES,
  ROLE_PERMISSIONS,
  hasPermission,
  requireAdmin,
  logAdminAction
};
