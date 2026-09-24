-- ============================================================================
-- CAMPUS RADAR — PRODUCTION SUPABASE POSTGRESQL SCHEMA
-- Collegiate Digital Community for Sanjivani University (@sanjivani.edu.in)
--
-- Features:
-- 1. Strict Two-Role Architecture: 'student' and 'admin'
-- 2. Decoupled Identity: Private Real Identity vs Public Anonymous Persona
-- 3. Complete Audit & Tracking: Login Activity, Active Sessions, Admin Logs
-- 4. Social Graph: Follows, Blocks, Posts, Confessions, Likes, Threaded Comments
-- 5. Zero-Leakage Architecture: Defense-in-depth DB constraints & indexes
-- ============================================================================

-- 0. Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USERS TABLE (Private Identity + Public Mask)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_profile_id UUID UNIQUE DEFAULT uuid_generate_v4(),
    handle VARCHAR(50) UNIQUE NOT NULL,
    anonymous_pseudonym VARCHAR(100) NOT NULL,
    anonymous_number INT,
    
    -- Real private identity (Protected — NEVER sent to peers)
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50) UNIQUE,
    department VARCHAR(100),
    graduation_year INT,
    avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
    bio TEXT,
    password_hash TEXT NOT NULL,
    
    -- Only two distinct user roles: 'student' or 'admin'
    role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned', 'deleted')),
    
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    reputation_score INT NOT NULL DEFAULT 100,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_public_profile_id ON users(public_profile_id);
CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ============================================================================
-- 2. USER SETTINGS TABLE (Granular Privacy & Notification Controls)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    show_department BOOLEAN NOT NULL DEFAULT TRUE,
    show_year BOOLEAN NOT NULL DEFAULT TRUE,
    show_bio BOOLEAN NOT NULL DEFAULT TRUE,
    profile_discoverability BOOLEAN NOT NULL DEFAULT TRUE,
    who_can_follow VARCHAR(50) NOT NULL DEFAULT 'everyone' CHECK (who_can_follow IN ('everyone', 'verified_only')),
    who_can_comment VARCHAR(50) NOT NULL DEFAULT 'everyone' CHECK (who_can_comment IN ('everyone', 'followers', 'nobody')),
    who_can_mention VARCHAR(50) NOT NULL DEFAULT 'everyone',
    show_posts_on_profile BOOLEAN NOT NULL DEFAULT TRUE,
    notify_likes BOOLEAN NOT NULL DEFAULT TRUE,
    notify_comments BOOLEAN NOT NULL DEFAULT TRUE,
    notify_replies BOOLEAN NOT NULL DEFAULT TRUE,
    notify_followers BOOLEAN NOT NULL DEFAULT TRUE,
    notify_events BOOLEAN NOT NULL DEFAULT TRUE,
    notify_announcements BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. USER SESSIONS TABLE (Active Session Management & Device Tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ NOT NULL,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active);

-- ============================================================================
-- 4. LOGIN ACTIVITY TABLE (Comprehensive Audit Trail for All Login Attempts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS login_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'SUSPENDED')),
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_activity_email ON login_activity(email);
CREATE INDEX IF NOT EXISTS idx_login_activity_user ON login_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_login_activity_created ON login_activity(created_at DESC);

-- ============================================================================
-- 5. STAGED REGISTRATIONS (Multi-Stage OTP Lifecycle Before Activation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS staged_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    password_hash TEXT NOT NULL,
    email_otp VARCHAR(10) NOT NULL,
    phone_otp VARCHAR(10) NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_otp_expires_at TIMESTAMPTZ NOT NULL,
    phone_otp_expires_at TIMESTAMPTZ NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    last_resend_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staged_registrations_email ON staged_registrations(email);

-- ============================================================================
-- 6. PASSWORD RESETS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);

-- ============================================================================
-- 7. POSTS TABLE (Main Campus Feed, Events, Discussions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    image_url TEXT,
    tag VARCHAR(50) DEFAULT '#General',
    likes_count INT NOT NULL DEFAULT 0,
    comments_count INT NOT NULL DEFAULT 0,
    is_edited BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_tag ON posts(tag);

-- ============================================================================
-- 8. POST LIKES TABLE (Unique Student Upvotes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_post_like UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id);

-- ============================================================================
-- 9. CONFESSIONS TABLE (Completely Decoupled Anonymous Expressions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS confessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    anonymous_pseudonym VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'Wholesome',
    likes_count INT NOT NULL DEFAULT 0,
    comments_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_confessions_created ON confessions(created_at DESC);

-- ============================================================================
-- 10. CONFESSION LIKES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS confession_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    confession_id UUID NOT NULL REFERENCES confessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_confession_like UNIQUE (confession_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_confession_likes_confession ON confession_likes(confession_id);

-- ============================================================================
-- 11. COMMENTS TABLE (Threaded Multi-Level Discussions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    anonymous_pseudonym VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);

-- ============================================================================
-- 12. SAVED POSTS TABLE (Personal Bookmarks)
-- ============================================================================
CREATE TABLE IF NOT EXISTS saved_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_saved_post UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_posts_user ON saved_posts(user_id);

-- ============================================================================
-- 13. HIDDEN POSTS TABLE (Persistent Feed Filters)
-- ============================================================================
CREATE TABLE IF NOT EXISTS hidden_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_hidden_post UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_hidden_posts_user ON hidden_posts(user_id);

-- ============================================================================
-- 14. FOLLOWS TABLE (Peer-to-Peer Relationships)
-- ============================================================================
CREATE TABLE IF NOT EXISTS follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_follow UNIQUE (follower_id, following_id),
    CONSTRAINT no_self_follow CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ============================================================================
-- 15. BLOCKS TABLE (Bidirectional Safety Interlock)
-- ============================================================================
CREATE TABLE IF NOT EXISTS blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id),
    CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);

-- ============================================================================
-- 16. NOTIFICATIONS TABLE (Student Activity Alerts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- 'LIKE', 'COMMENT', 'REPLY', 'FOLLOW', 'EVENT_REMINDER'
    entity_type VARCHAR(50) NOT NULL, -- 'post', 'confession', 'comment', 'profile', 'event'
    entity_id UUID,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read);

-- ============================================================================
-- 17. ORGANIZATIONS TABLE (Clubs, Societies, Labs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    avatar_url TEXT NOT NULL,
    bio TEXT,
    verified BOOLEAN NOT NULL DEFAULT TRUE,
    admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organization_followers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_org_follower UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_followers_user ON organization_followers(user_id);

-- ============================================================================
-- 18. REPORTS TABLE (Community Safety & Moderation Queue)
-- ============================================================================
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(50) NOT NULL, -- 'post', 'confession', 'comment', 'user'
    target_id UUID NOT NULL,
    reason VARCHAR(255) NOT NULL,
    details TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- ============================================================================
-- 19. ADMIN AUDIT LOGS TABLE (Permanent Safety & Moderation Trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID,
    metadata JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor ON admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);

-- ============================================================================
-- 20. TRIGGERS: AUTO-UPDATE updated_at TIMESTAMPS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON user_settings;
CREATE TRIGGER trg_settings_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- ============================================================================
-- 21. ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures database-level isolation if connected via Supabase client directly
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE confessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Service role bypass policy for Express backend connection
DROP POLICY IF EXISTS service_role_all_users ON users;
CREATE POLICY service_role_all_users ON users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_settings ON user_settings;
CREATE POLICY service_role_all_settings ON user_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_sessions ON user_sessions;
CREATE POLICY service_role_all_sessions ON user_sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_login_activity ON login_activity;
CREATE POLICY service_role_all_login_activity ON login_activity FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_posts ON posts;
CREATE POLICY service_role_all_posts ON posts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_post_likes ON post_likes;
CREATE POLICY service_role_all_post_likes ON post_likes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_confessions ON confessions;
CREATE POLICY service_role_all_confessions ON confessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_comments ON comments;
CREATE POLICY service_role_all_comments ON comments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_follows ON follows;
CREATE POLICY service_role_all_follows ON follows FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_blocks ON blocks;
CREATE POLICY service_role_all_blocks ON blocks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_notifications ON notifications;
CREATE POLICY service_role_all_notifications ON notifications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_audit_logs ON admin_audit_logs;
CREATE POLICY service_role_all_audit_logs ON admin_audit_logs FOR ALL USING (true) WITH CHECK (true);
