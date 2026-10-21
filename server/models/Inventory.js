const db = require('../config/db');

const Inventory = {
  async getStock(restaurantId) {
    const result = await db.query(
      `SELECT inv.*, i.name as item_name, i.sku, c.name as category_name
       FROM inventory_stock inv
       JOIN items i ON inv.item_id = i.id
       LEFT JOIN categories c ON i.category_id = c.id
       WHERE inv.restaurant_id = $1
       ORDER BY i.name`,
      [restaurantId]
    );
    return result.rows;
  },

  async getStockByItem(itemId) {
    const result = await db.query(
      'SELECT * FROM inventory_stock WHERE item_id = $1',
      [itemId]
    );
    return result.rows[0];
  },

  async updateStock(itemId, quantity) {
    const result = await db.query(
      `UPDATE inventory_stock SET quantity_available = $1, updated_at = NOW()
       WHERE item_id = $2 RETURNING *`,
      [quantity, itemId]
    );
    return result.rows[0];
  },

  async adjustStock(itemId, adjustment) {
    const result = await db.query(
      `UPDATE inventory_stock SET quantity_available = quantity_available + $1, updated_at = NOW()
       WHERE item_id = $2 RETURNING *`,
      [adjustment, itemId]
    );
    return result.rows[0];
  },

  async createTransaction(data) {
    const { item_id, restaurant_id, txn_type, quantity, notes, user_id } = data;
    const result = await db.query(
      `INSERT INTO inventory_transactions (item_id, restaurant_id, txn_type, quantity, notes, user_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [item_id, restaurant_id, txn_type, quantity, notes, user_id]
    );

    // Update stock based on transaction type
    if (txn_type === 'in') {
      await this.adjustStock(item_id, quantity);
    } else if (txn_type === 'out') {
      await this.adjustStock(item_id, -quantity);
    } else if (txn_type === 'adjust') {
      await this.updateStock(item_id, quantity);
    }

    return result.rows[0];
  },

  async getTransactions(filters = {}) {
    let query = `
      SELECT it.*, i.name as item_name, u.username
       FROM inventory_transactions it
       JOIN items i ON it.item_id = i.id
       LEFT JOIN users u ON it.user_id = u.id
       WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (filters.restaurant_id) {
      query += ` AND it.restaurant_id = $${paramIndex++}`;
      params.push(filters.restaurant_id);
    }
    if (filters.item_id) {
      query += ` AND it.item_id = $${paramIndex++}`;
      params.push(filters.item_id);
    }
    if (filters.txn_type) {
      query += ` AND it.txn_type = $${paramIndex++}`;
      params.push(filters.txn_type);
    }
    if (filters.start_date) {
      query += ` AND it.created_at >= $${paramIndex++}`;
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ` AND it.created_at <= $${paramIndex++}`;
      params.push(filters.end_date);
    }

    query += ' ORDER BY it.created_at DESC LIMIT 500';
    const result = await db.query(query, params);
    return result.rows;
  },

  async decrementStockForOrder(orderItems) {
    for (const item of orderItems) {
      // Check if item tracks inventory
      const itemInfo = await db.query(
        'SELECT track_inventory FROM items WHERE id = $1',
        [item.item_id]
      );
      if (itemInfo.rows[0]?.track_inventory) {
        await this.adjustStock(item.item_id, -item.quantity);
      }
    }
  }
};

module.exports = Inventory;
