const { query } = require('../db');
const { getValidSession, registerSessionInMemory } = require('../security');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseSecretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
const supabase = (supabaseUrl && supabaseSecretKey) ? createClient(supabaseUrl, supabaseSecretKey) : null;

/**
 * Production Centralized Authentication Middleware (authenticateUser):
 * Resolves the authenticated student or admin from:
 * 1. Bearer Token in `Authorization: Bearer <token>`
 *    - Validates Supabase JWT access token via supabase.auth.getUser
 *    - Validates server session token via activeSessions & user_sessions DB table
 * 2. `x-session-token` header
 * 3. Controlled testing header `x-user-id` (ONLY in isolated test runner environment)
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
      // Check if token is a Supabase JWT (3 segments separated by dots)
      if (token.split('.').length === 3 && supabase) {
        try {
          const { data: { user: sbUser }, error: sbError } = await supabase.auth.getUser(token);
          if (!sbError && sbUser && sbUser.email) {
            const userRes = await query(
              `SELECT u.id, u.public_profile_id, u.handle, u.anonymous_pseudonym, 
                      COALESCE(r.role, u.role) as role, u.status, 
                      u.email_verified, u.phone_verified, u.email, u.full_name, u.phone_number, 
                      u.avatar_url, u.bio, u.department, u.graduation_year, u.reputation_score
               FROM users u
               LEFT JOIN user_roles r ON r.user_id = u.id
               WHERE LOWER(u.email) = LOWER($1) OR u.id::text = $2`,
              [sbUser.email, sbUser.id]
            );
            if (userRes.rows.length > 0) {
              userRow = userRes.rows[0];
              req.sessionToken = token;
              req.supabaseUser = sbUser;
            }
          }
        } catch (jwtErr) {
          // Fall through to session token validation
        }
      }

      // If not resolved via Supabase JWT, resolve via server session token
      if (!userRow) {
        let session = getValidSession(token);

        // Fast-path: In-memory session with fresh cached user (under 60s)
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
              `SELECT u.id, u.public_profile_id, u.handle, u.anonymous_pseudonym, 
                      COALESCE(r.role, u.role) as role, u.status, 
                      u.email_verified, u.phone_verified, u.email, u.full_name, u.phone_number, 
                      u.avatar_url, u.bio, u.department, u.graduation_year, u.reputation_score
               FROM users u
               LEFT JOIN user_roles r ON r.user_id = u.id
               WHERE u.id = $1`,
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
    }

    // 2. Controlled test harness bypass (STRICTLY restricted to isolated test runner)
    if (!userRow && process.env.NODE_ENV === 'test' && process.env.ALLOW_TEST_AUTH_HEADER === 'true' && req.headers['x-user-id']) {
      const headerIdentifier = req.headers['x-user-id'].trim();
      const userRes = await query(
        `SELECT u.id, u.public_profile_id, u.handle, u.anonymous_pseudonym, 
                COALESCE(r.role, u.role) as role, u.status, 
                u.email_verified, u.phone_verified, u.email, u.full_name, u.phone_number, 
                u.avatar_url, u.bio, u.department, u.graduation_year, u.reputation_score
         FROM users u
         LEFT JOIN user_roles r ON r.user_id = u.id
         WHERE u.public_profile_id::text = $1 OR u.email = $1 OR u.id::text = $1`,
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
  authenticateUser: authenticate,
  requireRole
};
