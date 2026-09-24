require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool, query, withTransaction } = require('./index');

async function run() {
  console.log('[Migration] Running 016_social_privacy_schema.sql on Supabase PostgreSQL...');
  const sql = fs.readFileSync(path.join(__dirname, 'migration_016.sql'), 'utf8');
  await query(sql);
  console.log('[Migration] Migration SQL applied successfully.');

  // Check or seed users
  console.log('[Migration] Seeding standard test users...');
  
  // Student A (Rahul Sharma -> Anonymous #247, @anon247)
  const studentARes = await query("SELECT id FROM users WHERE email = 'rahul.sharma@sanjivani.edu.in'");
  let studentAId;
  if (studentARes.rows.length === 0) {
    const insertA = await query(`
      INSERT INTO users (
        email, phone_number, full_name, avatar_url, bio, department, graduation_year,
        role, status, email_verified, phone_verified, anonymous_pseudonym, handle, reputation_score, password_hash
      ) VALUES (
        'rahul.sharma@sanjivani.edu.in', '+919876543210', 'Rahul Sharma',
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
        'Building spatial interfaces & autonomous systems at Sanjivani University.',
        'AI & ML', 2027, 'student', 'active', true, true, 'Anonymous #247', '@anon247', 1420, 'managed_by_supabase_auth'
      ) RETURNING id
    `);
    studentAId = insertA.rows[0].id;
  } else {
    studentAId = studentARes.rows[0].id;
    await query(`
      UPDATE users 
      SET anonymous_pseudonym = 'Anonymous #247', handle = '@anon247', department = 'AI & ML', graduation_year = 2027
      WHERE id = $1
    `, [studentAId]);
  }

  // Student B (Pooja Deshmukh -> Anonymous #103, @anon103)
  const studentBRes = await query("SELECT id FROM users WHERE email = 'pooja.d@sanjivani.edu.in'");
  let studentBId;
  if (studentBRes.rows.length === 0) {
    const insertB = await query(`
      INSERT INTO users (
        email, phone_number, full_name, avatar_url, bio, department, graduation_year,
        role, status, email_verified, phone_verified, anonymous_pseudonym, handle, reputation_score, password_hash
      ) VALUES (
        'pooja.d@sanjivani.edu.in', '+919812345678', 'Pooja Deshmukh',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
        'Cybersecurity & distributed systems researcher. Campus coffee connoisseur.',
        'Computer Science', 2026, 'student', 'active', true, true, 'Anonymous #103', '@anon103', 980, 'managed_by_supabase_auth'
      ) RETURNING id
    `);
    studentBId = insertB.rows[0].id;
  } else {
    studentBId = studentBRes.rows[0].id;
    await query(`
      UPDATE users 
      SET anonymous_pseudonym = 'Anonymous #103', handle = '@anon103', department = 'Computer Science', graduation_year = 2026
      WHERE id = $1
    `, [studentBId]);
  }

  // Admin user
  const adminRes = await query("SELECT id FROM users WHERE email = 'admin@sanjivani.edu.in'");
  let adminId;
  if (adminRes.rows.length === 0) {
    const insertAdmin = await query(`
      INSERT INTO users (
        email, phone_number, full_name, avatar_url, bio, department, graduation_year,
        role, status, email_verified, phone_verified, anonymous_pseudonym, handle, reputation_score, password_hash
      ) VALUES (
        'admin@sanjivani.edu.in', '+919999900000', 'University Administrator',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
        'Official Campus Radar Platform Administration & Safety.',
        'Administration', 2024, 'admin', 'active', true, true, 'Campus Administrator', '@campus_admin', 5000, 'managed_by_supabase_auth'
      ) RETURNING id
    `);
    adminId = insertAdmin.rows[0].id;
  } else {
    adminId = adminRes.rows[0].id;
  }

  // Moderator user
  const modRes = await query("SELECT id FROM users WHERE email = 'moderator@sanjivani.edu.in'");
  if (modRes.rows.length === 0) {
    await query(`
      INSERT INTO users (
        email, phone_number, full_name, avatar_url, bio, department, graduation_year,
        role, status, email_verified, phone_verified, anonymous_pseudonym, handle, reputation_score, password_hash
      ) VALUES (
        'moderator@sanjivani.edu.in', '+919999911111', 'Student Council Moderator',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
        'Student Council Safety & Community Guidelines Moderator.',
        'Student Affairs', 2025, 'moderator', 'active', true, true, 'Community Moderator', '@campus_mod', 3000, 'managed_by_supabase_auth'
      )
    `);
  }

  // User Settings for Student A and Student B
  await query(`
    INSERT INTO user_settings (user_id, show_department, show_year, show_bio, profile_discoverability, who_can_follow, who_can_comment, who_can_mention, show_posts_on_profile)
    VALUES ($1, true, true, true, true, 'everyone', 'everyone', 'everyone', true)
    ON CONFLICT (user_id) DO NOTHING
  `, [studentAId]);

  await query(`
    INSERT INTO user_settings (user_id, show_department, show_year, show_bio, profile_discoverability, who_can_follow, who_can_comment, who_can_mention, show_posts_on_profile)
    VALUES ($1, true, true, true, true, 'everyone', 'everyone', 'everyone', true)
    ON CONFLICT (user_id) DO NOTHING
  `, [studentBId]);

  // Seed Organizations if empty
  const orgsCount = await query("SELECT count(*) FROM organizations");
  if (parseInt(orgsCount.rows[0].count, 10) === 0) {
    console.log('[Migration] Seeding student organizations...');
    await query(`
      INSERT INTO organizations (name, category, avatar_url, bio, verified) VALUES
      ('Robotics & AI Guild', 'Engineering', 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=150&auto=format&fit=crop&q=80', 'Autonomous aerial navigation and robotics club at Sanjivani University.', true),
      ('Design & Innovation Lab', 'Product & UX', 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=150&auto=format&fit=crop&q=80', 'UI/UX design, hardware prototypes and human-computer interaction lab.', true),
      ('Campus Culinary & Socials', 'Social Life', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150&auto=format&fit=crop&q=80', 'Connecting students through night food markets and campus culinary popups.', true)
    `);
  }

  // Seed sample initial posts if empty
  const postsCount = await query("SELECT count(*) FROM posts");
  if (parseInt(postsCount.rows[0].count, 10) === 0) {
    console.log('[Migration] Seeding initial posts from Student A and Student B...');
    await query(`
      INSERT INTO posts (author_id, content, image_url, tag, likes_count, comments_count) VALUES
      ($1, 'Quad Autonomous Drone Sprint Finals! Our autonomous aerial navigation fleet just completed the courtyard slalom obstacle trials with zero collision penalties! Come by University Amphitheatre at 5 PM for open flights!', 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800&auto=format&fit=crop&q=80', '#Robotics', 18, 2),
      ($2, 'CS 229 Midterm Comprehensive Review: Tonight session has been moved to Main Campus Auditorium. Starts promptly at 7:15 PM. Bring your cheat sheet drafts!', 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80', '#Academics', 34, 1)
    `, [studentAId, studentBId]);
  }

  // Seed initial confessions if empty
  const confessionsCount = await query("SELECT count(*) FROM confessions");
  if (parseInt(confessionsCount.rows[0].count, 10) === 0) {
    console.log('[Migration] Seeding initial confessions with decoupled pseudonyms...');
    await query(`
      INSERT INTO confessions (author_id, anonymous_pseudonym, content, category, likes_count, comments_count) VALUES
      ($1, 'Anonymous Falcon', 'To the person listening to Lo-Fi in Central Library 3rd Floor... You thought your AirPods were connected for 25 minutes. In reality, the entire quiet reading room was getting treated to chill Japanese study beats. Nobody told you because it was honestly setting an immaculate vibe for my pset 🙏', 'Wholesome', 412, 3),
      ($2, 'Anonymous Owl', 'Senior year realization: Nobody actually has it figured out. I spent 3 years stressing over whether taking 20 units every semester meant I was falling behind. Just had coffee with a friend who has a fancy return offer and they confessed they feel just as terrified. Be kind to yourselves.', 'Deep Thoughts', 672, 5)
    `, [studentAId, studentBId]);
  }

  console.log('[Migration] All migrations & seeds completed successfully!');
  await pool.end();
}

run().catch((err) => {
  console.error('[Migration Error]:', err);
  process.exit(1);
});
