/**
 * UNIFIED STORAGE & CLOUD SYNC ENGINE
 * Provides seamless Local Storage (Offline-First) and Cloud Storage options
 * Supports Restaurant POS, Supermarket POS, Inventory, Shifts, and Backup/Restore.
 */
import { getRestaurantMenuCategories, isAssignedToRestaurant } from '../utils/restaurantMenu';

const STORAGE_KEYS = {
  MODE: 'pos_storage_mode', // 'hybrid' | 'local' | 'cloud'
  CLOUD_URL: 'pos_cloud_url',
  ITEMS: 'pos_menu_items',
  CATEGORIES: 'pos_categories',
  ORDERS: 'pos_orders',
  HELD_CARTS: 'pos_held_carts',
  SHIFTS: 'pos_shifts',
  ACTIVE_SHIFT: 'pos_active_shift',
  CUSTOMERS: 'pos_customers',
  TABLES: 'pos_tables',
  SYNC_QUEUE: 'pos_sync_queue',
  LAST_SYNC: 'pos_last_sync_timestamp',
  BUSINESS_MODE: 'pos_active_business_mode', // 'restaurant' | 'supermarket'
  STORE_INFO: 'pos_restaurant',
};

// Rich default supermarket & restaurant categories
export const DEFAULT_CATEGORIES = [
  // Supermarket Departments
  { id: 101, name: 'Fresh Produce', type: 'supermarket', icon: '🍎', description: 'Fruits and vegetables (by weight/pcs)' },
  { id: 102, name: 'Dairy & Eggs', type: 'supermarket', icon: '🧀', description: 'Milk, cheese, yogurt, fresh eggs' },
  { id: 103, name: 'Bakery & Bread', type: 'supermarket', icon: '🍞', description: 'Artisan bread, buns, pastries' },
  { id: 104, name: 'Beverages & Drinks', type: 'supermarket', icon: '🥤', description: 'Soft drinks, juices, mineral water' },
  { id: 105, name: 'Meat & Seafood', type: 'supermarket', icon: '🥩', description: 'Fresh cuts, poultry, seafood by weight' },
  { id: 106, name: 'Snacks & Confectionery', type: 'supermarket', icon: '🍫', description: 'Chips, biscuits, chocolates' },
  { id: 107, name: 'Pantry & Grocery', type: 'supermarket', icon: '🥫', description: 'Rice, pasta, oils, sauces, canned food' },
  { id: 108, name: 'Household & Personal', type: 'supermarket', icon: '🧼', description: 'Detergents, hygiene, cleaning' },
  // Restaurant Categories
  { id: 1, name: 'Appetizers', type: 'restaurant', icon: '🥗', description: 'Starters and small plates' },
  { id: 2, name: 'Main Course', type: 'restaurant', icon: '🍽️', description: 'Steaks, pasta, signature entrees' },
  { id: 3, name: 'Desserts', type: 'restaurant', icon: '🍰', description: 'Sweet cakes and ice creams' },
  { id: 4, name: 'Beverages', type: 'restaurant', icon: '🍷', description: 'Cocktails, wines, coffees' },
];

// Rich default items for both Supermarket and Restaurant
export const DEFAULT_ITEMS = [
  // Supermarket Items (with barcodes, SKU, weight scale support, expiry dates)
  {
    id: 1001,
    name: 'Organic Bananas (kg)',
    barcode: '890100100101',
    sku: 'PRD-BAN-01',
    category_id: 101,
    department: 'Fresh Produce',
    price: 1.99,
    cost_price: 0.90,
    unit: 'kg',
    is_weight_scale: true,
    stock_quantity: 120,
    reorder_level: 25,
    expiry_date: '2026-10-18',
    batch_number: 'B-2610-A',
    is_active: true,
    is_supermarket: true,
    description: 'Fresh Cavendish sweet organic bananas, sold by weight.'
  },
  {
    id: 1002,
    name: 'Gala Apples (kg)',
    barcode: '890100100102',
    sku: 'PRD-APP-02',
    category_id: 101,
    department: 'Fresh Produce',
    price: 3.49,
    cost_price: 1.80,
    unit: 'kg',
    is_weight_scale: true,
    stock_quantity: 85,
    reorder_level: 20,
    expiry_date: '2026-10-25',
    batch_number: 'B-2610-B',
    is_active: true,
    is_supermarket: true,
    description: 'Crisp and sweet fresh Gala apples.'
  },
  {
    id: 1003,
    name: 'Fresh Whole Milk 1L',
    barcode: '890100100201',
    sku: 'DAI-MLK-01',
    category_id: 102,
    department: 'Dairy & Eggs',
    price: 2.29,
    cost_price: 1.40,
    unit: 'bottle',
    is_weight_scale: false,
    stock_quantity: 65,
    reorder_level: 15,
    expiry_date: '2026-10-22',
    batch_number: 'LOT-9921',
    is_active: true,
    is_supermarket: true,
    description: 'Pasteurized homogenized full-cream fresh milk.'
  },
  {
    id: 1004,
    name: 'Farm Fresh Large Eggs 12pk',
    barcode: '890100100202',
    sku: 'DAI-EGG-02',
    category_id: 102,
    department: 'Dairy & Eggs',
    price: 3.99,
    cost_price: 2.30,
    unit: 'pack',
    is_weight_scale: false,
    stock_quantity: 40,
    reorder_level: 10,
    expiry_date: '2026-11-05',
    batch_number: 'LOT-8812',
    is_active: true,
    is_supermarket: true,
    description: 'Grade A free-range eggs, carton of 12.'
  },
  {
    id: 1005,
    name: 'Artisan Sourdough Loaf 500g',
    barcode: '890100100301',
    sku: 'BAK-SRD-01',
    category_id: 103,
    department: 'Bakery & Bread',
    price: 4.50,
    cost_price: 2.00,
    unit: 'pcs',
    is_weight_scale: false,
    stock_quantity: 24,
    reorder_level: 8,
    expiry_date: '2026-10-14',
    batch_number: 'BAK-TODAY',
    is_active: true,
    is_supermarket: true,
    description: 'Slow-fermented crusty artisan sourdough bread.'
  },
  {
    id: 1006,
    name: 'Coca Cola Original 330ml Can',
    barcode: '5449000000996',
    sku: 'BEV-COC-01',
    category_id: 104,
    department: 'Beverages & Drinks',
    price: 1.25,
    cost_price: 0.65,
    unit: 'can',
    is_weight_scale: false,
    stock_quantity: 180,
    reorder_level: 48,
    expiry_date: '2027-06-30',
    batch_number: 'CC-3391',
    is_active: true,
    is_supermarket: true,
    description: 'Classic Coca Cola carbonated soft drink 330ml can.'
  },
  {
    id: 1007,
    name: 'Sparkling Mineral Water 750ml',
    barcode: '890100100402',
    sku: 'BEV-WTR-02',
    category_id: 104,
    department: 'Beverages & Drinks',
    price: 1.80,
    cost_price: 0.85,
    unit: 'bottle',
    is_weight_scale: false,
    stock_quantity: 90,
    reorder_level: 24,
    expiry_date: '2027-12-31',
    batch_number: 'WTR-7721',
    is_active: true,
    is_supermarket: true,
    description: 'Natural carbonated European sparkling mineral water.'
  },
  {
    id: 1008,
    name: 'Prime Ribeye Beef Steak (kg)',
    barcode: '890100100501',
    sku: 'MEA-RIB-01',
    category_id: 105,
    department: 'Meat & Seafood',
    price: 26.90,
    cost_price: 18.00,
    unit: 'kg',
    is_weight_scale: true,
    stock_quantity: 35,
    reorder_level: 8,
    expiry_date: '2026-10-15',
    batch_number: 'MEA-2610-01',
    is_active: true,
    is_supermarket: true,
    description: 'Fresh grass-fed marbled ribeye beef cut, priced per kg.'
  },
  {
    id: 1009,
    name: 'Atlantic Salmon Fillet (kg)',
    barcode: '890100100502',
    sku: 'MEA-SAL-02',
    category_id: 105,
    department: 'Meat & Seafood',
    price: 22.50,
    cost_price: 15.00,
    unit: 'kg',
    is_weight_scale: true,
    stock_quantity: 28,
    reorder_level: 6,
    expiry_date: '2026-10-13',
    batch_number: 'SEA-2610-02',
    is_active: true,
    is_supermarket: true,
    description: 'Fresh skin-on sashimi-grade Atlantic salmon fillet.'
  },
  {
    id: 1010,
    name: 'Lay\'s Classic Potato Chips 150g',
    barcode: '890100100601',
    sku: 'SNK-CHP-01',
    category_id: 106,
    department: 'Snacks & Confectionery',
    price: 2.49,
    cost_price: 1.30,
    unit: 'pack',
    is_weight_scale: false,
    stock_quantity: 75,
    reorder_level: 20,
    expiry_date: '2027-04-15',
    batch_number: 'CHP-8831',
    is_active: true,
    is_supermarket: true,
    description: 'Crispy salted golden potato chips.'
  },
  {
    id: 1011,
    name: 'Premium Basmati Rice 5kg Bag',
    barcode: '890100100701',
    sku: 'PAN-RIC-01',
    category_id: 107,
    department: 'Pantry & Grocery',
    price: 14.99,
    cost_price: 9.50,
    unit: 'bag',
    is_weight_scale: false,
    stock_quantity: 45,
    reorder_level: 10,
    expiry_date: '2028-01-30',
    batch_number: 'RIC-2026',
    is_active: true,
    is_supermarket: true,
    description: 'Extra-long grain aromatic royal aged basmati rice.'
  },
  {
    id: 1012,
    name: 'Extra Virgin Olive Oil 1L',
    barcode: '890100100702',
    sku: 'PAN-OIL-02',
    category_id: 107,
    department: 'Pantry & Grocery',
    price: 11.50,
    cost_price: 7.20,
    unit: 'bottle',
    is_weight_scale: false,
    stock_quantity: 32,
    reorder_level: 8,
    expiry_date: '2027-10-31',
    batch_number: 'OIL-4412',
    is_active: true,
    is_supermarket: true,
    description: 'Cold-pressed 100% Mediterranean extra virgin olive oil.'
  },

  // Restaurant Menu Items
  {
    id: 1,
    name: 'Caesar Salad',
    price: 12.50,
    cost_price: 4.00,
    category_id: 1,
    is_active: true,
    is_restaurant: true,
    stock_quantity: 50,
    unit: 'portion',
    description: 'Crisp romaine, shaved parmesan, garlic croutons, and house Caesar dressing.'
  },
  {
    id: 2,
    name: 'Crispy Truffle Fries',
    price: 9.00,
    cost_price: 2.50,
    category_id: 1,
    is_active: true,
    is_restaurant: true,
    stock_quantity: 100,
    unit: 'portion',
    description: 'Golden fries tossed in white truffle oil and pecorino cheese.'
  },
  {
    id: 3,
    name: 'SIVARA Signature Steak',
    price: 45.00,
    cost_price: 18.00,
    category_id: 2,
    is_active: true,
    is_restaurant: true,
    stock_quantity: 20,
    unit: 'portion',
    description: '45-day aged Black Angus ribeye with roasted garlic butter and red wine glaze.'
  },
  {
    id: 4,
    name: 'Grilled Atlantic Salmon',
    price: 28.00,
    cost_price: 12.00,
    category_id: 2,
    is_active: true,
    is_restaurant: true,
    stock_quantity: 18,
    unit: 'portion',
    description: 'Pan-seared salmon fillet over wild asparagus and lemon beurre blanc.'
  },
  {
    id: 5,
    name: 'Truffle Pasta Carbonara',
    price: 18.00,
    cost_price: 6.00,
    category_id: 2,
    is_active: true,
    is_restaurant: true,
    stock_quantity: 30,
    unit: 'portion',
    description: 'Handmade fettuccine, guanciale, organic egg yolk, and freshly cracked black pepper.'
  },
  {
    id: 6,
    name: 'Molten Chocolate Lava Cake',
    price: 12.00,
    cost_price: 3.50,
    category_id: 3,
    is_active: true,
    is_restaurant: true,
    stock_quantity: 25,
    unit: 'portion',
    description: 'Warm Valrhona chocolate cake with oozing center and Madagascar vanilla gelato.'
  },
  {
    id: 7,
    name: 'Madagascar Vanilla Bean Gelato',
    price: 6.00,
    cost_price: 1.80,
    category_id: 3,
    is_active: true,
    is_restaurant: true,
    stock_quantity: 40,
    unit: 'portion',
    description: 'Authentic churned Italian gelato made with whole milk and real vanilla beans.'
  },
  {
    id: 8,
    name: 'Classic Espresso Martini',
    price: 14.00,
    cost_price: 4.20,
    category_id: 4,
    is_active: true,
    is_restaurant: true,
    stock_quantity: 100,
    unit: 'glass',
    description: 'Grey Goose vodka, Kahlua, and fresh roasted espresso shaken over ice.'
  },
  {
    id: 9,
    name: 'Fresh Mint Watermelon Juice',
    price: 7.50,
    cost_price: 1.50,
    category_id: 4,
    is_active: true,
    is_restaurant: true,
    stock_quantity: 50,
    unit: 'glass',
    description: 'Freshly pressed organic watermelon with lime juice and fresh garden mint.'
  }
];

// Default Customers for Loyalty & Memberships
export const DEFAULT_CUSTOMERS = [
  { id: 1, name: 'Walk-in Customer', phone: '0000000000', email: '', points: 0, barcode: 'CUST-0001', tier: 'Standard' },
  { id: 2, name: 'Sarah Jenkins', phone: '+1-555-0192', email: 'sarah.j@example.com', points: 420, barcode: 'CUST-0002', tier: 'Gold' },
  { id: 3, name: 'Michael Chen', phone: '+1-555-0284', email: 'mchen@example.com', points: 150, barcode: 'CUST-0003', tier: 'Silver' },
  { id: 4, name: 'Elena Rostova', phone: '+1-555-0391', email: 'elena.r@example.com', points: 890, barcode: 'CUST-0004', tier: 'Platinum' }
];

// Sound generator using Web Audio API (zero external files required)
export const playSound = (type = 'beep') => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'beep') {
      // High pitch crisp scanner beep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // A6
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'success' || type === 'chime') {
      // Cash register pleasant success chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'error') {
      // Low buzz error
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (e) {
    // Ignore audio errors if audio context blocked
  }
};

class StorageEngine {
  constructor() {
    this.listeners = new Set();
    this.init();
  }

  init() {
    // Ensure default storage mode
    if (!localStorage.getItem(STORAGE_KEYS.MODE)) {
      localStorage.setItem(STORAGE_KEYS.MODE, 'hybrid'); // Default: Hybrid (Cloud + Local Offline)
    }

    if (!localStorage.getItem(STORAGE_KEYS.BUSINESS_MODE)) {
      localStorage.setItem(STORAGE_KEYS.BUSINESS_MODE, 'supermarket');
    }

    // Initialize Categories if empty
    const currentCats = this.getCategories();
    if (!currentCats || currentCats.length === 0) {
      this.saveCategories(DEFAULT_CATEGORIES);
    }

    // Initialize Items if empty
    const currentItems = this.getItems();
    if (!currentItems || currentItems.length === 0) {
      this.saveItems(DEFAULT_ITEMS);
    } else {
      // Merge in any missing supermarket items
      const hasSupermarket = currentItems.some(i => i.is_supermarket || i.barcode);
      if (!hasSupermarket) {
        const merged = [...currentItems, ...DEFAULT_ITEMS.filter(d => d.is_supermarket)];
        this.saveItems(merged);
      }
    }

    // Initialize Customers
    const currentCusts = this.getCustomers();
    if (!currentCusts || currentCusts.length === 0) {
      this.saveCustomers(DEFAULT_CUSTOMERS);
    }

    // Initialize Active Shift if empty
    if (!localStorage.getItem(STORAGE_KEYS.ACTIVE_SHIFT)) {
      const defaultShift = {
        id: 'SHIFT-' + Date.now(),
        opened_at: new Date().toISOString(),
        cashier_name: 'Admin',
        opening_float: 200.00,
        cash_in: 0,
        cash_out: 0,
        total_sales: 0,
        cash_sales: 0,
        card_sales: 0,
        other_sales: 0,
        status: 'open'
      };
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFT, JSON.stringify(defaultShift));
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(event, data) {
    this.listeners.forEach(cb => {
      try { cb(event, data); } catch (e) { console.error('Storage listener err', e); }
    });
  }

  // --- Storage Mode & Cloud URL ---
  getStorageMode() {
    return localStorage.getItem(STORAGE_KEYS.MODE) || 'hybrid';
  }

  setStorageMode(mode) {
    localStorage.setItem(STORAGE_KEYS.MODE, mode);
    this.notify('mode_changed', mode);
  }

  getCloudUrl() {
    return localStorage.getItem(STORAGE_KEYS.CLOUD_URL) || window.location.origin + '/api';
  }

  setCloudUrl(url) {
    localStorage.setItem(STORAGE_KEYS.CLOUD_URL, url);
    this.notify('cloud_url_changed', url);
  }

  getBusinessMode() {
    return localStorage.getItem(STORAGE_KEYS.BUSINESS_MODE) || 'supermarket';
  }

  setBusinessMode(mode) {
    localStorage.setItem(STORAGE_KEYS.BUSINESS_MODE, mode);
    this.notify('business_mode_changed', mode);
  }

  // --- Items & Catalog ---
  getItems(filter = null) {
    const raw = localStorage.getItem(STORAGE_KEYS.ITEMS);
    let items = raw ? JSON.parse(raw) : DEFAULT_ITEMS;
    const activeRestaurant = JSON.parse(localStorage.getItem('active_restaurant') || 'null');
    const restaurantId = Number(activeRestaurant?.id || 1);
    items = items.filter(item => isAssignedToRestaurant(item, restaurantId));
    if (filter === 'supermarket') {
      return items.filter(i => i.is_supermarket || i.barcode || i.is_weight_scale);
    }
    if (filter === 'restaurant') {
      return items.filter(i => i.is_restaurant || !i.barcode);
    }
    return items;
  }

  saveItems(items) {
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
    this.notify('items_updated', items);
  }

  getItemByBarcode(barcode) {
    const cleanCode = String(barcode).trim();
    const items = this.getItems();
    // Direct match
    let found = items.find(i => String(i.barcode).trim() === cleanCode || String(i.sku).trim().toLowerCase() === cleanCode.toLowerCase());
    if (found) return found;

    // Check for Price-Embedded / Weight scale barcode (e.g., EAN-13 starting with 20 or 02)
    // Structure: 20[5-digit PLU/SKU][5-digit Weight or Price][1 check digit]
    if (cleanCode.length === 13 && (cleanCode.startsWith('20') || cleanCode.startsWith('02'))) {
      const plu = cleanCode.substring(2, 7);
      const embeddedValue = parseInt(cleanCode.substring(7, 12), 10) / 100; // e.g. 01250 -> 1.25 kg or $1.25
      found = items.find(i => String(i.barcode).includes(plu) || String(i.id).includes(plu));
      if (found) {
        return {
          ...found,
          _embeddedWeight: embeddedValue,
          _isEmbeddedBarcode: true
        };
      }
    }
    return null;
  }

  // --- Categories ---
  getCategories(type = null) {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    const activeRestaurant = JSON.parse(localStorage.getItem('active_restaurant') || 'null');
    const restaurantId = Number(activeRestaurant?.id || 1);
    const cats = getRestaurantMenuCategories(
      raw ? JSON.parse(raw) : DEFAULT_CATEGORIES,
      this.getItems(),
      restaurantId
    );
    if (type) {
      return cats.filter(c => c.type === type || !c.type);
    }
    return cats;
  }

  saveCategories(categories) {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    this.notify('categories_updated', categories);
  }

  // --- Orders & Sales ---
  getOrders() {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    return raw ? JSON.parse(raw) : [];
  }

  saveOrder(orderData) {
    const orders = this.getOrders();
    const mode = this.getStorageMode();

    const order = {
      id: orderData.id || `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order_number: orderData.order_number || orders.length + 1001,
      created_at: new Date().toISOString(),
      status: orderData.status || 'Completed',
      items: orderData.items || [],
      subtotal: parseFloat(orderData.subtotal || 0),
      tax_amount: parseFloat(orderData.tax_amount || 0),
      discount: parseFloat(orderData.discount || 0),
      total: parseFloat(orderData.total || 0),
      payment_method: orderData.payment_method || 'Cash',
      amount_tendered: parseFloat(orderData.amount_tendered || orderData.total || 0),
      change_due: parseFloat(orderData.change_due || 0),
      customer: orderData.customer || null,
      cashier: orderData.cashier || 'Admin',
      business_type: orderData.business_type || this.getBusinessMode(),
      table_id: orderData.table_id || null,
      table_name: orderData.table_name || null,
      order_type: orderData.order_type || 'Takeaway/Checkout',
      sync_status: (mode === 'local') ? 'local_only' : 'pending_sync'
    };

    // 1. Deduct Stock Locally
    const allItems = this.getItems();
    const updatedItems = allItems.map(item => {
      const orderedItem = order.items.find(oi => oi.id === item.id);
      if (orderedItem) {
        const qtyToDeduct = parseFloat(orderedItem.quantity || 1);
        const currentQty = parseFloat(item.stock_quantity || 0);
        return { ...item, stock_quantity: Math.max(0, currentQty - qtyToDeduct) };
      }
      return item;
    });
    this.saveItems(updatedItems);

    // 2. Save Order to Local History
    const updatedOrders = [order, ...orders];
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updatedOrders));

    // 3. Update Active Shift
    this.recordSaleInActiveShift(order);

    // 4. Update Customer Loyalty Points
    if (order.customer && order.customer.id) {
      this.addCustomerPoints(order.customer.id, Math.floor(order.total), order.total);
    }

    // 5. Enqueue for Cloud Sync if in Hybrid or Cloud mode
    if (mode === 'hybrid' || mode === 'cloud') {
      this.enqueueForSync({ type: 'order', data: order });
      // Trigger background sync attempt
      this.triggerSync().catch(() => {});
    }

    this.notify('order_created', order);
    return order;
  }

  // --- Shifts & Cash Drawer (X-Report / Z-Report) ---
  getActiveShift() {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_SHIFT);
    return raw ? JSON.parse(raw) : null;
  }

  saveActiveShift(shift) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFT, JSON.stringify(shift));
    this.notify('shift_updated', shift);
  }

  recordSaleInActiveShift(order) {
    const shift = this.getActiveShift();
    if (!shift || shift.status !== 'open') return;

    shift.total_sales = (parseFloat(shift.total_sales || 0) + parseFloat(order.total)).toFixed(2);
    if (order.payment_method === 'Cash') {
      shift.cash_sales = (parseFloat(shift.cash_sales || 0) + parseFloat(order.total)).toFixed(2);
    } else if (order.payment_method === 'Card') {
      shift.card_sales = (parseFloat(shift.card_sales || 0) + parseFloat(order.total)).toFixed(2);
    } else {
      shift.other_sales = (parseFloat(shift.other_sales || 0) + parseFloat(order.total)).toFixed(2);
    }

    this.saveActiveShift(shift);
  }

  recordCashMovement(type, amount, reason) {
    const shift = this.getActiveShift();
    if (!shift) return;
    const num = parseFloat(amount || 0);
    if (type === 'in') {
      shift.cash_in = (parseFloat(shift.cash_in || 0) + num).toFixed(2);
    } else {
      shift.cash_out = (parseFloat(shift.cash_out || 0) + num).toFixed(2);
    }
    if (!shift.movements) shift.movements = [];
    shift.movements.push({
      type,
      amount: num,
      reason,
      timestamp: new Date().toISOString()
    });
    this.saveActiveShift(shift);
    return shift;
  }

  closeShift(actualCashCount, notes = '') {
    const shift = this.getActiveShift();
    if (!shift) return null;

    const opening = parseFloat(shift.opening_float || 0);
    const cashSales = parseFloat(shift.cash_sales || 0);
    const cashIn = parseFloat(shift.cash_in || 0);
    const cashOut = parseFloat(shift.cash_out || 0);
    const expectedCash = (opening + cashSales + cashIn - cashOut).toFixed(2);
    const counted = parseFloat(actualCashCount || 0).toFixed(2);
    const variance = (counted - expectedCash).toFixed(2);

    const closedShift = {
      ...shift,
      closed_at: new Date().toISOString(),
      status: 'closed',
      expected_cash: parseFloat(expectedCash),
      actual_cash: parseFloat(counted),
      variance: parseFloat(variance),
      closing_notes: notes
    };

    // Save to shift history
    const allShifts = this.getShifts();
    const updated = [closedShift, ...allShifts];
    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(updated));

    // Clear active shift
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHIFT);

    // Queue for sync
    this.enqueueForSync({ type: 'shift_close', data: closedShift });
    this.notify('shift_closed', closedShift);

    return closedShift;
  }

  openNewShift(cashierName, openingFloat = 200.00) {
    const newShift = {
      id: 'SHIFT-' + Date.now(),
      opened_at: new Date().toISOString(),
      cashier_name: cashierName || 'Cashier',
      opening_float: parseFloat(openingFloat),
      cash_in: 0,
      cash_out: 0,
      total_sales: 0,
      cash_sales: 0,
      card_sales: 0,
      other_sales: 0,
      movements: [],
      status: 'open'
    };
    this.saveActiveShift(newShift);
    return newShift;
  }

  getShifts() {
    const raw = localStorage.getItem(STORAGE_KEYS.SHIFTS);
    return raw ? JSON.parse(raw) : [];
  }

  // --- Held Carts / Parked Orders ---
  getHeldCarts() {
    const raw = localStorage.getItem(STORAGE_KEYS.HELD_CARTS);
    return raw ? JSON.parse(raw) : [];
  }

  holdCart(cartData) {
    const held = this.getHeldCarts();
    const newHeld = {
      id: 'HOLD-' + Date.now(),
      held_at: new Date().toISOString(),
      customer_name: cartData.customer?.name || `Customer #${held.length + 1}`,
      items: cartData.items,
      subtotal: cartData.subtotal,
      total: cartData.total,
      notes: cartData.notes || '',
      type: cartData.type || this.getBusinessMode()
    };
    const updated = [...held, newHeld];
    localStorage.setItem(STORAGE_KEYS.HELD_CARTS, JSON.stringify(updated));
    this.notify('held_carts_updated', updated);
    return newHeld;
  }

  recallHeldCart(heldId) {
    const held = this.getHeldCarts();
    const target = held.find(h => h.id === heldId);
    if (target) {
      const remaining = held.filter(h => h.id !== heldId);
      localStorage.setItem(STORAGE_KEYS.HELD_CARTS, JSON.stringify(remaining));
      this.notify('held_carts_updated', remaining);
    }
    return target;
  }

  deleteHeldCart(heldId) {
    const held = this.getHeldCarts();
    const remaining = held.filter(h => h.id !== heldId);
    localStorage.setItem(STORAGE_KEYS.HELD_CARTS, JSON.stringify(remaining));
    this.notify('held_carts_updated', remaining);
  }

  // --- Customers & Loyalty ---
  getCustomers() {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    return raw ? JSON.parse(raw) : DEFAULT_CUSTOMERS;
  }

  saveCustomers(customers) {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    this.notify('customers_updated', customers);
  }

  addCustomerPoints(customerId, points, orderTotal = points) {
    const customers = this.getCustomers();
    const updated = customers.map(c => {
      if (String(c.id) === String(customerId)) {
        const newPts = Number(c.loyaltyPoints ?? c.points ?? 0) + points;
        let tier = 'Standard';
        if (newPts > 750) tier = 'Platinum';
        else if (newPts > 300) tier = 'Gold';
        else if (newPts > 100) tier = 'Silver';
        return {
          ...c,
          points: newPts,
          loyaltyPoints: newPts,
          visits: Number(c.visits || 0) + 1,
          totalSpent: Number(c.totalSpent || 0) + Number(orderTotal || 0),
          lastVisit: new Date().toISOString().slice(0, 10),
          tier,
        };
      }
      return c;
    });
    this.saveCustomers(updated);
  }

  // --- Sync Queue & Cloud Sync ---
  getSyncQueue() {
    const raw = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
    return raw ? JSON.parse(raw) : [];
  }

  enqueueForSync(entry) {
    const queue = this.getSyncQueue();
    queue.push({
      id: 'QUEUE-' + Date.now() + '-' + Math.random(),
      queued_at: new Date().toISOString(),
      ...entry
    });
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
    this.notify('sync_queue_updated', queue);
  }

  getLastSyncTime() {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  }

  async triggerSync() {
    const mode = this.getStorageMode();
    if (mode === 'local') {
      return { success: true, message: 'Local Storage Mode active (offline air-gapped)', synced: 0 };
    }

    const queue = this.getSyncQueue();
    const cloudUrl = this.getCloudUrl();

    try {
      // Push queue to server if any
      if (queue.length > 0) {
        const response = await fetch(`${cloudUrl}/storage/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: queue })
        });

        if (response.ok) {
          localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify([]));
        }
      }

      // Mark timestamp
      const now = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, now);
      this.notify('sync_completed', { timestamp: now, synced: queue.length });

      return {
        success: true,
        message: queue.length > 0 ? `Synced ${queue.length} transactions with cloud` : 'Cloud database is up to date',
        synced: queue.length,
        timestamp: now
      };
    } catch (err) {
      console.warn('Background sync failed (operating offline):', err.message);
      this.notify('sync_failed', { error: err.message });
      return {
        success: false,
        message: 'Offline: Changes queued locally for sync when reconnected',
        synced: 0,
        error: err.message
      };
    }
  }

  // --- Backup & Restore Engine ---
  exportFullBackup() {
    const backupData = {
      version: '2.0.0-ADVANCED',
      system: 'SIVARA Restaurant & Supermarket POS',
      export_date: new Date().toISOString(),
      storage_mode: this.getStorageMode(),
      business_mode: this.getBusinessMode(),
      categories: this.getCategories(),
      items: this.getItems(),
      orders: this.getOrders(),
      expenses: JSON.parse(localStorage.getItem('pos_expenses') || '[]'),
      customers: this.getCustomers(),
      shifts: this.getShifts(),
      active_shift: this.getActiveShift(),
      held_carts: this.getHeldCarts(),
      tables: JSON.parse(localStorage.getItem(STORAGE_KEYS.TABLES) || '[]'),
      store_info: JSON.parse(localStorage.getItem(STORAGE_KEYS.STORE_INFO) || '{}'),
      sync_queue: this.getSyncQueue()
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `POS_BACKUP_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return backupData;
  }

  importFullBackup(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

      if (!data.items || !data.categories) {
        throw new Error('Invalid backup file: Missing items or categories collections');
      }

      if (data.categories) localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(data.categories));
      if (data.items) localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(data.items));
      if (data.orders) localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(data.orders));
      if (data.expenses) localStorage.setItem('pos_expenses', JSON.stringify(data.expenses));
      if (data.customers) localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(data.customers));
      if (data.shifts) localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(data.shifts));
      if (data.active_shift) localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFT, JSON.stringify(data.active_shift));
      if (data.tables) localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(data.tables));
      if (data.store_info) localStorage.setItem(STORAGE_KEYS.STORE_INFO, JSON.stringify(data.store_info));
      if (data.storage_mode) localStorage.setItem(STORAGE_KEYS.MODE, data.storage_mode);
      if (data.business_mode) localStorage.setItem(STORAGE_KEYS.BUSINESS_MODE, data.business_mode);

      this.notify('backup_restored', data);
      return { success: true, message: 'Database restored successfully!' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  getStorageStats() {
    let totalBytes = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalBytes += (localStorage[key].length + key.length) * 2;
      }
    }
    const kb = (totalBytes / 1024).toFixed(1);
    const queue = this.getSyncQueue();
    const items = this.getItems();
    const orders = this.getOrders();

    return {
      storageSizeKB: kb,
      itemsCount: items.length,
      supermarketItemsCount: items.filter(i => i.is_supermarket || i.barcode).length,
      restaurantItemsCount: items.filter(i => i.is_restaurant || !i.barcode).length,
      ordersCount: orders.length,
      pendingSyncCount: queue.length,
      mode: this.getStorageMode(),
      lastSyncTime: this.getLastSyncTime(),
      isOnline: navigator.onLine
    };
  }
}

export const storageEngine = new StorageEngine();
export default storageEngine;
