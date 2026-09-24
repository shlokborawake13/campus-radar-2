require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool, query } = require('./index');

async function applyIndexes() {
  console.log('[Migration 03] Applying performance and security indexes to Supabase PostgreSQL...');
  const sql = fs.readFileSync(path.join(__dirname, '03_performance_and_security_indexes.sql'), 'utf8');

  // Split by semicolon and run each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  for (const stmt of statements) {
    try {
      await query(stmt);
      successCount++;
    } catch (err) {
      console.warn(`[Warning] Stmt: ${stmt.slice(0, 50)}... -> ${err.message}`);
    }
  }

  console.log(`[Migration 03] Completed successfully! Applied ${successCount}/${statements.length} index statements.`);
  await pool.end();
}

applyIndexes().catch(err => {
  console.error('[Migration 03 Error]:', err);
  process.exit(1);
});
