const crypto = require('crypto');
const db = require('../config/db');

const argumentsList = process.argv.slice(2);
const usernameIndex = argumentsList.indexOf('--username');
const username = usernameIndex >= 0 ? argumentsList[usernameIndex + 1] : '';
const localMode = argumentsList.includes('--local');

const main = async () => {
  if (!argumentsList.includes('--confirm') || !username || username.startsWith('--')) {
    throw new Error('Usage: node scripts/bootstrap-admin.js --username <admin-username> [--local] --confirm');
  }

  const appUrl = new URL(process.env.APP_URL || 'http://localhost:8080');
  if (
    appUrl.protocol !== 'https:'
    && !['localhost', '127.0.0.1', '[::1]'].includes(appUrl.hostname)
  ) {
    throw new Error('Set APP_URL to an HTTPS origin before issuing a remote setup link');
  }
  if (appUrl.username || appUrl.password) {
    throw new Error('APP_URL must not contain credentials');
  }
  appUrl.pathname = '/activate';
  appUrl.hash = '';

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  let storageName = 'PostgreSQL';
  let client = null;
  let transactionStarted = false;

  try {
    if (localMode) {
      let postgresReachable = false;
      if (db.pool) {
        try {
          await db.pool.query('SELECT 1');
          postgresReachable = true;
        } catch {
          console.info('PostgreSQL is unavailable; preparing the explicitly requested local bootstrap.');
        }
      }
      if (postgresReachable) {
        throw new Error('PostgreSQL is reachable; omit --local so the account is bootstrapped in the active database');
      }
      const state = db.getLocalDb();
      const adminRole = (state.roles || []).find(role => role.name === 'Admin');
      const adminUser = (state.users || []).find(user => (
        String(user.username || '').toLowerCase() === username.toLowerCase()
        && Number(user.role_id) === Number(adminRole?.id)
      ));
      if (!adminUser) throw new Error(`No local Admin account named "${username}" was found`);
      Object.assign(adminUser, {
        password: null,
        is_active: false,
        account_status: 'pending_activation',
        password_reset_token_hash: tokenHash,
        password_reset_expires_at: expiresAt.toISOString(),
        token_version: (Number(adminUser.token_version) || 0) + 1,
        updated_at: new Date().toISOString(),
      });
      db.saveLocalDb();
      storageName = 'local JSON';
    } else {
      if (!db.pool) throw new Error('PostgreSQL is not configured');
      client = await db.pool.connect();
      await client.query('BEGIN');
      transactionStarted = true;
      const result = await client.query(
        `SELECT u.id
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE LOWER(u.username) = LOWER($1) AND r.name = 'Admin'
         FOR UPDATE OF u`,
        [username]
      );
      if (!result.rows[0]) {
        throw new Error(`No Admin account named "${username}" was found`);
      }
      await client.query(
        `UPDATE users SET password = NULL, is_active = FALSE,
           account_status = 'pending_activation',
           password_reset_token_hash = $1, password_reset_expires_at = $2,
           token_version = token_version + 1, updated_at = NOW()
         WHERE id = $3`,
        [tokenHash, expiresAt, result.rows[0].id]
      );
      await client.query('COMMIT');
      transactionStarted = false;
    }

    appUrl.search = new URLSearchParams({ token }).toString();
    console.log(`Admin access in ${storageName} is pending a new password. Share this one-time link through a trusted channel:`);
    console.log(appUrl.toString());
    console.log(`Expires: ${expiresAt.toISOString()}`);
  } catch (error) {
    if (client && transactionStarted) await client.query('ROLLBACK');
    throw error;
  } finally {
    if (client) client.release();
  }
};

main().then(
  () => db.pool?.end(),
  error => {
    console.error(error.message);
    if (db.pool) db.pool.end();
    process.exitCode = 1;
  }
);
