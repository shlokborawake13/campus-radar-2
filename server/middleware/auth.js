const { query } = require('../db');
const { getValidSession, registerSessionInMemory } = require('../security');

/**
 * Production Authentication Middleware:
 * Resolves the authenticated student or admin from:
 * 1. Bearer Token in `Authorization: Bearer <sessionToken>`
 * 2. `x-session-token` header
 * 3. Testing header `x-user-id` (allowed for automated security audit suite)
 */
async function authenticate(req, res, next) {
  try {
    // 1. Extract Bearer token
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (req.headers['x-session-token']) {
      token = req.headers['x-session-token'].trim();
    }

    let userRow = null;

    if (token) {
      let session = getValidSession(token);

      // Fast-path: In-memory session with fresh cached user (Zero database roundtrips)
      if (session && session.cachedUser && (Date.now() - (session.cachedUserAt || 0) < 60000)) {
        userRow = session.cachedUser;
        req.sessionToken = token;
        req.session = session;
      } else {
        let targetUserId = session ? session.userId : null;

        if (!targetUserId) {
          // Fallback to database user_sessions (Multi-process, cluster, and restart resilience)
          const dbSessionRes = await query(
            `SELECT user_id, expires_at 
             FROM user_sessions 
             WHERE session_token = $1 AND is_active = true AND expires_at > NOW()`,
            [token]
          );
          if (dbSessionRes.rows.length > 0) {
            targetUserId = dbSessionRes.rows[0].user_id;
            session = registerSessionInMemory(token, targetUserId, dbSessionRes.rows[0].expires_at);
          }
        }

        if (targetUserId) {
          const userRes = await query(
            `SELECT id, public_profile_id, handle, anonymous_pseudonym, role, status, 
                    email_verified, phone_verified, email, full_name, phone_number, 
                    avatar_url, bio, department, graduation_year, reputation_score
             FROM users 
             WHERE id = $1`,
            [targetUserId]
          );
          if (userRes.rows.length > 0) {
            userRow = userRes.rows[0];
            if (session) {
              session.cachedUser = userRow;
              session.cachedUserAt = Date.now();
            } else {
              session = registerSessionInMemory(token, targetUserId, Date.now() + 7 * 24 * 60 * 60 * 1000, userRow);
            }
            req.sessionToken = token;
            req.session = session;
          }
        }
      }
    }

    // 2. Controlled test harness bypass (STRICTLY restricted to isolated test runner)
    if (!userRow && process.env.NODE_ENV === 'test' && process.env.ALLOW_TEST_AUTH_HEADER === 'true' && req.headers['x-user-id']) {
      const headerIdentifier = req.headers['x-user-id'].trim();
      const userRes = await query(
        `SELECT id, public_profile_id, handle, anonymous_pseudonym, role, status, 
                email_verified, phone_verified, email, full_name, phone_number, 
                avatar_url, bio, department, graduation_year, reputation_score
         FROM users 
         WHERE public_profile_id::text = $1 OR email = $1 OR id::text = $1`,
        [headerIdentifier]
      );
      if (userRes.rows.length > 0) {
        userRow = userRes.rows[0];
      }
    }

    // Determine if this is an explicitly public route
    const isPublicRoute = 
      req.path.startsWith('/auth/login') ||
      req.path.startsWith('/auth/register') ||
      req.path.startsWith('/auth/forgot-password');

    if (!userRow) {
      if (isPublicRoute) {
        return next();
      }
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in with your @sanjivani.edu.in account.'
      });
    }

    // Check account status
    if (userRow.status === 'suspended' || userRow.status === 'banned') {
      return res.status(403).json({
        success: false,
        message: 'Your Sanjivani University student account has been suspended or restricted.'
      });
    }

    if (userRow.status === 'deleted') {
      return res.status(401).json({
        success: false,
        message: 'This student account has been deactivated.'
      });
    }

    req.user = Object.freeze(userRow); // Freeze to prevent in-flight tampering
    next();
  } catch (err) {
    console.error('[Auth Middleware Error]:', err);
    res.status(500).json({ success: false, message: 'Authentication service failure' });
  }
}

/**
 * Server-Side Role Enforcement (Defense in Depth)
 */
function requireRole(allowedRoles = ['admin']) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access Forbidden: Insufficient administrative privileges.'
      });
    }
    next();
  };
}

module.exports = {
  authenticate,
  requireRole
};
