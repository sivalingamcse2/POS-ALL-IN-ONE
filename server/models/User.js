const crypto = require('crypto');
const db = require('../config/db');
const bcrypt = require('bcryptjs');

const publicUserFields = `
  id, username, email, full_name, employee_id, role_id, is_active,
  account_status, last_login, created_at, updated_at, token_version
`;

const makeInviteToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const isPostgres = () => db.isPgConnected();

const localUser = (user) => {
  if (!user) return null;
  const state = db.getLocalDb();
  const role = (state.roles || []).find(record => Number(record.id) === Number(user.role_id));
  const access = (state.user_restaurant_access || [])
    .filter(record => Number(record.user_id) === Number(user.id));
  const restaurants = access
    .map(record => (state.restaurants || []).find(restaurant => Number(restaurant.id) === Number(record.restaurant_id)))
    .filter(Boolean)
    .map(restaurant => ({
      ...restaurant,
      is_default: access.find(record => Number(record.restaurant_id) === Number(restaurant.id))?.is_default || false,
    }));
  const {
    password,
    password_reset_token_hash,
    password_reset_expires_at,
    ...safeUser
  } = user;
  return {
    ...safeUser,
    role_name: role?.name || null,
    permissions: role?.permissions || {},
    restaurant_ids: restaurants.map(restaurant => Number(restaurant.id)),
    restaurants,
    restaurant_name: restaurants.map(restaurant => restaurant.name).join(', '),
  };
};

const User = {
  async findAll(restaurantId = null) {
    if (!isPostgres()) {
      const state = db.getLocalDb();
      return (state.users || [])
        .filter(user => !restaurantId || (state.user_restaurant_access || []).some(access => (
          Number(access.user_id) === Number(user.id)
          && Number(access.restaurant_id) === Number(restaurantId)
        )))
        .map(localUser);
    }
    const result = await db.query(
      `SELECT u.${publicUserFields.split(', ').join(', u.')},
              r.name AS role_name, r.permissions,
              COALESCE(access.restaurants, '[]'::json) AS restaurants,
              COALESCE(access.restaurant_ids, ARRAY[]::INTEGER[]) AS restaurant_ids,
              COALESCE(access.restaurant_name, '') AS restaurant_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object(
                  'id', restaurant.id, 'name', restaurant.name, 'is_default', ura.is_default
                ) ORDER BY ura.is_default DESC, restaurant.name) AS restaurants,
                array_agg(ura.restaurant_id ORDER BY ura.is_default DESC, restaurant.name) AS restaurant_ids,
                string_agg(restaurant.name, ', ' ORDER BY ura.is_default DESC, restaurant.name) AS restaurant_name
         FROM user_restaurant_access ura
         JOIN restaurants restaurant ON restaurant.id = ura.restaurant_id
         WHERE ura.user_id = u.id
       ) access ON TRUE
       WHERE ($1::INTEGER IS NULL OR EXISTS (
         SELECT 1 FROM user_restaurant_access filter_access
         WHERE filter_access.user_id = u.id AND filter_access.restaurant_id = $1
       ))
       ORDER BY u.username`,
      [restaurantId ? Number(restaurantId) : null]
    );
    return result.rows;
  },

  async findById(id) {
    if (!isPostgres()) {
      return localUser((db.getLocalDb().users || []).find(user => Number(user.id) === Number(id)));
    }
    const result = await db.query(
      `SELECT u.${publicUserFields.split(', ').join(', u.')},
              r.name AS role_name, r.permissions,
              COALESCE(access.restaurants, '[]'::json) AS restaurants,
              COALESCE(access.restaurant_ids, ARRAY[]::INTEGER[]) AS restaurant_ids,
              COALESCE(access.restaurant_name, '') AS restaurant_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object(
                  'id', restaurant.id, 'name', restaurant.name, 'is_default', ura.is_default
                ) ORDER BY ura.is_default DESC, restaurant.name) AS restaurants,
                array_agg(ura.restaurant_id ORDER BY ura.is_default DESC, restaurant.name) AS restaurant_ids,
                string_agg(restaurant.name, ', ' ORDER BY ura.is_default DESC, restaurant.name) AS restaurant_name
         FROM user_restaurant_access ura
         JOIN restaurants restaurant ON restaurant.id = ura.restaurant_id
         WHERE ura.user_id = u.id
       ) access ON TRUE
       WHERE u.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async findByUsername(identifier) {
    const normalized = String(identifier || '').trim().toLowerCase();
    if (!isPostgres()) {
      const state = db.getLocalDb();
      const found = (state.users || []).find(user => (
        String(user.username || '').toLowerCase() === normalized
        || String(user.email || '').toLowerCase() === normalized
        || String(user.employee_id || '').toLowerCase() === normalized
      ));
      if (!found) return null;
      return {
        ...localUser(found),
        password: found.password,
        password_reset_token_hash: found.password_reset_token_hash,
      };
    }
    const result = await db.query(
      `SELECT u.*, r.name AS role_name, r.permissions
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE LOWER(u.username) = $1
          OR LOWER(u.email) = $1
          OR LOWER(u.employee_id) = $1
       LIMIT 1`,
      [normalized]
    );
    return result.rows[0] || null;
  },

  async getRestaurants(userId) {
    if (!isPostgres()) {
      const state = db.getLocalDb();
      const links = (state.user_restaurant_access || []).filter(access => Number(access.user_id) === Number(userId));
      return links.map(link => ({
        ...(state.restaurants || []).find(restaurant => Number(restaurant.id) === Number(link.restaurant_id)),
        is_default: Boolean(link.is_default),
      })).filter(restaurant => restaurant.id);
    }
    const result = await db.query(
      `SELECT r.*, ura.is_default
       FROM restaurants r
       JOIN user_restaurant_access ura ON r.id = ura.restaurant_id
       WHERE ura.user_id = $1
       ORDER BY ura.is_default DESC, r.name`,
      [userId]
    );
    return result.rows;
  },

  async create(data) {
    const invitationToken = makeInviteToken();
    const tokenHash = hashToken(invitationToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const username = String(data.username).trim().toLowerCase();
    const email = String(data.email || '').trim().toLowerCase();
    const employeeId = String(data.employee_id).trim();
    const restaurantIds = [...new Set(data.restaurant_ids.map(Number))];

    if (!isPostgres()) {
      const state = db.getLocalDb();
      state.users ||= [];
      state.user_restaurant_access ||= [];
      const user = {
        id: Math.max(0, ...state.users.map(record => Number(record.id) || 0)) + 1,
        username,
        email,
        full_name: String(data.full_name).trim(),
        employee_id: employeeId,
        role_id: Number(data.role_id),
        password: null,
        is_active: false,
        account_status: 'pending_activation',
        token_version: 0,
        password_reset_token_hash: tokenHash,
        password_reset_expires_at: expiresAt,
        created_at: new Date().toISOString(),
      };
      if (state.users.some(record => String(record.username || '').toLowerCase() === username)) {
        const error = new Error('Username already exists');
        error.code = '23505';
        throw error;
      }
      if (state.users.some(record => record.employee_id && String(record.employee_id).toLowerCase() === employeeId.toLowerCase())) {
        const error = new Error('Employee ID already exists');
        error.code = '23505';
        throw error;
      }
      if (email && state.users.some(record => record.email?.toLowerCase() === email)) {
        const error = new Error('Email already exists');
        error.code = '23505';
        throw error;
      }
      state.users.push(user);
      restaurantIds.forEach((restaurantId, index) => state.user_restaurant_access.push({
        id: Math.max(0, ...(state.user_restaurant_access || []).map(record => Number(record.id) || 0)) + 1,
        user_id: user.id,
        restaurant_id: restaurantId,
        is_default: index === 0,
      }));
      db.saveLocalDb();
      return { user: localUser(user), invitationToken };
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO users (
           username, email, full_name, employee_id, role_id, password, is_active,
           account_status, password_reset_token_hash, password_reset_expires_at
         )
         VALUES ($1, $2, $3, $4, $5, NULL, FALSE, 'pending_activation', $6, $7)
         RETURNING id`,
        [username, email || null, String(data.full_name).trim(), employeeId, data.role_id, tokenHash, expiresAt]
      );
      const userId = result.rows[0].id;
      for (let index = 0; index < restaurantIds.length; index += 1) {
        await client.query(
          `INSERT INTO user_restaurant_access (user_id, restaurant_id, is_default)
           VALUES ($1, $2, $3)`,
          [userId, restaurantIds[index], index === 0]
        );
      }
      await client.query('COMMIT');
      const restaurants = data.restaurants.map((restaurant, index) => ({
        ...restaurant,
        is_default: index === 0,
      }));
      return {
        user: {
          id: userId,
          username,
          email: email || null,
          full_name: String(data.full_name).trim(),
          employee_id: employeeId,
          role_id: Number(data.role_id),
          role_name: data.role_name,
          permissions: data.permissions,
          is_active: false,
          account_status: 'pending_activation',
          token_version: 0,
          restaurant_ids: restaurantIds,
          restaurants,
          restaurant_name: restaurants.map(restaurant => restaurant.name).join(', '),
        },
        invitationToken,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async update(id, data) {
    const newStatus = data.account_status
      || (data.is_active === false ? 'suspended' : data.is_active === true ? 'active' : null);
    if (!isPostgres()) {
      const state = db.getLocalDb();
      const user = (state.users || []).find(record => Number(record.id) === Number(id));
      if (!user) return null;
      const nextUsername = String(data.username ?? user.username).trim().toLowerCase();
      const nextEmail = data.email === undefined ? String(user.email || '').trim().toLowerCase() : String(data.email || '').trim().toLowerCase();
      const nextEmployeeId = data.employee_id === undefined ? String(user.employee_id || '').trim().toLowerCase() : String(data.employee_id || '').trim().toLowerCase();
      const duplicates = state.users.some(record => (
        Number(record.id) !== Number(id)
        && (
          String(record.username || '').toLowerCase() === nextUsername
          || (nextEmail && String(record.email || '').toLowerCase() === nextEmail)
          || (nextEmployeeId && String(record.employee_id || '').toLowerCase() === nextEmployeeId)
        )
      ));
      if (duplicates) {
        const error = new Error('Username, email, or employee ID already exists');
        error.code = '23505';
        throw error;
      }
      Object.assign(user, {
        username: nextUsername,
        email: data.email === undefined ? user.email : nextEmail,
        full_name: data.full_name === undefined ? user.full_name : String(data.full_name).trim(),
        employee_id: data.employee_id === undefined ? user.employee_id : String(data.employee_id).trim(),
        role_id: data.role_id === undefined ? user.role_id : Number(data.role_id),
        token_version: (Number(user.token_version) || 0) + 1,
        updated_at: new Date().toISOString(),
      });
      if (newStatus) {
        user.account_status = newStatus;
        user.is_active = newStatus === 'active';
      }
      if (Array.isArray(data.restaurant_ids)) {
        state.user_restaurant_access = (state.user_restaurant_access || [])
          .filter(access => Number(access.user_id) !== Number(id));
        [...new Set(data.restaurant_ids.map(Number))].forEach((restaurantId, index) => {
          state.user_restaurant_access.push({
            id: Math.max(0, ...state.user_restaurant_access.map(record => Number(record.id) || 0)) + 1,
            user_id: Number(id),
            restaurant_id: restaurantId,
            is_default: index === 0,
          });
        });
      }
      db.saveLocalDb();
      return localUser(user);
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const values = [
        String(data.username).trim().toLowerCase(),
        String(data.email || '').trim().toLowerCase() || null,
        String(data.full_name).trim(),
        String(data.employee_id).trim() || null,
        data.role_id,
        newStatus,
        id,
      ];
      const result = await client.query(
        `UPDATE users SET
           username = $1, email = $2, full_name = $3, employee_id = $4, role_id = $5,
           account_status = COALESCE($6, account_status),
           is_active = CASE WHEN $6 IS NULL THEN is_active ELSE $6 = 'active' END,
           token_version = token_version + 1, updated_at = NOW()
         WHERE id = $7
         RETURNING id`,
        values
      );
      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      if (Array.isArray(data.restaurant_ids)) {
        const restaurantIds = [...new Set(data.restaurant_ids.map(Number))];
        await client.query('DELETE FROM user_restaurant_access WHERE user_id = $1', [id]);
        for (let index = 0; index < restaurantIds.length; index += 1) {
          await client.query(
            `INSERT INTO user_restaurant_access (user_id, restaurant_id, is_default)
             VALUES ($1, $2, $3)`,
            [id, restaurantIds[index], index === 0]
          );
        }
      }
      await client.query('COMMIT');
      return this.findById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async issuePasswordSetup(id) {
    const invitationToken = makeInviteToken();
    const tokenHash = hashToken(invitationToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    if (!isPostgres()) {
      const user = (db.getLocalDb().users || []).find(record => Number(record.id) === Number(id));
      if (!user) return null;
      user.password_reset_token_hash = tokenHash;
      user.password_reset_expires_at = expiresAt;
      user.token_version = (Number(user.token_version) || 0) + 1;
      db.saveLocalDb();
      return { user: localUser(user), invitationToken };
    }
    const result = await db.query(
      `UPDATE users SET password_reset_token_hash = $1,
         password_reset_expires_at = $2, token_version = token_version + 1,
         updated_at = NOW()
       WHERE id = $3 RETURNING id`,
      [tokenHash, expiresAt, id]
    );
    if (!result.rows[0]) return null;
    return { userId: id, invitationToken };
  },

  async activateWithToken(token, password) {
    const tokenHash = hashToken(token);
    if (!isPostgres()) {
      const user = (db.getLocalDb().users || []).find(record => (
        record.password_reset_token_hash === tokenHash
        && new Date(record.password_reset_expires_at) > new Date()
      ));
      if (!user) return null;
      const hashedPassword = await bcrypt.hash(password, 12);
      user.password = hashedPassword;
      if (!user.account_status || user.account_status === 'pending_activation') {
        user.is_active = true;
        user.account_status = 'active';
      }
      user.password_reset_token_hash = null;
      user.password_reset_expires_at = null;
      user.token_version = (Number(user.token_version) || 0) + 1;
      db.saveLocalDb();
      return localUser(user);
    }
    const eligible = await db.query(
      `SELECT id FROM users
       WHERE password_reset_token_hash = $1
         AND password_reset_expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );
    if (!eligible.rows[0]) return null;
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await db.query(
      `UPDATE users SET password = $1,
         is_active = CASE WHEN account_status = 'pending_activation' THEN TRUE ELSE is_active END,
         account_status = CASE WHEN account_status = 'pending_activation' THEN 'active' ELSE account_status END,
         password_reset_token_hash = NULL, password_reset_expires_at = NULL,
         token_version = token_version + 1, updated_at = NOW()
       WHERE password_reset_token_hash = $2
         AND password_reset_expires_at > NOW()
       RETURNING id`,
      [hashedPassword, tokenHash]
    );
    return result.rows[0] ? { id: result.rows[0].id } : null;
  },

  async updatePassword(id, password) {
    const hashedPassword = await bcrypt.hash(password, 12);
    if (!isPostgres()) {
      const user = (db.getLocalDb().users || []).find(record => Number(record.id) === Number(id));
      if (!user) return null;
      user.password = hashedPassword;
      user.token_version = (Number(user.token_version) || 0) + 1;
      user.password_reset_token_hash = null;
      user.password_reset_expires_at = null;
      user.updated_at = new Date().toISOString();
      db.saveLocalDb();
      return localUser(user);
    }
    const result = await db.query(
      `UPDATE users SET password = $1, password_reset_token_hash = NULL,
         password_reset_expires_at = NULL, token_version = token_version + 1,
         updated_at = NOW()
       WHERE id = $2 RETURNING id`,
      [hashedPassword, id]
    );
    return result.rows[0] || null;
  },

  async updateLastLogin(id) {
    if (!isPostgres()) {
      const user = (db.getLocalDb().users || []).find(record => Number(record.id) === Number(id));
      if (user) {
        user.last_login = new Date().toISOString();
        db.saveLocalDb();
      }
      return;
    }
    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [id]);
  },

  async delete(id) {
    if (!isPostgres()) {
      const user = (db.getLocalDb().users || []).find(record => Number(record.id) === Number(id));
      if (!user) return null;
      user.account_status = 'suspended';
      user.is_active = false;
      user.token_version = (Number(user.token_version) || 0) + 1;
      user.password_reset_token_hash = null;
      user.password_reset_expires_at = null;
      user.updated_at = new Date().toISOString();
      db.saveLocalDb();
      return localUser(user);
    }
    const result = await db.query(
      `UPDATE users SET account_status = 'suspended', is_active = FALSE,
         password_reset_token_hash = NULL, password_reset_expires_at = NULL,
         token_version = token_version + 1, updated_at = NOW()
       WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  },

  async verifyPassword(plainPassword, hashedPassword) {
    return Boolean(hashedPassword) && bcrypt.compare(plainPassword, hashedPassword);
  },

  hashToken,
};

module.exports = User;
