const assert = require('assert');
const { query, pool } = require('./db');
const { hashPasswordSync, createSession } = require('./security');
const sharp = require('sharp');
const crypto = require('crypto');

const BASE_URL = 'http://127.0.0.1:5001';

async function runAvatarTests() {
  console.log('\n============================================================');
  console.log('   CAMPUS RADAR — PROFILE PICTURE SYSTEM TEST SUITE   ');
  console.log('============================================================\n');

  let passed = 0;
  let total = 0;

  function testAssert(condition, name, details = '') {
    total++;
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}: ${details}`);
    }
  }

  // Generate test fixtures
  const testIdA = crypto.randomUUID();
  const testIdB = crypto.randomUUID();
  const testEmailA = `avatar.test.a.${Date.now()}@sanjivani.edu.in`;
  const testEmailB = `avatar.test.b.${Date.now()}@sanjivani.edu.in`;
  const testHandleA = `@av_a_${Date.now().toString().slice(-4)}`;
  const testHandleB = `@av_b_${Date.now().toString().slice(-4)}`;
  const pwHash = hashPasswordSync('Password@123');

  console.log('[Setup] Creating isolated student accounts...');
  const userARes = await query(`
    INSERT INTO users (id, public_profile_id, email, phone_number, full_name, password_hash, handle, anonymous_pseudonym, role, status, email_verified, phone_verified)
    VALUES ($1, $2, $3, $4, 'Avatar Test Alpha', $5, $6, 'Student Alpha', 'student', 'active', true, true)
    RETURNING id, public_profile_id, email, handle, avatar_url
  `, [testIdA, crypto.randomUUID(), testEmailA, `+91987${Math.floor(1000000 + Math.random() * 9000000)}`, pwHash, testHandleA]);
  const userA = userARes.rows[0];

  const userBRes = await query(`
    INSERT INTO users (id, public_profile_id, email, phone_number, full_name, password_hash, handle, anonymous_pseudonym, role, status, email_verified, phone_verified)
    VALUES ($1, $2, $3, $4, 'Avatar Test Beta', $5, $6, 'Student Beta', 'student', 'active', true, true)
    RETURNING id, public_profile_id, email, handle, avatar_url
  `, [testIdB, crypto.randomUUID(), testEmailB, `+91987${Math.floor(1000000 + Math.random() * 9000000)}`, pwHash, testHandleB]);
  const userB = userBRes.rows[0];

  // Sessions
  const { token: tokenA } = createSession(userA);
  const { token: tokenB } = createSession(userB);

  await query(`
    INSERT INTO user_sessions (user_id, session_token, is_active, expires_at)
    VALUES ($1, $2, true, NOW() + INTERVAL '1 day'), ($3, $4, true, NOW() + INTERVAL '1 day')
  `, [userA.id, tokenA, userB.id, tokenB]);

  // Admin user
  const adminRes = await query(`SELECT id, email, role FROM users WHERE role = 'admin' LIMIT 1`);
  const adminUser = adminRes.rows[0];
  const { token: adminToken } = adminUser ? createSession(adminUser) : { token: null };
  if (adminUser && adminToken) {
    await query(`
      INSERT INTO user_sessions (user_id, session_token, is_active, expires_at)
      VALUES ($1, $2, true, NOW() + INTERVAL '1 day')
    `, [adminUser.id, adminToken]);
  }

  try {
    // ---------------------------------------------------------------
    // 1. FILE VALIDATION & FORMAT TESTING
    // ---------------------------------------------------------------
    console.log('\n--- 1. FILE VALIDATION & TYPE SAFETY ---');

    // 1.1 Generate valid JPEG buffer
    const validJpegBuffer = await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 3,
        background: { r: 16, g: 185, b: 129 }
      }
    }).jpeg().toBuffer();

    // 1.2 Generate valid PNG buffer
    const validPngBuffer = await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 4,
        background: { r: 14, g: 165, b: 233, alpha: 1 }
      }
    }).png().toBuffer();

    // 1.3 Generate valid WebP buffer
    const validWebpBuffer = await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 3,
        background: { r: 244, g: 63, b: 94 }
      }
    }).webp().toBuffer();

    // 1.4 Generate spoofed file (text/executable disguised as image)
    const spoofedBuffer = Buffer.from('<?php echo "malicious script"; ?>');

    // 1.5 Generate oversized buffer (> 5MB)
    const oversizedBuffer = Buffer.alloc(5.5 * 1024 * 1024);

    // Test rejection of spoofed image
    const spoofFormData = new FormData();
    spoofFormData.append('avatar', new Blob([spoofedBuffer], { type: 'image/jpeg' }), 'avatar.jpg');

    const spoofRes = await fetch(`${BASE_URL}/api/user/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: spoofFormData
    });
    const spoofData = await spoofRes.json().catch(() => ({}));
    testAssert(
      spoofRes.status === 400,
      'Validation: Rejects spoofed / non-image file with 400',
      `Got status ${spoofRes.status}`
    );
    testAssert(
      spoofData.message && spoofData.message.includes('Only JPG, PNG, and WebP'),
      'Validation: Provides clear format safety message',
      spoofData.message
    );

    // Test rejection of oversized image (>5MB)
    const overFormData = new FormData();
    overFormData.append('avatar', new Blob([oversizedBuffer], { type: 'image/png' }), 'large.png');

    const overRes = await fetch(`${BASE_URL}/api/user/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: overFormData
    });
    testAssert(
      overRes.status === 400,
      'Validation: Rejects oversized file (>5MB) with 400',
      `Got status ${overRes.status}`
    );

    // ---------------------------------------------------------------
    // 2. AVATAR UPLOAD & STORAGE VERIFICATION
    // ---------------------------------------------------------------
    console.log('\n--- 2. AVATAR UPLOAD, OPTIMIZATION & STORAGE ---');

    // Upload valid JPEG avatar for User A
    const uploadFormDataA = new FormData();
    uploadFormDataA.append('avatar', new Blob([validJpegBuffer], { type: 'image/jpeg' }), 'my_photo.jpg');

    const uploadResA = await fetch(`${BASE_URL}/api/user/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: uploadFormDataA
    });
    const uploadDataA = await uploadResA.json();

    testAssert(
      uploadResA.status === 200,
      'Upload: User A can upload valid avatar (Status 200)',
      `Status: ${uploadResA.status}`
    );
    testAssert(
      uploadDataA.success === true && uploadDataA.avatarUrl,
      'Upload: Returns public avatar URL',
      JSON.stringify(uploadDataA)
    );
    testAssert(
      uploadDataA.avatarUrl.includes(userA.id),
      'Storage Security: Avatar path is isolated inside user ID folder',
      uploadDataA.avatarUrl
    );
    testAssert(
      uploadDataA.avatarUrl.endsWith('.webp'),
      'Image Optimization: Converted to optimized WebP format',
      uploadDataA.avatarUrl
    );

    const firstAvatarUrl = uploadDataA.avatarUrl;

    // Verify Database Persistence
    const checkDbA = await query('SELECT avatar_url FROM users WHERE id = $1', [userA.id]);
    testAssert(
      checkDbA.rows[0].avatar_url === firstAvatarUrl,
      'Database: users.avatar_url is updated in PostgreSQL',
      checkDbA.rows[0].avatar_url
    );

    // Verify /api/me immediately returns updated avatar
    const meResA = await fetch(`${BASE_URL}/api/me`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const meDataA = await meResA.json();
    testAssert(
      meDataA.user?.avatar === firstAvatarUrl,
      'Identity: GET /api/me immediately reflects updated avatar',
      meDataA.user?.avatar
    );

    // Verify /api/profiles/:id returns updated avatar to peers
    const profileRes = await fetch(`${BASE_URL}/api/profiles/${userA.public_profile_id}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const profileData = await profileRes.json();
    testAssert(
      profileData.profile?.avatar === firstAvatarUrl,
      'Public View: Peers see updated avatar on student public profile',
      profileData.profile?.avatar
    );

    // ---------------------------------------------------------------
    // 3. AVATAR REPLACEMENT & CLEANUP
    // ---------------------------------------------------------------
    console.log('\n--- 3. AVATAR REPLACEMENT & STORAGE CLEANUP ---');

    // Replace User A avatar with a PNG
    const replaceFormData = new FormData();
    replaceFormData.append('avatar', new Blob([validPngBuffer], { type: 'image/png' }), 'new_avatar.png');

    const replaceRes = await fetch(`${BASE_URL}/api/user/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: replaceFormData
    });
    const replaceData = await replaceRes.json();

    testAssert(
      replaceRes.status === 200,
      'Replace: User A can replace existing avatar (Status 200)',
      `Status: ${replaceRes.status}`
    );
    testAssert(
      replaceData.avatarUrl !== firstAvatarUrl,
      'Replace: New unique object path created upon replacement',
      replaceData.avatarUrl
    );

    const secondAvatarUrl = replaceData.avatarUrl;

    // Verify /api/me returns second avatar
    const meResA2 = await fetch(`${BASE_URL}/api/me`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const meDataA2 = await meResA2.json();
    testAssert(
      meDataA2.user?.avatar === secondAvatarUrl,
      'Replace: GET /api/me reflects newly replaced avatar',
      meDataA2.user?.avatar
    );

    // ---------------------------------------------------------------
    // 4. AVATAR REMOVAL
    // ---------------------------------------------------------------
    console.log('\n--- 4. AVATAR REMOVAL & RESET TO FALLBACK ---');

    const removeRes = await fetch(`${BASE_URL}/api/user/avatar`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const removeData = await removeRes.json();

    testAssert(
      removeRes.status === 200,
      'Remove: DELETE /api/user/avatar returns 200',
      `Status: ${removeRes.status}`
    );
    testAssert(
      removeData.success === true && removeData.avatarUrl,
      'Remove: Successfully reset to default fallback avatar',
      removeData.avatarUrl
    );

    // Verify Database reflects NULL
    const checkDbNull = await query('SELECT avatar_url FROM users WHERE id = $1', [userA.id]);
    testAssert(
      checkDbNull.rows[0].avatar_url === null,
      'Database: users.avatar_url is set to NULL in PostgreSQL',
      checkDbNull.rows[0].avatar_url
    );

    // ---------------------------------------------------------------
    // 5. AUTHORIZATION & IDOR ISOLATION
    // ---------------------------------------------------------------
    console.log('\n--- 5. AUTHENTICATION & IDOR ISOLATION ---');

    // Unauthenticated request
    const unauthRes = await fetch(`${BASE_URL}/api/user/avatar`, {
      method: 'DELETE'
    });
    testAssert(
      unauthRes.status === 401,
      'Security: Unauthenticated avatar removal rejected with 401',
      `Got status ${unauthRes.status}`
    );

    // ---------------------------------------------------------------
    // 6. ADMIN MODERATION & AUDIT LOGGING
    // ---------------------------------------------------------------
    if (adminToken) {
      console.log('\n--- 6. ADMIN AVATAR MODERATION ---');

      // Upload avatar for User B
      const uploadFormDataB = new FormData();
      uploadFormDataB.append('avatar', new Blob([validWebpBuffer], { type: 'image/webp' }), 'b_photo.webp');
      const uploadResB = await fetch(`${BASE_URL}/api/user/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
        body: uploadFormDataB
      });
      testAssert(
        uploadResB.status === 200,
        'Admin Prep: User B uploaded avatar for moderation test',
        `Status: ${uploadResB.status}`
      );

      // Student A tries to invoke admin moderation endpoint -> rejected with 404/403
      const studentModRes = await fetch(`${BASE_URL}/api/admin/users/${userB.id}/avatar`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      testAssert(
        studentModRes.status === 403 || studentModRes.status === 404,
        'Security: Student cannot invoke admin avatar moderation endpoint',
        `Got status ${studentModRes.status}`
      );

      // Admin removes User B's avatar
      const adminModRes = await fetch(`${BASE_URL}/api/admin/users/${userB.id}/avatar`, {
        method: 'DELETE',
        headers: { 
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: 'Avatar violates campus dress code policy' })
      });
      const adminModData = await adminModRes.json();
      testAssert(
        adminModRes.status === 200,
        'Admin: Authorized administrator can remove inappropriate student avatar',
        `Status: ${adminModRes.status}`
      );

      // Check DB User B avatar is NULL
      const checkUserBDb = await query('SELECT avatar_url FROM users WHERE id = $1', [userB.id]);
      testAssert(
        checkUserBDb.rows[0].avatar_url === null,
        'Admin: User B avatar is reset to NULL in database',
        checkUserBDb.rows[0].avatar_url
      );

      // Check Admin Audit Log
      const auditRes = await query(`
        SELECT action, target_type, target_id, metadata
        FROM admin_audit_logs
        WHERE action = 'ADMIN_REMOVED_AVATAR' AND target_id = $1
        ORDER BY created_at DESC LIMIT 1
      `, [userB.id]);
      testAssert(
        auditRes.rows.length > 0,
        'Audit: Admin avatar removal creates audit log event in admin_audit_logs',
        JSON.stringify(auditRes.rows[0])
      );
    }

  } finally {
    console.log('\n[Cleanup] Removing isolated test accounts...');
    await query('DELETE FROM users WHERE id IN ($1, $2)', [userA.id, userB.id]);
    await pool.end();
  }

  console.log('\n============================================================');
  console.log(`   TEST RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)   `);
  console.log('============================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runAvatarTests().catch(err => {
  console.error('[Avatar Test Suite Error]:', err);
  process.exit(1);
});
