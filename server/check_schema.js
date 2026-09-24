require('dotenv').config();
const { pool } = require('./db');

async function testComment() {
  try {
    const user = await pool.query("SELECT id FROM users LIMIT 1");
    const userId = user.rows[0].id;
    const res = await pool.query(
      "INSERT INTO comments (author_id, post_id, content, is_anonymous) VALUES ($1, $2, $3, $4) RETURNING *",
      [userId, '9758f9f9-2e9d-4c56-ae06-50b45909f44e', 'Test comment on confession', true]
    );
    console.log('Inserted:', res.rows[0]);
  } catch (err) {
    console.error('Insert error:', err.message, err.code);
  } finally {
    await pool.end();
  }
}

testComment();
