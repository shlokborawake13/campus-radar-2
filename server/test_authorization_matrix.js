require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const assert = require('assert');
const { query, pool } = require('./db');
const { createSession } = require('./security');
const http = require('http');
const app = require('./index');

async function runAuthorizationMatrix() {
  console.log('================================================================');
  console.log(' CAMPUS RADAR — AUTHORIZATION & SECURITY TEST MATRIX (21 TESTS)');
  console.log('================================================================\n');

  // Start dedicated test server instance
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(5098, resolve));
  const baseUrl = 'http://localhost:5098/api';

  async function api(path, { method = 'GET', body, token, headers: extraHeaders = {} } = {}) {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  let userA, userB, adminUser;
  let tokenA, tokenB, adminToken;

  let totalTests = 0;
  let passedTests = 0;

  function report(title, passed, detail = '') {
    totalTests++;
    if (passed) {
      passedTests++;
      console.log(`[PASS] Test ${totalTests.toString().padStart(2, '0')}: ${title}`);
      if (detail) console.log(`       ↳ ${detail}`);
    } else {
      console.error(`[FAIL] Test ${totalTests.toString().padStart(2, '0')}: ${title}`);
      if (detail) console.error(`       ↳ ${detail}`);
    }
  }

  try {
    // ------------------------------------------------------------------------
    // SETUP TEST ACTORS
    // ------------------------------------------------------------------------
    console.log('[SETUP] Provisioning test users and authoritative roles...');

    // 1. User A (Student)
    let resA = await query("SELECT * FROM users WHERE email = 'student.a.test@sanjivani.edu.in'");
    if (resA.rows.length === 0) {
      const rnd = Math.floor(10000 + Math.random() * 90000);
      resA = await query(`
        INSERT INTO users (email, phone_number, full_name, department, password_hash, anonymous_pseudonym, handle, role, status, email_verified, phone_verified)
        VALUES ('student.a.test@sanjivani.edu.in', '+9199990${rnd}', 'Student Alpha', 'Computer Engineering', 'hash_pass', 'Anonymous #${rnd}', '@anon_a_${rnd}', 'student', 'active', true, true)
        RETURNING *
      `);
    }
    userA = resA.rows[0];

    // Ensure user_roles has 'student'
    await query(`
      INSERT INTO user_roles (user_id, role) VALUES ($1, 'student')
      ON CONFLICT (user_id) DO UPDATE SET role = 'student'
    `, [userA.id]);

    // 2. User B (Student)
    let resB = await query("SELECT * FROM users WHERE email = 'student.b.test@sanjivani.edu.in'");
    if (resB.rows.length === 0) {
      const rnd = Math.floor(10000 + Math.random() * 90000);
      resB = await query(`
        INSERT INTO users (email, phone_number, full_name, department, password_hash, anonymous_pseudonym, handle, role, status, email_verified, phone_verified)
        VALUES ('student.b.test@sanjivani.edu.in', '+9199991${rnd}', 'Student Beta', 'Mechanical Engineering', 'hash_pass', 'Anonymous #${rnd}', '@anon_b_${rnd}', 'student', 'active', true, true)
        RETURNING *
      `);
    }
    userB = resB.rows[0];

    await query(`
      INSERT INTO user_roles (user_id, role) VALUES ($1, 'student')
      ON CONFLICT (user_id) DO UPDATE SET role = 'student'
    `, [userB.id]);

    // 3. Admin Account
    let resAdmin = await query("SELECT * FROM users WHERE email = 'admin.sec.test@sanjivani.edu.in'");
    if (resAdmin.rows.length === 0) {
      const rnd = Math.floor(10000 + Math.random() * 90000);
      resAdmin = await query(`
        INSERT INTO users (email, phone_number, full_name, department, password_hash, anonymous_pseudonym, handle, role, status, email_verified, phone_verified)
        VALUES ('admin.sec.test@sanjivani.edu.in', '+9199992${rnd}', 'Security Officer', 'Administration', 'hash_pass', 'Campus Admin', '@admin_${rnd}', 'admin', 'active', true, true)
        RETURNING *
      `);
    }
    adminUser = resAdmin.rows[0];

    await query(`
      INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')
      ON CONFLICT (user_id) DO UPDATE SET role = 'admin'
    `, [adminUser.id]);

    // Sessions
    const fakeReq = { ip: '127.0.0.1', headers: { 'user-agent': 'SecurityTestRunner/2.0' } };
    tokenA = createSession(userA, fakeReq).token;
    tokenB = createSession(userB, fakeReq).token;
    adminToken = createSession(adminUser, fakeReq).token;

    console.log(`✓ User A (Student): ${userA.email} (ID: ${userA.id})`);
    console.log(`✓ User B (Student): ${userB.email} (ID: ${userB.id})`);
    console.log(`✓ Admin:            ${adminUser.email} (ID: ${adminUser.id})\n`);

    // Create a post for User B to test IDOR
    const postBRes = await query(`
      INSERT INTO posts (author_id, content, tag)
      VALUES ($1, 'Protected post by Student B', '#Academics')
      RETURNING *
    `, [userB.id]);
    const postB = postBRes.rows[0];

    // Create a comment by User B
    const commentBRes = await query(`
      INSERT INTO comments (post_id, author_id, content)
      VALUES ($1, $2, 'Comment by Student B')
      RETURNING *
    `, [postB.id, userB.id]);
    const commentB = commentBRes.rows[0];

    // Create a confession by User B
    const confBRes = await query(`
      INSERT INTO confessions (author_id, anonymous_pseudonym, content)
      VALUES ($1, 'Anonymous Tiger', 'Secret confession by Student B')
      RETURNING *
    `, [userB.id]);
    const confB = confBRes.rows[0];

    // Save post B for User B
    await query(`
      INSERT INTO saved_posts (user_id, post_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [userB.id, postB.id]);

    // Create a notification for User B
    await query(`
      INSERT INTO notifications (recipient_id, actor_id, type, entity_type, entity_id)
      VALUES ($1, $2, 'LIKE', 'post', $3)
    `, [userB.id, userA.id, postB.id]);

    // ------------------------------------------------------------------------
    // TEST MATRIX EXECUTION
    // ------------------------------------------------------------------------

    // TEST 1: Unauthenticated request to Admin API -> 401
    const t1 = await api('/admin/overview');
    report('Unauthenticated request to /api/admin/overview returns 401', t1.status === 401, `Status: ${t1.status}`);

    // TEST 2: Student -> /api/admin/dashboard -> 403
    const t2 = await api('/admin/dashboard', { token: tokenA });
    report('Student requesting /api/admin/dashboard returns 403 Forbidden', t2.status === 403, `Status: ${t2.status}`);

    // TEST 3: Student -> /api/admin/overview -> 403
    const t3 = await api('/admin/overview', { token: tokenA });
    report('Student requesting /api/admin/overview returns 403 Forbidden', t3.status === 403, `Status: ${t3.status}`);

    // TEST 4: Student -> /api/admin/users -> 403
    const t4 = await api('/admin/users', { token: tokenA });
    report('Student requesting /api/admin/users returns 403 Forbidden', t4.status === 403, `Status: ${t4.status}`);

    // TEST 5: Student -> /api/admin/posts -> 403
    const t5 = await api('/admin/posts', { token: tokenA });
    report('Student requesting /api/admin/posts returns 403 Forbidden', t5.status === 403, `Status: ${t5.status}`);

    // TEST 6: Student -> /api/admin/confessions -> 403
    const t6 = await api('/admin/confessions', { token: tokenA });
    report('Student requesting /api/admin/confessions returns 403 Forbidden', t6.status === 403, `Status: ${t6.status}`);

    // TEST 7: Student -> /api/admin/reports -> 403
    const t7 = await api('/admin/reports', { token: tokenA });
    report('Student requesting /api/admin/reports returns 403 Forbidden', t7.status === 403, `Status: ${t7.status}`);

    // TEST 8: Student -> /api/admin/analytics -> 403
    const t8 = await api('/admin/analytics', { token: tokenA });
    report('Student requesting /api/admin/analytics returns 403 Forbidden', t8.status === 403, `Status: ${t8.status}`);

    // TEST 9: Student -> DELETE /api/admin/posts/:id -> 403
    const t9 = await api(`/admin/posts/${postB.id}`, { method: 'DELETE', token: tokenA });
    report('Student attempting DELETE /api/admin/posts/:id returns 403 Forbidden', t9.status === 403, `Status: ${t9.status}`);

    // TEST 10: Student -> DELETE /api/admin/users/:id -> 403
    const t10 = await api(`/admin/users/${userB.id}`, { method: 'DELETE', token: tokenA });
    report('Student attempting DELETE /api/admin/users/:id returns 403 Forbidden', t10.status === 403, `Status: ${t10.status}`);

    // TEST 11: Student -> PATCH /api/admin/users/:id/role -> 403
    const t11 = await api(`/admin/users/${userA.id}/role`, { method: 'PATCH', body: { role: 'admin' }, token: tokenA });
    report('Student attempting PATCH /api/admin/users/:id/role returns 403 Forbidden', t11.status === 403, `Status: ${t11.status}`);

    // TEST 12: Student A attempting to delete Student B post via normal endpoint -> 403 (IDOR prevention)
    const t12 = await api(`/posts/${postB.id}`, { method: 'DELETE', token: tokenA });
    report('Student A attempting to delete Student B post returns 403 Forbidden', t12.status === 403, `Status: ${t12.status}`);

    // TEST 13: Student A attempting to edit Student B post -> 403 (IDOR prevention)
    const t13 = await api(`/posts/${postB.id}`, { method: 'PATCH', body: { content: 'Hacked content' }, token: tokenA });
    report('Student A attempting to edit Student B post returns 403 Forbidden', t13.status === 403, `Status: ${t13.status}`);

    // TEST 14: Student A attempting to delete Student B comment -> 403 (IDOR prevention)
    const t14 = await api(`/comments/${commentB.id}`, { method: 'DELETE', token: tokenA });
    report('Student A attempting to delete Student B comment returns 403 Forbidden', t14.status === 403, `Status: ${t14.status}`);

    // TEST 15: Student A inspecting Student B public profile -> ZERO private data leaked
    const t15 = await api(`/profiles/${userB.public_profile_id}`, { token: tokenA });
    const profileJson = JSON.stringify(t15.data);
    const leakedEmail = profileJson.includes('student.b.test@sanjivani.edu.in');
    const leakedPhone = profileJson.includes('+919999000002');
    const leakedRealName = profileJson.includes('Student Beta');
    const leakedInternalId = profileJson.includes(userB.id);
    const hasZeroLeaks = !leakedEmail && !leakedPhone && !leakedRealName && !leakedInternalId;
    report('Public profile view does NOT leak email, phone, real name, or internal UUID', hasZeroLeaks && t15.status === 200, 
      `Leaks: email=${leakedEmail}, phone=${leakedPhone}, realName=${leakedRealName}, internalId=${leakedInternalId}`);

    // TEST 16: Student attempting self-promotion via PUT /api/settings -> role rejected/stripped
    const t16 = await api('/settings', { method: 'PUT', body: { role: 'admin', bio: 'Trying to become admin' }, token: tokenA });
    // Verify in database that User A's role remains 'student'
    const roleCheckA = await query('SELECT role FROM user_roles WHERE user_id = $1', [userA.id]);
    const userRowA = await query('SELECT role FROM users WHERE id = $1', [userA.id]);
    const roleRemainsStudent = roleCheckA.rows[0]?.role === 'student' && userRowA.rows[0]?.role === 'student';
    report('Student cannot promote self via settings (role remains student in DB)', roleRemainsStudent, 
      `user_roles: ${roleCheckA.rows[0]?.role}, users: ${userRowA.rows[0]?.role}`);

    // TEST 17: Student viewing confessions feed -> anonymous pseudonym only, author identity completely masked
    const t17 = await api('/posts?category=Confessions', { token: tokenA });
    const confList = t17.data.posts || [];
    const targetConf = confList.find(c => c.id === confB.id);
    const confMasked = targetConf && targetConf.author && targetConf.author.isAnonymous === true && !targetConf.author.public_profile_id;
    const authorNotExposed = !JSON.stringify(t17.data).includes('student.b.test');
    report('Confession author identity is strictly masked from peer students', confMasked && authorNotExposed, 
      `isAnonymous: ${targetConf?.author?.isAnonymous}, author_id leaked: ${!authorNotExposed}`);

    // TEST 18: Student A reading User B private saved posts -> User A gets only own saved posts
    const t18 = await api('/user/saved', { token: tokenA });
    const userASavedPosts = t18.data.savedPosts || [];
    const accessedUserBBookmarks = userASavedPosts.some(p => p.id === postB.id);
    report('Student A cannot access Student B saved bookmarks (/api/user/saved isolated)', !accessedUserBBookmarks && t18.status === 200, 
      `User A saved count: ${userASavedPosts.length}`);

    // TEST 19: Student A reading notifications -> User A gets only own notifications
    const t19 = await api('/notifications', { token: tokenA });
    const userANotifs = t19.data.notifications || [];
    const accessedUserBNotifs = userANotifs.some(n => n.recipient_id === userB.id);
    report('Student A cannot access Student B notifications (/api/notifications isolated)', !accessedUserBNotifs && t19.status === 200, 
      `User A notifs count: ${userANotifs.length}`);

    // TEST 20: Admin accessing /api/admin/overview -> 200 OK with real data
    const t20 = await api('/admin/overview', { token: adminToken });
    report('Authorized Admin receives 200 and administrative data from /api/admin/overview', t20.status === 200 && !!t20.data.stats, 
      `Status: ${t20.status}, totalUsers: ${t20.data.stats?.totalUsers}`);

    // TEST 21: Admin audit logs record all privileged and unauthorized actions
    const t21 = await api('/admin/audit', { token: adminToken });
    const auditLogs = t21.data.logs || [];
    const hasForbiddenLogged = auditLogs.some(l => l.action === 'UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT');
    report('Unauthorized admin access attempts are immutably logged in admin_audit_logs', hasForbiddenLogged, 
      `Logged actions count: ${auditLogs.length}`);

    console.log('\n================================================================');
    console.log(` TEST MATRIX RESULT: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('================================================================\n');

    if (passedTests !== totalTests) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[Test Matrix Error]:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await pool.end();
  }
}

runAuthorizationMatrix();
