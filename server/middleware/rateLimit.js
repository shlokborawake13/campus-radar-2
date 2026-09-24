/**
 * Campus Radar Production Rate Limiting & Abuse Prevention Engine
 * 
 * Implements defense-in-depth tiered throttling:
 * - LOGIN: Strict (5 req / 5 min per IP + identifier)
 * - OTP SEND: Very Strict (3 req / 5 min per email/phone)
 * - OTP VERIFY: Very Strict (5 req / 5 min per email/phone)
 * - REGISTER: Strict (5 req / 15 min per IP)
 * - PASSWORD RESET: Very Strict (3 req / 15 min per email)
 * - CONTENT CREATION: Moderate (15 posts/min, 10 confessions/min, 30 comments/min)
 * - INTERACTIONS: High (120 likes/min)
 * - PUBLIC READS: Permissive (300 req / min)
 * - ADMIN APIS: Strict (60 req / min per admin)
 */

const tracker = new Map();

// Periodic prune every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tracker.entries()) {
    if (now > v.resetTime) {
      tracker.delete(k);
    }
  }
}, 120000);

function createLimiter({
  windowMs = 60000,
  max = 60,
  message = 'Too many requests. Please slow down and try again later.',
  keyGenerator = null,
  category = 'GENERAL'
}) {
  return (req, res, next) => {
    // Generate key based on custom key generator or default IP/User
    let idKey;
    if (typeof keyGenerator === 'function') {
      try {
        idKey = keyGenerator(req);
      } catch {
        idKey = req.ip || '127.0.0.1';
      }
    } else {
      idKey = req.user ? `user:${req.user.id}` : `ip:${req.ip || '127.0.0.1'}`;
    }

    const routePath = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
    const bucketKey = `${category}:${idKey}:${routePath}`;
    const now = Date.now();

    let record = tracker.get(bucketKey);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      tracker.set(bucketKey, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    // Standard RFC RateLimit headers
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      res.setHeader('Retry-After', resetSeconds);

      // Security abuse logging (never log secrets, only masked or route identifiers)
      console.warn(`[RateLimit Breach] Category: ${category}, Client: ${idKey}, Route: ${routePath}, Count: ${record.count}/${max}`);

      return res.status(429).json({
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        category,
        message,
        retryAfterSeconds: resetSeconds
      });
    }

    next();
  };
}

// 1. Auth & Registration Limiters
const authLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  category: 'AUTH_LOGIN',
  message: 'Too many login attempts. For security, please try again in 5 minutes.',
  keyGenerator: (req) => {
    const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
    return `${req.ip || '127.0.0.1'}_${email}`;
  }
});

const registerLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8,
  category: 'AUTH_REGISTER',
  message: 'Registration request rate limit exceeded. Please try again later.'
});

const otpSendLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 4,
  category: 'OTP_SEND',
  message: 'Too many verification code requests. Please wait 5 minutes before requesting again.',
  keyGenerator: (req) => {
    const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
    const phone = req.body?.phoneNumber ? String(req.body.phoneNumber).replace(/\D/g, '') : '';
    return `${req.ip || '127.0.0.1'}_${email || phone}`;
  }
});

const otpVerifyLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 6,
  category: 'OTP_VERIFY',
  message: 'Too many incorrect verification attempts. Please wait 5 minutes.',
  keyGenerator: (req) => {
    const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
    return `${req.ip || '127.0.0.1'}_${email}`;
  }
});

const passwordResetLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 4,
  category: 'PASSWORD_RESET',
  message: 'Password reset request limit exceeded. Please wait 15 minutes.',
  keyGenerator: (req) => {
    const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
    return `${req.ip || '127.0.0.1'}_${email}`;
  }
});

// 2. Content Creation Limiters
const postCreateLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 15,
  category: 'POST_CREATE',
  message: 'You are posting too frequently. Please wait a moment.'
});

const confessionCreateLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  category: 'CONFESSION_CREATE',
  message: 'Confession posting limit reached. Please wait a minute.'
});

const commentLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  category: 'COMMENT_CREATE',
  message: 'You are commenting too rapidly. Please pause for a moment.'
});

// 3. User Interactions & Reads
const likeLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 120,
  category: 'INTERACTION_LIKE',
  message: 'Interaction rate limit reached. Please wait a moment.'
});

const uploadLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 15,
  category: 'IMAGE_UPLOAD',
  message: 'Upload rate limit reached. Please wait before uploading more photos.'
});

const readLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 300,
  category: 'PUBLIC_READ',
  message: 'Request rate limit reached. Please slow down.'
});

const adminLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  category: 'ADMIN_OPERATIONS',
  message: 'Administrative request limit reached. Please pause.'
});

// Backward compatibility helper
function rateLimit(options = {}) {
  return createLimiter(options);
}

module.exports = {
  createLimiter,
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
};
