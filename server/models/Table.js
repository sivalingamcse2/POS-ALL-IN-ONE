const db = require('../config/db');

const Table = {
  async findAll(restaurantId) {
    // Force restaurantId to integer, default to 1 if missing
    const rId = parseInt(restaurantId) || 1;
    const result = await db.query(
      `SELECT t.*, 
              (SELECT COUNT(*) FROM orders o WHERE o.table_id = t.id AND o.status IN ('open', 'Held', 'Pending', 'Preparing')) as active_orders
       FROM tables t
       WHERE t.restaurant_id = $1
       ORDER BY t.table_name`,
      [rId]
    );
    return result.rows;
  },

  async findById(id) {
    const result = await db.query('SELECT * FROM tables WHERE id = $1', [id]);
    return result.rows[0];
  },

  async create(data) {
    const { table_name, capacity, restaurant_id, status } = data;
    const result = await db.query(
      `INSERT INTO tables (table_name, capacity, restaurant_id, status)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [table_name, capacity || 4, restaurant_id, status || 'available']
    );
    return result.rows[0];
  },

  async update(id, data) {
    const { table_name, capacity, status } = data;
    const result = await db.query(
      `UPDATE tables SET table_name = $1, capacity = $2, status = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [table_name, capacity, status, id]
    );
    return result.rows[0];
  },

  async updateStatus(id, status) {
    const result = await db.query(
      'UPDATE tables SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await db.query('DELETE FROM tables WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
};

module.exports = Table;
