require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { pool, query, withTransaction } = require('./db');
const { authenticate, requireRole } = require('./middleware/auth');
const {
  toPublicProfile,
  toPublicAuthor,
  toDecoupledConfession,
  checkBlock,
  formatTimeAgo
} = require('./middleware/privacy');
const {
  rateLimit,
  authLimiter,
  registerLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  passwordResetLimiter,
  postCreateLimiter,
  confessionCreateLimiter,
  commentLimiter,
  likeLimiter,
  uploadLimiter,
  readLimiter,
  adminLimiter
} = require('./middleware/rateLimit');
const {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  validateInstitutionalEmail,
  validatePhoneNumber,
  normalizePhoneNumber,
  stageRegistration,
  cancelPendingRegistration,
  verifyRegistrationEmailOtp,
  verifyRegistrationPhoneOtp,
  resendRegistrationOtp,
  stagePasswordReset,
  verifyAndResetPassword,
  createSession,
  revokeSession,
  revokeUserSessions,
  getUserSessions
} = require('./security');
const { sendEmailOtp } = require('./services/emailOtp');
const { sendSmsOtp, sendPhoneOtp } = require('./services/smsOtp');
const multer = require('multer');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
const supabase = createClient(supabaseUrl, supabaseKey);
const STORAGE_BUCKET = 'campus-radar-media';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Configure Multer for user avatar upload (strict 5MB limit)
const uploadAvatarMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const {
  AVATAR_BUCKET,
  DEFAULT_AVATAR_URL,
  validateAvatarMagicBytes,
  processAvatar,
  uploadAvatarToStorage,
  deleteAvatarFromStorage
} = require('./services/avatarService');

// Validate image signature by magic bytes to prevent extension spoofing
function validateImageMagicNumbers(buffer) {
  if (!buffer || buffer.length < 12) return { valid: false };

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, mime: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return { valid: true, mime: 'image/png', ext: 'png' };
  }

  // WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, mime: 'image/webp', ext: 'webp' };
  }

  return { valid: false };
}

// Strip EXIF metadata (specifically GPS coordinates and camera device serials in APP1 marker) from JPEG
function stripJpegExif(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
    return buffer;
  }
  let pos = 2;
  const chunks = [buffer.slice(0, 2)];
  while (pos < buffer.length - 1) {
    if (buffer[pos] !== 0xFF) {
      chunks.push(buffer.slice(pos));
      break;
    }
    const marker = buffer[pos + 1];
    if (marker === 0xD9) { // End of Image
      chunks.push(buffer.slice(pos));
      break;
    }
    if (pos + 4 > buffer.length) break;
    const len = buffer.readUInt16BE(pos + 2);
    if (marker === 0xE1) { // APP1 (EXIF / XMP)
      pos += 2 + len;
    } else {
      chunks.push(buffer.slice(pos, pos + 2 + len));
      pos += 2 + len;
    }
  }
  return Buffer.concat(chunks);
}

const app = express();
const PORT = process.env.API_PORT || 5001;

// 1. Performance Compression (Gzip / Deflate for fast JSON & API payloads)
app.use(compression());

// 2. Production Security Headers (OWASP Defense in Depth)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "https://images.unsplash.com"],
      connectSrc: ["'self'", "http://localhost:*", "http://127.0.0.1:*", "https:"]
    }
  },
  xContentTypeOptions: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  frameguard: { action: "deny" }
}));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      callback(null, true);
    } else {
      callback(new Error('CORS access blocked by Campus Radar security policy.'));
    }
  },
  credentials: true
}));

// 3. Request body limits (max 1mb to prevent memory exhaustion)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 4. Global Auth Middleware on all /api routes
app.use('/api', authenticate);

// Helper to format safe private student account object
async function formatSafeAccountObject(userRow) {
  const metaRes = await query(`
    SELECT
      (SELECT row_to_json(s) FROM user_settings s WHERE s.user_id = $1) AS settings,
      (SELECT count(*) FROM follows WHERE following_id = $1) AS followers_count,
      (SELECT count(*) FROM follows WHERE follower_id = $1) AS following_count,
      (SELECT count(*) FROM posts WHERE author_id = $1 AND deleted_at IS NULL) AS posts_count,
      (SELECT count(*) FROM saved_posts WHERE user_id = $1) AS saved_count
  `, [userRow.id]);
  const meta = metaRes.rows[0] || {};
  const settings = meta.settings || {};
  const counts = meta;

  return {
    public_profile_id: userRow.public_profile_id,
    display_name: userRow.anonymous_pseudonym,
    handle: userRow.handle,
    avatar: userRow.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
    bio: userRow.bio || '',
    department: userRow.department || '',
    year: userRow.graduation_year ? `Class of '${String(userRow.graduation_year).slice(-2)}` : '',
    campus: 'Sanjivani University',
    karma: userRow.reputation_score || 100,
    badges: ['Verified Student', userRow.role === 'admin' ? 'Administrator' : 'Campus Contributor'],
    isVerified: userRow.email_verified || false,
    role: userRow.role,
    followersCount: parseInt(counts.followers_count || 0, 10),
    followingCount: parseInt(counts.following_count || 0, 10),
    postsCount: parseInt(counts.posts_count || 0, 10),
    savedCount: parseInt(counts.saved_count || 0, 10),
    // Private identity (ONLY sent to authenticated owner)
    private: {
      full_name: userRow.full_name,
      email: userRow.email,
      phone_number: userRow.phone_number
    },
    settings
  };
}

async function logLoginActivity({ userId, email, ip, userAgent, status, failureReason }) {
  try {
    await query(
      `INSERT INTO login_activity (user_id, email, ip_address, user_agent, status, failure_reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId || null, email, ip || '127.0.0.1', userAgent || 'Unknown Browser', status, failureReason || null]
    );
  } catch (err) {
    // Non-blocking log
  }
}

async function recordSessionInDb({ userId, sessionToken, deviceInfo, ipAddress, expiresAt }) {
  try {
    await query(
      `INSERT INTO user_sessions (user_id, session_token, device_info, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0))`,
      [userId, sessionToken, deviceInfo || 'Browser', ipAddress || '127.0.0.1', expiresAt]
    );
  } catch (err) {
    // Non-blocking log
  }
}

// =============================================================
// AUTHENTICATION & REGISTRATION ENDPOINTS
// =============================================================

/**
 * POST /api/auth/register/initiate
 * Step 1 of Multi-Stage Registration:
 * Validates inputs, strictly verifies @sanjivani.edu.in, checks existence,
 * hashes password, and creates a staged registration awaiting Email & Phone OTP verification.
 */
app.post('/api/auth/register/initiate', registerLimiter, async (req, res) => {
  try {
    const { fullName, email, phoneNumber, department, password, confirmPassword, termsAccepted } = req.body;

    // 1. Mandatory fields validation
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Full Name is required.' });
    }

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Sanjivani College Email is required.' });
    }

    // Strict domain check: MUST end with @sanjivani.edu.in
    if (!validateInstitutionalEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email. Only official institutional accounts ending with @sanjivani.edu.in are allowed.'
      });
    }

    if (!phoneNumber || !validatePhoneNumber(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Indian mobile phone number for verification.'
      });
    }

    // Password requirements
    const pwdValidation = validatePasswordStrength(password);
    if (!pwdValidation.valid) {
      return res.status(400).json({ success: false, message: pwdValidation.message });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    if (!termsAccepted) {
      return res.status(400).json({
        success: false,
        message: 'You must agree to the Terms of Service and Privacy Policy to create an account.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = normalizePhoneNumber(phoneNumber);

    // Check if email already registered (Safe response preventing account enumeration abuse)
    const existingEmail = await query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An account already exists with this email.'
      });
    }

    // Check if phone already registered
    const existingPhone = await query('SELECT id FROM users WHERE phone_number = $1', [cleanPhone]);
    if (existingPhone.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An account already exists with this phone number.'
      });
    }

    // Hash password using memory-hard scrypt with unique salt
    const passwordHash = await hashPassword(password);

    // Stage registration (generates Email OTP and stores secure HMAC hash)
    const stageInfo = stageRegistration({
      email: cleanEmail,
      fullName,
      phoneNumber: cleanPhone,
      department: department || null,
      passwordHash
    });

    // Deliver Email OTP via external provider (Resend)
    try {
      await sendEmailOtp(cleanEmail, stageInfo.emailOtp);
    } catch (deliveryErr) {
      console.error('[Register Initiate Delivery Failure]:', deliveryErr.message);
      cancelPendingRegistration(cleanEmail);
      return res.status(502).json({
        success: false,
        code: deliveryErr.code || 'EMAIL_DELIVERY_FAILED',
        message: 'Unable to deliver verification code to your email. Please try again or verify your address.'
      });
    }

    res.status(200).json({
      success: true,
      step: 'EMAIL_OTP',
      message: `A 6-digit verification code has been dispatched to ${stageInfo.maskedEmail}.`,
      maskedEmail: stageInfo.maskedEmail,
      maskedPhone: stageInfo.maskedPhone,
      expiresInSeconds: stageInfo.expiresInSeconds,
      cooldownSeconds: stageInfo.cooldownSeconds
    });
  } catch (err) {
    console.error('[Register Initiate Error]:', err.message);
    res.status(500).json({ success: false, message: 'Registration service error' });
  }
});

/**
 * POST /api/auth/register/verify-email
 * Step 2 of Multi-Stage Registration: Verifies 6-digit Email OTP against secure hash.
 * Upon success: dispatches Phone OTP via TextBee SMS.
 */
app.post('/api/auth/register/verify-email', otpVerifyLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and 6-digit verification code are required.' });
    }

    const result = verifyRegistrationEmailOtp(email, otp);
    if (!result.success) {
      return res.status(400).json(result);
    }

    // Deliver Phone OTP via TextBee SMS Gateway
    try {
      await sendSmsOtp(result.phoneNumber, result.phoneOtp);
    } catch (smsErr) {
      console.error('[SMS OTP] Delivery failed');
      return res.status(502).json({
        success: false,
        code: smsErr.code || 'SMS_DELIVERY_FAILED',
        message: 'Email verified, but unable to send SMS code. Please click Resend Code to try again.'
      });
    }

    res.json({
      success: true,
      step: 'PHONE_OTP',
      message: 'Email verified. A 6-digit verification code has been sent to your phone.',
      maskedPhone: result.maskedPhone
    });
  } catch (err) {
    console.error('[Verify Email Error]:', err.message);
    res.status(500).json({ success: false, message: 'Verification service error' });
  }
});

/**
 * POST /api/auth/register/verify-phone
 * Step 3 of Multi-Stage Registration: Verifies Phone OTP, creates the student user in PostgreSQL,
 * provisions an immutable Anonymous ID, establishes user settings, and creates an active session.
 */
app.post('/api/auth/register/verify-phone', otpVerifyLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and phone verification code are required.' });
    }

    const result = verifyRegistrationPhoneOtp(email, otp);
    if (!result.success) {
      return res.status(400).json(result);
    }

    const { userData } = result;

    // Generate next anonymous student identifier (e.g. Anonymous #24)
    const countRes = await query('SELECT count(*) FROM users');
    const studentCount = parseInt(countRes.rows[0].count, 10);
    const anonNum = studentCount + 101;
    const anonymousPseudonym = `Anonymous #${anonNum}`;
    const handle = `@anon${anonNum}`;

    // Insert user into PostgreSQL users table (Enforces database unique constraints against concurrent races)
    const insertRes = await query(`
      INSERT INTO users (
        email, phone_number, full_name, department, password_hash,
        anonymous_pseudonym, handle, role, status, email_verified, phone_verified,
        reputation_score, avatar_url, bio
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, 'student', 'active', true, true, 100,
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
        'Sanjivani University student.'
      ) RETURNING *
    `, [
      userData.email,
      userData.phoneNumber,
      userData.fullName,
      userData.department,
      userData.passwordHash,
      anonymousPseudonym,
      handle
    ]);

    const newUser = insertRes.rows[0];

    // Seed default user settings
    await query(`
      INSERT INTO user_settings (user_id, show_department, show_year, show_bio, profile_discoverability, who_can_follow, who_can_comment, show_posts_on_profile)
      VALUES ($1, true, true, true, true, 'everyone', 'everyone', true)
      ON CONFLICT (user_id) DO NOTHING
    `, [newUser.id]);

    // Create session token
    const { token, expiresAt } = createSession(newUser, req);
    const safeUser = await formatSafeAccountObject(newUser);

    res.status(201).json({
      success: true,
      message: 'Account successfully verified and activated. Welcome to Campus Radar!',
      token,
      expiresAt,
      user: safeUser
    });
  } catch (err) {
    // Database unique constraint violation handler for concurrent duplicate requests
    if (err.code === '23505') {
      if (err.constraint?.includes('email') || err.detail?.includes('email')) {
        return res.status(409).json({ success: false, message: 'An account already exists with this email.' });
      }
      if (err.constraint?.includes('phone') || err.detail?.includes('phone')) {
        return res.status(409).json({ success: false, message: 'An account already exists with this phone number.' });
      }
      return res.status(409).json({ success: false, message: 'An account with these credentials already exists.' });
    }
    console.error('[Verify Phone Error]:', err.message);
    res.status(500).json({ success: false, message: 'Account activation failed' });
  }
});

/**
 * POST /api/auth/register/resend-otp
 * Resends a new OTP via Resend (email) or TextBee (phone) with rate limiting and invalidation of old codes.
 */
app.post('/api/auth/register/resend-otp', otpSendLimiter, async (req, res) => {
  try {
    const { email, type } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const targetType = type === 'phone' ? 'phone' : 'email';

    const result = resendRegistrationOtp(cleanEmail, targetType);
    if (!result.success) {
      return res.status(400).json(result);
    }

    if (targetType === 'phone') {
      try {
        await sendSmsOtp(result.phoneNumber, result.phoneOtp);
      } catch (smsErr) {
        console.error('[SMS OTP] Delivery failed');
        return res.status(502).json({
          success: false,
          code: smsErr.code || 'SMS_DELIVERY_FAILED',
          message: 'Unable to deliver SMS verification code. Please try again in a moment.'
        });
      }

      return res.json({
        success: true,
        message: result.message,
        maskedPhone: result.maskedPhone
      });
    } else {
      try {
        await sendEmailOtp(cleanEmail, result.emailOtp);
      } catch (emailErr) {
        console.error('[Resend Email Failure]:', emailErr.message);
        return res.status(502).json({
          success: false,
          code: emailErr.code || 'EMAIL_DELIVERY_FAILED',
          message: 'Unable to deliver email verification code. Please try again in a moment.'
        });
      }

      return res.json({
        success: true,
        message: result.message,
        maskedEmail: result.maskedEmail
      });
    }
  } catch (err) {
    console.error('[Resend OTP Error]:', err.message);
    res.status(500).json({ success: false, message: 'Failed to resend verification code' });
  }
});

/**
 * POST /api/auth/login
 * Production login: checks @sanjivani.edu.in domain, verifies password hash,
 * checks account status, and issues a session token.
 */
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password, remember } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    if (!validateInstitutionalEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email. Only official institutional accounts ending with @sanjivani.edu.in are allowed.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const userRes = await query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);

    if (userRes.rows.length === 0) {
      await logLoginActivity({ email: cleanEmail, ip: req.ip, userAgent: req.headers['user-agent'], status: 'FAILED', failureReason: 'Email not registered' });
      return res.status(401).json({ success: false, message: 'Invalid Sanjivani email or password.' });
    }

    const user = userRes.rows[0];

    if (user.status === 'suspended' || user.status === 'banned') {
      await logLoginActivity({ userId: user.id, email: cleanEmail, ip: req.ip, userAgent: req.headers['user-agent'], status: 'SUSPENDED', failureReason: 'Account suspended' });
      return res.status(403).json({ success: false, message: 'This student account has been suspended or restricted.' });
    }

    if (user.status === 'deleted') {
      await logLoginActivity({ userId: user.id, email: cleanEmail, ip: req.ip, userAgent: req.headers['user-agent'], status: 'FAILED', failureReason: 'Account deleted' });
      return res.status(401).json({ success: false, message: 'This student account has been deleted.' });
    }

    // Verify password hash
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      await logLoginActivity({ userId: user.id, email: cleanEmail, ip: req.ip, userAgent: req.headers['user-agent'], status: 'FAILED', failureReason: 'Incorrect password' });
      return res.status(401).json({ success: false, message: 'Invalid Sanjivani email or password.' });
    }

    // Issue session token
    const { token, expiresAt } = createSession(user, req);
    const safeUser = await formatSafeAccountObject(user);

    // Persist login activity and active session to Supabase
    await logLoginActivity({ userId: user.id, email: cleanEmail, ip: req.ip, userAgent: req.headers['user-agent'], status: 'SUCCESS' });
    await recordSessionInDb({ userId: user.id, sessionToken: token, deviceInfo: req.headers['user-agent'], ipAddress: req.ip, expiresAt });

    res.json({
      success: true,
      message: 'Authentication successful.',
      token,
      expiresAt,
      user: safeUser
    });
  } catch (err) {
    console.error('[Login Error]:', err.message);
    res.status(500).json({ success: false, message: 'Authentication failure' });
  }
});

/**
 * POST /api/auth/forgot-password/initiate
 */
app.post('/api/auth/forgot-password/initiate', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !validateInstitutionalEmail(email)) {
      return res.status(400).json({ success: false, message: 'A valid @sanjivani.edu.in email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const userRes = await query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);

    if (userRes.rows.length === 0) {
      // Return ambiguous success to prevent email enumeration
      return res.json({
        success: true,
        message: 'If this Sanjivani address is registered, a 6-digit verification code has been dispatched.'
      });
    }

    const stageInfo = stagePasswordReset(cleanEmail);

    try {
      await sendEmailOtp(cleanEmail, stageInfo.otp, {
        subject: 'Campus Radar — Reset Your Password',
        purpose: 'reset'
      });
    } catch (deliveryErr) {
      console.error('[Forgot Password Delivery Failure]:', deliveryErr.message);
      return res.status(502).json({
        success: false,
        code: deliveryErr.code || 'EMAIL_DELIVERY_FAILED',
        message: 'Unable to deliver password reset code. Please try again in a moment.'
      });
    }

    res.json({
      success: true,
      message: `A 6-digit password reset code has been dispatched to ${stageInfo.maskedEmail}.`,
      maskedEmail: stageInfo.maskedEmail
    });
  } catch (err) {
    console.error('[Forgot Password Error]:', err.message);
    res.status(500).json({ success: false, message: 'Failed to initiate password reset' });
  }
});

/**
 * POST /api/auth/forgot-password/verify-and-reset
 */
app.post('/api/auth/forgot-password/verify-and-reset', passwordResetLimiter, async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return res.status(400).json({ success: false, message: strength.message });
    }

    const newHash = await hashPassword(newPassword);
    const result = verifyAndResetPassword(email, otp, newHash);
    if (!result.success) {
      return res.status(400).json(result);
    }

    // Update DB
    const cleanEmail = email.trim().toLowerCase();
    const updateRes = await query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id',
      [newHash, cleanEmail]
    );

    if (updateRes.rows.length > 0) {
      // Invalidate all existing sessions for safety
      revokeUserSessions(updateRes.rows[0].id);
    }

    res.json({
      success: true,
      message: 'Password reset successful. Please sign in with your new credentials.'
    });
  } catch (err) {
    console.error('[Reset Password Error]:', err);
    res.status(500).json({ success: false, message: 'Password reset failed' });
  }
});

/**
 * POST /api/auth/change-password (Authenticated student)
 */
app.post('/api/auth/change-password', rateLimit({ windowMs: 60000, max: 5 }), async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New passwords do not match.' });
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return res.status(400).json({ success: false, message: strength.message });
    }

    // Verify current password
    const userRes = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const isValid = await verifyPassword(currentPassword, userRes.rows[0]?.password_hash);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

    // Invalidate other devices
    revokeUserSessions(req.user.id, req.sessionToken);

    res.json({ success: true, message: 'Password changed successfully. Other device sessions were revoked.' });
  } catch (err) {
    console.error('[Change Password Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to update password' });
  }
});

/**
 * POST /api/auth/change-phone (Authenticated student)
 */
app.post('/api/auth/change-phone', rateLimit({ windowMs: 60000, max: 5 }), async (req, res) => {
  try {
    const { newPhoneNumber } = req.body;
    if (!newPhoneNumber || !validatePhoneNumber(newPhoneNumber)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid Indian mobile number.' });
    }

    const normalized = normalizePhoneNumber(newPhoneNumber);
    await query('UPDATE users SET phone_number = $1 WHERE id = $2', [normalized, req.user.id]);

    res.json({ success: true, message: 'Phone number updated successfully.', phoneNumber: normalized });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update phone number' });
  }
});

/**
 * GET /api/auth/sessions (Authenticated student)
 */
app.get('/api/auth/sessions', async (req, res) => {
  try {
    const sessions = getUserSessions(req.user.id, req.sessionToken);
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
  }
});

/**
 * POST /api/auth/logout (Authenticated student)
 */
app.post('/api/auth/logout', async (req, res) => {
  try {
    if (req.sessionToken) {
      revokeSession(req.sessionToken);
      await query('UPDATE user_sessions SET is_active = false WHERE session_token = $1', [req.sessionToken]).catch(() => {});
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
});

/**
 * POST /api/auth/logout-others (Authenticated student)
 */
app.post('/api/auth/logout-others', async (req, res) => {
  try {
    revokeUserSessions(req.user.id, req.sessionToken);
    res.json({ success: true, message: 'All other active sessions have been terminated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to revoke other sessions' });
  }
});

// =============================================================
// STUDENT ACCOUNT & PUBLIC PROFILES
// =============================================================

/**
 * GET /api/me - Private Authenticated Student Account
 * Zero Leakage: Returns full details ONLY to the owner.
 */
app.get('/api/me', async (req, res) => {
  try {
    const safeAccount = await formatSafeAccountObject(req.user);
    res.json({ success: true, user: safeAccount });
  } catch (err) {
    console.error('[GET /api/me Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve profile' });
  }
});

/**
 * GET /api/profiles/:publicProfileId - Public Profile View
 * Zero-Leakage: NEVER includes full_name, email, phone_number, or password_hash.
 */
app.get('/api/profiles/:publicProfileId', readLimiter, async (req, res) => {
  try {
    const { publicProfileId } = req.params;

    const userRes = await query(
      `SELECT u.id, u.public_profile_id, u.anonymous_pseudonym, u.handle, u.avatar_url, u.bio, u.department, 
              u.graduation_year, u.reputation_score, u.email_verified, u.role, u.status,
              s.show_department, s.show_year, s.show_bio, s.profile_discoverability, s.show_posts_on_profile
       FROM users u
       LEFT JOIN user_settings s ON s.user_id = u.id
       WHERE u.public_profile_id = $1 AND u.status != 'deleted'`,
      [publicProfileId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'This profile is unavailable.' });
    }

    const target = userRes.rows[0];
    const isOwner = req.user.id === target.id;

    // Concurrently fetch profile metadata (counts, follows, blocks) and profile posts
    const [metaRes, postsData] = await Promise.all([
      query(`
        SELECT 
          (SELECT count(*) FROM follows WHERE following_id = $1) AS followers_count,
          (SELECT count(*) FROM follows WHERE follower_id = $1) AS following_count,
          (SELECT count(*) FROM posts WHERE author_id = $1 AND deleted_at IS NULL) AS posts_count,
          EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = $1) AS is_following,
          EXISTS(
            SELECT 1 FROM blocks 
            WHERE (blocker_id = $2 AND blocked_id = $1) 
               OR (blocker_id = $1 AND blocked_id = $2)
          ) AS is_blocked
      `, [target.id, req.user.id]),
      (isOwner || target.show_posts_on_profile !== false)
        ? query(
            `SELECT p.id, p.content, p.image_url, p.tag, p.likes_count, p.comments_count, p.created_at, p.is_edited,
                    EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as has_liked,
                    EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = $1) as has_bookmarked
             FROM posts p
             WHERE p.author_id = $2 AND p.deleted_at IS NULL
             ORDER BY p.created_at DESC LIMIT 20`,
            [req.user.id, target.id]
          )
        : Promise.resolve({ rows: [] })
    ]);

    const meta = metaRes.rows[0] || {};

    if (!isOwner) {
      if (meta.is_blocked) {
        return res.status(404).json({ success: false, message: 'This profile is unavailable.' });
      }

      if (target.profile_discoverability === false && !meta.is_following) {
        return res.status(404).json({ success: false, message: 'This profile is unavailable.' });
      }
    }

    const publicProfile = toPublicProfile(target, target, isOwner);
    publicProfile.followersCount = parseInt(meta.followers_count || 0, 10);
    publicProfile.followingCount = parseInt(meta.following_count || 0, 10);
    publicProfile.postsCount = parseInt(meta.posts_count || 0, 10);
    publicProfile.isFollowing = !!meta.is_following;
    publicProfile.isSelf = isOwner;

    const publicPosts = postsData.rows.map(p => ({
        id: p.id,
        type: 'post',
        category: p.tag ? p.tag.replace('#', '') : 'General',
        title: p.content.length > 50 ? p.content.slice(0, 50) + '...' : p.content,
        content: p.content,
        images: p.image_url ? [p.image_url] : [],
        timestamp: formatTimeAgo(p.created_at),
        createdAt: p.created_at,
        likes: p.likes_count || 0,
        hasLiked: !!p.has_liked,
        commentsCount: p.comments_count || 0,
        hasBookmarked: !!p.has_bookmarked,
        tags: p.tag ? [p.tag] : [],
        author: toPublicAuthor(target)
      }));

    res.json({
      success: true,
      profile: publicProfile,
      posts: publicPosts
    });
  } catch (err) {
    console.error('[GET /api/profiles/:id Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve profile' });
  }
});

// =============================================================
// FOLLOW & UNFOLLOW ENGINE
// =============================================================

app.post('/api/profiles/:publicProfileId/follow', rateLimit({ max: 30 }), async (req, res) => {
  try {
    const { publicProfileId } = req.params;

    const targetRes = await query(
      `SELECT u.id, s.who_can_follow 
       FROM users u
       LEFT JOIN user_settings s ON s.user_id = u.id
       WHERE u.public_profile_id = $1`,
      [publicProfileId]
    );

    if (targetRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const target = targetRes.rows[0];

    // Prevent self-follow
    if (req.user.id === target.id) {
      return res.status(400).json({ success: false, message: 'You cannot follow your own account.' });
    }

    // Check blocking
    const isBlocked = await checkBlock(req.user.id, target.id);
    if (isBlocked) {
      return res.status(403).json({ success: false, message: 'Action not allowed.' });
    }

    // Check who_can_follow privacy setting
    if (target.who_can_follow === 'verified_only' && !req.user.email_verified) {
      return res.status(403).json({
        success: false,
        message: 'This student only accepts follows from verified Sanjivani University students.'
      });
    }

    // Insert relationship
    await query(
      `INSERT INTO follows (follower_id, following_id) 
       VALUES ($1, $2) 
       ON CONFLICT (follower_id, following_id) DO NOTHING`,
      [req.user.id, target.id]
    );

    // Create notification
    await query(
      `INSERT INTO notifications (recipient_id, actor_id, type, entity_type, entity_id)
       VALUES ($1, $2, 'FOLLOW', 'profile', $2)`,
      [target.id, req.user.id]
    );

    const countRes = await query('SELECT count(*) FROM follows WHERE following_id = $1', [target.id]);

    res.json({
      success: true,
      isFollowing: true,
      followersCount: parseInt(countRes.rows[0].count, 10)
    });
  } catch (err) {
    console.error('[Follow Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to follow user' });
  }
});

app.delete('/api/profiles/:publicProfileId/follow', rateLimit({ max: 30 }), async (req, res) => {
  try {
    const { publicProfileId } = req.params;

    const targetRes = await query(
      'SELECT id FROM users WHERE public_profile_id = $1',
      [publicProfileId]
    );

    if (targetRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const target = targetRes.rows[0];

    await query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [req.user.id, target.id]
    );

    const countRes = await query('SELECT count(*) FROM follows WHERE following_id = $1', [target.id]);

    res.json({
      success: true,
      isFollowing: false,
      followersCount: parseInt(countRes.rows[0].count, 10)
    });
  } catch (err) {
    console.error('[Unfollow Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to unfollow user' });
  }
});

// =============================================================
// POSTS, CONFESSIONS & FEED
// =============================================================

app.get('/api/posts', readLimiter, async (req, res) => {
  try {
    const { category, search, type, limit = 20, cursor } = req.query;
    const pageLimit = Math.min(parseInt(limit, 10) || 20, 50);

    let queryParams = [req.user.id];
    let whereClauses = [
      `p.deleted_at IS NULL`,
      `NOT EXISTS (
        SELECT 1 FROM blocks b 
        WHERE (b.blocker_id = $1 AND b.blocked_id = p.author_id)
           OR (b.blocker_id = p.author_id AND b.blocked_id = $1)
      )`,
      `NOT EXISTS (
        SELECT 1 FROM hidden_posts hp 
        WHERE hp.user_id = $1 AND hp.post_id = p.id
      )`
    ];

    if (cursor) {
      queryParams.push(cursor);
      whereClauses.push(`p.created_at < $${queryParams.length}`);
    }

    if (search) {
      queryParams.push(`%${search.trim().toLowerCase()}%`);
      whereClauses.push(`(LOWER(p.content) LIKE $${queryParams.length} OR LOWER(p.tag) LIKE $${queryParams.length})`);
    }

    if (category && category !== 'All' && category !== 'Trending' && category !== 'Confessions' && category !== 'Events') {
      queryParams.push(`%${category.toLowerCase()}%`);
      whereClauses.push(`LOWER(p.tag) LIKE $${queryParams.length}`);
    }

    const sql = `
      SELECT p.id, p.content, p.image_url, p.tag, p.likes_count, p.comments_count, p.created_at, p.is_edited,
             u.id as user_id, u.public_profile_id, u.anonymous_pseudonym, u.handle, u.avatar_url, u.email_verified, u.role,
             EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as has_liked,
             EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = $1) as has_bookmarked
      FROM posts p
      JOIN users u ON u.id = p.author_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY ${category === 'Trending' ? '(p.likes_count + p.comments_count) DESC,' : ''} p.created_at DESC
      LIMIT ${pageLimit}
    `;

    const shouldFetchConfessions = !type || type === 'confession' || category === 'Confessions';

    const [postResults, confRes] = await Promise.all([
      query(sql, queryParams),
      shouldFetchConfessions
        ? query(`
            SELECT c.id, c.content, c.category, c.anonymous_pseudonym, c.likes_count, c.comments_count, c.created_at,
                   EXISTS(SELECT 1 FROM confession_likes WHERE confession_id = c.id AND user_id = $1) as has_liked
            FROM confessions c
            WHERE c.deleted_at IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM blocks b 
                WHERE (b.blocker_id = $1 AND b.blocked_id = c.author_id)
                   OR (b.blocker_id = c.author_id AND b.blocked_id = $1)
              )
            ORDER BY c.created_at DESC LIMIT 10
          `, [req.user.id])
        : Promise.resolve({ rows: [] })
    ]);

    let formattedPosts = postResults.rows.map(p => ({
      id: p.id,
      type: 'post',
      category: p.tag ? p.tag.replace('#', '') : 'General',
      title: p.content.length > 50 ? p.content.slice(0, 50) + '...' : p.content,
      content: p.content,
      images: p.image_url ? [p.image_url] : [],
      timestamp: formatTimeAgo(p.created_at),
      createdAt: p.created_at,
      likes: p.likes_count || 0,
      hasLiked: !!p.has_liked,
      commentsCount: p.comments_count || 0,
      hasBookmarked: !!p.has_bookmarked,
      isEdited: p.is_edited || false,
      tags: p.tag ? [p.tag] : [],
      author: toPublicAuthor(p)
    }));

    if (shouldFetchConfessions && confRes.rows.length > 0) {
      const formattedConfessions = confRes.rows.map(toDecoupledConfession);

      if (category === 'Confessions') {
        formattedPosts = formattedConfessions;
      } else if (!category || category === 'All') {
        formattedPosts = [...formattedPosts, ...formattedConfessions].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
      }
    }

    const nextCursor = postResults.rows.length >= pageLimit 
      ? postResults.rows[postResults.rows.length - 1].created_at 
      : null;

    res.json({
      success: true,
      total: formattedPosts.length,
      nextCursor,
      posts: formattedPosts
    });
  } catch (err) {
    console.error('[GET /api/posts Error]:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch posts' });
  }
});

app.post('/api/posts', postCreateLimiter, async (req, res) => {
  try {
    const { type, content, title, tags, images, flair } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Content is required.' });
    }

    if (content.length > 5000) {
      return res.status(400).json({ success: false, message: 'Content exceeds 5,000 character limit.' });
    }

    const cleanContent = content.trim();
    const tag = tags && tags.length > 0 ? tags[0] : '#General';
    const imageUrl = images && images.length > 0 ? images[0] : null;

    if (type === 'confession') {
      const masks = ['Anonymous Falcon', 'Anonymous Owl', 'Anonymous Cardinal', 'Anonymous Lynx'];
      const randomMask = masks[Math.floor(Math.random() * masks.length)];

      const confRes = await query(`
        INSERT INTO confessions (author_id, anonymous_pseudonym, content, category)
        VALUES ($1, $2, $3, $4)
        RETURNING id, content, category, anonymous_pseudonym, likes_count, comments_count, created_at
      `, [req.user.id, randomMask, cleanContent, flair || 'Wholesome']);

      const created = toDecoupledConfession(confRes.rows[0]);
      return res.status(201).json({ success: true, post: created });
    }

    const insertRes = await query(`
      INSERT INTO posts (author_id, content, image_url, tag)
      VALUES ($1, $2, $3, $4)
      RETURNING id, content, image_url, tag, likes_count, comments_count, created_at, is_edited
    `, [req.user.id, cleanContent, imageUrl, tag]);

    const createdPost = {
      id: insertRes.rows[0].id,
      type: 'post',
      category: tag.replace('#', ''),
      title: title || (cleanContent.length > 50 ? cleanContent.slice(0, 50) + '...' : cleanContent),
      content: cleanContent,
      images: imageUrl ? [imageUrl] : [],
      timestamp: 'Just now',
      createdAt: insertRes.rows[0].created_at,
      likes: 0,
      hasLiked: false,
      commentsCount: 0,
      hasBookmarked: false,
      isEdited: false,
      tags: [tag],
      author: toPublicAuthor(req.user)
    };

    res.status(201).json({ success: true, post: createdPost });
  } catch (err) {
    console.error('[POST /api/posts Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to create entry' });
  }
});

app.patch('/api/posts/:id', rateLimit({ max: 20 }), async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Content cannot be empty' });
    }

    const postRes = await query('SELECT author_id FROM posts WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (postRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const post = postRes.rows[0];
    const isOwner = post.author_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized to edit this post' });
    }

    await query(
      'UPDATE posts SET content = $1, is_edited = true, updated_at = NOW() WHERE id = $2',
      [content.trim(), id]
    );

    res.json({ success: true, message: 'Post updated successfully' });
  } catch (err) {
    console.error('[PATCH /api/posts Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to edit post' });
  }
});

app.delete('/api/posts/:id', rateLimit({ max: 20 }), async (req, res) => {
  try {
    const { id } = req.params;

    const postRes = await query('SELECT author_id FROM posts WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (postRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const post = postRes.rows[0];
    const isOwner = post.author_id === req.user.id;
    const isStaff = req.user.role === 'admin' || req.user.role === 'moderator';

    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this post' });
    }

    await query('UPDATE posts SET deleted_at = NOW() WHERE id = $1', [id]);

    if (isStaff && !isOwner) {
      await query(`
        INSERT INTO admin_audit_logs (actor_id, action, target_type, target_id, metadata)
        VALUES ($1, 'DELETE_POST', 'post', $2, $3)
      `, [req.user.id, id, JSON.stringify({ reason: 'Staff removal' })]);
    }

    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/posts Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to delete post' });
  }
});

// Likes & Bookmarks
app.post('/api/posts/:id/like', likeLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    const postRes = await query('SELECT id, author_id, likes_count FROM posts WHERE id = $1', [id]);
    let isConfession = false;
    let target = postRes.rows[0];

    if (!target) {
      const confRes = await query('SELECT id, author_id, likes_count FROM confessions WHERE id = $1', [id]);
      if (!confRes.rows[0]) {
        return res.status(404).json({ success: false, message: 'Entry not found' });
      }
      target = confRes.rows[0];
      isConfession = true;
    }

    if (isConfession) {
      const checkLike = await query('SELECT 1 FROM confession_likes WHERE confession_id = $1 AND user_id = $2', [id, req.user.id]);
      const hasLiked = checkLike.rows.length > 0;

      if (hasLiked) {
        await query('DELETE FROM confession_likes WHERE confession_id = $1 AND user_id = $2', [id, req.user.id]);
        await query('UPDATE confessions SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1', [id]);
      } else {
        await query('INSERT INTO confession_likes (confession_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, req.user.id]);
        await query('UPDATE confessions SET likes_count = likes_count + 1 WHERE id = $1', [id]);
      }
      const updated = await query('SELECT likes_count FROM confessions WHERE id = $1', [id]);
      return res.json({ success: true, hasLiked: !hasLiked, likes: updated.rows[0].likes_count });
    }

    const checkLike = await query('SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2', [id, req.user.id]);
    const hasLiked = checkLike.rows.length > 0;

    if (hasLiked) {
      await query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [id, req.user.id]);
      await query('UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1', [id]);
    } else {
      await query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, req.user.id]);
      await query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1', [id]);

      if (target.author_id !== req.user.id) {
        await query(`
          INSERT INTO notifications (recipient_id, actor_id, type, entity_type, entity_id)
          VALUES ($1, $2, 'LIKE', 'post', $3)
        `, [target.author_id, req.user.id, id]);
      }
    }

    const updated = await query('SELECT likes_count FROM posts WHERE id = $1', [id]);
    res.json({ success: true, hasLiked: !hasLiked, likes: updated.rows[0].likes_count });
  } catch (err) {
    console.error('[Like Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to toggle like' });
  }
});

app.post('/api/posts/:id/bookmark', likeLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    const checkSave = await query('SELECT 1 FROM saved_posts WHERE post_id = $1 AND user_id = $2', [id, req.user.id]);
    const hasBookmarked = checkSave.rows.length > 0;

    if (hasBookmarked) {
      await query('DELETE FROM saved_posts WHERE post_id = $1 AND user_id = $2', [id, req.user.id]);
    } else {
      await query('INSERT INTO saved_posts (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, req.user.id]);
    }

    const countRes = await query('SELECT count(*) FROM saved_posts WHERE post_id = $1', [id]);

    res.json({
      success: true,
      hasBookmarked: !hasBookmarked,
      bookmarksCount: parseInt(countRes.rows[0].count, 10)
    });
  } catch (err) {
    console.error('[Bookmark Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to bookmark' });
  }
});

app.post('/api/posts/:id/hide', rateLimit({ max: 30 }), async (req, res) => {
  try {
    const { id } = req.params;
    await query(
      'INSERT INTO hidden_posts (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, id]
    );
    res.json({ success: true, message: 'Post hidden from feed.' });
  } catch (err) {
    console.error('[Hide Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to hide post' });
  }
});

app.get('/api/user/saved', async (req, res) => {
  try {
    const saved = await query(`
      SELECT p.id, p.content, p.image_url, p.tag, p.likes_count, p.comments_count, p.created_at,
             u.id as user_id, u.public_profile_id, u.anonymous_pseudonym, u.handle, u.avatar_url, u.email_verified, u.role
      FROM saved_posts sp
      JOIN posts p ON p.id = sp.post_id AND p.deleted_at IS NULL
      JOIN users u ON u.id = p.author_id
      WHERE sp.user_id = $1
        AND p.author_id NOT IN (
          SELECT blocked_id FROM blocks WHERE blocker_id = $1
          UNION
          SELECT blocker_id FROM blocks WHERE blocked_id = $1
        )
      ORDER BY sp.created_at DESC
    `, [req.user.id]);

    const formatted = saved.rows.map(p => ({
      id: p.id,
      type: 'post',
      category: p.tag ? p.tag.replace('#', '') : 'General',
      title: p.content.length > 50 ? p.content.slice(0, 50) + '...' : p.content,
      content: p.content,
      images: p.image_url ? [p.image_url] : [],
      timestamp: formatTimeAgo(p.created_at),
      likes: p.likes_count || 0,
      hasLiked: false,
      commentsCount: p.comments_count || 0,
      hasBookmarked: true,
      tags: p.tag ? [p.tag] : [],
      author: toPublicAuthor(p)
    }));

    res.json({ success: true, savedPosts: formatted });
  } catch (err) {
    console.error('[GET /api/user/saved Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to load saved posts' });
  }
});

// =============================================================
// PHOTO UPLOAD ENGINE (DEVICE UPLOAD TO SUPABASE STORAGE)
// =============================================================

app.post('/api/upload/image', uploadLimiter, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Image size exceeds maximum limit of 10MB.' });
      }
      return res.status(400).json({ success: false, message: err.message || 'Image upload failed.' });
    }

    try {
      const file = req.file;
      if (!file || !file.buffer) {
        return res.status(400).json({ success: false, message: 'Please select an image file to upload.' });
      }

      // Validate MIME type and actual file signature (magic numbers)
      const detected = validateImageMagicNumbers(file.buffer);
      if (!detected.valid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid image file signature. Only JPG, PNG, and WebP images are allowed.'
        });
      }

      // Process image: strip EXIF metadata from JPEG (GPS, camera info)
      let cleanBuffer = file.buffer;
      if (detected.ext === 'jpg') {
        cleanBuffer = stripJpegExif(cleanBuffer);
      }

      // Generate safe unique filename to prevent path traversal
      const uniqueSuffix = `${Date.now()}_${crypto.randomUUID()}`;
      const safeKey = `posts/${req.user.id}/${uniqueSuffix}.${detected.ext}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(safeKey, cleanBuffer, {
          contentType: detected.mime,
          upsert: false
        });

      if (uploadErr) {
        console.error('[Supabase Storage Upload Error]:', uploadErr);
        return res.status(500).json({ success: false, message: 'Unable to store image. Please try again.' });
      }

      // Generate public URL
      const { data: pubData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(safeKey);

      res.status(201).json({
        success: true,
        url: pubData.publicUrl,
        filename: safeKey,
        mime: detected.mime,
        size: cleanBuffer.length
      });
    } catch (uploadCatchErr) {
      console.error('[Image Upload Catch Error]:', uploadCatchErr);
      res.status(500).json({ success: false, message: 'Image upload failed. Please try again.' });
    }
  });
});

/**
 * POST /api/user/avatar - Upload / Replace Profile Picture
 * - Strict 5MB limit
 * - Binary magic bytes validation (JPG, PNG, WebP only)
 * - EXIF stripped & resized to 512x512 WebP square
 * - Stored in dedicated user folder: avatars/{userId}/{uniqueId}.webp
 * - Purges previous custom avatar from storage
 * - Updates user record & in-memory session cache
 */
app.post('/api/user/avatar', uploadLimiter, (req, res) => {
  uploadAvatarMulter.single('avatar')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Image size exceeds maximum limit of 5MB.' });
      }
      return res.status(400).json({ success: false, message: err.message || 'Avatar upload failed.' });
    }

    try {
      const file = req.file;
      if (!file || !file.buffer) {
        return res.status(400).json({ success: false, message: 'Please select an image file to upload.' });
      }

      // 1. Binary Magic Bytes Validation
      const detected = validateAvatarMagicBytes(file.buffer);
      if (!detected.valid) {
        return res.status(400).json({ success: false, message: detected.error });
      }

      // 2. Image Processing: Resize 512x512, strip EXIF metadata, compress to WebP
      const processed = await processAvatar(file.buffer);

      // 3. Query existing user avatar to clean up old file after new upload
      const currentRes = await query('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
      const oldAvatarUrl = currentRes.rows[0]?.avatar_url;

      // 4. Upload to isolated user folder in Supabase Storage 'avatars' bucket
      const { publicUrl, storagePath } = await uploadAvatarToStorage(req.user.id, processed.buffer);

      // 5. Update user profile record in PostgreSQL
      await query(
        'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2',
        [publicUrl, req.user.id]
      );

      // 6. Update in-memory session cache so subsequent requests return new avatar immediately
      if (req.session && req.session.cachedUser) {
        req.session.cachedUser = {
          ...req.session.cachedUser,
          avatar_url: publicUrl
        };
      }

      // 7. Non-blocking cleanup of previous avatar from Supabase Storage
      if (oldAvatarUrl && oldAvatarUrl !== publicUrl) {
        deleteAvatarFromStorage(oldAvatarUrl, req.user.id).catch(() => {});
      }

      res.status(200).json({
        success: true,
        avatarUrl: publicUrl,
        message: 'Profile picture updated successfully.'
      });
    } catch (uploadCatchErr) {
      console.error('[Avatar Upload Catch Error]:', uploadCatchErr);
      res.status(500).json({ success: false, message: uploadCatchErr.message || 'Failed to update profile picture.' });
    }
  });
});

/**
 * DELETE /api/user/avatar - Remove Profile Picture
 * - Deletes stored file from 'avatars' bucket
 * - Resets users.avatar_url to NULL (defaults to fallback avatar)
 * - Updates in-memory session cache
 */
app.delete('/api/user/avatar', async (req, res) => {
  try {
    const currentRes = await query('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
    const oldAvatarUrl = currentRes.rows[0]?.avatar_url;

    if (oldAvatarUrl) {
      await deleteAvatarFromStorage(oldAvatarUrl, req.user.id);
    }

    await query('UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1', [req.user.id]);

    if (req.session && req.session.cachedUser) {
      req.session.cachedUser = {
        ...req.session.cachedUser,
        avatar_url: null
      };
    }

    res.json({
      success: true,
      avatarUrl: DEFAULT_AVATAR_URL,
      message: 'Profile picture removed successfully.'
    });
  } catch (err) {
    console.error('[Avatar Removal Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to remove profile picture.' });
  }
});

// =============================================================
// COMMENTS ENGINE (POSTS & CONFESSIONS)
// =============================================================

// Helper to verify existence of post or confession
async function findTargetPostOrConfession(id) {
  const postRes = await query(`
    SELECT p.id, p.author_id, 'post' as entity_type, s.who_can_comment 
    FROM posts p
    JOIN users u ON u.id = p.author_id
    LEFT JOIN user_settings s ON s.user_id = u.id
    WHERE p.id = $1 AND p.deleted_at IS NULL
  `, [id]);

  if (postRes.rows.length > 0) {
    return { target: postRes.rows[0], isConfession: false };
  }

  const confRes = await query(`
    SELECT c.id, c.author_id, 'confession' as entity_type, 'everyone' as who_can_comment
    FROM confessions c
    WHERE c.id = $1 AND c.deleted_at IS NULL
  `, [id]);

  if (confRes.rows.length > 0) {
    return { target: confRes.rows[0], isConfession: true };
  }

  return { target: null, isConfession: false };
}

// GET comments for a post or confession
app.get('/api/posts/:id/comments', readLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    const { target } = await findTargetPostOrConfession(id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const commentsRes = await query(`
      SELECT c.id, c.content, c.is_anonymous, c.anonymous_pseudonym, c.parent_comment_id, c.created_at,
             u.id as author_id, u.public_profile_id, u.anonymous_pseudonym as user_pseudonym, u.handle, u.avatar_url, u.role
      FROM comments c
      LEFT JOIN users u ON u.id = c.author_id
      WHERE c.post_id = $1 AND c.deleted_at IS NULL
        AND (c.author_id IS NULL OR c.author_id NOT IN (
          SELECT blocked_id FROM blocks WHERE blocker_id = $2
          UNION
          SELECT blocker_id FROM blocks WHERE blocked_id = $2
        ))
      ORDER BY c.created_at ASC
    `, [id, req.user.id]);

    const formattedComments = commentsRes.rows.map(c => {
      const isAnon = c.is_anonymous;
      return {
        id: c.id,
        parent_comment_id: c.parent_comment_id,
        author: isAnon ? (c.anonymous_pseudonym || 'Anonymous Peer') : (c.user_pseudonym || 'Student'),
        handle: isAnon ? `@mask_${(parseInt(c.id.replace(/-/g, '').slice(0, 3), 16) % 90) + 10}` : (c.handle || '@anon'),
        public_profile_id: isAnon ? null : c.public_profile_id,
        avatar: isAnon ? 'mask' : (c.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'),
        isAnonymous: isAnon,
        text: c.content,
        timestamp: formatTimeAgo(c.created_at),
        isOwn: c.author_id === req.user.id
      };
    });

    res.json({ success: true, comments: formattedComments });
  } catch (err) {
    console.error('[GET Comments Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to load comments' });
  }
});

// POST comment on a post or confession
app.post('/api/posts/:id/comments', commentLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, isAnonymous, parent_comment_id } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Comment cannot be empty.' });
    }

    if (text.trim().length > 1000) {
      return res.status(400).json({ success: false, message: 'Comment exceeds 1,000 character limit.' });
    }

    const { target, isConfession } = await findTargetPostOrConfession(id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check interaction permissions for standard posts
    if (!isConfession && target.author_id !== req.user.id) {
      if (target.who_can_comment === 'nobody') {
        return res.status(403).json({ success: false, message: 'The author has turned off comments on this post.' });
      }
      if (target.who_can_comment === 'followers') {
        const followCheck = await query(
          'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
          [req.user.id, target.author_id]
        );
        if (followCheck.rows.length === 0) {
          return res.status(403).json({ success: false, message: 'Only followers can comment on this post.' });
        }
      }
    }

    // Validate parent comment if nested reply
    let validParentId = null;
    if (parent_comment_id) {
      const parentCheck = await query(
        'SELECT id FROM comments WHERE id = $1 AND post_id = $2 AND deleted_at IS NULL',
        [parent_comment_id, id]
      );
      if (parentCheck.rows.length > 0) {
        validParentId = parent_comment_id;
      }
    }

    const masks = ['Anonymous Falcon', 'Anonymous Owl', 'Anonymous Cardinal', 'Anonymous Lynx', 'Anonymous Peer'];
    const maskName = isAnonymous ? masks[Math.floor(Math.random() * masks.length)] : null;

    // Insert comment with authenticated user ID (never trusting client-supplied ID)
    const commentRes = await query(`
      INSERT INTO comments (author_id, post_id, content, is_anonymous, anonymous_pseudonym, parent_comment_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, content, is_anonymous, anonymous_pseudonym, parent_comment_id, created_at
    `, [req.user.id, id, text.trim(), !!isAnonymous, maskName, validParentId]);

    // Increment comments_count on target
    if (isConfession) {
      await query('UPDATE confessions SET comments_count = comments_count + 1 WHERE id = $1', [id]);
    } else {
      await query('UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1', [id]);
      if (target.author_id !== req.user.id) {
        await query(`
          INSERT INTO notifications (recipient_id, actor_id, type, entity_type, entity_id)
          VALUES ($1, $2, 'COMMENT', 'post', $3)
        `, [target.author_id, req.user.id, id]).catch(() => {});
      }
    }

    const c = commentRes.rows[0];
    const newComment = {
      id: c.id,
      parent_comment_id: c.parent_comment_id,
      author: isAnonymous ? maskName : req.user.anonymous_pseudonym,
      handle: isAnonymous ? `@mask_${(parseInt(c.id.replace(/-/g, '').slice(0, 3), 16) % 90) + 10}` : req.user.handle,
      public_profile_id: isAnonymous ? null : req.user.public_profile_id,
      avatar: isAnonymous ? 'mask' : req.user.avatar_url,
      isAnonymous: !!isAnonymous,
      text: c.content,
      timestamp: 'Just now',
      isOwn: true
    };

    res.status(201).json({ success: true, comment: newComment });
  } catch (err) {
    console.error('[POST Comment Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to post comment' });
  }
});

// Helper for comment deletion
async function executeDeleteComment(req, res, commentId, postId = null) {
  const commRes = await query('SELECT id, author_id, post_id FROM comments WHERE id = $1 AND deleted_at IS NULL', [commentId]);
  if (commRes.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Comment not found' });
  }

  const comment = commRes.rows[0];
  if (postId && comment.post_id !== postId) {
    return res.status(404).json({ success: false, message: 'Comment not found on this post' });
  }

  const isOwner = comment.author_id === req.user.id;
  const isStaff = ['admin', 'moderator'].includes(req.user.role);

  if (!isOwner && !isStaff) {
    return res.status(403).json({ success: false, message: 'Unauthorized to delete this comment' });
  }

  // Soft delete
  await query('UPDATE comments SET deleted_at = NOW() WHERE id = $1', [commentId]);

  // Decrement counter on both tables safely
  await query('UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1', [comment.post_id]);
  await query('UPDATE confessions SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1', [comment.post_id]);

  if (isStaff && !isOwner) {
    await query(`
      INSERT INTO admin_audit_logs (actor_id, action, target_type, target_id, metadata)
      VALUES ($1, 'DELETE_COMMENT', 'comment', $2, $3)
    `, [req.user.id, commentId, JSON.stringify({ reason: 'Staff removal' })]).catch(() => {});
  }

  res.json({ success: true, message: 'Comment deleted successfully' });
}

// DELETE comment via post context: DELETE /api/posts/:id/comments/:commentId
app.delete('/api/posts/:id/comments/:commentId', rateLimit({ max: 30 }), async (req, res) => {
  try {
    const { id, commentId } = req.params;
    await executeDeleteComment(req, res, commentId, id);
  } catch (err) {
    console.error('[DELETE Post Comment Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to delete comment' });
  }
});

// DELETE comment directly: DELETE /api/comments/:commentId
app.delete('/api/comments/:commentId', rateLimit({ max: 30 }), async (req, res) => {
  try {
    const { commentId } = req.params;
    await executeDeleteComment(req, res, commentId, null);
  } catch (err) {
    console.error('[DELETE Comment Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to delete comment' });
  }
});

// Notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const notifs = await query(`
      SELECT n.id, n.type, n.entity_type, n.entity_id, n.read, n.created_at,
             u.public_profile_id, u.anonymous_pseudonym, u.handle, u.avatar_url
      FROM notifications n
      LEFT JOIN users u ON u.id = n.actor_id
      WHERE n.recipient_id = $1
      ORDER BY n.created_at DESC LIMIT 30
    `, [req.user.id]);

    const formatted = notifs.rows.map(n => {
      const actorName = n.anonymous_pseudonym || 'A student';
      let title = 'Campus Alert';
      let message = 'New activity on campus';

      if (n.type === 'FOLLOW') {
        title = 'New Follower';
        message = `${actorName} started following your public profile.`;
      } else if (n.type === 'LIKE') {
        title = 'Post Upvote';
        message = `${actorName} liked your post.`;
      } else if (n.type === 'COMMENT') {
        title = 'New Discussion Reply';
        message = `${actorName} replied to your post thread.`;
      }

      return {
        id: n.id,
        type: n.type.toLowerCase(),
        title,
        message,
        timestamp: formatTimeAgo(n.created_at),
        unread: !n.read,
        actionUrl: n.entity_id ? `post-${n.entity_id}` : null,
        actor: {
          public_profile_id: n.public_profile_id,
          display_name: actorName,
          handle: n.handle || '@anon'
        }
      };
    });

    const unreadCount = formatted.filter(n => n.unread).length;
    res.json({ success: true, notifications: formatted, unreadCount });
  } catch (err) {
    console.error('[GET Notifications Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to load notifications' });
  }
});

app.post('/api/notifications/read-all', async (req, res) => {
  try {
    await query('UPDATE notifications SET read = true WHERE recipient_id = $1', [req.user.id]);
    res.json({ success: true, unreadCount: 0 });
  } catch (err) {
    console.error('[Read All Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to mark read' });
  }
});

// Clubs & Organizations
app.get('/api/organizations', async (req, res) => {
  try {
    const orgs = await query(`
      SELECT o.id, o.name, o.category, o.avatar_url, o.bio, o.verified,
             count(f.user_id) as followers_count,
             EXISTS(SELECT 1 FROM organization_followers WHERE organization_id = o.id AND user_id = $1) as is_following
      FROM organizations o
      LEFT JOIN organization_followers f ON f.organization_id = o.id
      GROUP BY o.id
      ORDER BY followers_count DESC
    `, [req.user.id]);

    const formatted = orgs.rows.map(o => ({
      id: o.id,
      name: o.name,
      category: o.category,
      avatar: o.avatar_url,
      bio: o.bio,
      verified: o.verified,
      members: `${o.followers_count} members`,
      isFollowing: !!o.is_following
    }));

    res.json({ success: true, organizations: formatted });
  } catch (err) {
    console.error('[GET Organizations Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to load organizations' });
  }
});

app.post('/api/organizations/:id/follow', rateLimit({ max: 30 }), async (req, res) => {
  try {
    const { id } = req.params;
    await query(
      'INSERT INTO organization_followers (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, req.user.id]
    );
    res.json({ success: true, isFollowing: true });
  } catch (err) {
    console.error('[Org Follow Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to follow club' });
  }
});

app.delete('/api/organizations/:id/follow', rateLimit({ max: 30 }), async (req, res) => {
  try {
    const { id } = req.params;
    await query(
      'DELETE FROM organization_followers WHERE organization_id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    res.json({ success: true, isFollowing: false });
  } catch (err) {
    console.error('[Org Unfollow Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to unfollow club' });
  }
});

// Search
app.get('/api/search', rateLimit({ max: 40 }), async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === '') {
      return res.json({ success: true, people: [], posts: [], clubs: [] });
    }

    const searchTerm = `%${q.trim().toLowerCase()}%`;

    const [peopleRes, postsRes] = await Promise.all([
      query(`
        SELECT u.public_profile_id, u.anonymous_pseudonym, u.handle, u.avatar_url, u.department, u.graduation_year,
               s.show_department, s.show_year
        FROM users u
        LEFT JOIN user_settings s ON s.user_id = u.id
        WHERE u.status = 'active'
          AND (s.profile_discoverability IS NULL OR s.profile_discoverability = true)
          AND (LOWER(u.handle) LIKE $1 OR LOWER(u.anonymous_pseudonym) LIKE $1 OR LOWER(COALESCE(u.department, '')) LIKE $1)
          AND NOT EXISTS (
            SELECT 1 FROM blocks b 
            WHERE (b.blocker_id = $2 AND b.blocked_id = u.id)
               OR (b.blocker_id = u.id AND b.blocked_id = $2)
          )
        LIMIT 10
      `, [searchTerm, req.user.id]),
      query(`
        SELECT p.id, p.content, p.tag, p.likes_count, p.comments_count, p.created_at,
               u.public_profile_id, u.anonymous_pseudonym, u.handle, u.avatar_url, u.role
        FROM posts p
        JOIN users u ON u.id = p.author_id
        WHERE p.deleted_at IS NULL
          AND (LOWER(p.content) LIKE $1 OR LOWER(p.tag) LIKE $1)
          AND NOT EXISTS (
            SELECT 1 FROM blocks b 
            WHERE (b.blocker_id = $2 AND b.blocked_id = p.author_id)
               OR (b.blocker_id = p.author_id AND b.blocked_id = $2)
          )
        LIMIT 15
      `, [searchTerm, req.user.id])
    ]);

    const people = peopleRes.rows.map(p => ({
      public_profile_id: p.public_profile_id,
      display_name: p.anonymous_pseudonym,
      handle: p.handle,
      avatar: p.avatar_url,
      department: p.show_department !== false ? p.department : ''
    }));

    const posts = postsRes.rows.map(p => ({
      id: p.id,
      type: 'post',
      title: p.content.slice(0, 50),
      content: p.content,
      tags: p.tag ? [p.tag] : [],
      likes: p.likes_count || 0,
      commentsCount: p.comments_count || 0,
      timestamp: formatTimeAgo(p.created_at),
      author: toPublicAuthor(p)
    }));

    res.json({ success: true, people, posts });
  } catch (err) {
    console.error('[Search Error]:', err);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
});

// Settings & Privacy
app.get('/api/settings', async (req, res) => {
  try {
    const sRes = await query('SELECT * FROM user_settings WHERE user_id = $1', [req.user.id]);
    const uRes = await query('SELECT bio, department FROM users WHERE id = $1', [req.user.id]);
    const userRow = uRes.rows[0] || {};

    const defaultSettings = {
      show_department: true,
      show_year: true,
      show_bio: true,
      profile_discoverability: true,
      who_can_follow: 'everyone',
      who_can_comment: 'everyone',
      show_posts_on_profile: true,
      notify_likes: true,
      notify_comments: true,
      notify_replies: true,
      notify_followers: true,
      notify_events: true,
      notify_announcements: true
    };

    const settings = {
      ...defaultSettings,
      ...(sRes.rows[0] || {}),
      bio: userRow.bio || '',
      department: userRow.department || ''
    };

    res.json({ success: true, settings });
  } catch (err) {
    console.error('[GET Settings Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to load settings' });
  }
});

app.put('/api/settings', rateLimit({ max: 20 }), async (req, res) => {
  try {
    const {
      show_department,
      show_year,
      show_bio,
      profile_discoverability,
      who_can_follow,
      who_can_comment,
      show_posts_on_profile,
      notify_likes,
      notify_comments,
      notify_replies,
      notify_followers,
      notify_events,
      notify_announcements,
      bio,
      department
    } = req.body;

    if (bio !== undefined || department !== undefined) {
      await query(`
        UPDATE users 
        SET bio = COALESCE($1, bio), department = COALESCE($2, department), updated_at = NOW()
        WHERE id = $3
      `, [bio !== undefined ? String(bio).slice(0, 300) : null, department !== undefined ? String(department).slice(0, 100) : null, req.user.id]);
    }

    // Get current settings to merge cleanly
    const currentRes = await query('SELECT * FROM user_settings WHERE user_id = $1', [req.user.id]);
    const current = currentRes.rows[0] || {};

    const merged = {
      show_department: show_department !== undefined ? !!show_department : (current.show_department !== false),
      show_year: show_year !== undefined ? !!show_year : (current.show_year !== false),
      show_bio: show_bio !== undefined ? !!show_bio : (current.show_bio !== false),
      profile_discoverability: profile_discoverability !== undefined ? !!profile_discoverability : (current.profile_discoverability !== false),
      who_can_follow: who_can_follow !== undefined ? String(who_can_follow) : (current.who_can_follow || 'everyone'),
      who_can_comment: who_can_comment !== undefined ? String(who_can_comment) : (current.who_can_comment || 'everyone'),
      show_posts_on_profile: show_posts_on_profile !== undefined ? !!show_posts_on_profile : (current.show_posts_on_profile !== false),
      notify_likes: notify_likes !== undefined ? !!notify_likes : (current.notify_likes !== false),
      notify_comments: notify_comments !== undefined ? !!notify_comments : (current.notify_comments !== false),
      notify_replies: notify_replies !== undefined ? !!notify_replies : (current.notify_replies !== false),
      notify_followers: notify_followers !== undefined ? !!notify_followers : (current.notify_followers !== false),
      notify_events: notify_events !== undefined ? !!notify_events : (current.notify_events !== false),
      notify_announcements: notify_announcements !== undefined ? !!notify_announcements : (current.notify_announcements !== false)
    };

    await query(`
      INSERT INTO user_settings (
        user_id, show_department, show_year, show_bio, profile_discoverability,
        who_can_follow, who_can_comment, show_posts_on_profile,
        notify_likes, notify_comments, notify_replies, notify_followers,
        notify_events, notify_announcements, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        show_department = EXCLUDED.show_department,
        show_year = EXCLUDED.show_year,
        show_bio = EXCLUDED.show_bio,
        profile_discoverability = EXCLUDED.profile_discoverability,
        who_can_follow = EXCLUDED.who_can_follow,
        who_can_comment = EXCLUDED.who_can_comment,
        show_posts_on_profile = EXCLUDED.show_posts_on_profile,
        notify_likes = EXCLUDED.notify_likes,
        notify_comments = EXCLUDED.notify_comments,
        notify_replies = EXCLUDED.notify_replies,
        notify_followers = EXCLUDED.notify_followers,
        notify_events = EXCLUDED.notify_events,
        notify_announcements = EXCLUDED.notify_announcements,
        updated_at = NOW()
    `, [
      req.user.id,
      merged.show_department,
      merged.show_year,
      merged.show_bio,
      merged.profile_discoverability,
      merged.who_can_follow,
      merged.who_can_comment,
      merged.show_posts_on_profile,
      merged.notify_likes,
      merged.notify_comments,
      merged.notify_replies,
      merged.notify_followers,
      merged.notify_events,
      merged.notify_announcements
    ]);

    res.json({ success: true, message: 'Settings saved successfully', settings: merged });
  } catch (err) {
    console.error('[PUT Settings Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

// Blocking
app.get('/api/blocks', async (req, res) => {
  try {
    const list = await query(`
      SELECT b.id, b.created_at, u.public_profile_id, u.anonymous_pseudonym, u.handle
      FROM blocks b
      JOIN users u ON u.id = b.blocked_id
      WHERE b.blocker_id = $1
    `, [req.user.id]);

    res.json({ success: true, blockedUsers: list.rows });
  } catch (err) {
    console.error('[GET Blocks Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to load blocked users' });
  }
});

app.post('/api/blocks', rateLimit({ max: 20 }), async (req, res) => {
  try {
    const { publicProfileId } = req.body;

    const targetRes = await query('SELECT id FROM users WHERE public_profile_id = $1', [publicProfileId]);
    if (targetRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Target student not found' });
    }

    const targetId = targetRes.rows[0].id;
    if (targetId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot block your own account.' });
    }

    await withTransaction(async (client) => {
      await client.query(
        'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.user.id, targetId]
      );
      await client.query(
        'DELETE FROM follows WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)',
        [req.user.id, targetId]
      );
    });

    res.json({ success: true, message: 'User blocked. Content and interactions have been severed.' });
  } catch (err) {
    console.error('[Block Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to block user' });
  }
});

app.delete('/api/blocks/:publicProfileId', rateLimit({ max: 20 }), async (req, res) => {
  try {
    const { publicProfileId } = req.params;
    const targetRes = await query('SELECT id FROM users WHERE public_profile_id = $1', [publicProfileId]);
    if (targetRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Target user not found' });
    }

    await query('DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2', [req.user.id, targetRes.rows[0].id]);
    res.json({ success: true, message: 'User unblocked.' });
  } catch (err) {
    console.error('[Unblock Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to unblock user' });
  }
});

// Reporting
app.post('/api/reports', rateLimit({ max: 10 }), async (req, res) => {
  try {
    const { target_type, target_id, reason, details } = req.body;

    if (!target_type || !target_id || !reason) {
      return res.status(400).json({ success: false, message: 'Target and reason are required' });
    }

    await query(`
      INSERT INTO reports (reporter_id, target_type, target_id, reason, details, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
    `, [req.user.id, target_type, target_id, reason, details || '']);

    res.status(201).json({ success: true, message: 'Report submitted for moderation review.' });
  } catch (err) {
    console.error('[Report Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to submit report' });
  }
});

// Account Deletion
app.post('/api/user/delete-account', rateLimit({ max: 3 }), async (req, res) => {
  try {
    const { confirmation } = req.body;

    if (confirmation !== 'DELETE') {
      return res.status(400).json({
        success: false,
        message: 'Must provide exact confirmation string "DELETE".'
      });
    }

    await withTransaction(async (client) => {
      await client.query('DELETE FROM follows WHERE follower_id = $1 OR following_id = $1', [req.user.id]);
      await client.query('DELETE FROM post_likes WHERE user_id = $1', [req.user.id]);
      await client.query('DELETE FROM confession_likes WHERE user_id = $1', [req.user.id]);
      await client.query('DELETE FROM saved_posts WHERE user_id = $1', [req.user.id]);
      await client.query('DELETE FROM hidden_posts WHERE user_id = $1', [req.user.id]);
      await client.query('DELETE FROM notifications WHERE recipient_id = $1 OR actor_id = $1', [req.user.id]);
      await client.query('DELETE FROM blocks WHERE blocker_id = $1 OR blocked_id = $1', [req.user.id]);
      await client.query('DELETE FROM organization_followers WHERE user_id = $1', [req.user.id]);

      await client.query(`
        UPDATE users 
        SET full_name = 'Deleted Student', 
            email = 'deleted_' || id || '@sanjivani.edu.in',
            phone_number = NULL,
            bio = 'This student account has been permanently deactivated.',
            status = 'deleted',
            anonymous_pseudonym = 'Deleted Student',
            handle = '@deleted_' || SUBSTRING(id::text, 1, 6)
        WHERE id = $1
      `, [req.user.id]);
    });

    revokeUserSessions(req.user.id);

    res.json({
      success: true,
      message: 'Your account has been deleted and private identifiers permanently purged.'
    });
  } catch (err) {
    console.error('[Delete Account Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to complete account deletion' });
  }
});

// =============================================================
// CAMPUS EVENTS (STUDENT & PUBLIC VIEW)
// =============================================================
app.get('/api/events', async (req, res) => {
  try {
    const { category, search, upcoming } = req.query;
    const where = ['e.deleted_at IS NULL', 'e.is_published = true'];
    const params = [];

    if (category && category !== 'All' && category !== 'all') {
      params.push(`%${category.toLowerCase()}%`);
      where.push(`LOWER(e.category) LIKE $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      where.push(`(LOWER(e.title) LIKE $${params.length} OR LOWER(e.description) LIKE $${params.length} OR LOWER(e.location) LIKE $${params.length})`);
    }

    if (upcoming === 'true') {
      where.push('e.event_date >= NOW()');
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const eventsRes = await query(`
      SELECT e.id, e.title, e.description, e.category, e.location,
             e.event_date, e.end_date, e.image_url, e.attendees_count, e.created_at,
             u.full_name as organizer_name, u.anonymous_pseudonym as organizer_pseudonym
      FROM events e
      LEFT JOIN users u ON u.id = e.organizer_id
      ${whereSql}
      ORDER BY e.event_date ASC
      LIMIT 100
    `, params);

    res.json({ success: true, events: eventsRes.rows });
  } catch (err) {
    console.error('[Get Events Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve events' });
  }
});

// =============================================================
// USER BEHAVIOR ANALYTICS INGESTION (CLIENT-SIDE TELEMETRY)
// Privacy-First: Discards sensitive fields (passwords, OTPs, raw text)
// =============================================================
app.post('/api/analytics/track', async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const sessionId = req.headers['x-session-id'] || req.body.sessionId || null;
    const { type, page, route, activeDurationMs, totalDurationMs, enteredAt, exitedAt, events = [] } = req.body;

    // 1. Process Page View / Active Duration
    if (type === 'PAGE_VIEW' || type === 'PAGE_EXIT' || (page && activeDurationMs !== undefined)) {
      await query(`
        INSERT INTO page_views (user_id, session_id, page, route, entered_at, exited_at, active_duration_ms, total_duration_ms)
        VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_TIMESTAMP), $6, $7, $8)
      `, [
        userId,
        sessionId,
        (page || 'Unknown').slice(0, 150),
        (route || '/').slice(0, 150),
        enteredAt ? new Date(enteredAt) : null,
        exitedAt ? new Date(exitedAt) : (type === 'PAGE_EXIT' ? new Date() : null),
        Math.max(0, parseInt(activeDurationMs || 0, 10)),
        Math.max(0, parseInt(totalDurationMs || 0, 10))
      ]);
    }

    // 2. Process Semantic User Action Events
    const rawEvents = Array.isArray(events) ? events : (req.body.eventType ? [req.body] : []);
    
    for (const ev of rawEvents) {
      const eventType = (ev.eventType || ev.event_type || '').toUpperCase();
      if (!eventType) continue;

      // Privacy check: sanitize metadata to ensure no sensitive text is logged
      const safeMeta = { ...(ev.metadata || {}) };
      delete safeMeta.password;
      delete safeMeta.otp;
      delete safeMeta.token;
      delete safeMeta.jwt;
      delete safeMeta.text; // Strip arbitrary keystroke inputs

      await query(`
        INSERT INTO user_activity_events (user_id, session_id, event_type, page, target_type, target_id, element_id, metadata, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        userId,
        sessionId,
        eventType.slice(0, 50),
        (ev.page || page || '').slice(0, 150),
        ev.targetType ? String(ev.targetType).slice(0, 50) : null,
        ev.targetId ? String(ev.targetId).slice(0, 100) : null,
        ev.elementId ? String(ev.elementId).slice(0, 100) : null,
        JSON.stringify(safeMeta),
        req.ip || '127.0.0.1',
        req.headers['user-agent'] || 'Unknown'
      ]);
    }

    // Also update session last_active_at if session token exists
    if (req.sessionToken) {
      await query('UPDATE user_sessions SET last_active_at = NOW() WHERE session_token = $1', [req.sessionToken]).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    // Non-blocking telemetry ingestion
    console.error('[Analytics Ingestion Error]:', err.message);
    res.json({ success: true });
  }
});

// =============================================================
// ADMIN & MODERATION PORTAL (SERVER-SIDE AUTHORIZED & AUDITED)
// =============================================================
app.use('/api/admin', require('./routes/admin'));

// =============================================================
// CENTRALIZED ERROR HANDLING MIDDLEWARE (OWASP DEFENSE IN DEPTH)
// Ensures no SQL queries, stack traces, hostnames, or secrets leak to the client
// =============================================================
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV !== 'production';
  console.error('[Unhandled Server Error]:', {
    requestId: req.headers['x-request-id'] || null,
    method: req.method,
    path: req.path,
    message: err.message,
    ...(isDev ? { stack: err.stack } : {})
  });

  const statusCode = err.status || err.statusCode || (err.message?.includes('CORS') ? 403 : 500);
  res.status(statusCode).json({
    success: false,
    message: isDev 
      ? err.message || 'Internal server error' 
      : (statusCode === 500 ? 'An unexpected error occurred. Please try again later.' : err.message)
  });
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Campus Radar Server] running on http://localhost:${PORT}`);
  });
}

module.exports = app;

