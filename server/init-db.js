const fs = require('fs');
const path = require('path');
const { pool } = require('./config/db');

async function initDatabase() {
  try {
    console.log('Initializing database...');
    
    const sqlFile = path.join(__dirname, '..', 'database', 'migrations', '001_initial_schema.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    await pool.query(sql);
    
    console.log('Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

initDatabase();
