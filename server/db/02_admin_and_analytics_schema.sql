-- ============================================================================
-- CAMPUS RADAR — MIGRATION 02: ADMIN RBAC, AUDIT LOG & USER ANALYTICS ENGINE
-- ============================================================================

-- 1. Update user role check constraint to support SUPER_ADMIN, ADMIN, MODERATOR
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('student', 'admin', 'super_admin', 'moderator'));

-- 2. Enhance admin_audit_logs with full security context
ALTER TABLE admin_audit_logs 
    ADD COLUMN IF NOT EXISTS admin_role VARCHAR(50) DEFAULT 'admin',
    ADD COLUMN IF NOT EXISTS request_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS user_agent TEXT,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'SUCCESS';

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON admin_audit_logs(target_type, target_id);

-- 3. Enhance posts, confessions, and comments with soft-delete metadata
ALTER TABLE posts 
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

ALTER TABLE confessions 
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

ALTER TABLE comments 
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- 4. Enhance reports table with assignment and resolution tracking
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE reports ADD CONSTRAINT reports_status_check 
    CHECK (LOWER(status) IN ('pending', 'under_review', 'resolved', 'dismissed'));

ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS resolution TEXT,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_reports_assigned_to ON reports(assigned_to);

-- 5. Create Events table (Campus events, workshops, hackathons)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'Campus Life',
    location VARCHAR(255) NOT NULL,
    event_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    image_url TEXT,
    organizer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    attendees_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deletion_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_published ON events(is_published) WHERE deleted_at IS NULL;

-- 6. USER ANALYTICS TABLE 1: User Activity Events (Semantic actions inside application)
CREATE TABLE IF NOT EXISTS user_activity_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    event_type VARCHAR(50) NOT NULL, -- 'PAGE_VIEW', 'CLICK', 'SEARCH', 'POST_VIEW', 'LIKE', 'COMMENT', etc.
    page VARCHAR(150),
    target_type VARCHAR(50),
    target_id VARCHAR(100),
    element_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_created ON user_activity_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_session ON user_activity_events(session_id);

-- 7. USER ANALYTICS TABLE 2: Page Views & Active Time Spent Tracking
CREATE TABLE IF NOT EXISTS page_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    page VARCHAR(150) NOT NULL,
    route VARCHAR(150) NOT NULL,
    entered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    exited_at TIMESTAMPTZ,
    active_duration_ms INT NOT NULL DEFAULT 0,
    total_duration_ms INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_page_views_user ON page_views(user_id);
CREATE INDEX IF NOT EXISTS idx_page_views_page ON page_views(page);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);
