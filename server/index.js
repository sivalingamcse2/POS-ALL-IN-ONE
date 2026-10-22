const express = require('express');
const os = require('os');
console.log('-------------------------------------------');
console.log('🚀 SIVARA MASTER SERVER INITIALIZING...');
console.log('-------------------------------------------');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const restaurantRoutes = require('./routes/restaurants');
const userRoutes = require('./routes/users');
const menuRoutes = require('./routes/menu');
const posRoutes = require('./routes/pos');
const inventoryRoutes = require('./routes/inventory');
const reportRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const storageRoutes = require('./routes/storage');

const app = express();

// Seeding logic for SIVARA GROUP
const seedDatabase = async () => {
  const db = require('./config/db');
  console.log('🔍 Checking database schema for Guest Ordering...');
  try {
    // 0. Ensure columns exist - Forceful check
    await db.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='orders' AND column_name='is_guest_order') THEN
          ALTER TABLE orders ADD COLUMN is_guest_order BOOLEAN DEFAULT FALSE;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='orders' AND column_name='customer_name') THEN
          ALTER TABLE orders ADD COLUMN customer_name VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='orders' AND column_name='customer_phone') THEN
          ALTER TABLE orders ADD COLUMN customer_phone VARCHAR(50);
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='orders' AND column_name='room_number') THEN
          ALTER TABLE orders ADD COLUMN room_number VARCHAR(50);
        END IF;
      END $$;
    `);
    console.log('✅ Database schema verified.');
      
    const resCount = await db.query('SELECT COUNT(*) FROM items');
    if (parseInt(resCount.rows[0].count) === 0) {
      console.log('🌱 Seeding default SIVARA menu...');
      // 1. Ensure a restaurant exists
      let restaurantId = 1;
      const restRes = await db.query('SELECT id FROM restaurants LIMIT 1');
      if (restRes.rows.length === 0) {
        const newRest = await db.query("INSERT INTO restaurants (name, address, currency) VALUES ('SIVARA Signature', 'Hospitality Hub', 'USD') RETURNING id");
        restaurantId = newRest.rows[0].id;
      } else {
        restaurantId = restRes.rows[0].id;
      }
    
      // 2. Create Categories
      const catNames = ['Signature Steaks', 'Gourmet Burgers', 'Premium Drinks', 'House Specials'];
      const categories = [];
      for (const name of catNames) {
        const cat = await db.query('INSERT INTO categories (name, restaurant_id) VALUES ($1, $2) RETURNING id, name', [name, restaurantId]);
        categories.push(cat.rows[0]);
      }
    
      // 3. Create Items
      const items = [
        { name: 'SIVARA Signature Steak', price: 45.00, category_name: 'Signature Steaks' },
        { name: 'Wagyu Gold Burger', price: 32.50, category_name: 'Gourmet Burgers' },
        { name: 'Vintage Red Wine', price: 85.00, category_name: 'Premium Drinks' },
        { name: 'Truffle Pasta', price: 28.00, category_name: 'House Specials' }
      ];
    
      for (const item of items) {
        const cat = categories.find(c => c.name === item.category_name);
        await db.query(
          'INSERT INTO items (name, price, category_id, restaurant_id, is_active) VALUES ($1, $2, $3, $4, true)',
          [item.name, item.price, cat.id, restaurantId]
        );
      }
    
      // 4. Ensure Tables exist
      const tableCount = await db.query('SELECT COUNT(*) FROM tables');
      if (parseInt(tableCount.rows[0].count) === 0) {
        for (let i = 1; i <= 12; i++) {
          await db.query('INSERT INTO tables (table_name, restaurant_id, capacity, status) VALUES ($1, $2, 4, $3)', [`Table ${i}`, restaurantId, 'available']);
        }
      }
    
      // 5. Ensure Admin is assigned to this restaurant
      await db.query('INSERT INTO user_restaurant_access (user_id, restaurant_id, is_default) VALUES (1, $1, TRUE) ON CONFLICT DO NOTHING', [restaurantId]);
            
      console.log('✅ Seeding complete!');
    }
  } catch (err) {
    console.error('❌ Seeding failed:', err);
  }
};
seedDatabase();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const posController = require('./controllers/posController');
const menuController = require('./controllers/menuController');

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 1. GUEST/PUBLIC ROUTES (Strictly No Auth)
app.post('/api/public/orders/new', async (req, res, next) => {
  console.log('--- 🛡️ GUEST ORDER ATTEMPT 🛡️ ---');
  try {
    await posController.createOrder(req, res);
    console.log('--- ✅ GUEST ORDER SUCCESS ✅ ---');
  } catch (err) {
    console.error('--- ❌ GUEST ORDER FATAL ERROR ❌ ---');
    console.error(err);
    res.status(500).json({ error: 'FATAL_INTERNAL_ERROR', message: err.message });
  }
});
app.get('/api/public/tables', posController.getAllTables);
app.get('/api/public/network-addresses', (req, res) => {
  const addresses = Object.values(os.networkInterfaces())
    .flatMap(entries => entries || [])
    .filter(entry => (
      entry.family === 'IPv4'
      && !entry.internal
      && !entry.address.startsWith('169.254.')
      && (/^10\./.test(entry.address)
        || /^192\.168\./.test(entry.address)
        || /^172\.(1[6-9]|2\d|3[01])\./.test(entry.address))
    ))
    .map(entry => entry.address);
  res.json({ addresses: [...new Set(addresses)] });
});
app.get('/api/public/kitchen-orders', posController.getKitchenOrders);
app.patch('/api/public/kitchen-orders/:id/status', posController.updateKitchenOrderStatus);
app.get('/api/pos/tables/:id', posController.getTableById);
app.get('/api/menu/items', menuController.getAllItems);
app.get('/api/menu/items/:id', menuController.getItemById);
app.get('/api/menu/categories', menuController.getAllCategories);
app.get('/api/menu/categories/:id', menuController.getCategoryById);

// 2. PROTECTED ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/storage', storageRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve the built React client (single-service production deployment, e.g. Render).
// The client is bundled into client/dist by the build step. When dist is absent
// (local dev with the separate Vite server on :4000), this block is skipped.
const path = require('path');
const fs = require('fs');
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: any non-API GET returns index.html so client-side routing works.
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    } else {
      next();
    }
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, '0.0.0.0', () => {
  console.log('-------------------------------------------');
  console.log(`🚀 SIVARA MASTER SERVER V4 - PORT: ${PORT}`);
  console.log('--- PUBLIC QR ORDERING ENABLED ---');
  console.log('-------------------------------------------');
});

module.exports = app;
