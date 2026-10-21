const express = require('express');
const router = express.Router();
const db = require('../config/db');
const Order = require('../models/Order');

router.get('/orders', async (req, res) => {
  try {
    const localDb = db.getLocalDb();
    const localOrders = Array.isArray(localDb.orders) ? localDb.orders : [];

    let databaseOrders = [];
    try {
      databaseOrders = await Order.findAll();
      if (db.isPgConnected()) {
        await Promise.all(databaseOrders.map(async (order) => {
          if (!Array.isArray(order.items) || order.items.length === 0) {
            try {
              order.items = await Order.getOrderItems(order.id);
            } catch (itemsError) {
              console.warn('Unable to load order items for order', order.id, itemsError.message);
              order.items = [];
            }
          }
        }));
      }
    } catch (dbError) {
      console.warn('Using local order storage fallback because the server order query failed:', dbError.message);
      databaseOrders = [];
    }

    const ordersById = new Map();

    [...localOrders, ...databaseOrders].forEach(order => {
      if (!order || (!order.id && !order.order_number)) return;

      const normalizedOrder = {
        id: order.id,
        order_number: order.order_number,
        restaurant_id: order.restaurant_id || 1,
        subtotal: Number(order.subtotal) || 0,
        tax_amount: Number(order.tax_amount) || 0,
        discount_amount: Number(order.discount_amount ?? order.discount) || 0,
        created_at: order.created_at || order.date,
        date: order.date || order.created_at,
        table_id: order.table_id,
        table_name: order.table_name || 'Takeaway',
        customer_name: order.customer_name
          || (typeof order.customer === 'string' ? order.customer : order.customer?.name)
          || 'Walk-in',
        staff_name: order.staff_name || order.cashier || order.employee_id || '—',
        total_amount: Number(order.total_amount ?? order.total) || 0,
        status: order.status || 'Completed',
        payment_method: order.payment_method || '—',
        cash_amount: Number(order.cash_amount) || 0,
        card_amount: Number(order.card_amount) || 0,
        business_type: order.business_type || 'restaurant',
        items: Array.isArray(order.items) ? order.items.map(item => ({
          id: item.id || item.item_id,
          name: item.name || item.item_name || item.product_name || 'Menu item',
          quantity: Number(item.quantity) || 0,
          price: Number(item.price) || 0
        })) : [],
        source: 'server'
      };
      ordersById.set(String(normalizedOrder.id), normalizedOrder);
    });

    const orders = [...ordersById.values()]
      .sort((a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0));
    res.json(orders);
  } catch (error) {
    console.error('Get stored order history error:', error);
    const localOrders = Array.isArray(db.getLocalDb().orders) ? db.getLocalDb().orders : [];
    res.json(localOrders.map(order => ({
      ...order,
      id: order.id,
      order_number: order.order_number,
      created_at: order.created_at || order.date,
      date: order.date || order.created_at,
      table_name: order.table_name || 'Takeaway',
      customer_name: order.customer_name || 'Walk-in',
      total_amount: Number(order.total_amount ?? order.total) || 0,
      status: order.status || 'Completed',
      payment_method: order.payment_method || '—',
      items: Array.isArray(order.items) ? order.items : [],
      source: 'server'
    })));
  }
});

// 1. GET STORAGE STATUS
router.get('/status', (req, res) => {
  const localDb = db.getLocalDb();
  res.json({
    status: 'online',
    storage_engine: db.getStorageType(),
    is_cloud_connected: db.isPgConnected(),
    stats: {
      items_count: localDb.items?.length || 0,
      categories_count: localDb.categories?.length || 0,
      tables_count: localDb.tables?.length || 0,
      orders_count: localDb.orders?.length || 0,
      shifts_count: localDb.shifts?.length || 0
    },
    timestamp: new Date().toISOString()
  });
});

// 2. POST SYNC QUEUED DATA FROM CLIENT TERMINALS
router.post('/sync', (req, res) => {
  try {
    const { items = [] } = req.body;
    const localDb = db.getLocalDb();
    let syncedCount = 0;

    for (const queueItem of items) {
      if (queueItem.type === 'order' && queueItem.data) {
        if (!localDb.orders) localDb.orders = [];
        localDb.orders.unshift(queueItem.data);
        syncedCount++;
      } else if (queueItem.type === 'shift_close' && queueItem.data) {
        if (!localDb.shifts) localDb.shifts = [];
        localDb.shifts.unshift(queueItem.data);
        syncedCount++;
      }
    }

    db.saveLocalDb();
    res.json({
      success: true,
      message: `Successfully synchronized ${syncedCount} records with server storage.`,
      synced: syncedCount,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Storage sync error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. GET FULL SYSTEM BACKUP (.JSON)
router.get('/backup', (req, res) => {
  try {
    const localDb = db.getLocalDb();
    const backupPayload = {
      version: '2.0.0-ADVANCED',
      system: 'SIVARA Restaurant & Supermarket POS',
      export_date: new Date().toISOString(),
      storage_engine: db.getStorageType(),
      data: localDb
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=pos_server_backup_${Date.now()}.json`);
    res.json(backupPayload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. POST RESTORE SYSTEM BACKUP (.JSON)
router.post('/restore', (req, res) => {
  try {
    const backupData = req.body.data || req.body;
    if (!backupData.items && !backupData.categories) {
      return res.status(400).json({ error: 'Invalid backup structure. Missing items or categories.' });
    }

    db.setLocalDb(backupData);
    res.json({ success: true, message: 'Server database restored successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
