const db = require('../config/db');

const Activity = {
  async findAll(filters = {}) {
    // Local JSON mode: the SQL emulator cannot join users, so hydrate
    // usernames and apply filters in memory.
    if (!db.isPgConnected()) {
      const state = db.getLocalDb();
      let rows = (state.activities || []).map(activity => ({
        ...activity,
        username: (state.users || []).find(user => Number(user.id) === Number(activity.user_id))?.username || 'Unknown',
      }));
      if (filters.user_id) rows = rows.filter(row => Number(row.user_id) === Number(filters.user_id));
      if (filters.start_date) rows = rows.filter(row => new Date(row.created_at) >= new Date(filters.start_date));
      if (filters.end_date) rows = rows.filter(row => new Date(row.created_at) <= new Date(filters.end_date));
      rows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      return rows.slice(0, 500);
    }

    let query = `
      SELECT a.*, u.username 
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (filters.user_id) {
      query += ` AND a.user_id = $${paramIndex++}`;
      params.push(filters.user_id);
    }
    if (filters.restaurant_id) {
      query += ` AND a.restaurant_id = $${paramIndex++}`;
      params.push(filters.restaurant_id);
    }
    if (filters.start_date) {
      query += ` AND a.created_at >= $${paramIndex++}`;
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ` AND a.created_at <= $${paramIndex++}`;
      params.push(filters.end_date);
    }

    query += ' ORDER BY a.created_at DESC LIMIT 500';
    const result = await db.query(query, params);
    return result.rows;
  },

  async create(data) {
    const { user_id, restaurant_id, action, details } = data;
    const result = await db.query(
      `INSERT INTO activities (user_id, restaurant_id, action, details)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, restaurant_id, action, details]
    );
    return result.rows[0];
  }
};

module.exports = Activity;
