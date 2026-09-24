const { query } = require('../db');

/**
 * Converts a raw database user row + settings into a strict public profile representation.
 * Zero-Leakage: NEVER includes full_name, email, phone_number, internal users.id, or password_hash.
 */
function toPublicProfile(userRow, settingsRow = {}, isOwner = false) {
  if (!userRow) return null;

  // Defaults if settingsRow is empty
  const showDept = settingsRow.show_department !== false;
  const showYear = settingsRow.show_year !== false;
  const showBio = settingsRow.show_bio !== false;

  return {
    public_profile_id: userRow.public_profile_id,
    display_name: userRow.anonymous_pseudonym || 'Anonymous Student',
    handle: userRow.handle || '@anon_student',
    avatar: userRow.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
    bio: (isOwner || showBio) ? (userRow.bio || '') : '',
    department: (isOwner || showDept) ? (userRow.department || '') : '',
    year: (isOwner || showYear) ? (userRow.graduation_year ? `Class of '${String(userRow.graduation_year).slice(-2)}` : '') : '',
    campus: 'Sanjivani University',
    karma: userRow.reputation_score || 100,
    badges: ['Verified Student', 'Campus Contributor'],
    isVerified: userRow.email_verified || false
  };
}

/**
 * Projects a public author for normal posts and comments.
 */
function toPublicAuthor(userRow) {
  if (!userRow) {
    return {
      public_profile_id: null,
      name: 'Deleted Student',
      handle: '@deleted',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
      isVerified: false,
      badgeText: 'Student'
    };
  }

  return {
    public_profile_id: userRow.public_profile_id,
    name: userRow.anonymous_pseudonym || 'Anonymous Student',
    handle: userRow.handle || '@anon_student',
    avatar: userRow.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
    isVerified: userRow.email_verified || false,
    badgeText: userRow.role === 'admin' ? 'Campus Admin' : userRow.role === 'moderator' ? 'Moderator' : 'Student'
  };
}

/**
 * Decoupled Confession projection: NO link to author_id or public_profile_id.
 */
function toDecoupledConfession(row) {
  return {
    id: row.id,
    type: 'confession',
    category: 'Confessions',
    flair: row.category || 'Wholesome',
    author: {
      name: row.anonymous_pseudonym || 'Anonymous Student',
      handle: `@mask_${(parseInt(row.id.replace(/-/g, '').slice(0, 4), 16) % 900) + 100}`,
      avatar: 'mask',
      isAnonymous: true,
      badgeText: 'Masked Student'
    },
    title: row.content.length > 60 ? row.content.slice(0, 60) + '...' : row.content,
    content: row.content,
    timestamp: row.created_at ? formatTimeAgo(row.created_at) : 'Just now',
    createdAt: row.created_at,
    likes: row.likes_count || 0,
    hasLiked: !!row.has_liked,
    commentsCount: row.comments_count || 0,
    bookmarksCount: row.bookmarks_count || 0,
    hasBookmarked: !!row.has_bookmarked,
    tags: ['#CampusTalk', '#Confession']
  };
}

/**
 * Checks if a bidirectional block exists between user A and user B.
 */
async function checkBlock(userIdA, userIdB) {
  if (!userIdA || !userIdB || userIdA === userIdB) return false;
  const res = await query(
    `SELECT 1 FROM blocks 
     WHERE (blocker_id = $1 AND blocked_id = $2) 
        OR (blocker_id = $2 AND blocked_id = $1) 
     LIMIT 1`,
    [userIdA, userIdB]
  );
  return res.rows.length > 0;
}

function formatTimeAgo(dateInput) {
  const d = new Date(dateInput);
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

module.exports = {
  toPublicProfile,
  toPublicAuthor,
  toDecoupledConfession,
  checkBlock,
  formatTimeAgo
};
