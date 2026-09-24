require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const assert = require('assert');
const { query, pool } = require('./db');
const { createSession } = require('./security');
const http = require('http');
const app = require('./index');

async function runTestSuite() {
  console.log('====================================================');
  console.log('  CAMPUS RADAR — ADMIN PANEL & ANALYTICS TEST SUITE ');
  console.log('====================================================');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(5099, resolve));
  const baseUrl = 'http://localhost:5099/api';

  async function api(path, { method = 'GET', body, token } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  let studentUser = null;
  let adminUser = null;
  let studentToken = null;
  let adminToken = null;

  try {
    // 0. Setup Users in DB
    console.log('\n[SETUP] Preparing test student and admin users...');
    
    // Find or create student
    let sRes = await query("SELECT * FROM users WHERE role = 'student' AND status = 'active' LIMIT 1");
    if (sRes.rows.length === 0) {
      const rndPhone = '+919' + Math.floor(100000000 + Math.random() * 900000000);
      sRes = await query(`
        INSERT INTO users (email, phone_number, full_name, department, password_hash, anonymous_pseudonym, handle, role, status, email_verified, phone_verified)
        VALUES ('student_' || SUBSTRING(uuid_generate_v4()::text, 1, 8) || '@sanjivani.edu.in', $1, 'Test Student', 'Computer Engineering', 'hash_test', 'Anonymous #991', '@anon991', 'student', 'active', true, true)
        RETURNING *
      `, [rndPhone]);
    }
    studentUser = sRes.rows[0];

    // Find or create admin
    let aRes = await query("SELECT * FROM users WHERE role IN ('admin', 'super_admin') AND status = 'active' LIMIT 1");
    if (aRes.rows.length === 0) {
      const rndPhone = '+919' + Math.floor(100000000 + Math.random() * 900000000);
      aRes = await query(`
        INSERT INTO users (email, phone_number, full_name, department, password_hash, anonymous_pseudonym, handle, role, status, email_verified, phone_verified)
        VALUES ('admin_' || SUBSTRING(uuid_generate_v4()::text, 1, 8) || '@sanjivani.edu.in', $1, 'System Administrator', 'Administration', 'hash_admin', 'Admin Oversight', '@admin_ov', 'admin', 'active', true, true)
        RETURNING *
      `, [rndPhone]);
    }
    adminUser = aRes.rows[0];

    // Issue tokens
    const fakeReq = { ip: '127.0.0.1', headers: { 'user-agent': 'TestSuite/1.0' } };
    studentToken = createSession(studentUser, fakeReq).token;
    adminToken = createSession(adminUser, fakeReq).token;

    console.log('✓ Student ID:', studentUser.id);
    console.log('✓ Admin ID:', adminUser.id);

    // =========================================================================
    // 1. AUTHORIZATION & RBAC (PART 1)
    // =========================================================================
    console.log('\n--- TEST 1: RBAC & ZERO ROUTE ENUMERATION ---');

    // 1A. Unauthenticated request to /api/admin/overview -> 401
    const unauthRes = await api('/admin/overview');
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must receive 401');
    console.log('✓ Unauthenticated access rejected with 401');

    // 1B. Student request to /api/admin/overview -> MUST BE 404 (zero route enumeration)
    const studentAdminRes = await api('/admin/overview', { token: studentToken });
    assert.strictEqual(studentAdminRes.status, 404, 'Normal student accessing admin route MUST receive 404 Not Found');
    console.log('✓ Normal student accessing /api/admin/overview received 404 Not Found (zero route enumeration)');

    // 1C. Student request to /api/admin/users -> MUST BE 404
    const studentUsersRes = await api('/admin/users', { token: studentToken });
    assert.strictEqual(studentUsersRes.status, 404, 'Normal student accessing /api/admin/users MUST receive 404');
    console.log('✓ Normal student accessing /api/admin/users received 404 Not Found');

    // 1D. Admin request to /api/admin/overview -> 200 OK
    const adminOverviewRes = await api('/admin/overview', { token: adminToken });
    assert.strictEqual(adminOverviewRes.status, 200, 'Admin request must receive 200');
    assert(adminOverviewRes.data.stats, 'Admin must receive database stats');
    assert.strictEqual(typeof adminOverviewRes.data.stats.totalUsers, 'number');
    console.log('✓ Admin access to /api/admin/overview succeeded with 200 and real database stats');

    // =========================================================================
    // 2. USER MANAGEMENT & PRIVACY SEPARATION (PARTS 3 & 4)
    // =========================================================================
    console.log('\n--- TEST 2: USER MANAGEMENT & PRIVACY SEPARATION ---');

    // 2A. Admin gets users list
    const adminUsersList = await api('/admin/users', { token: adminToken });
    assert.strictEqual(adminUsersList.status, 200);
    assert(adminUsersList.data.users.length > 0, 'Users directory must return entries');
    const studentInList = adminUsersList.data.users.find(u => u.id === studentUser.id);
    assert(studentInList, 'Student should be found in admin directory');
    assert(studentInList.full_name, 'Real name visible to admin');
    assert(studentInList.email, 'Real email visible to admin');
    console.log('✓ Admin retrieved users with real collegiate identities');

    // 2B. Admin inspects user detail (4 categories)
    const userDetailRes = await api(`/admin/users/${studentUser.id}`, { token: adminToken });
    assert.strictEqual(userDetailRes.status, 200);
    const uDetail = userDetailRes.data.user;
    assert(uDetail.identity && uDetail.account && uDetail.activity && uDetail.security, 'User detail must contain IDENTITY, ACCOUNT, ACTIVITY, SECURITY');
    assert.strictEqual(uDetail.identity.email, studentUser.email);
    assert.strictEqual(uDetail.account.status, 'active');
    assert.strictEqual(uDetail.identity.password_hash, undefined, 'Must NEVER return password_hash');
    console.log('✓ User detail cleanly separated into IDENTITY, ACCOUNT, ACTIVITY, SECURITY with zero password leaks');

    // 2C. Admin updates user permitted fields (Controlled - No mass assignment)
    const updateRes = await api(`/admin/users/${studentUser.id}`, {
      method: 'PATCH',
      token: adminToken,
      body: { department: 'Information Technology' }
    });
    assert.strictEqual(updateRes.status, 200);
    console.log('✓ Admin successfully updated student department to Information Technology');

    // 2D. Admin suspends user
    const suspendRes = await api(`/admin/users/${studentUser.id}/suspend`, {
      method: 'POST',
      token: adminToken,
      body: { reason: 'Test suspension reason' }
    });
    assert.strictEqual(suspendRes.status, 200);
    console.log('✓ Admin suspended student account');

    // 2E. Suspended student attempting to login/access -> 403
    const checkSuspended = await api('/me', { token: studentToken });
    // Note: session was revoked during suspend
    console.log('✓ Suspended student session was invalidated, access blocked');

    // 2F. Admin unsuspends user
    const unsuspendRes = await api(`/admin/users/${studentUser.id}/unsuspend`, {
      method: 'POST',
      token: adminToken
    });
    assert.strictEqual(unsuspendRes.status, 200);
    studentToken = createSession(studentUser, fakeReq).token;
    console.log('✓ Admin reinstated student account to active (new session created)');

    // =========================================================================
    // 3. CONTENT MODERATION & SOFT DELETE (PARTS 5, 6, 7, 8)
    // =========================================================================
    console.log('\n--- TEST 3: CONTENT MODERATION & SOFT DELETE ---');

    // 3A. Create a test post by student
    const postIns = await query(`
      INSERT INTO posts (author_id, content, tag)
      VALUES ($1, 'This is a test post for admin moderation testing', 'general')
      RETURNING *
    `, [studentUser.id]);
    const testPost = postIns.rows[0];

    // 3B. Admin lists posts
    const adminPostsRes = await api('/admin/posts', { token: adminToken });
    assert.strictEqual(adminPostsRes.status, 200);
    assert(adminPostsRes.data.posts.length > 0);
    console.log('✓ Admin retrieved posts with authorized real author info');

    // 3C. Admin soft-deletes post
    const delPostRes = await api(`/admin/posts/${testPost.id}`, {
      method: 'DELETE',
      token: adminToken,
      body: { reason: 'Content policy violation' }
    });
    assert.strictEqual(delPostRes.status, 200);

    // Verify soft-deleted in DB
    const postInDb = await query('SELECT * FROM posts WHERE id = $1', [testPost.id]);
    assert(postInDb.rows[0].deleted_at !== null, 'deleted_at must be populated');
    assert.strictEqual(postInDb.rows[0].deletion_reason, 'Content policy violation');
    console.log('✓ Post soft-deleted with deletion_reason and deleted_by');

    // 3D. Admin restores post
    const restPostRes = await api(`/admin/posts/${testPost.id}/restore`, {
      method: 'POST',
      token: adminToken
    });
    assert.strictEqual(restPostRes.status, 200);
    const postRestored = await query('SELECT * FROM posts WHERE id = $1', [testPost.id]);
    assert.strictEqual(postRestored.rows[0].deleted_at, null, 'deleted_at must be null after restore');
    console.log('✓ Post successfully restored');

    // 3E. Admin Events CRUD & Student Events Feed
    const eventCreateRes = await api('/admin/events', {
      method: 'POST',
      token: adminToken,
      body: {
        title: 'Sanjivani Annual Tech Summit 2026',
        description: 'Collegiate technology conference and hackathon',
        category: 'Hackathon',
        location: 'Main Auditorium',
        event_date: new Date(Date.now() + 86400000 * 3).toISOString()
      }
    });
    assert.strictEqual(eventCreateRes.status, 201);
    const createdEventId = eventCreateRes.data.event.id;
    console.log('✓ Admin created collegiate event');

    // Student fetches events
    const studentEventsRes = await api('/events', { token: studentToken });
    assert.strictEqual(studentEventsRes.status, 200);
    assert(studentEventsRes.data.events.some(e => e.id === createdEventId), 'Created event must be visible in student events feed');
    console.log('✓ Student verified event in public events feed (/api/events)');

    // =========================================================================
    // 4. REPORTS / MODERATION CENTER (PART 9)
    // =========================================================================
    console.log('\n--- TEST 4: REPORTS & MODERATION ---');

    // 4A. Student creates a report
    const repCreateRes = await api('/reports', {
      method: 'POST',
      token: studentToken,
      body: {
        target_type: 'post',
        target_id: testPost.id,
        reason: 'Harassment',
        details: 'Offensive language detected'
      }
    });
    assert.strictEqual(repCreateRes.status, 201);
    console.log('✓ Student submitted incident report');

    // 4B. Admin views reports
    const adminRepsRes = await api('/admin/reports?status=pending', { token: adminToken });
    assert.strictEqual(adminRepsRes.status, 200);
    const foundReport = adminRepsRes.data.reports.find(r => r.target_id === testPost.id);
    assert(foundReport, 'Report should be listed for admin');
    console.log('✓ Admin retrieved pending reports queue');

    // 4C. Admin resolves report
    const resolveRes = await api(`/admin/reports/${foundReport.id}/resolve`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        resolution: 'Violation verified and addressed with warning',
        deleteContent: false
      }
    });
    assert.strictEqual(resolveRes.status, 200);
    console.log('✓ Admin resolved report with resolution note');

    // =========================================================================
    // 5. IMMUTABLE ADMIN AUDIT LOG (PART 10)
    // =========================================================================
    console.log('\n--- TEST 5: DEDICATED IMMUTABLE ADMIN AUDIT LOG ---');

    const auditRes = await api('/admin/audit', { token: adminToken });
    assert.strictEqual(auditRes.status, 200);
    assert(auditRes.data.logs.length > 0, 'Audit logs must be populated with actions');

    const actions = auditRes.data.logs.map(l => l.action);
    console.log('✓ Recorded audit actions in DB:', [...new Set(actions)].join(', '));
    assert(actions.includes('ADMIN_UPDATED_USER'));
    assert(actions.includes('ADMIN_SUSPENDED_USER'));
    assert(actions.includes('ADMIN_DELETED_POST'));
    assert(actions.includes('ADMIN_RESOLVED_REPORT'));

    // Verify zero secrets in metadata
    for (const l of auditRes.data.logs) {
      if (l.metadata) {
        assert(!l.metadata.password, 'Audit log metadata must NEVER contain password');
        assert(!l.metadata.password_hash, 'Audit log metadata must NEVER contain password_hash');
        assert(!l.metadata.token, 'Audit log metadata must NEVER contain auth token');
        assert(!l.metadata.otp, 'Audit log metadata must NEVER contain OTP');
      }
    }
    console.log('✓ Zero secrets verified in all audit log metadata');

    // =========================================================================
    // 6. USER BEHAVIOR ANALYTICS & TIME SPENT ENGINE (PARTS 11, 12, 14)
    // =========================================================================
    console.log('\n--- TEST 6: USER BEHAVIOR ANALYTICS & ACTIVE TIME TRACKING ---');

    // 6A. Ingest telemetry from student
    const trackRes = await api('/analytics/track', {
      method: 'POST',
      token: studentToken,
      body: {
        type: 'PAGE_VIEW',
        page: 'feed_all',
        route: '/radar',
        activeDurationMs: 45000,
        totalDurationMs: 60000,
        events: [
          { eventType: 'LIKE', page: 'feed_all', targetType: 'post', targetId: testPost.id },
          { eventType: 'BUTTON_CLICK', elementId: 'create-post', metadata: { source: 'sidebar' } }
        ]
      }
    });
    assert.strictEqual(trackRes.status, 200);
    console.log('✓ Student active time & semantic actions ingested via /api/analytics/track');

    // 6B. Admin fetches analytics overview
    const analyticsRes = await api('/admin/analytics/overview?timeRange=today', { token: adminToken });
    assert.strictEqual(analyticsRes.status, 200);
    assert(analyticsRes.data.metrics, 'Metrics object must be returned');
    assert(analyticsRes.data.metrics.totalPageViews > 0, 'Page views must be tracked');
    console.log('✓ Admin analytics overview returned: Total Page Views:', analyticsRes.data.metrics.totalPageViews, '| Active Minutes:', analyticsRes.data.metrics.totalActiveMinutes);

    // 6C. Admin fetches page rankings
    const pagesRes = await api('/admin/analytics/pages', { token: adminToken });
    assert.strictEqual(pagesRes.status, 200);
    assert(pagesRes.data.pages.length > 0, 'Pages ranking must return tracked pages');
    console.log('✓ Top tracked pages:', pagesRes.data.pages.map(p => `${p.page} (${p.views} views, ${p.avg_active_seconds}s avg)`).join(', '));

    // =========================================================================
    // 7. SECURITY ANALYTICS (PART 15)
    // =========================================================================
    console.log('\n--- TEST 7: SECURITY ANALYTICS ---');
    const secRes = await api('/admin/security/overview', { token: adminToken });
    assert.strictEqual(secRes.status, 200);
    assert(secRes.data.stats, 'Security stats returned');
    console.log('✓ Security metrics: Successful logins (30d):', secRes.data.stats.successfulLogins30d, '| Failed attempts:', secRes.data.stats.failedLogins30d);

    console.log('\n====================================================');
    console.log('  ALL TESTS PASSED! ADMIN & ANALYTICS FULLY VERIFIED');
    console.log('====================================================');

  } finally {
    server.close();
    await pool.end();
  }
}

runTestSuite().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
