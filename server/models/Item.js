const db = require('../config/db');

const Item = {
  async findAll(restaurantId, categoryId = null) {
    let query = `
      SELECT i.*, c.name as category_name,
             COALESCE(inv.quantity_available, 0) as stock_quantity
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN inventory_stock inv ON i.id = inv.item_id
      WHERE i.restaurant_id = $1
    `;
    const params = [restaurantId];
    
    if (categoryId) {
      query += ' AND i.category_id = $2';
      params.push(categoryId);
    }
    query += ' ORDER BY c.name, i.name';
    
    const result = await db.query(query, params);
    return result.rows;
  },

  async findById(id) {
    const result = await db.query(
      `SELECT i.*, c.name as category_name,
              COALESCE(inv.quantity_available, 0) as stock_quantity
       FROM items i
       LEFT JOIN categories c ON i.category_id = c.id
       LEFT JOIN inventory_stock inv ON i.id = inv.item_id
       WHERE i.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async create(data) {
    const { name, description, category_id, restaurant_id, price, cost, sku, is_active, track_inventory } = data;
    const result = await db.query(
      `INSERT INTO items (name, description, category_id, restaurant_id, price, cost, sku, is_active, track_inventory)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, description, category_id, restaurant_id, price, cost || 0, sku, is_active !== false, track_inventory !== false]
    );
    
    // Initialize inventory stock if tracking
    if (track_inventory !== false) {
      await db.query(
        `INSERT INTO inventory_stock (item_id, restaurant_id, quantity_available)
         VALUES ($1, $2, 0)`,
        [result.rows[0].id, restaurant_id]
      );
    }
    
    return result.rows[0];
  },

  async update(id, data) {
    const { name, description, category_id, price, cost, sku, is_active, track_inventory } = data;
    const result = await db.query(
      `UPDATE items SET name = $1, description = $2, category_id = $3, price = $4, 
       cost = $5, sku = $6, is_active = $7, track_inventory = $8, updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [name, description, category_id, price, cost, sku, is_active, track_inventory, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await db.query('DELETE FROM items WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },

  async getLowStockItems(restaurantId, threshold = 10) {
    const result = await db.query(
      `SELECT i.*, inv.quantity_available
       FROM items i
       JOIN inventory_stock inv ON i.id = inv.item_id
       WHERE i.restaurant_id = $1 AND i.track_inventory = true 
             AND inv.quantity_available <= $2
       ORDER BY inv.quantity_available ASC`,
      [restaurantId, threshold]
    );
    return result.rows;
  }
};

module.exports = Item;
