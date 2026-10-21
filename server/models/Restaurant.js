const db = require('../config/db');

const Restaurant = {
  async findAll() {
    const result = await db.query('SELECT * FROM restaurants ORDER BY name');
    return result.rows;
  },

  async findById(id) {
    const result = await db.query('SELECT * FROM restaurants WHERE id = $1', [id]);
    return result.rows[0];
  },

  async create(data) {
    const result = await db.query(
      `INSERT INTO restaurants (
         name, address, currency, tax_rate, phone, email, business_type,
         website, manager_name, operating_hours, seating_capacity
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        data.name,
        data.address || '',
        data.currency || 'USD',
        data.tax_rate ?? 0,
        data.phone || '',
        data.email || '',
        data.business_type || 'restaurant',
        data.website || '',
        data.manager_name || '',
        data.operating_hours || '',
        data.seating_capacity ?? 0,
      ]
    );
    return result.rows[0];
  },

  async update(id, data) {
    const result = await db.query(
      `UPDATE restaurants SET
         name = $1, address = $2, currency = $3, tax_rate = $4, phone = $5,
         email = $6, business_type = $7, website = $8, manager_name = $9,
         operating_hours = $10, seating_capacity = $11, updated_at = NOW()
       WHERE id = $12 RETURNING *`,
      [
        data.name,
        data.address || '',
        data.currency || 'USD',
        data.tax_rate ?? 0,
        data.phone || '',
        data.email || '',
        data.business_type || 'restaurant',
        data.website || '',
        data.manager_name || '',
        data.operating_hours || '',
        data.seating_capacity ?? 0,
        id,
      ]
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await db.query('DELETE FROM restaurants WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
};

module.exports = Restaurant;
