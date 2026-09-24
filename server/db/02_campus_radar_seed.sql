-- ============================================================================
-- CAMPUS RADAR — PRODUCTION SEED DATA FOR SUPABASE
-- Sets up initial verified Administrator, verified Students, clubs, and sample feed
--
-- Default Credentials:
-- 1. Admin Account:
--    Email: admin@sanjivani.edu.in
--    Password: Admin@123
--    Role: admin
--
-- 2. Student A (AI & ML, Class of 2027):
--    Email: rahul.sharma@sanjivani.edu.in
--    Password: Student@123
--    Pseudonym: Anonymous #247 (@anon247)
--    Role: student
--
-- 3. Student B (Computer Science, Class of 2026):
--    Email: pooja.d@sanjivani.edu.in
--    Password: Student@123
--    Pseudonym: Anonymous #103 (@anon103)
--    Role: student
-- ============================================================================

DO $$
DECLARE
    v_admin_id UUID;
    v_student_a_id UUID;
    v_student_b_id UUID;
    v_org_robotics_id UUID;
    v_org_design_id UUID;
    v_org_culinary_id UUID;
    v_post_1_id UUID;
    v_post_2_id UUID;
    v_admin_hash TEXT := 'scrypt$N=16384,r=8,p=1$2d071d9398962dd717c923880e7aef9a$91ab6f726d33e009ec4bb4ffcbf78ff0877413ba3fcb0041a263d45c74ad1b7bf22b2a80ce14384ad6677566908f8b32f880d0b325448b6bdebd4c061f53a6cf';
    v_student_hash TEXT := 'scrypt$N=16384,r=8,p=1$a5431de704ef91908e555aead5df2838$8d657b8229f0cc3f878cc27668a606f6fb58c05f0856e3ad90d1ca7c71fa55ab8d536fa87c790830a1a11f402e201af6634e029c0420cea8c9eead416b5de0e7';
BEGIN

    -- 1. SEED / UPSERT ADMINISTRATOR
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

    -- 2. SEED / UPSERT STUDENT A (Rahul Sharma)
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

    -- 3. SEED / UPSERT STUDENT B (Pooja Deshmukh)
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

    -- 4. SEED USER SETTINGS
    INSERT INTO user_settings (user_id, show_department, show_year, show_bio, profile_discoverability, who_can_follow, who_can_comment, show_posts_on_profile)
    VALUES 
        (v_admin_id, true, true, true, true, 'everyone', 'everyone', true),
        (v_student_a_id, true, true, true, true, 'everyone', 'everyone', true),
        (v_student_b_id, true, true, true, true, 'everyone', 'everyone', true)
    ON CONFLICT (user_id) DO NOTHING;

    -- 5. SEED INITIAL CAMPUS CLUBS / ORGANIZATIONS
    INSERT INTO organizations (name, category, avatar_url, bio, verified, admin_user_id)
    VALUES 
        ('Robotics & AI Guild', 'Engineering', 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=150&auto=format&fit=crop&q=80', 'Autonomous aerial navigation and robotics club at Sanjivani University.', true, v_admin_id),
        ('Design & Innovation Lab', 'Product & UX', 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=150&auto=format&fit=crop&q=80', 'UI/UX design, hardware prototypes and human-computer interaction lab.', true, v_admin_id),
        ('Campus Culinary & Socials', 'Social Life', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150&auto=format&fit=crop&q=80', 'Connecting students through night food markets and campus culinary popups.', true, v_admin_id)
    ON CONFLICT DO NOTHING;

    -- 6. SEED INITIAL VERIFIED DISCUSSIONS (Posts)
    INSERT INTO posts (author_id, content, image_url, tag, likes_count, comments_count)
    VALUES (
        v_student_a_id,
        'Quad Autonomous Drone Sprint Finals! Our autonomous aerial navigation fleet just completed the courtyard slalom obstacle trials with zero collision penalties! Come by University Amphitheatre at 5 PM for open flights!',
        'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800&auto=format&fit=crop&q=80',
        '#Robotics', 18, 2
    )
    RETURNING id INTO v_post_1_id;

    INSERT INTO posts (author_id, content, image_url, tag, likes_count, comments_count)
    VALUES (
        v_student_b_id,
        'CS 229 Midterm Comprehensive Review: Tonight session has been moved to Main Campus Auditorium. Starts promptly at 7:15 PM. Bring your cheat sheet drafts!',
        'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80',
        '#Academics', 34, 1
    )
    RETURNING id INTO v_post_2_id;

    -- 7. SEED CONFESSIONS WITH DECOUPLED MASKS
    INSERT INTO confessions (author_id, anonymous_pseudonym, content, category, likes_count, comments_count)
    VALUES 
        (v_student_a_id, 'Anonymous Falcon', 'To the person listening to Lo-Fi in Central Library 3rd Floor... You thought your AirPods were connected for 25 minutes. In reality, the entire quiet reading room was getting treated to chill Japanese study beats. Nobody told you because it was honestly setting an immaculate vibe for my pset 🙏', 'Wholesome', 412, 3),
        (v_student_b_id, 'Anonymous Owl', 'Senior year realization: Nobody actually has it figured out. I spent 3 years stressing over whether taking 20 units every semester meant I was falling behind. Just had coffee with a friend who has a fancy return offer and they confessed they feel just as terrified. Be kind to yourselves.', 'Deep Thoughts', 672, 5);

    -- 8. SEED INITIAL SAMPLE LOGIN ACTIVITY (Audit Demonstration)
    INSERT INTO login_activity (user_id, email, ip_address, user_agent, status, failure_reason)
    VALUES 
        (v_admin_id, 'admin@sanjivani.edu.in', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'SUCCESS', NULL),
        (v_student_a_id, 'rahul.sharma@sanjivani.edu.in', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'SUCCESS', NULL),
        (v_student_b_id, 'pooja.d@sanjivani.edu.in', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'SUCCESS', NULL),
        (NULL, 'hacker@gmail.com', '192.168.1.105', 'Python-urllib/3.10', 'FAILED', 'Invalid institutional domain');

    -- 9. SEED INITIAL FOLLOW RELATIONSHIP
    INSERT INTO follows (follower_id, following_id)
    VALUES (v_student_a_id, v_student_b_id)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Campus Radar database seeded successfully with Admin and Student accounts.';
END $$;
