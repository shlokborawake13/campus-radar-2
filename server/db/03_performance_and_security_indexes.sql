-- ============================================================================
-- CAMPUS RADAR — PRODUCTION PERFORMANCE & SECURITY INDEXES
-- Optimized for:
-- 1. Sub-millisecond indexed lookups on auth & registration
-- 2. Fast cursor-based pagination on posts feed and confessions
-- 3. Instant threaded comments resolution
-- 4. Fast notification counts & unread filters
-- 5. Complete isolation and audit log querying
-- ============================================================================

-- 1. Users Table Constraints & Indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_phone ON users (phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_public_profile_id ON users (public_profile_id);
CREATE INDEX IF NOT EXISTS idx_users_handle_lower ON users (LOWER(handle));
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users (role, status);

-- 2. Posts Table Performance Indexes
CREATE INDEX IF NOT EXISTS idx_posts_feed_created ON posts (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_author_created ON posts (author_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_tag_created ON posts (tag, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_trending_score ON posts ((likes_count + comments_count) DESC, created_at DESC) WHERE deleted_at IS NULL;

-- 3. Confessions Table Indexes
CREATE INDEX IF NOT EXISTS idx_confessions_feed_created ON confessions (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_confessions_author_created ON confessions (author_id, created_at DESC) WHERE deleted_at IS NULL;

-- 4. Comments Table Indexes
CREATE INDEX IF NOT EXISTS idx_comments_post_thread ON comments (post_id, created_at ASC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments (author_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_comment_id) WHERE parent_comment_id IS NOT NULL;

-- 5. Likes & Bookmarks Composite Indexes
CREATE INDEX IF NOT EXISTS idx_post_likes_post_user ON post_likes (post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes (user_id);
CREATE INDEX IF NOT EXISTS idx_confession_likes_conf_user ON confession_likes (confession_id, user_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_user_created ON saved_posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hidden_posts_user_post ON hidden_posts (user_id, post_id);

-- 6. Social Graph (Follows & Blocks) Indexes
CREATE INDEX IF NOT EXISTS idx_follows_pair ON follows (follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows (following_id);
CREATE INDEX IF NOT EXISTS idx_blocks_pair ON blocks (blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks (blocked_id);

-- 7. Notifications Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON notifications (recipient_id, read) WHERE read = false;

-- 8. Audit Logs & Telemetry Analytics Indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor_created ON admin_audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_logs (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_user_activity_created ON user_activity_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_created ON user_activity_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_page_views_user_entered ON page_views (user_id, entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_page ON page_views (page, entered_at DESC);

-- 9. Sessions & Login Activity Indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_login_activity_email_created ON login_activity (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_activity_user_created ON login_activity (user_id, created_at DESC);
