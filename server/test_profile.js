require('dotenv').config();
const http = require('http');
const { query } = require('./db');
const { createSession } = require('./security');

async function test() {
  const uRes = await query("SELECT id, public_profile_id, email, role FROM users WHERE role = 'student' LIMIT 1");
  const user = uRes.rows[0];
  const session = createSession(user, { headers: {} });

  const start = Date.now();
  const req = http.request(`http://127.0.0.1:5001/api/profiles/${user.public_profile_id}`, {
    headers: { Authorization: `Bearer ${session.token}` }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      console.log('Status:', res.statusCode, 'Time:', Date.now() - start, 'ms');
      console.log('Body length:', d.length);
      process.exit(0);
    });
  });
  req.end();
}

test();
