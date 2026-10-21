const db = require('../config/db');
const Table = require('../models/Table');
const Order = require('../models/Order');
const Item = require('../models/Item');
const Inventory = require('../models/Inventory');
const Activity = require('../models/Activity');
const memoryOrders = [];

const isDateWithinRange = (value, startDate, endDate, timeZone) => {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return false;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const dateString = `${parts.find(part => part.type === 'year').value}-${parts.find(part => part.type === 'month').value}-${parts.find(part => part.type === 'day').value}`;
  return dateString >= startDate && dateString <= endDate;
};

const posController = {
  // Tables
  async getAllTables(req, res) {
    try {
      const restaurantId = req.user ? req.user.restaurant_id : (req.headers['x-restaurant-id'] || 1);
      const tables = await Table.findAll(restaurantId);
      res.json(tables);
    } catch (error) {
      console.error('Get tables error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getTableById(req, res) {
    try {
      const table = await Table.findById(req.params.id);
      if (!table) {
        return res.status(404).json({ error: 'Table not found' });
      }
      res.json(table);
    } catch (error) {
      console.error('Get table error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async createTable(req, res) {
    try {
      const table = await Table.create({
        ...req.body,
        restaurant_id: req.user.restaurant_id
      });
      res.status(201).json(table);
    } catch (error) {
      console.error('Create table error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async updateTable(req, res) {
    try {
      const table = await Table.update(req.params.id, req.body);
      if (!table) {
        return res.status(404).json({ error: 'Table not found' });
      }
      res.json(table);
    } catch (error) {
      console.error('Update table error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async deleteTable(req, res) {
    try {
      const table = await Table.delete(req.params.id);
      if (!table) {
        return res.status(404).json({ error: 'Table not found' });
      }
      res.json({ message: 'Table deleted successfully' });
    } catch (error) {
      console.error('Delete table error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Orders
  async getAllOrders(req, res) {
    try {
      // Handle both authenticated users and public access for guest orders
      let restaurantId = 1; // default
      
      if (req.user && req.user.restaurant_id) {
        restaurantId = req.user.restaurant_id;
      } else if (req.headers['x-restaurant-id']) {
        restaurantId = parseInt(req.headers['x-restaurant-id']) || 1;
      }
      
      const filters = {
        restaurant_id: restaurantId,
        status: req.query.status,
        table_id: req.query.table_id,
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        limit: req.query.limit ? parseInt(req.query.limit) : 100
      };
      const orders = await Order.findAll(filters);
      res.json(orders);
    } catch (error) {
      console.error('Get orders error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getKitchenOrders(req, res) {
    const restaurantId = parseInt(req.headers['x-restaurant-id'] || req.query.restaurant_id) || 1;
    const { start_date: startDate, end_date: endDate, timezone = 'UTC' } = req.query;
    const isValidDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value)
      && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
      && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    let isValidTimeZone = true;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      isValidTimeZone = false;
    }

    if ((startDate || endDate) && (!isValidDate(startDate) || !isValidDate(endDate) || !isValidTimeZone)) {
      return res.status(400).json({ error: 'Valid start_date, end_date, and timezone values are required together' });
    }
    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({ error: 'start_date must be on or before end_date' });
    }

    const values = [restaurantId];
    let dateFilter = '';
    let resultLimit = 'LIMIT 100';
    if (startDate && endDate) {
      values.push(startDate, endDate, timezone);
      dateFilter = 'AND o.created_at >= ($2::date::timestamp AT TIME ZONE $4) AND o.created_at < (($3::date + INTERVAL \'1 day\')::timestamp AT TIME ZONE $4)';
      resultLimit = '';
    }

    try {
      const result = await db.query(`
        SELECT o.id, o.restaurant_id, o.table_id, o.status, o.total_amount,
               o.created_at AS date, o.customer_name, o.customer_phone, o.room_number,
               COALESCE(t.table_name, 'Takeaway') AS table_name,
               COALESCE(json_agg(json_build_object(
                 'item_id', oi.item_id, 'item_name', i.name,
                 'quantity', oi.quantity, 'notes', oi.notes
               ) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
        FROM orders o
        LEFT JOIN tables t ON t.id = o.table_id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN items i ON i.id = oi.item_id
        WHERE o.restaurant_id = $1
          AND o.status IN ('Pending', 'Preparing', 'Ready', 'Completed', 'Held', 'open')
          ${dateFilter}
        GROUP BY o.id, t.table_name
        ORDER BY o.created_at ASC
        ${resultLimit}`, values);
      const databaseOrders = result.rows.map(order => ({
        ...order,
        status: order.status === 'Held' || order.status === 'open' ? 'Pending' : order.status,
        items: order.items || []
      }));
      const memoryKitchenOrders = memoryOrders.filter(order => (
        Number(order.restaurant_id) === restaurantId
        && ['Pending', 'Preparing', 'Ready', 'Completed', 'Held', 'open'].includes(order.status)
        && (!startDate || !endDate || isDateWithinRange(order.created_at || order.date, startDate, endDate, timezone))
      )).map(order => ({
        ...order,
        status: order.status === 'Held' || order.status === 'open' ? 'Pending' : order.status
      }));
      const mergedOrders = new Map(memoryKitchenOrders.map(order => [String(order.id), order]));
      databaseOrders.forEach(order => mergedOrders.set(String(order.id), order));
      const kitchenOrders = [...mergedOrders.values()]
        .sort((a, b) => new Date(a.created_at || a.date || 0) - new Date(b.created_at || b.date || 0));
      res.json(kitchenOrders);
    } catch (error) {
      console.error('Get kitchen orders error:', error);
      const fallbackOrders = memoryOrders.filter(order => (
        Number(order.restaurant_id) === restaurantId
        && (!startDate || !endDate || isDateWithinRange(order.created_at || order.date, startDate, endDate, timezone))
      ));
      res.json(fallbackOrders);
    }
  },

  async updateKitchenOrderStatus(req, res) {
    const orderId = Number(req.params.id);
    const { status } = req.body;
    const normalizedStatus = status === 'Ready' ? 'Completed' : status;
    const memoryOrder = memoryOrders.find(order => order.id === orderId);
    if (memoryOrder) {
      memoryOrder.status = normalizedStatus;
      return res.json(memoryOrder);
    }
    try {
      const updatedOrder = await Order.updateStatus(orderId, normalizedStatus);
      if (!updatedOrder) return res.status(404).json({ error: 'Order not found' });
      res.json(updatedOrder);
    } catch (error) {
      console.error('Update kitchen order error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getOrderById(req, res) {
    try {
      const order = await Order.findByIdWithItems(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      res.json(order);
    } catch (error) {
      console.error('Get order error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async createOrder(req, res) {
    console.log('📦 createOrder called with body:', JSON.stringify(req.body));
    try {
      const { items, ...orderData } = req.body;
      const isPublicGuestOrder = req.originalUrl.includes('/api/public/orders/new');
      let restaurantId = req.user ? req.user.restaurant_id : (orderData.restaurant_id || req.headers['x-restaurant-id'] || req.headers['X-Restaurant-Id']);
      
      // Force restaurantId to integer
      restaurantId = parseInt(restaurantId) || 1;

      let validatedItems = items || [];
      if (isPublicGuestOrder) {
        if (!Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ error: 'Add at least one menu item before placing the order.' });
        }
        if (!String(orderData.customer_name || '').trim() || !String(orderData.customer_phone || '').trim()) {
          return res.status(400).json({ error: 'Customer name and mobile number are required.' });
        }
        validatedItems = [];
        for (const item of items) {
          const itemId = Number.parseInt(item.item_id || item.id, 10);
          const quantity = Number.parseInt(item.quantity, 10);
          if (!Number.isInteger(itemId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
            return res.status(400).json({ error: 'The order contains an invalid item or quantity.' });
          }
          const menuItem = await Item.findById(itemId);
          if (!menuItem || Number(menuItem.restaurant_id) !== restaurantId || menuItem.is_active === false) {
            return res.status(400).json({ error: 'One or more selected menu items are no longer available.' });
          }
          validatedItems.push({
            ...item,
            id: menuItem.id,
            item_id: menuItem.id,
            item_name: menuItem.name,
            quantity,
            price: Number(menuItem.price) || 0
          });
        }
        const orderTotal = validatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        orderData.subtotal = orderTotal;
        orderData.total_amount = orderTotal;
        orderData.status = 'Pending';
        orderData.payment_method = orderData.payment_method || 'Cash at counter';
        orderData.customer_name = String(orderData.customer_name).trim();
        orderData.customer_phone = String(orderData.customer_phone).trim();
      }
      
      // Infer restaurant from table if missing
      let validTableId = null;
      if (orderData.table_id) {
        // Ensure table_id is integer for DB search
        const tId = parseInt(orderData.table_id);
        const table = !isNaN(tId) ? await Table.findById(tId) : null;
        
        if (table) {
          validTableId = table.id;
          restaurantId = table.restaurant_id || restaurantId;
        } else {
          // If table ID is invalid (mismatch), try to find by name if provided
          const allTables = await Table.findAll(restaurantId);
          const matchedByName = allTables.find(t => String(t.table_name).toLowerCase() === String(orderData.table_name).toLowerCase());
          if (matchedByName) {
            validTableId = matchedByName.id;
            restaurantId = matchedByName.restaurant_id || restaurantId;
          }
        }
      }

      // Ensure restaurant exists
      const restCheck = await db.query('SELECT id FROM restaurants WHERE id = $1', [restaurantId]);
      if (restCheck.rows.length === 0) {
        console.warn(`⚠️ Restaurant ${restaurantId} not found, defaulting to first available.`);
        const firstRest = await db.query('SELECT id FROM restaurants LIMIT 1');
        if (firstRest.rows.length > 0) restaurantId = firstRest.rows[0].id;
        else {
          // If no restaurants at all, we must create one or fail
          const newRest = await db.query("INSERT INTO restaurants (name, address, currency) VALUES ('SIVARA Signature', 'Hospitality Hub', 'USD') RETURNING id");
          restaurantId = newRest.rows[0].id;
        }
      }

      // Fixed: Properly initialize userId with null fallback
      const userId = req.user ? (req.user.id || null) : null;
      
      let order;
      order = await Order.create({
        ...orderData,
        table_id: validTableId,
        user_id: userId,
        restaurant_id: restaurantId,
        is_guest_order: isPublicGuestOrder || orderData.is_guest_order || false,
        customer_name: orderData.customer_name || 'Guest'
      });

      if (validatedItems.length > 0) {
        for (const item of validatedItems) {
          try {
            // Ensure item_id is valid
            const itemId = parseInt(item.id || item.item_id);
            if (!isNaN(itemId)) {
              await Order.addItem(order.id, {
                item_id: itemId,
                quantity: parseInt(item.quantity) || 1,
                price: parseFloat(item.price) || 0,
                notes: item.notes
              });
            }
          } catch (itemErr) {
            console.error(`Error adding item to order ${order.id}:`, itemErr.message);
            if (isPublicGuestOrder) throw itemErr;
          }
        }
      }

      // Update table status only if we have a valid ID
      if (validTableId) {
        await Table.updateStatus(validTableId, 'occupied');
      }

      // Add to activity log if there's a valid user
      if (userId) {
        await Activity.create({
          user_id: userId,
          restaurant_id: restaurantId,
          action: 'Create Guest Order',
          details: `Created guest order #${order.id} from table ${orderData.table_name || validTableId}`
        });
      }

      res.status(201).json(order);
    } catch (error) {
      console.error('❌ Create order crash:', error);
      res.status(500).json({ 
        error: 'DATABASE_ERROR', 
        message: error.message,
        detail: 'This usually happens if the orders table is missing guest columns or there is a type mismatch.'
      });
    }
  },

  async updateOrder(req, res) {
    try {
      const order = await Order.update(req.params.id, req.body);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      res.json(order);
    } catch (error) {
      console.error('Update order error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async updateOrderStatus(req, res) {
    try {
      const { status } = req.body;
      const order = await Order.findByIdWithItems(req.params.id);
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // If completing/paying order, decrement inventory
      if (status === 'paid' && order.status !== 'paid') {
        await Inventory.decrementStockForOrder(order.items);
      }

      const updatedOrder = await Order.updateStatus(req.params.id, status);

      // Update table status if order is closed
      if (['paid', 'cancelled'].includes(status) && order.table_id) {
        const openOrders = await Order.findAll({ 
          table_id: order.table_id, 
          status: 'open',
          restaurant_id: req.user.restaurant_id 
        });
        if (openOrders.length === 0) {
          await Table.updateStatus(order.table_id, 'available');
        }
      }

      await Activity.create({
        user_id: req.user.id,
        restaurant_id: req.user.restaurant_id,
        action: 'Update Order Status',
        details: `Order #${order.id} status changed to ${status}`
      });

      res.json(updatedOrder);
    } catch (error) {
      console.error('Update order status error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async addOrderItem(req, res) {
    try {
      const orderItem = await Order.addItem(req.params.id, req.body);
      res.status(201).json(orderItem);
    } catch (error) {
      console.error('Add order item error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async updateOrderItem(req, res) {
    try {
      const orderItem = await Order.updateItem(req.params.itemId, req.body);
      if (!orderItem) {
        return res.status(404).json({ error: 'Order item not found' });
      }
      res.json(orderItem);
    } catch (error) {
      console.error('Update order item error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async removeOrderItem(req, res) {
    try {
      const orderItem = await Order.removeItem(req.params.itemId);
      if (!orderItem) {
        return res.status(404).json({ error: 'Order item not found' });
      }
      res.json({ message: 'Item removed from order' });
    } catch (error) {
      console.error('Remove order item error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async deleteOrder(req, res) {
    try {
      const order = await Order.delete(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      res.json({ message: 'Order deleted successfully' });
    } catch (error) {
      console.error('Delete order error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = posController;
