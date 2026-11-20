import pg from 'pg';

// Return dates / times as plain strings and numbers as JS numbers
pg.types.setTypeParser(1082, (v) => v); // DATE  -> 'YYYY-MM-DD'
pg.types.setTypeParser(1083, (v) => v.slice(0, 5)); // TIME  -> 'HH:MM'
pg.types.setTypeParser(1700, (v) => parseFloat(v)); // NUMERIC
pg.types.setTypeParser(20, (v) => parseInt(v, 10)); // BIGINT (COUNT)

const globalForPg = globalThis;

export const pool =
  globalForPg.__scpmsPool ||
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== 'production') globalForPg.__scpmsPool = pool;

export function query(text, params) {
  return pool.query(text, params);
}

/**
 * Runs fn(client) inside BEGIN ... COMMIT. Any error rolls everything back.
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
