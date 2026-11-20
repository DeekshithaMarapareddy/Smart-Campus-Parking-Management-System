/**
 * Creates the PostgreSQL database (if needed), applies database/schema.sql,
 * loads demo data, and seeds the MongoDB log collections.
 *
 *   npm run db:setup
 *
 * WARNING: this drops and recreates the "public" schema of DATABASE_URL.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { MongoClient } = require('mongodb');
const { seedPostgres, seedMongo } = require('./seed');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const DATABASE_URL = process.env.DATABASE_URL;
const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

async function ensureDatabase(url) {
  const target = new URL(url);
  const dbName = decodeURIComponent(target.pathname.replace(/^\//, ''));
  if (!dbName) throw new Error('DATABASE_URL must include a database name');

  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`  created database "${dbName}"`);
    } else {
      console.log(`  database "${dbName}" already exists`);
    }
    await client.query(`ALTER DATABASE "${dbName.replace(/"/g, '""')}" SET timezone TO '${TIMEZONE.replace(/'/g, '')}'`);
  } finally {
    await client.end();
  }
}

async function main() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env.local and edit it first.');
    process.exit(1);
  }

  console.log('1/4  Preparing PostgreSQL database');
  await ensureDatabase(DATABASE_URL);

  const pg = new Client({ connectionString: DATABASE_URL });
  await pg.connect();
  try {
    console.log('2/4  Creating tables, indexes, functions, triggers and views');
    const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
    await pg.query(sql);

    console.log('3/4  Loading demo data into PostgreSQL');
    await seedPostgres(pg);

    console.log('4/4  Seeding MongoDB logs');
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.warn('  MONGODB_URI not set, skipping MongoDB seed');
    } else {
      const mongo = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 3000 });
      try {
        await mongo.connect();
        await seedMongo(mongo.db(process.env.MONGODB_DB || 'scpms_logs'), pg);
        console.log('  MongoDB collections ready');
      } catch (err) {
        console.warn(`  Could not reach MongoDB (${err.message}).`);
        console.warn('  The app will still run, but activity and sensor logs will be empty until MongoDB is running.');
        console.warn('  Start MongoDB and run "npm run db:setup" again to seed the logs.');
      } finally {
        await mongo.close().catch(() => {});
      }
    }
  } finally {
    await pg.end();
  }

  console.log('\nDone. Demo logins:');
  console.log('  Admin    admin@scpms.edu       Admin@123');
  console.log('  Staff    ravi.kumar@scpms.edu  Password@123');
  console.log('  Student  ananya@scpms.edu      Password@123');
}

main().catch((err) => {
  console.error('\nSetup failed:', err.message);
  process.exit(1);
});
