const db = require('../config/db');

const Category = {
  async findAll(restaurantId) {
    const result = await db.query(
      'SELECT * FROM categories WHERE restaurant_id = $1 ORDER BY name',
      [restaurantId]
    );
    return result.rows;
  },

  async findById(id) {
    const result = await db.query('SELECT * FROM categories WHERE id = $1', [id]);
    return result.rows[0];
  },

  async create(data) {
    const { name, description, restaurant_id } = data;
    const result = await db.query(
      `INSERT INTO categories (name, description, restaurant_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, description, restaurant_id]
    );
    return result.rows[0];
  },

  async update(id, data) {
    const { name, description } = data;
    const result = await db.query(
      `UPDATE categories SET name = $1, description = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [name, description, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await db.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
};

module.exports = Category;
