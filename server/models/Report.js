const db = require('../config/db');

const Report = {
  async getDailySales(restaurantId, date) {
    const result = await db.query(
      `SELECT 
         DATE(o.created_at) as date,
         COUNT(*) as total_orders,
         SUM(o.subtotal) as subtotal,
         SUM(o.tax_amount) as total_tax,
         SUM(o.discount_amount) as total_discount,
         SUM(o.total_amount) as total_sales
       FROM orders o
       WHERE o.restaurant_id = $1 
         AND DATE(o.created_at) = $2
         AND LOWER(o.status) = 'paid'
       GROUP BY DATE(o.created_at)`,
      [restaurantId, date]
    );
    return result.rows[0] || { date, total_orders: 0, subtotal: 0, total_tax: 0, total_discount: 0, total_sales: 0 };
  },

  async getMonthlySales(restaurantId, year, month) {
    const result = await db.query(
      `SELECT 
         DATE(o.created_at) as date,
         COUNT(*) as total_orders,
         SUM(o.total_amount) as total_sales
       FROM orders o
       WHERE o.restaurant_id = $1 
         AND EXTRACT(YEAR FROM o.created_at) = $2
         AND EXTRACT(MONTH FROM o.created_at) = $3
         AND LOWER(o.status) = 'paid'
       GROUP BY DATE(o.created_at)
       ORDER BY date`,
      [restaurantId, year, month]
    );
    return result.rows;
  },

  async getSalesRange(restaurantId, startDate, endDate) {
    const result = await db.query(
      `SELECT 
         DATE(o.created_at) as date,
         COUNT(*) as total_orders,
         SUM(o.subtotal) as subtotal,
         SUM(o.tax_amount) as total_tax,
         SUM(o.discount_amount) as total_discount,
         SUM(o.total_amount) as total_sales
       FROM orders o
       WHERE o.restaurant_id = $1 
         AND DATE(o.created_at) BETWEEN $2 AND $3
         AND LOWER(o.status) = 'paid'
       GROUP BY DATE(o.created_at)
       ORDER BY date`,
      [restaurantId, startDate, endDate]
    );
    return result.rows;
  },

  async getItemSales(restaurantId, startDate, endDate) {
    const result = await db.query(
      `SELECT 
         i.id as item_id,
         i.name as item_name,
         c.name as category_name,
         SUM(oi.quantity) as total_quantity,
         SUM(oi.quantity * oi.price) as total_revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN items i ON oi.item_id = i.id
       LEFT JOIN categories c ON i.category_id = c.id
       WHERE o.restaurant_id = $1 
         AND DATE(o.created_at) BETWEEN $2 AND $3
         AND LOWER(o.status) = 'paid'
       GROUP BY i.id, i.name, c.name
       ORDER BY total_revenue DESC`,
      [restaurantId, startDate, endDate]
    );
    return result.rows;
  },

  async getCategorySales(restaurantId, startDate, endDate) {
    const result = await db.query(
      `SELECT 
         c.id as category_id,
         c.name as category_name,
         SUM(oi.quantity) as total_quantity,
         SUM(oi.quantity * oi.price) as total_revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN items i ON oi.item_id = i.id
       LEFT JOIN categories c ON i.category_id = c.id
       WHERE o.restaurant_id = $1 
         AND DATE(o.created_at) BETWEEN $2 AND $3
         AND LOWER(o.status) = 'paid'
       GROUP BY c.id, c.name
       ORDER BY total_revenue DESC`,
      [restaurantId, startDate, endDate]
    );
    return result.rows;
  },

  async getTaxSummary(restaurantId, startDate, endDate) {
    const result = await db.query(
      `SELECT 
         DATE(o.created_at) as date,
         SUM(o.subtotal) as taxable_amount,
         SUM(o.tax_amount) as tax_collected,
         COUNT(*) as order_count
       FROM orders o
       WHERE o.restaurant_id = $1 
         AND DATE(o.created_at) BETWEEN $2 AND $3
         AND LOWER(o.status) = 'paid'
       GROUP BY DATE(o.created_at)
       ORDER BY date`,
      [restaurantId, startDate, endDate]
    );
    return result.rows;
  },

  async getInventoryReport(restaurantId) {
    const result = await db.query(
      `SELECT 
         i.id as item_id,
         i.name as item_name,
         i.sku,
         c.name as category_name,
         i.cost,
         i.price,
         inv.quantity_available,
         (i.cost * inv.quantity_available) as stock_value
       FROM inventory_stock inv
       JOIN items i ON inv.item_id = i.id
       LEFT JOIN categories c ON i.category_id = c.id
       WHERE inv.restaurant_id = $1
       ORDER BY i.name`,
      [restaurantId]
    );
    return result.rows;
  },

  async getPaymentMethodSummary(restaurantId, startDate, endDate) {
    const result = await db.query(
      `SELECT 
         payment_method,
         COUNT(*) as order_count,
         SUM(total_amount) as total_amount
       FROM orders
       WHERE restaurant_id = $1 
         AND DATE(created_at) BETWEEN $2 AND $3
         AND LOWER(status) = 'paid'
       GROUP BY payment_method
       ORDER BY total_amount DESC`,
      [restaurantId, startDate, endDate]
    );
    return result.rows;
  },

  async getDashboardStats(restaurantId) {
    const today = new Date().toISOString().split('T')[0];
    
    // Today's sales
    const todaySales = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM orders WHERE restaurant_id = $1 AND DATE(created_at) = $2 AND LOWER(status) = 'paid'`,
      [restaurantId, today]
    );

    // Today's orders
    const todayOrders = await db.query(
      `SELECT COUNT(*) as count
       FROM orders WHERE restaurant_id = $1 AND DATE(created_at) = $2`,
      [restaurantId, today]
    );

    // Open orders
    const openOrders = await db.query(
      `SELECT COUNT(*) as count
       FROM orders WHERE restaurant_id = $1 AND status = 'open'`,
      [restaurantId]
    );

    // Low stock items
    const lowStock = await db.query(
      `SELECT COUNT(*) as count
       FROM inventory_stock inv
       JOIN items i ON inv.item_id = i.id
       WHERE inv.restaurant_id = $1 AND i.track_inventory = true AND inv.quantity_available <= 10`,
      [restaurantId]
    );

    return {
      today_sales: parseFloat(todaySales.rows[0].total) || 0,
      today_orders: parseInt(todayOrders.rows[0].count) || 0,
      open_orders: parseInt(openOrders.rows[0].count) || 0,
      low_stock_items: parseInt(lowStock.rows[0].count) || 0
    };
  }
};

module.exports = Report;
