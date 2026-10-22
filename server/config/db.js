const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Local Data Path — workspace root (portable across machines)
const DATA_DIR = path.join(__dirname, '..', '..');
const LOCAL_DB_FILE = path.join(DATA_DIR, 'local_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default Seed State for Local Storage
const DEFAULT_LOCAL_STATE = {
  restaurants: [
    { id: 1, name: 'SIVARA Main Branch', address: '123 Commercial Plaza', currency: 'USD', tax_rate: 10.0 }
  ],
  roles: [
    { id: 1, name: 'Admin', permissions: { POS: true, Inventory: true, Reports: true, UserMgmt: true, Settings: true } }
  ],
  users: [
    { id: 1, username: 'admin', password: '$2b$10$xWkCCJpL.UU9ToBGq1i4cOB9UANaAe4Jfvl3LeRX6w7axBEt.p1wW', role_id: 1, is_active: true }
  ],
  user_restaurant_access: [
    { id: 1, user_id: 1, restaurant_id: 1, is_default: true }
  ],
  categories: [
    { id: 101, name: 'Fresh Produce', restaurant_id: 1 },
    { id: 102, name: 'Dairy & Eggs', restaurant_id: 1 },
    { id: 103, name: 'Bakery & Bread', restaurant_id: 1 },
    { id: 104, name: 'Beverages & Drinks', restaurant_id: 1 },
    { id: 1, name: 'Appetizers', restaurant_id: 1 },
    { id: 2, name: 'Main Course', restaurant_id: 1 },
    { id: 3, name: 'Desserts', restaurant_id: 1 },
    { id: 4, name: 'Beverages', restaurant_id: 1 }
  ],
  items: [
    { id: 1001, name: 'Organic Bananas (kg)', price: 1.99, cost: 0.90, category_id: 101, restaurant_id: 1, sku: 'PRD-BAN-01', is_active: true },
    { id: 1002, name: 'Gala Apples (kg)', price: 3.49, cost: 1.80, category_id: 101, restaurant_id: 1, sku: 'PRD-APP-02', is_active: true },
    { id: 1003, name: 'Fresh Whole Milk 1L', price: 2.29, cost: 1.40, category_id: 102, restaurant_id: 1, sku: 'DAI-MLK-01', is_active: true },
    { id: 1, name: 'Caesar Salad', price: 12.50, cost: 4.00, category_id: 1, restaurant_id: 1, is_active: true },
    { id: 2, name: 'Truffle Fries', price: 9.00, cost: 2.50, category_id: 1, restaurant_id: 1, is_active: true },
    { id: 3, name: 'SIVARA Signature Steak', price: 45.00, cost: 18.00, category_id: 2, restaurant_id: 1, is_active: true },
    { id: 4, name: 'Grilled Atlantic Salmon', price: 28.00, cost: 12.00, category_id: 2, restaurant_id: 1, is_active: true }
  ],
  tables: [
    { id: 1, table_name: 'Table 1', restaurant_id: 1, capacity: 4, status: 'available' },
    { id: 2, table_name: 'Table 2', restaurant_id: 1, capacity: 4, status: 'available' },
    { id: 3, table_name: 'Table 3', restaurant_id: 1, capacity: 4, status: 'available' },
    { id: 4, table_name: 'Table 4', restaurant_id: 1, capacity: 4, status: 'available' }
  ],
  orders: [],
  order_items: [],
  inventory_stock: [],
  activities: [],
  shifts: []
};

// Load or initialize local JSON DB
let localDb = DEFAULT_LOCAL_STATE;
if (fs.existsSync(LOCAL_DB_FILE)) {
  try {
    localDb = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf8'));
  } catch (e) {
    console.warn('[Storage] Corrupt local DB file, reinitializing with defaults');
    localDb = DEFAULT_LOCAL_STATE;
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(localDb, null, 2));
  }
} else {
  fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(localDb, null, 2));
}

const saveLocalDb = () => {
  try {
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(localDb, null, 2));
  } catch (e) {
    console.error('[Storage] Error saving local DB:', e);
  }
};

// PostgreSQL Pool setup
let isPgConnected = false;
let pool = null;

try {
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'pos_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    connectionTimeoutMillis: 1500,
  });

  pool.on('error', (err) => {
    // Graceful error handle - do NOT call process.exit(-1)
    console.warn('[PostgreSQL Pool Notice] Cloud DB connection idle error or offline:', err.message);
    isPgConnected = false;
  });

  // Test PG connection
  pool.query('SELECT 1')
    .then(() => {
      isPgConnected = true;
      console.log('✅ Connected to Cloud / Local PostgreSQL Database');
    })
    .catch((err) => {
      isPgConnected = false;
      console.log('ℹ️ PostgreSQL not reachable (' + err.message + ').');
      console.log('⚡ Active Storage Engine: LOCAL PERSISTENT STORAGE (' + LOCAL_DB_FILE + ')');
    });
} catch (e) {
  isPgConnected = false;
}

// SQL Query Emulator for Local Storage
const emulateQuery = async (sqlText, params = []) => {
  const sql = sqlText.trim().replace(/\s+/g, ' ');
  const lower = sql.toLowerCase();

  // 1. ALTER TABLE / DO $$ / schema management queries
  if (lower.startsWith('do $$') || lower.startsWith('alter table') || lower.startsWith('create table')) {
    return { rows: [], rowCount: 0 };
  }

  // 2. COUNT queries (e.g. SELECT COUNT(*) FROM items / tables)
  if (lower.includes('count(*)')) {
    const tableMatch = lower.match(/from\s+([a-zA-Z_]+)/);
    const tableName = tableMatch ? tableMatch[1] : '';
    const tableData = localDb[tableName] || [];
    return { rows: [{ count: String(tableData.length) }], rowCount: 1 };
  }

  // 3. SELECT ALL / FILTER queries
  if (lower.startsWith('select')) {
    const tableMatch = lower.match(/from\s+([a-zA-Z_]+)/);
    const tableName = tableMatch ? tableMatch[1] : '';
    let tableData = localDb[tableName] || [];

    if (lower.includes('from orders o') && lower.includes('left join order_items oi')) {
      const restaurantId = Number(params[0]);
      let orders = (localDb.orders || []).filter(order => (
        Number(order.restaurant_id) === restaurantId
        && ['pending', 'preparing', 'ready', 'completed', 'held', 'open'].includes(String(order.status).toLowerCase())
      ));
      if (params[1] && params[2]) {
        const timeZone = params[3] || 'UTC';
        orders = orders.filter(order => {
          const date = new Date(order.created_at || order.date || '');
          if (Number.isNaN(date.getTime())) return false;
          const formatted = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).format(date);
          return formatted >= params[1] && formatted <= params[2];
        });
      }
      orders.sort((a, b) => new Date(a.created_at || a.date || 0) - new Date(b.created_at || b.date || 0));
      if (lower.includes('limit 100')) orders = orders.slice(0, 100);
      const rows = orders.map(order => {
        const table = (localDb.tables || []).find(record => Number(record.id) === Number(order.table_id));
        const items = (localDb.order_items || [])
          .filter(record => Number(record.order_id) === Number(order.id))
          .map(record => {
            const item = (localDb.items || []).find(menuItem => Number(menuItem.id) === Number(record.item_id));
            return {
              item_id: record.item_id,
              item_name: item?.name || record.item_name || 'Menu item',
              quantity: record.quantity,
              notes: record.notes || ''
            };
          });
        return {
          id: order.id,
          restaurant_id: order.restaurant_id,
          table_id: order.table_id,
          status: order.status,
          total_amount: order.total_amount,
          date: order.created_at || order.date,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          room_number: order.room_number,
          table_name: table?.table_name || 'Takeaway',
          items
        };
      });
      return { rows, rowCount: rows.length };
    }

    // Filter by restaurant_id or id if params exist
    if (params.length > 0) {
      if (lower.includes('where i.restaurant_id = $1') || lower.includes('where restaurant_id = $1')) {
        const restId = parseInt(params[0]);
        tableData = tableData.filter(item => !item.restaurant_id || item.restaurant_id === restId);
      } else if (lower.includes('where id = $1') || lower.includes('where i.id = $1')) {
        const id = parseInt(params[0]);
        const found = tableData.find(item => item.id === id);
        return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
      } else if (lower.includes('where username = $1')) {
        const uname = params[0];
        const found = tableData.find(item => item.username === uname);
        return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
      }
    }

    return { rows: tableData, rowCount: tableData.length };
  }

  // 4. INSERT queries
  if (lower.startsWith('insert into')) {
    const tableMatch = lower.match(/insert into\s+([a-zA-Z_]+)/);
    const tableName = tableMatch ? tableMatch[1] : '';
    if (!localDb[tableName]) localDb[tableName] = [];

    const newId = localDb[tableName].length > 0
      ? Math.max(...localDb[tableName].map(x => x.id || 0)) + 1
      : 1;

    let newRecord = { id: newId, created_at: new Date().toISOString() };
    const columnsMatch = sql.match(/insert into\s+[a-zA-Z_]+\s*\(([^)]+)\)/i);
    const valuesMatch = sql.match(/\bvalues\s*\(([^)]+)\)/i);
    if (columnsMatch && valuesMatch) {
      const columns = columnsMatch[1].split(',').map(column => column.trim());
      const expressions = valuesMatch[1].split(',').map(value => value.trim());
      columns.forEach((column, index) => {
        const parameterMatch = expressions[index]?.match(/^\$(\d+)$/);
        if (parameterMatch) {
          newRecord[column] = params[Number(parameterMatch[1]) - 1];
        } else if (/^\d+(\.\d+)?$/.test(expressions[index] || '')) {
          newRecord[column] = Number(expressions[index]);
        } else if (/^true$/i.test(expressions[index] || '')) {
          newRecord[column] = true;
        } else if (/^false$/i.test(expressions[index] || '')) {
          newRecord[column] = false;
        }
      });
    }

    // Common columns mapping
    if (tableName === 'items' && params.length >= 2) {
      newRecord.name = params[0];
      newRecord.price = params[1];
      if (params[2]) newRecord.category_id = params[2];
      if (params[3]) newRecord.restaurant_id = params[3];
      newRecord.is_active = true;
    } else if (tableName === 'categories' && params.length >= 1) {
      newRecord.name = params[0];
      if (params[1]) newRecord.restaurant_id = params[1];
    }

    localDb[tableName].push(newRecord);
    saveLocalDb();
    return { rows: [newRecord], rowCount: 1 };
  }

  // 5. UPDATE queries
  if (lower.startsWith('update')) {
    const tableMatch = lower.match(/update\s+([a-zA-Z_]+)/);
    const tableName = tableMatch ? tableMatch[1] : '';
    const idParam = params[params.length - 1];
    if (localDb[tableName] && idParam) {
      const idx = localDb[tableName].findIndex(x => x.id === parseInt(idParam));
      if (idx > -1) {
        const updatedRecord = { ...localDb[tableName][idx], updated_at: new Date().toISOString() };
        const setMatch = sql.match(/set\s+(.+?)\s+where/i);
        if (setMatch) {
          setMatch[1].split(',').forEach(assignment => {
            const fieldMatch = assignment.trim().match(/^([a-zA-Z_]+)\s*=\s*\$(\d+)/);
            if (fieldMatch) updatedRecord[fieldMatch[1]] = params[Number(fieldMatch[2]) - 1];
          });
        }
        localDb[tableName][idx] = updatedRecord;
        saveLocalDb();
        return { rows: [localDb[tableName][idx]], rowCount: 1 };
      }
    }
    return { rows: [], rowCount: 0 };
  }

  // 6. DELETE queries
  if (lower.startsWith('delete from')) {
    const tableMatch = lower.match(/delete from\s+([a-zA-Z_]+)/);
    const tableName = tableMatch ? tableMatch[1] : '';
    const idParam = params[0];
    if (localDb[tableName] && idParam) {
      localDb[tableName] = localDb[tableName].filter(x => x.id !== parseInt(idParam));
      saveLocalDb();
      return { rows: [], rowCount: 1 };
    }
  }

  return { rows: [], rowCount: 0 };
};

// Unified Query Handler
const query = async (text, params) => {
  if (isPgConnected && pool) {
    try {
      return await pool.query(text, params);
    } catch (pgError) {
      console.warn('[Cloud PG Query Error -> Local Fallback]:', pgError.message);
      return await emulateQuery(text, params);
    }
  }
  return await emulateQuery(text, params);
};

module.exports = {
  query,
  pool,
  isPgConnected: () => isPgConnected,
  getStorageType: () => isPgConnected ? 'postgresql_cloud' : 'local_json_file',
  getLocalDb: () => localDb,
  setLocalDb: (newDb) => {
    localDb = newDb;
    saveLocalDb();
  },
  saveLocalDb
};
