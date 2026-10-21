const db = require('../config/db');

const Order = {
  async findAll(filters = {}) {
    try {
      let query = `
        SELECT o.*, t.table_name, u.username as staff_name
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.id
        LEFT JOIN users u ON o.user_id = u.id
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (filters.restaurant_id) {
        query += ` AND o.restaurant_id = $${paramIndex++}`;
        params.push(filters.restaurant_id);
      }
      if (filters.status) {
        query += ` AND o.status = $${paramIndex++}`;
        params.push(filters.status);
      }
      if (filters.table_id) {
        query += ` AND o.table_id = $${paramIndex++}`;
        params.push(filters.table_id);
      }
      if (filters.start_date) {
        query += ` AND o.created_at >= $${paramIndex++}`;
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        query += ` AND o.created_at <= $${paramIndex++}`;
        params.push(filters.end_date);
      }

      query += ' ORDER BY o.created_at DESC';
      
      if (filters.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(filters.limit);
      }

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Order.findAll fallback to local storage due to query error:', error.message);
      const localDb = db.getLocalDb();
      const localOrders = Array.isArray(localDb.orders) ? localDb.orders : [];
      return localOrders
        .filter((order) => {
          if (filters.restaurant_id && Number(order.restaurant_id) !== Number(filters.restaurant_id)) return false;
          if (filters.status && String(order.status).toLowerCase() !== String(filters.status).toLowerCase()) return false;
          if (filters.table_id && String(order.table_id) !== String(filters.table_id)) return false;
          return true;
        })
        .map((order) => ({
          ...order,
          table_name: order.table_name || 'Takeaway',
          staff_name: order.staff_name || order.cashier || order.employee_id || 'Admin',
          items: Array.isArray(order.items) ? order.items : []
        }));
    }
  },

  async findById(id) {
    const result = await db.query(
      `SELECT o.*, t.table_name, u.username as staff_name
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByIdWithItems(id) {
    const order = await this.findById(id);
    if (!order) return null;

    const items = await db.query(
      `SELECT oi.*, i.name as item_name
       FROM order_items oi
       JOIN items i ON oi.item_id = i.id
       WHERE oi.order_id = $1`,
      [id]
    );
    order.items = items.rows;
    return order;
  },

  async create(data) {
    const {
      table_id, user_id, restaurant_id, subtotal, tax_amount, discount_amount,
      total_amount, notes, payment_method, status, is_guest_order, customer_name,
      customer_phone, room_number
    } = data;
    const orderStatus = status || 'open';
    const result = await db.query(
      `INSERT INTO orders (
         table_id, user_id, restaurant_id, subtotal, tax_amount, discount_amount,
         total_amount, notes, payment_method, status, is_guest_order, customer_name,
         customer_phone, room_number
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        table_id, user_id, restaurant_id, subtotal || 0, tax_amount || 0,
        discount_amount || 0, total_amount || 0, notes, payment_method,
        orderStatus, is_guest_order || false, customer_name, customer_phone, room_number
      ]
    );
    return result.rows[0];
  },

  async update(id, data) {
    const { subtotal, tax_amount, discount_amount, total_amount, notes, payment_method } = data;
    const result = await db.query(
      `UPDATE orders SET subtotal = $1, tax_amount = $2, discount_amount = $3, 
       total_amount = $4, notes = $5, payment_method = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [subtotal, tax_amount, discount_amount, total_amount, notes, payment_method, id]
    );
    return result.rows[0];
  },

  async updateStatus(id, status) {
    const result = await db.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0];
  },

  async addItem(orderId, itemData) {
    const { item_id, quantity, price, notes } = itemData;
    const result = await db.query(
      `INSERT INTO order_items (order_id, item_id, quantity, price, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [orderId, item_id, quantity, price, notes]
    );
    return result.rows[0];
  },

  async updateItem(orderItemId, data) {
    const { quantity, notes } = data;
    const result = await db.query(
      `UPDATE order_items SET quantity = $1, notes = $2 WHERE id = $3 RETURNING *`,
      [quantity, notes, orderItemId]
    );
    return result.rows[0];
  },

  async removeItem(orderItemId) {
    const result = await db.query('DELETE FROM order_items WHERE id = $1 RETURNING *', [orderItemId]);
    return result.rows[0];
  },

  async getOrderItems(orderId) {
    const result = await db.query(
      `SELECT oi.*, i.name as item_name
       FROM order_items oi
       JOIN items i ON oi.item_id = i.id
       WHERE oi.order_id = $1`,
      [orderId]
    );
    return result.rows;
  },

  async delete(id) {
    await db.query('DELETE FROM order_items WHERE order_id = $1', [id]);
    const result = await db.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
};

module.exports = Order;
