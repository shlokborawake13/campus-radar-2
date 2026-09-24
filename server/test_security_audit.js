const BASE_URL = 'http://localhost:5001';

const headersA = {
  'Content-Type': 'application/json',
  'x-user-id': 'rahul.sharma@sanjivani.edu.in'
};

const headersB = {
  'Content-Type': 'application/json',
  'x-user-id': 'pooja.d@sanjivani.edu.in'
};

const headersAdmin = {
  'Content-Type': 'application/json',
  'x-user-id': 'admin@sanjivani.edu.in'
};

async function runAudit() {
  console.log('====================================================');
  console.log('CAMPUS RADAR — PRODUCTION PRIVACY & SECURITY AUDIT');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${message}`);
    }
  }

  // ----------------------------------------------------
  // TEST 1: ZERO DATA LEAKAGE IN API RESPONSES
  // ----------------------------------------------------
  console.log('\n--- TEST 1: NETWORK RESPONSE PRIVACY AUDIT ---');
  
  // Student A fetches posts
  const postsRes = await fetch(`${BASE_URL}/api/posts`, { headers: headersA }).then(r => r.json());
  const postsPayload = JSON.stringify(postsRes);

  assert(!postsPayload.includes('Pooja Deshmukh'), 'Posts response does NOT contain peer real name (Pooja Deshmukh)');
  assert(!postsPayload.includes('pooja.d@sanjivani.edu.in'), 'Posts response does NOT contain peer email (pooja.d@sanjivani.edu.in)');
  assert(!postsPayload.includes('+919812345678'), 'Posts response does NOT contain peer phone (+919812345678)');
  assert(!postsPayload.includes('password_hash'), 'Posts response does NOT contain password_hash');

  // Student A fetches Student B public profile
  const bProf = await fetch(`${BASE_URL}/api/profiles/90481751-8869-4b6c-90a0-7d777e382410`, { headers: headersA }).then(r => r.json());
  const bProfPayload = JSON.stringify(bProf);

  assert(bProf.success === true, 'Public profile fetches successfully');
  assert(bProf.profile.display_name === 'Anonymous #103', 'Public profile uses display_name (Anonymous #103)');
  assert(bProf.profile.handle === '@anon103', 'Public profile uses handle (@anon103)');
  assert(!bProfPayload.includes('Pooja Deshmukh'), 'Public profile response does NOT leak real name');
  assert(!bProfPayload.includes('pooja.d@sanjivani.edu.in'), 'Public profile response does NOT leak email');
  assert(!bProfPayload.includes('+919812345678'), 'Public profile response does NOT leak phone');

  // ----------------------------------------------------
  // TEST 2: CONFESSION DECOUPLING AUDIT
  // ----------------------------------------------------
  console.log('\n--- TEST 2: CONFESSIONS DECOUPLING AUDIT ---');
  const confPost = await fetch(`${BASE_URL}/api/posts?category=Confessions`, { headers: headersA }).then(r => r.json());
  const confPayload = JSON.stringify(confPost);

  assert(confPost.posts.length > 0, 'Confessions feed loaded');
  assert(confPost.posts.every(p => p.author.isAnonymous === true), 'All confessions are marked isAnonymous = true');
  assert(confPost.posts.every(p => !p.author.public_profile_id), 'Confessions do NOT contain author public_profile_id');
  assert(!confPayload.includes('rahul.sharma'), 'Confessions do NOT contain author email');
  assert(!confPayload.includes('Rahul Sharma'), 'Confessions do NOT contain author real name');

  // ----------------------------------------------------
  // TEST 3: REAL FOLLOW / UNFOLLOW SYSTEM
  // ----------------------------------------------------
  console.log('\n--- TEST 3: REAL FOLLOW / UNFOLLOW AUDIT ---');
  // Follow Student B
  const followRes = await fetch(`${BASE_URL}/api/profiles/90481751-8869-4b6c-90a0-7d777e382410/follow`, {
    method: 'POST',
    headers: headersA
  }).then(r => r.json());
  assert(followRes.success === true && followRes.isFollowing === true, 'Follow Student B succeeds');

  // Verify count updated
  const checkFollow = await fetch(`${BASE_URL}/api/profiles/90481751-8869-4b6c-90a0-7d777e382410`, { headers: headersA }).then(r => r.json());
  assert(checkFollow.profile.isFollowing === true, 'Profile correctly reports isFollowing = true');
  assert(checkFollow.profile.followersCount >= 1, 'Profile reports follower count >= 1');

  // Self-Follow Rejection
  const selfFollow = await fetch(`${BASE_URL}/api/profiles/bd7206f9-a67c-4e67-b492-4f1de252167e/follow`, {
    method: 'POST',
    headers: headersA
  }).then(r => r.json());
  assert(selfFollow.success === false, 'Self-follow is strictly rejected');

  // Unfollow
  const unfollowRes = await fetch(`${BASE_URL}/api/profiles/90481751-8869-4b6c-90a0-7d777e382410/follow`, {
    method: 'DELETE',
    headers: headersA
  }).then(r => r.json());
  assert(unfollowRes.success === true && unfollowRes.isFollowing === false, 'Unfollow succeeds and returns isFollowing = false');

  // ----------------------------------------------------
  // TEST 4: PRIVACY SETTINGS ENFORCEMENT
  // ----------------------------------------------------
  console.log('\n--- TEST 4: SERVER-ENFORCED PRIVACY SETTINGS ---');
  // Student B hides department
  await fetch(`${BASE_URL}/api/settings`, {
    method: 'PUT',
    headers: headersB,
    body: JSON.stringify({ show_department: false })
  });

  const bProfHiddenDept = await fetch(`${BASE_URL}/api/profiles/90481751-8869-4b6c-90a0-7d777e382410`, { headers: headersA }).then(r => r.json());
  assert(bProfHiddenDept.profile.department === '', 'Department is OMITTED from public profile when show_department is false');

  // Restore department
  await fetch(`${BASE_URL}/api/settings`, {
    method: 'PUT',
    headers: headersB,
    body: JSON.stringify({ show_department: true })
  });

  // ----------------------------------------------------
  // TEST 5: BLOCKING ENGINE
  // ----------------------------------------------------
  console.log('\n--- TEST 5: BLOCKING ENGINE AUDIT ---');
  // Student B blocks Student A
  await fetch(`${BASE_URL}/api/blocks`, {
    method: 'POST',
    headers: headersB,
    body: JSON.stringify({ publicProfileId: 'bd7206f9-a67c-4e67-b492-4f1de252167e' })
  });

  // Student A tries to view B's profile
  const blockedProf = await fetch(`${BASE_URL}/api/profiles/90481751-8869-4b6c-90a0-7d777e382410`, { headers: headersA }).then(r => r.json());
  assert(blockedProf.success === false, 'Blocked profile returns 404 / unavailable');

  // Student A searches for B
  const blockedSearch = await fetch(`${BASE_URL}/api/search?q=103`, { headers: headersA }).then(r => r.json());
  assert(blockedSearch.people.length === 0, 'Blocked user is omitted from search results');

  // Student B unblocks Student A
  await fetch(`${BASE_URL}/api/blocks/bd7206f9-a67c-4e67-b492-4f1de252167e`, {
    method: 'DELETE',
    headers: headersB
  });

  const unblockedProf = await fetch(`${BASE_URL}/api/profiles/90481751-8869-4b6c-90a0-7d777e382410`, { headers: headersA }).then(r => r.json());
  assert(unblockedProf.success === true, 'Profile access is restored after unblocking');

  // ----------------------------------------------------
  // TEST 6: ADMIN AUTHORIZATION
  // ----------------------------------------------------
  console.log('\n--- TEST 6: ADMIN AUTHORIZATION AUDIT ---');
  const studentAdminAttempt = await fetch(`${BASE_URL}/api/admin/overview`, { headers: headersA });
  assert(studentAdminAttempt.status === 403, 'Non-admin student receives 403 Forbidden on admin portal');

  const adminOverview = await fetch(`${BASE_URL}/api/admin/overview`, { headers: headersAdmin });
  assert(adminOverview.status === 200, 'Admin credentials receive 200 OK on admin portal');

  // ----------------------------------------------------
  // TEST 7: POST HIDING & BOOKMARKS
  // ----------------------------------------------------
  console.log('\n--- TEST 7: PERSISTENT HIDE & SAVED POSTS ---');
  const feed = await fetch(`${BASE_URL}/api/posts`, { headers: headersA }).then(r => r.json());
  if (feed.posts.length > 0) {
    const testPost = feed.posts[0];
    
    // Bookmark
    const bmRes = await fetch(`${BASE_URL}/api/posts/${testPost.id}/bookmark`, { method: 'POST', headers: headersA }).then(r => r.json());
    assert(bmRes.success === true, 'Toggle bookmark succeeds');

    const savedCheck = await fetch(`${BASE_URL}/api/user/saved`, { headers: headersA }).then(r => r.json());
    assert(savedCheck.savedPosts.some(p => p.id === testPost.id), 'Saved post appears in /api/user/saved');

    // Unbookmark
    await fetch(`${BASE_URL}/api/posts/${testPost.id}/bookmark`, { method: 'POST', headers: headersA });
  }

  console.log('\n====================================================');
  console.log(`AUDIT RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log('====================================================\n');
}

runAudit().catch(console.error);
