-- ============================================================================
-- CAMPUS RADAR — SUPABASE MASTER SETUP SCRIPT
-- Paste this entire script into your Supabase SQL Editor and click "RUN".
--
-- Features:
-- 1. Sets up all 20 required tables with foreign keys and cascade rules.
-- 2. Enforces ONLY two user roles: 'admin' and 'student'.
-- 3. Sets up Login Activity audit tracking, User Sessions, and OTP staging.
-- 4. Pre-seeds verified Admin account (admin@sanjivani.edu.in / Admin@123).
-- 5. Pre-seeds verified Student accounts (Student@123).
-- 6. Pre-seeds clubs, discussions, confessions, and follows.
-- ============================================================================

-- Step 0: Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_profile_id UUID UNIQUE DEFAULT uuid_generate_v4(),
    handle VARCHAR(50) UNIQUE NOT NULL,
    anonymous_pseudonym VARCHAR(100) NOT NULL,
    anonymous_number INT,
    
    -- Real Private Identity (Never exposed publicly to peers)
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50) UNIQUE,
    department VARCHAR(100),
    graduation_year INT,
    avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
    bio TEXT,
    password_hash TEXT NOT NULL,
    
    -- Strict Two-Role Architecture: 'student' or 'admin'
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
-- 2. USER SETTINGS TABLE
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
-- 3. USER SESSIONS TABLE (Active Session Management)
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
-- 4. LOGIN ACTIVITY TABLE (Audit Log of All Login Attempts)
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
CREATE INDEX IF NOT EXISTS idx_login_activity_created ON login_activity(created_at DESC);

-- ============================================================================
-- 5. STAGED REGISTRATIONS TABLE (Multi-Stage Verification)
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

-- ============================================================================
-- 7. POSTS TABLE (Campus Radar Feed & Announcements)
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
-- 8. POST LIKES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_post_like UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);

-- ============================================================================
-- 9. CONFESSIONS TABLE (Decoupled Anonymous Confessions)
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

-- ============================================================================
-- 11. COMMENTS TABLE (Threaded Discussions)
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

-- ============================================================================
-- 12. SAVED POSTS TABLE (Bookmarks)
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
-- 13. HIDDEN POSTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS hidden_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_hidden_post UNIQUE (user_id, post_id)
);

-- ============================================================================
-- 14. FOLLOWS TABLE
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
-- 15. BLOCKS TABLE
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

-- ============================================================================
-- 16. NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read);

-- ============================================================================
-- 17. ORGANIZATIONS & FOLLOWERS TABLE
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

-- ============================================================================
-- 18. REPORTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID NOT NULL,
    reason VARCHAR(255) NOT NULL,
    details TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 19. ADMIN AUDIT LOGS TABLE
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

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);

-- ============================================================================
-- 20. TRIGGERS: AUTO-UPDATE updated_at
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

-- ============================================================================
-- 22. SEED INITIAL DATA (Admin & Verified Students)
-- ============================================================================
DO $$
DECLARE
    v_admin_id UUID;
    v_student_a_id UUID;
    v_student_b_id UUID;
    v_admin_hash TEXT := 'scrypt$N=16384,r=8,p=1$2d071d9398962dd717c923880e7aef9a$91ab6f726d33e009ec4bb4ffcbf78ff0877413ba3fcb0041a263d45c74ad1b7bf22b2a80ce14384ad6677566908f8b32f880d0b325448b6bdebd4c061f53a6cf';
    v_student_hash TEXT := 'scrypt$N=16384,r=8,p=1$a5431de704ef91908e555aead5df2838$8d657b8229f0cc3f878cc27668a606f6fb58c05f0856e3ad90d1ca7c71fa55ab8d536fa87c790830a1a11f402e201af6634e029c0420cea8c9eead416b5de0e7';
BEGIN

    -- 1. Insert or Update Admin Account
    INSERT INTO users (
        email, phone_number, full_name, avatar_url, bio, department, graduation_year,
        role, status, email_verified, phone_verified, anonymous_pseudonym, handle, reputation_score, password_hash
    ) VALUES (
        'admin@sanjivani.edu.in', '+919999900000', 'University Administrator',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
        'Official Campus Radar Platform Administration & Safety.',
        'Administration', 2024, 'admin', 'active', true, true, 'Campus Administrator', '@campus_admin', 5000, v_admin_hash
    )
    ON CONFLICT (email) DO UPDATE SET
        password_hash = v_admin_hash,
        role = 'admin',
        status = 'active',
        email_verified = true,
        phone_verified = true
    RETURNING id INTO v_admin_id;

    -- 2. Insert or Update Student A (Rahul Sharma)
    INSERT INTO users (
        email, phone_number, full_name, avatar_url, bio, department, graduation_year,
        role, status, email_verified, phone_verified, anonymous_pseudonym, handle, reputation_score, password_hash
    ) VALUES (
        'rahul.sharma@sanjivani.edu.in', '+919876543210', 'Rahul Sharma',
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
        'Building spatial interfaces & autonomous systems at Sanjivani University.',
        'AI & ML', 2027, 'student', 'active', true, true, 'Anonymous #247', '@anon247', 1420, v_student_hash
    )
    ON CONFLICT (email) DO UPDATE SET
        password_hash = v_student_hash,
        role = 'student',
        status = 'active',
        email_verified = true,
        phone_verified = true
    RETURNING id INTO v_student_a_id;

    -- 3. Insert or Update Student B (Pooja Deshmukh)
    INSERT INTO users (
        email, phone_number, full_name, avatar_url, bio, department, graduation_year,
        role, status, email_verified, phone_verified, anonymous_pseudonym, handle, reputation_score, password_hash
    ) VALUES (
        'pooja.d@sanjivani.edu.in', '+919812345678', 'Pooja Deshmukh',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
        'Cybersecurity & distributed systems researcher. Campus coffee connoisseur.',
        'Computer Science', 2026, 'student', 'active', true, true, 'Anonymous #103', '@anon103', 980, v_student_hash
    )
    ON CONFLICT (email) DO UPDATE SET
        password_hash = v_student_hash,
        role = 'student',
        status = 'active',
        email_verified = true,
        phone_verified = true
    RETURNING id INTO v_student_b_id;

    -- 4. User Settings
    INSERT INTO user_settings (user_id, show_department, show_year, show_bio, profile_discoverability, who_can_follow, who_can_comment, show_posts_on_profile)
    VALUES 
        (v_admin_id, true, true, true, true, 'everyone', 'everyone', true),
        (v_student_a_id, true, true, true, true, 'everyone', 'everyone', true),
        (v_student_b_id, true, true, true, true, 'everyone', 'everyone', true)
    ON CONFLICT (user_id) DO NOTHING;

    -- 5. Organizations (Clubs)
    INSERT INTO organizations (name, category, avatar_url, bio, verified, admin_user_id)
    VALUES 
        ('Robotics & AI Guild', 'Engineering', 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=150&auto=format&fit=crop&q=80', 'Autonomous aerial navigation and robotics club at Sanjivani University.', true, v_admin_id),
        ('Design & Innovation Lab', 'Product & UX', 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=150&auto=format&fit=crop&q=80', 'UI/UX design, hardware prototypes and human-computer interaction lab.', true, v_admin_id),
        ('Campus Culinary & Socials', 'Social Life', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150&auto=format&fit=crop&q=80', 'Connecting students through night food markets and campus culinary popups.', true, v_admin_id)
    ON CONFLICT DO NOTHING;

    -- 6. Initial Discussions (Posts)
    INSERT INTO posts (author_id, content, image_url, tag, likes_count, comments_count)
    VALUES 
        (v_student_a_id, 'Quad Autonomous Drone Sprint Finals! Our autonomous aerial navigation fleet just completed courtyard slalom obstacle trials with zero collision penalties! Open flights at University Amphitheatre at 5 PM!', 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800&auto=format&fit=crop&q=80', '#Robotics', 18, 2),
        (v_student_b_id, 'CS 229 Midterm Comprehensive Review: Tonight session moved to Main Campus Auditorium at 7:15 PM sharp. Bring cheat sheets!', 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80', '#Academics', 34, 1);

    -- 7. Confessions
    INSERT INTO confessions (author_id, anonymous_pseudonym, content, category, likes_count, comments_count)
    VALUES 
        (v_student_a_id, 'Anonymous Falcon', 'To the student listening to Lo-Fi in Central Library 3rd Floor... You thought your AirPods were connected for 25 minutes. In reality, the entire quiet reading room was getting treated to chill Japanese study beats. Nobody told you because it was honestly setting an immaculate vibe for my pset 🙏', 'Wholesome', 412, 3),
        (v_student_b_id, 'Anonymous Owl', 'Senior year realization: Nobody actually has it figured out. I spent 3 years stressing over whether taking 20 units every semester meant I was falling behind. Just had coffee with a friend with a return offer who feels just as terrified. Be kind to yourselves.', 'Deep Thoughts', 672, 5);

    -- 8. Sample Login Activity
    INSERT INTO login_activity (user_id, email, ip_address, user_agent, status, failure_reason)
    VALUES 
        (v_admin_id, 'admin@sanjivani.edu.in', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'SUCCESS', NULL),
        (v_student_a_id, 'rahul.sharma@sanjivani.edu.in', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'SUCCESS', NULL),
        (v_student_b_id, 'pooja.d@sanjivani.edu.in', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'SUCCESS', NULL),
        (NULL, 'hacker@gmail.com', '192.168.1.105', 'Python-urllib/3.10', 'FAILED', 'Invalid institutional domain');

    -- 9. Initial Follow
    INSERT INTO follows (follower_id, following_id)
    VALUES (v_student_a_id, v_student_b_id)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Supabase Master Setup completed successfully with Admin and Student seed records.';
END $$;
