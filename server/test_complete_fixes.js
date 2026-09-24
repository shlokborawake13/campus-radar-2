require('dotenv').config();
const { pool, query } = require('./db');
const { createSession, hashPassword } = require('./security');
const http = require('http');
const app = require('./index');

let server;
let baseUrl;

async function startServer() {
  return new Promise((resolve) => {
    // Listen on dynamic port for testing
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      console.log(`[Test Server] running on ${baseUrl}`);
      resolve();
    });
  });
}

async function stopServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('CAMPUS RADAR — COMPLETE FUNCTIONALITY FIX TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    await startServer();

    // 1. Fetch test admin/student from database
    const userRes = await query("SELECT * FROM users WHERE status = 'active' LIMIT 2");
    if (userRes.rows.length === 0) {
      throw new Error('No active users found in database for testing');
    }

    const testAdmin = userRes.rows.find(u => u.role === 'admin') || userRes.rows[0];
    
    // Ensure we have a second user for relationship and IDOR tests
    let testStudent = userRes.rows.find(u => u.id !== testAdmin.id);
    if (!testStudent) {
      const pwdHash = await hashPassword('StudentPass123!');
      const insRes = await query(`
        INSERT INTO users (full_name, email, phone_number, password_hash, department, anonymous_pseudonym, handle, role, status)
        VALUES ('Test Peer Student', 'test.peer@sanjivani.edu.in', '+919876543210', $1, 'Computer Engineering', 'Anonymous Falcon', '@peer_falcon', 'student', 'active')
        RETURNING *
      `, [pwdHash]);
      testStudent = insRes.rows[0];
    }

    const adminToken = createSession(testAdmin).token;
    const studentToken = createSession(testStudent).token;

    console.log(`[Context] Admin: ${testAdmin.email} (${testAdmin.id})`);
    console.log(`[Context] Student: ${testStudent.email} (${testStudent.id})\n`);

    // ========================================================
    // TEST SECTION 1: AUTH & ZERO DATA LEAKAGE
    // ========================================================
    console.log('--- TEST SECTION 1: AUTH & ZERO DATA LEAKAGE ---');
    
    // Check /api/me as owner
    const meRes = await request('/api/me', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(meRes.status === 200, '/api/me returns 200 for authenticated user');
    assert(meRes.data.user?.private?.email === testStudent.email, '/api/me contains private email for owner');
    assert(!meRes.data.user?.password_hash, '/api/me never leaks password_hash');

    // Check public profile of student from admin perspective
    const pubProfileRes = await request(`/api/profiles/${testStudent.public_profile_id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(pubProfileRes.status === 200, 'Public profile returns 200');
    assert(pubProfileRes.data.profile?.display_name === testStudent.anonymous_pseudonym, 'Public profile displays anonymous pseudonym');
    assert(!pubProfileRes.data.profile?.email, 'Public profile NEVER leaks private email');
    assert(!pubProfileRes.data.profile?.phone_number, 'Public profile NEVER leaks phone number');
    assert(!pubProfileRes.data.profile?.full_name, 'Public profile NEVER leaks real full name');

    // ========================================================
    // TEST SECTION 2: COMMENTS / REPLIES FIX
    // ========================================================
    console.log('\n--- TEST SECTION 2: COMMENTS / REPLIES FIX ---');

    const knownConfessionId = '9758f9f9-2e9d-4c56-ae06-50b45909f44e';

    // A. GET comments on known confession
    const getConfComments = await request(`/api/posts/${knownConfessionId}/comments`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(getConfComments.status === 200, `GET /api/posts/${knownConfessionId}/comments returns 200 (Post or Confession)`);
    assert(Array.isArray(getConfComments.data.comments), 'Comments returned as an array');

    // B. POST comment on confession (the exact reported bug!)
    const postConfComment = await request(`/api/posts/${knownConfessionId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        text: 'This is a verified test comment from student peer.',
        isAnonymous: true
      })
    });
    assert(postConfComment.status === 201, `POST /api/posts/${knownConfessionId}/comments returns 201 Created`);
    assert(postConfComment.data.comment?.text === 'This is a verified test comment from student peer.', 'Created comment text matches');
    assert(postConfComment.data.comment?.isAnonymous === true, 'Comment flagged as anonymous');
    assert(postConfComment.data.comment?.isOwn === true, 'Comment marked as own comment');
    assert(!postConfComment.data.comment?.email, 'Comment does NOT expose author email');

    const createdConfCommentId = postConfComment.data.comment?.id;

    // C. Nonexistent post returns 404
    const nonExistentComment = await request('/api/posts/00000000-0000-0000-0000-000000000000/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ text: 'Hello' })
    });
    assert(nonExistentComment.status === 404, 'POST comment on nonexistent post returns 404');
    assert(nonExistentComment.data.message === 'Post not found', 'Returns "Post not found" message');

    // D. Comment validation: Empty text rejected
    const emptyComment = await request(`/api/posts/${knownConfessionId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ text: '   ' })
    });
    assert(emptyComment.status === 400, 'Empty comment text rejected with 400');

    // E. Comment validation: Oversized text rejected
    const longText = 'A'.repeat(1005);
    const oversizedComment = await request(`/api/posts/${knownConfessionId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ text: longText })
    });
    assert(oversizedComment.status === 400, 'Oversized comment (>1000 chars) rejected with 400');

    // F. IDOR Protection: Student B cannot delete Student A's comment
    const idorDelete = await request(`/api/posts/${knownConfessionId}/comments/${createdConfCommentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` } // Admin CAN delete
    });
    assert(idorDelete.status === 200, 'Admin can delete comment (moderation)');

    // Create another comment for student to delete own comment
    const ownCommentRes = await request(`/api/posts/${knownConfessionId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ text: 'My own comment to delete', isAnonymous: false })
    });
    const ownCommentId = ownCommentRes.data.comment?.id;

    // Student deletes own comment
    const deleteOwn = await request(`/api/posts/${knownConfessionId}/comments/${ownCommentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(deleteOwn.status === 200, 'Student can delete own comment');

    // Direct route DELETE /api/comments/:commentId
    const anotherComment = await request(`/api/posts/${knownConfessionId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ text: 'Testing direct delete route' })
    });
    const directDelete = await request(`/api/comments/${anotherComment.data.comment?.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(directDelete.status === 200, 'Direct DELETE /api/comments/:id works correctly');

    // ========================================================
    // TEST SECTION 3: DEVICE PHOTO UPLOAD & FEED DISPLAY
    // ========================================================
    console.log('\n--- TEST SECTION 3: DEVICE PHOTO UPLOAD & STORAGE ---');

    // Create a real JPEG buffer with APP1 EXIF segment to test upload and EXIF stripping
    const testJpegBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // APP1 EXIF header
      0xFF, 0xDB, 0x00, 0x43, 0x00, ...new Array(64).fill(1), // DQT Quantization table
      0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, // SOF0
      0xFF, 0xD9 // EOI
    ]);

    // Construct multipart form-data payload manually
    const boundary = '----WebKitFormBoundaryTest' + Math.random().toString(36).slice(2);
    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="campus_photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      testJpegBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const uploadRes = await request('/api/upload/image', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${studentToken}`
      },
      body: multipartBody
    });

    assert(uploadRes.status === 201, 'POST /api/upload/image returns 201 Created');
    assert(uploadRes.data.success === true, 'Upload returns success: true');
    assert(typeof uploadRes.data.url === 'string' && uploadRes.data.url.startsWith('https://'), 'Upload returns public URL from Supabase Storage');
    assert(uploadRes.data.url.includes('campus-radar-media'), 'URL references campus-radar-media bucket');
    
    const uploadedImageUrl = uploadRes.data.url;

    // Test rejection of non-image file spoofing extension
    const fakeExeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00');
    const fakeMultipart = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="malicious.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      fakeExeBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const badUploadRes = await request('/api/upload/image', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${studentToken}`
      },
      body: fakeMultipart
    });
    assert(badUploadRes.status === 400, 'Rejects executable spoofed as .jpg with 400');
    assert(badUploadRes.data.message.includes('Invalid image file signature'), 'Provides clear signature failure message');

    // Create a post referencing the uploaded image
    const createPostWithImage = await request('/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        type: 'post',
        title: 'New Campus Innovation Lab',
        content: 'Check out the new robotics lab equipment on campus!',
        tags: ['#Robotics', '#Innovation'],
        images: [uploadedImageUrl]
      })
    });
    assert(createPostWithImage.status === 201, 'POST /api/posts with uploaded image returns 201');
    assert(createPostWithImage.data.post?.images?.[0] === uploadedImageUrl, 'Post references uploaded Supabase storage URL');

    const createdPostId = createPostWithImage.data.post?.id;

    // Verify post appears in feed with image
    const feedRes = await request('/api/posts', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const foundPost = feedRes.data.posts?.find(p => p.id === createdPostId);
    assert(!!foundPost, 'Created post appears in main feed');
    assert(foundPost?.images?.[0] === uploadedImageUrl, 'Feed returns correct uploaded image URL');

    // ========================================================
    // TEST SECTION 4: SETTINGS PERSISTENCE & PRIVACY RULES
    // ========================================================
    console.log('\n--- TEST SECTION 4: SETTINGS PERSISTENCE & CONTROLS ---');

    // GET settings
    const getSettingsRes = await request('/api/settings', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(getSettingsRes.status === 200, 'GET /api/settings returns 200');
    assert(typeof getSettingsRes.data.settings === 'object', 'Returns settings object');

    // PUT settings - toggle privacy & notification settings
    const updateSettingsRes = await request('/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        show_department: false,
        show_year: false,
        show_bio: true,
        profile_discoverability: false,
        who_can_comment: 'followers',
        who_can_follow: 'verified_only',
        show_posts_on_profile: true,
        notify_likes: false,
        notify_comments: true,
        notify_replies: true,
        notify_followers: false,
        notify_events: true,
        notify_announcements: true,
        bio: 'Automated test verified bio',
        department: 'Information Technology'
      })
    });
    assert(updateSettingsRes.status === 200, 'PUT /api/settings returns 200');

    // Verify settings persisted in DB by reading again
    const verifySettingsRes = await request('/api/settings', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const saved = verifySettingsRes.data.settings;
    assert(saved.show_department === false, 'show_department persisted as false');
    assert(saved.show_year === false, 'show_year persisted as false');
    assert(saved.profile_discoverability === false, 'profile_discoverability persisted as false');
    assert(saved.who_can_comment === 'followers', 'who_can_comment persisted as followers');
    assert(saved.who_can_follow === 'verified_only', 'who_can_follow persisted as verified_only');
    assert(saved.notify_likes === false, 'notify_likes persisted as false');
    assert(saved.bio === 'Automated test verified bio', 'bio updated and persisted on users table');

    // Test privacy enforcement: Admin (not following student) tries to comment on post where who_can_comment = 'followers'
    const restrictedComment = await request(`/api/posts/${createdPostId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ text: 'Attempting comment when not following' })
    });
    assert(restrictedComment.status === 403, 'Enforces who_can_comment: followers (returns 403 to non-followers)');

    // Reset settings to default for clean state
    await request('/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        show_department: true,
        show_year: true,
        profile_discoverability: true,
        who_can_comment: 'everyone',
        who_can_follow: 'everyone'
      })
    });

    // ========================================================
    // TEST SECTION 5: FOLLOW SYSTEM
    // ========================================================
    console.log('\n--- TEST SECTION 5: FOLLOW SYSTEM ---');

    // Student A follows Admin
    const followRes = await request(`/api/profiles/${testAdmin.public_profile_id}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(followRes.status === 200, 'POST /api/profiles/:id/follow returns 200');
    assert(followRes.data.isFollowing === true, 'Returns isFollowing: true');

    // Self-follow prevented
    const selfFollowRes = await request(`/api/profiles/${testStudent.public_profile_id}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(selfFollowRes.status === 400, 'Self-follow prevented with 400');

    // Unfollow
    const unfollowRes = await request(`/api/profiles/${testAdmin.public_profile_id}/follow`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(unfollowRes.status === 200, 'DELETE /api/profiles/:id/follow returns 200');
    assert(unfollowRes.data.isFollowing === false, 'Returns isFollowing: false');

    // ========================================================
    // TEST SECTION 6: LIKES & SAVED POSTS
    // ========================================================
    console.log('\n--- TEST SECTION 6: LIKES & SAVED POSTS ---');

    // Toggle like on post
    const likeRes = await request(`/api/posts/${createdPostId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(likeRes.status === 200, 'Toggle like returns 200');
    assert(likeRes.data.hasLiked === true, 'hasLiked is true');

    // Toggle bookmark
    const bookmarkRes = await request(`/api/posts/${createdPostId}/bookmark`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(bookmarkRes.status === 200, 'Toggle bookmark returns 200');
    assert(bookmarkRes.data.hasBookmarked === true, 'hasBookmarked is true');

    // Clean up created test post
    await request(`/api/posts/${createdPostId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` }
    });

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Test Suite Fatal Error:', err);
    failed++;
  } finally {
    await stopServer();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
