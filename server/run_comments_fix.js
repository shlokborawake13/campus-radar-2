require('dotenv').config();
const { query, pool } = require('./db');

async function run() {
  console.log('[Migration] Dropping strict posts foreign key constraint on comments...');
  await query('ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_post_id_fkey;');
  await query('CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);');
  console.log('[Migration] comments_post_id_fkey dropped successfully and index created.');

  // Test insert for confession 9758f9f9-2e9d-4c56-ae06-50b45909f44e
  const user = await query('SELECT id FROM users LIMIT 1');
  const userId = user.rows[0].id;
  const testRes = await query(
    'INSERT INTO comments (author_id, post_id, content, is_anonymous, anonymous_pseudonym) VALUES ($1, $2, $3, true, $4) RETURNING *',
    [userId, '9758f9f9-2e9d-4c56-ae06-50b45909f44e', 'Test reply to confession', 'Anonymous Cardinal']
  );
  console.log('[Migration] Test comment inserted successfully:', testRes.rows[0].id);

  // Clean up test comment
  await query('DELETE FROM comments WHERE id = $1', [testRes.rows[0].id]);
  console.log('[Migration] Test comment cleaned up.');
  await pool.end();
}

run().catch(err => {
  console.error('[Migration Error]:', err);
  process.exit(1);
});
