require('dotenv').config();

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('[Database] DATABASE_URL is missing');
}

const pool = new Pool({
  connectionString,

  max: Number(process.env.DB_MAX_CONNECTIONS || 4),

  idleTimeoutMillis: Number(
    process.env.DB_IDLE_TIMEOUT_MS || 30000
  ),

  connectionTimeoutMillis: Number(
    process.env.DB_CONNECTION_TIMEOUT_MS || 30000
  ),

  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,

  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]:', err.message);
});

async function query(text, params, retries = 2) {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (err) {
    if (retries > 0 && (err.code === 'ECONNRESET' || err.message?.includes('Connection terminated') || err.message?.includes('closed unexpectedly'))) {
      await new Promise(r => setTimeout(r, 600));
      return query(text, params, retries - 1);
    }
    console.error('[Database Query Failed]:', {
      text,
      error: err.message,
      code: err.code
    });

    throw err;
  }
}

async function withTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');

    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function testDatabaseConnection() {
  try {
    const result = await pool.query('SELECT NOW() AS now');

    console.log(
      '[Database] Connected successfully:',
      result.rows[0].now
    );

    return true;
  } catch (err) {
    console.error(
      '[Database] Connection FAILED:',
      err.message
    );

    return false;
  }
}

module.exports = {
  pool,
  query,
  withTransaction,
  testDatabaseConnection
};