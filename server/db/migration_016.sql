-- 016_social_privacy_schema.sql
-- Production schema for Campus Radar: Decoupled public identity, follows, blocks, settings, notifications, organizations, audit logs

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Ensure public_profile_id, handle, and auth_user_id columns exist on users
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'public_profile_id') THEN
        ALTER TABLE users ADD COLUMN public_profile_id UUID UNIQUE DEFAULT uuid_generate_v4();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'handle') THEN
        ALTER TABLE users ADD COLUMN handle VARCHAR(50) UNIQUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'auth_user_id') THEN
        ALTER TABLE users ADD COLUMN auth_user_id UUID UNIQUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'is_edited') THEN
        ALTER TABLE posts ADD COLUMN is_edited BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Populate public_profile_id and handle for any existing users
UPDATE users 
SET public_profile_id = uuid_generate_v4() 
WHERE public_profile_id IS NULL;

UPDATE users 
SET handle = '@anon' || COALESCE(anonymous_number, FLOOR(100 + RANDOM() * 899)::int)::text
WHERE handle IS NULL;

-- 2. Follows relationship
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

-- 3. Blocks relationship
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

-- 4. Hidden Posts (persistent "Hide" feature)
CREATE TABLE IF NOT EXISTS hidden_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_hidden_post UNIQUE (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_hidden_posts_user ON hidden_posts(user_id);

-- 5. Threaded Comments: add parent_comment_id if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comments' AND column_name = 'parent_comment_id') THEN
        ALTER TABLE comments ADD COLUMN parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 6. User Settings
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    show_department BOOLEAN NOT NULL DEFAULT TRUE,
    show_year BOOLEAN NOT NULL DEFAULT TRUE,
    show_bio BOOLEAN NOT NULL DEFAULT TRUE,
    profile_discoverability BOOLEAN NOT NULL DEFAULT TRUE,
    who_can_follow VARCHAR(50) NOT NULL DEFAULT 'everyone', -- 'everyone' | 'verified_only'
    who_can_comment VARCHAR(50) NOT NULL DEFAULT 'everyone', -- 'everyone' | 'followers' | 'nobody'
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

-- 7. Notifications
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

-- 8. Organizations & Followers
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

-- 9. Admin Audit Logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
