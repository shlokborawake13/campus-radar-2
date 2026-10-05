-- ============================================================================
-- CAMPUS RADAR — MIGRATION 04: STRICT ROLE-BASED ACCESS CONTROL & RLS HARDENING
-- ============================================================================

-- 1. Create Dedicated Server-Authoritative user_roles Table
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'super_admin', 'moderator')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- 2. Populate user_roles from existing users
INSERT INTO user_roles (user_id, role, created_at, updated_at)
SELECT id, role, created_at, updated_at FROM users
ON CONFLICT (user_id) DO UPDATE SET 
    role = EXCLUDED.role, 
    updated_at = CURRENT_TIMESTAMP;

-- 3. Automatic Synchronization Trigger between user_roles and users
CREATE OR REPLACE FUNCTION sync_user_role_to_users()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    UPDATE users SET role = NEW.role, updated_at = CURRENT_TIMESTAMP WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_user_role_to_users ON user_roles;
CREATE TRIGGER trg_sync_user_role_to_users
AFTER UPDATE OR INSERT ON user_roles
FOR EACH ROW EXECUTE FUNCTION sync_user_role_to_users();

-- 4. HARDEN ROW LEVEL SECURITY (RLS) POLICIES
-- Drop existing blanket policies that permitted open access to all roles
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE confessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE confession_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hidden_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Clean up any insecure blanket policies
DROP POLICY IF EXISTS service_role_all_users ON users;
DROP POLICY IF EXISTS service_role_all_settings ON user_settings;
DROP POLICY IF EXISTS service_role_all_sessions ON user_sessions;
DROP POLICY IF EXISTS service_role_all_login_activity ON login_activity;
DROP POLICY IF EXISTS service_role_all_posts ON posts;
DROP POLICY IF EXISTS service_role_all_post_likes ON post_likes;
DROP POLICY IF EXISTS service_role_all_confessions ON confessions;
DROP POLICY IF EXISTS service_role_all_comments ON comments;
DROP POLICY IF EXISTS service_role_all_follows ON follows;
DROP POLICY IF EXISTS service_role_all_blocks ON blocks;
DROP POLICY IF EXISTS service_role_all_notifications ON notifications;
DROP POLICY IF EXISTS service_role_all_audit_logs ON admin_audit_logs;

-- Service Role Full Access Policies (Backend trusted worker)
DROP POLICY IF EXISTS service_role_users_policy ON users;
CREATE POLICY service_role_users_policy ON users TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_user_roles_policy ON user_roles;
CREATE POLICY service_role_user_roles_policy ON user_roles TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_settings_policy ON user_settings;
CREATE POLICY service_role_settings_policy ON user_settings TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_sessions_policy ON user_sessions;
CREATE POLICY service_role_sessions_policy ON user_sessions TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_login_activity_policy ON login_activity;
CREATE POLICY service_role_login_activity_policy ON login_activity TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_posts_policy ON posts;
CREATE POLICY service_role_posts_policy ON posts TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_post_likes_policy ON post_likes;
CREATE POLICY service_role_post_likes_policy ON post_likes TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_confessions_policy ON confessions;
CREATE POLICY service_role_confessions_policy ON confessions TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_confession_likes_policy ON confession_likes;
CREATE POLICY service_role_confession_likes_policy ON confession_likes TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_comments_policy ON comments;
CREATE POLICY service_role_comments_policy ON comments TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_saved_posts_policy ON saved_posts;
CREATE POLICY service_role_saved_posts_policy ON saved_posts TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_hidden_posts_policy ON hidden_posts;
CREATE POLICY service_role_hidden_posts_policy ON hidden_posts TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_follows_policy ON follows;
CREATE POLICY service_role_follows_policy ON follows TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_blocks_policy ON blocks;
CREATE POLICY service_role_blocks_policy ON blocks TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_notifications_policy ON notifications;
CREATE POLICY service_role_notifications_policy ON notifications TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_reports_policy ON reports;
CREATE POLICY service_role_reports_policy ON reports TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_events_policy ON events;
CREATE POLICY service_role_events_policy ON events TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_audit_logs_policy ON admin_audit_logs;
CREATE POLICY service_role_audit_logs_policy ON admin_audit_logs TO service_role USING (true) WITH CHECK (true);

-- Authenticated User / Client Isolation Policies:
-- 1. user_roles: Read-only for self. Students CANNOT modify their role.
DROP POLICY IF EXISTS user_roles_read_own ON user_roles;
CREATE POLICY user_roles_read_own ON user_roles FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- 2. users: Read active users (basic data); Update own profile only
DROP POLICY IF EXISTS users_read_active ON users;
CREATE POLICY users_read_active ON users FOR SELECT TO authenticated, anon
    USING (status = 'active');

DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 3. user_settings: Access own settings only
DROP POLICY IF EXISTS user_settings_own ON user_settings;
CREATE POLICY user_settings_own ON user_settings FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. posts: Public read non-deleted; Author-only write
DROP POLICY IF EXISTS posts_read_public ON posts;
CREATE POLICY posts_read_public ON posts FOR SELECT TO authenticated, anon
    USING (deleted_at IS NULL);

DROP POLICY IF EXISTS posts_insert_own ON posts;
CREATE POLICY posts_insert_own ON posts FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS posts_update_own ON posts;
CREATE POLICY posts_update_own ON posts FOR UPDATE TO authenticated
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS posts_delete_own ON posts;
CREATE POLICY posts_delete_own ON posts FOR DELETE TO authenticated
    USING (auth.uid() = author_id);

-- 5. comments: Public read non-deleted; Author-only write
DROP POLICY IF EXISTS comments_read_public ON comments;
CREATE POLICY comments_read_public ON comments FOR SELECT TO authenticated, anon
    USING (deleted_at IS NULL);

DROP POLICY IF EXISTS comments_insert_own ON comments;
CREATE POLICY comments_insert_own ON comments FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS comments_delete_own ON comments;
CREATE POLICY comments_delete_own ON comments FOR DELETE TO authenticated
    USING (auth.uid() = author_id);

-- 6. saved_posts: Owner only
DROP POLICY IF EXISTS saved_posts_own ON saved_posts;
CREATE POLICY saved_posts_own ON saved_posts FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 7. notifications: Owner only
DROP POLICY IF EXISTS notifications_own ON notifications;
CREATE POLICY notifications_own ON notifications FOR ALL TO authenticated
    USING (auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = recipient_id);

-- 8. reports: Reporter can submit
DROP POLICY IF EXISTS reports_insert_own ON reports;
CREATE POLICY reports_insert_own ON reports FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = reporter_id);
