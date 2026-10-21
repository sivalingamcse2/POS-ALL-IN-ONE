const db = require('../config/db');

const Role = {
  async findAll() {
    const result = await db.query('SELECT * FROM roles ORDER BY name');
    return result.rows;
  },

  async findById(id) {
    const result = await db.query('SELECT * FROM roles WHERE id = $1', [id]);
    return result.rows[0];
  },

  async findByName(name) {
    const result = await db.query('SELECT * FROM roles WHERE name = $1', [name]);
    return result.rows[0];
  },

  async create(data) {
    const { name, permissions } = data;
    if (!db.isPgConnected()) {
      const state = db.getLocalDb();
      state.roles ||= [];
      if (state.roles.some(role => role.name.toLowerCase() === name.trim().toLowerCase())) {
        const error = new Error('Role name already exists');
        error.code = '23505';
        throw error;
      }
      const role = {
        id: Math.max(0, ...state.roles.map(record => Number(record.id) || 0)) + 1,
        name: name.trim(),
        permissions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.roles.push(role);
      db.saveLocalDb();
      return role;
    }
    const result = await db.query(
      `INSERT INTO roles (name, permissions) VALUES ($1, $2) RETURNING *`,
      [name, JSON.stringify(permissions)]
    );
    return result.rows[0];
  },

  async update(id, data) {
    const { name, permissions } = data;
    if (!db.isPgConnected()) {
      const state = db.getLocalDb();
      const role = (state.roles || []).find(record => Number(record.id) === Number(id));
      if (!role) return null;
      const duplicate = state.roles.find(record => (
        Number(record.id) !== Number(id)
        && record.name.toLowerCase() === name.trim().toLowerCase()
      ));
      if (duplicate) {
        const error = new Error('Role name already exists');
        error.code = '23505';
        throw error;
      }
      role.name = name.trim();
      role.permissions = permissions;
      role.updated_at = new Date().toISOString();
      db.saveLocalDb();
      return role;
    }
    const result = await db.query(
      `UPDATE roles SET name = $1, permissions = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [name, JSON.stringify(permissions), id]
    );
    return result.rows[0];
  },

  async delete(id) {
    if (!db.isPgConnected()) {
      const state = db.getLocalDb();
      const role = (state.roles || []).find(record => Number(record.id) === Number(id));
      if (!role) return null;
      if (role.name === 'Admin' || (state.users || []).some(user => Number(user.role_id) === Number(id))) {
        const error = new Error('Cannot delete a built-in or assigned role');
        error.code = 'ROLE_IN_USE';
        throw error;
      }
      state.roles = state.roles.filter(record => Number(record.id) !== Number(id));
      db.saveLocalDb();
      return role;
    }
    const result = await db.query(
      `DELETE FROM roles
       WHERE id = $1 AND name <> 'Admin'
         AND NOT EXISTS (SELECT 1 FROM users WHERE role_id = $1)
       RETURNING *`,
      [id]
    );
    if (!result.rows[0]) {
      const existing = await this.findById(id);
      if (existing) {
        const error = new Error('Cannot delete a built-in or assigned role');
        error.code = 'ROLE_IN_USE';
        throw error;
      }
    }
    return result.rows[0];
  }
};

module.exports = Role;
