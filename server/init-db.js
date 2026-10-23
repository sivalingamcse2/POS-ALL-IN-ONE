const fs = require('fs');
const path = require('path');
const { pool } = require('./config/db');

// Applied in order. Each file is sent to Postgres as a single multi-statement
// query so dollar-quoted DO $$ ... $$ blocks are preserved.
const MIGRATIONS = [
  '001_initial_schema.sql',
  '002_hotel_schema.sql',
  '003_user_access_security.sql',
  '004_multi_store_types.sql',
  '005_seed_admin.sql',
];

async function initDatabase() {
  if (!pool) {
    console.error('No PostgreSQL connection configured (set DATABASE_URL or DB_*). Skipping schema init.');
    process.exit(1);
  }

  const dir = path.join(__dirname, '..', 'database', 'migrations');
  try {
    console.log('Initializing database...');
    for (const file of MIGRATIONS) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      console.log(`Applying migration ${file}...`);
      await pool.query(sql);
    }
    console.log('Database initialized successfully!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

initDatabase();
