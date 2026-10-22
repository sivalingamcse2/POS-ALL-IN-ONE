import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import storageEngine, { playSound } from '../services/storageEngine';
import ThermalReceipt from '../components/ThermalReceipt';
import ShiftManager from '../components/ShiftManager';

export default function SupermarketPOS() {
  const navigate = useNavigate();
  const location = useLocation();
  const barcodeInputRef = useRef(null);

  // Core Data from Unified Storage Engine
  const [items, setItems] = useState(() => storageEngine.getItems('supermarket'));
  const [categories, setCategories] = useState(() => storageEngine.getCategories('supermarket'));
  const [customers, setCustomers] = useState(() => storageEngine.getCustomers());
  const [heldCarts, setHeldCarts] = useState(() => storageEngine.getHeldCarts());
  const [activeShift, setActiveShift] = useState(() => storageEngine.getActiveShift());

  // Active Transaction State
  const [cart, setCart] = useState(() => (
    Array.isArray(location.state?.initialCart) ? location.state.initialCart : []
  ));
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [qtyMultiplier, setQtyMultiplier] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(customers[0] || null);
  const [discountPercent, setDiscountPercent] = useState(0);

  // Modals & Panels
  const [showShiftManager, setShowShiftManager] = useState(false);
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [scaleItem, setScaleItem] = useState(null);
  const [scaleWeight, setScaleWeight] = useState('1.00');

  const [showPriceCheckModal, setShowPriceCheckModal] = useState(false);
  const [priceCheckItem, setPriceCheckItem] = useState(null);

  const [showHeldCartsModal, setShowHeldCartsModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [customerFormError, setCustomerFormError] = useState('');

  // Checkout State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [amountTendered, setAmountTendered] = useState('');
  const [completedOrder, setCompletedOrder] = useState(null);

  // Sync state listener
  useEffect(() => {
    const unsub = storageEngine.subscribe((event) => {
      if (event === 'items_updated') setItems(storageEngine.getItems('supermarket'));
      if (event === 'categories_updated') setCategories(storageEngine.getCategories('supermarket'));
      if (event === 'customers_updated') setCustomers(storageEngine.getCustomers());
      if (event === 'held_carts_updated') setHeldCarts(storageEngine.getHeldCarts());
      if (event === 'shift_updated' || event === 'shift_closed') setActiveShift(storageEngine.getActiveShift());
    });
    return unsub;
  }, []);

  // Auto-focus barcode input
  useEffect(() => {
    if (!showPaymentModal && !showScaleModal && !showPriceCheckModal && !showHeldCartsModal && !showCustomerModal && !showShiftManager) {
      barcodeInputRef.current?.focus();
    }
  }, [showPaymentModal, showScaleModal, showPriceCheckModal, showHeldCartsModal, showCustomerModal, showShiftManager, cart]);

  // Keyboard shortcut listener (F1-F12, Esc)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        handleClearCart();
      } else if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F3') {
        e.preventDefault();
        setShowPriceCheckModal(true);
      } else if (e.key === 'F7') {
        e.preventDefault();
        handleHoldCart();
      } else if (e.key === 'F8') {
        e.preventDefault();
        setShowHeldCartsModal(true);
      } else if (e.key === 'F9') {
        e.preventDefault();
        setShowCustomerModal(true);
      } else if (e.key === 'F10') {
        e.preventDefault();
        if (cart.length > 0) setShowPaymentModal(true);
      } else if (e.key === 'F12') {
        e.preventDefault();
        setShowShiftManager(true);
      } else if (e.key === 'Escape') {
        setShowPaymentModal(false);
        setShowScaleModal(false);
        setShowPriceCheckModal(false);
        setShowHeldCartsModal(false);
        setShowCustomerModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  // Filtered Products
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchCat = selectedCategory === 'all' || item.category_id === Number(selectedCategory);
      return matchCat;
    });
  }, [items, selectedCategory]);

  // Cart Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return (subtotal * (discountPercent / 100));
  }, [subtotal, discountPercent]);

  const taxRate = 0.10; // 10% standard VAT
  const taxAmount = useMemo(() => {
    return ((subtotal - discountAmount) * taxRate);
  }, [subtotal, discountAmount]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount + taxAmount);
  }, [subtotal, discountAmount, taxAmount]);

  const changeDue = useMemo(() => {
    const tendered = parseFloat(amountTendered || 0);
    return Math.max(0, tendered - grandTotal);
  }, [amountTendered, grandTotal]);

  const handleRegisterCustomer = (event) => {
    event.preventDefault();
    const name = newCustomer.name.trim();
    const phone = newCustomer.phone.trim();
    const normalizedPhone = phone.replace(/\D/g, '');

    if (!name) {
      setCustomerFormError('Enter the customer name.');
      return;
    }
    if (normalizedPhone.length < 7 || normalizedPhone.length > 15) {
      setCustomerFormError('Enter a valid mobile number with 7 to 15 digits.');
      return;
    }

    const duplicate = customers.find(
      (customer) => String(customer.phone || '').replace(/\D/g, '') === normalizedPhone,
    );
    if (duplicate) {
      setCustomerFormError(`${duplicate.name} is already registered with this mobile number.`);
      return;
    }

    const customer = {
      id: Date.now(),
      name,
      phone,
      email: newCustomer.email.trim(),
      points: 0,
      loyaltyPoints: 0,
      tier: 'Standard',
      visits: 0,
      totalSpent: 0,
      lastVisit: 'Never',
      created_at: new Date().toISOString(),
    };
    storageEngine.saveCustomers([...customers, customer]);
    setSelectedCustomer(customer);
    setCustomerSearch('');
    setNewCustomer({ name: '', phone: '', email: '' });
    setCustomerFormError('');
    setShowNewCustomerForm(false);
    setShowCustomerModal(false);
  };

  // Add Item to Cart
  const addItemToCart = (item, quantity = 1, isWeighed = false) => {
    if (item.is_weight_scale && !isWeighed) {
      setScaleItem(item);
      setScaleWeight('1.00');
      setShowScaleModal(true);
      return;
    }

    const qty = parseFloat(quantity) || 1;
    const existingIndex = cart.findIndex(c => c.id === item.id);

    playSound('beep');

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity = parseFloat((updated[existingIndex].quantity + qty).toFixed(3));
      setCart(updated);
    } else {
      setCart([...cart, { ...item, quantity: qty }]);
    }

    setQtyMultiplier(1);
    setBarcodeQuery('');
  };

  // Barcode Scan / Enter Handler
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (!barcodeQuery.trim()) return;

    const query = barcodeQuery.trim();

    // Check for quantity multiplier format like "3*890100100101" or "5*"
    if (query.includes('*')) {
      const parts = query.split('*');
      const multiplier = parseFloat(parts[0]) || 1;
      const actualCode = parts[1];
      if (actualCode) {
        const item = storageEngine.getItemByBarcode(actualCode);
        if (item) {
          addItemToCart(item, multiplier);
          return;
        }
      } else {
        setQtyMultiplier(multiplier);
        setBarcodeQuery('');
        return;
      }
    }

    const item = storageEngine.getItemByBarcode(query);
    if (item) {
      if (item._isEmbeddedBarcode && item._embeddedWeight) {
        addItemToCart(item, item._embeddedWeight, true);
      } else {
        addItemToCart(item, qtyMultiplier);
      }
    } else {
      playSound('error');
      alert(`⚠️ Item with Barcode/SKU "${query}" not found in catalog!`);
    }

    setBarcodeQuery('');
    setQtyMultiplier(1);
  };

  // Update item quantity in cart
  const updateQuantity = (itemId, delta) => {
    const updated = cart.map(item => {
      if (item.id === itemId) {
        const newQty = item.is_weight_scale ? parseFloat((item.quantity + delta).toFixed(2)) : item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean);
    setCart(updated);
  };

  const removeItem = (itemId) => {
    setCart(cart.filter(i => i.id !== itemId));
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Clear all items from current cart?')) {
      setCart([]);
      setDiscountPercent(0);
    }
  };

  // Hold & Park Cart
  const handleHoldCart = () => {
    if (cart.length === 0) return;
    storageEngine.holdCart({
      customer: selectedCustomer,
      items: cart,
      subtotal,
      total: grandTotal,
      type: 'supermarket'
    });
    playSound('beep');
    setCart([]);
    setSelectedCustomer(customers[0] || null);
    setDiscountPercent(0);
    alert('Cart held (parked) successfully! You can now serve the next customer.');
  };

  const handleRecallCart = (heldId) => {
    const target = storageEngine.recallHeldCart(heldId);
    if (target) {
      playSound('beep');
      setCart(target.items || []);
      if (target.customer) setSelectedCustomer(target.customer);
      setShowHeldCartsModal(false);
    }
  };

  // Confirm Weighed Produce
  const handleConfirmScaleWeight = () => {
    if (!scaleItem) return;
    const weightNum = parseFloat(scaleWeight) || 0.1;
    addItemToCart(scaleItem, weightNum, true);
    setShowScaleModal(false);
    setScaleItem(null);
  };

  // Fast Checkout Action
  const handleProcessPayment = () => {
    if (cart.length === 0) return;

    const tenderedNum = parseFloat(amountTendered || grandTotal);
    if (paymentMethod === 'Cash' && tenderedNum < grandTotal) {
      alert('Tendered cash is less than the total amount due!');
      return;
    }

    const orderData = {
      items: cart,
      subtotal,
      tax_amount: taxAmount,
      discount: discountAmount,
      total: grandTotal,
      payment_method: paymentMethod,
      amount_tendered: tenderedNum,
      change_due: changeDue,
      customer: selectedCustomer,
      cashier: activeShift?.cashier_name || 'Admin',
      business_type: 'supermarket',
      order_type: 'Supermarket POS Checkout'
    };

    const savedOrder = storageEngine.saveOrder(orderData);
    playSound('chime');

    setCompletedOrder(savedOrder);
    setCart([]);
    setShowPaymentModal(false);
    setAmountTendered('');
    setDiscountPercent(0);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden font-sans">
      {/* 1. TOP SUPERMARKET TERMINAL BAR */}
      <header className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center shadow-md select-none">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500 rounded-xl text-white font-extrabold text-xl shadow">
            🛒
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg tracking-wide uppercase">ALL IN ONE SUPERMARKET POS</h1>
              <span className="px-2 py-0.5 bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-full">
                ADVANCED RETAIL
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Terminal #01 • Cashier: <span className="text-white font-semibold">{activeShift?.cashier_name || 'Admin'}</span>
            </p>
          </div>
        </div>

        {/* Center: Shift & Mode Shortcuts */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShiftManager(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all text-amber-400"
          >
            <span>💼</span>
            {activeShift ? `Drawer: $${(parseFloat(activeShift.opening_float || 0) + parseFloat(activeShift.cash_sales || 0)).toFixed(2)}` : 'Open Shift'}
          </button>

          <button
            onClick={() => setShowHeldCartsModal(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all text-blue-400"
          >
            <span>⏸️</span>
            Held Carts ({heldCarts.length})
          </button>

          <button
            onClick={() => setShowPriceCheckModal(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all text-purple-400"
          >
            <span>🔍</span>
            Price Check (F3)
          </button>

          {/* Mode Switcher */}
          <button
            onClick={() => navigate('/pos')}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow transition-all"
            title="Switch to Restaurant Dining Table Mode"
          >
            <span>🍽️</span>
            Switch to Restaurant POS
          </button>
        </div>
      </header>

      {/* 2. MAIN CASHIER WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SECTION: Barcode Entry & Product Catalog */}
        <div className="flex-1 flex flex-col p-3 overflow-hidden">
          {/* A. Fast Barcode Scanning Input Bar */}
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-200 mb-3">
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2 items-center">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 text-lg">
                  📷
                </span>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Scan USB Barcode, SKU, or type '3*Barcode' for multiplier (Press Enter)..."
                  value={barcodeQuery}
                  onChange={(e) => setBarcodeQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-emerald-500 rounded-xl text-base font-mono font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-gray-400"
                />
              </div>

              {/* Quantity Multiplier Pill */}
              <div className="flex items-center gap-1 bg-gray-100 px-3 py-2 rounded-xl border border-gray-200">
                <span className="text-xs font-bold text-gray-500">QTY:</span>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={qtyMultiplier}
                  onChange={(e) => setQtyMultiplier(parseInt(e.target.value) || 1)}
                  className="w-12 text-center font-extrabold text-sm bg-transparent border-none focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-sm shadow flex items-center gap-1.5 transition-all"
              >
                Scan / Enter
              </button>
            </form>
          </div>

          {/* B. Department Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none select-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-sm ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              🏷️ All Products ({items.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-sm flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span>{cat.icon || '📦'}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* C. Touch Product Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {filteredItems.map((item) => {
                const isWeighed = item.is_weight_scale;
                const isLowStock = (item.stock_quantity || 0) <= (item.reorder_level || 10);

                return (
                  <button
                    key={item.id}
                    onClick={() => addItemToCart(item, qtyMultiplier)}
                    className="bg-white hover:border-emerald-500 hover:shadow-md p-3 rounded-2xl border border-gray-200 flex flex-col justify-between text-left transition-all active:scale-95 group relative"
                  >
                    {/* Top badges */}
                    <div className="flex justify-between items-start w-full mb-1">
                      {isWeighed ? (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded-md flex items-center gap-0.5">
                          ⚖️ By {item.unit || 'kg'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-mono">
                          {item.sku || 'SKU'}
                        </span>
                      )}

                      {isLowStock && (
                        <span className="px-1 py-0.2 bg-red-100 text-red-700 text-[9px] font-bold rounded">
                          Low: {item.stock_quantity}
                        </span>
                      )}
                    </div>

                    {/* Item Name */}
                    <h3 className="font-bold text-gray-800 text-xs line-clamp-2 mb-2 group-hover:text-emerald-700">
                      {item.name}
                    </h3>

                    {/* Bottom Price & Barcode */}
                    <div className="w-full pt-1 border-t border-gray-100 flex justify-between items-baseline">
                      <span className="text-sm font-extrabold text-gray-900 group-hover:text-emerald-600">
                        ${parseFloat(item.price).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {item.barcode ? `*${String(item.barcode).slice(-4)}` : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* D. Bottom Keyboard Shortcuts Strip */}
          <div className="bg-slate-900 text-slate-300 text-[11px] font-mono py-1.5 px-3 rounded-xl mt-2 flex justify-between items-center overflow-x-auto select-none">
            <span><strong>F1:</strong> Clear</span>
            <span><strong>F2:</strong> Scan</span>
            <span><strong>F3:</strong> Price Check</span>
            <span><strong>F7:</strong> Hold Cart</span>
            <span><strong>F8:</strong> Recall</span>
            <span><strong>F9:</strong> Customer</span>
            <span><strong>F10:</strong> Checkout</span>
            <span><strong>F12:</strong> Drawer</span>
          </div>
        </div>

        {/* RIGHT SECTION: Active Cart & Cashier Register Terminal */}
        <div className="w-[380px] lg:w-[420px] bg-white border-l border-gray-200 flex flex-col shadow-xl">
          {/* Cart Header */}
          <div className="p-3.5 bg-slate-50 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-sm">🛒</span>
              <div>
                <h2 className="font-extrabold text-sm text-gray-800">Current Register Cart</h2>
                <p className="text-[11px] text-gray-500">{cart.length} unique line items</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleHoldCart}
                disabled={cart.length === 0}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-all"
                title="Hold / Park this cart (F7)"
              >
                Park Cart
              </button>
              <button
                onClick={handleClearCart}
                disabled={cart.length === 0}
                className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-40 rounded-lg transition-colors"
                title="Clear Cart (F1)"
              >
                🗑️
              </button>
            </div>
          </div>

          {/* Customer Loyalty Strip */}
          <div className="px-3.5 py-2 bg-emerald-50/70 border-b border-emerald-100 flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5">
              <span>👤</span>
              <span className="font-bold text-emerald-900">{selectedCustomer?.name || 'Walk-in Customer'}</span>
              {selectedCustomer?.phone && selectedCustomer.id !== 1 && (
                <span className="text-emerald-700">{selectedCustomer.phone}</span>
              )}
              {Number(selectedCustomer?.loyaltyPoints ?? selectedCustomer?.points ?? 0) > 0 && (
                <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-800 text-[10px] font-extrabold rounded-md">
                  {selectedCustomer.loyaltyPoints ?? selectedCustomer.points} pts
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setCustomerFormError('');
                setShowNewCustomerForm(false);
                setShowCustomerModal(true);
              }}
              className="text-emerald-700 font-bold hover:underline text-[11px]"
            >
              Select / Register (F9)
            </button>
          </div>

          {/* Itemized Cart List */}
          <div className="flex-1 overflow-y-auto p-3 divide-y divide-gray-100">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2 py-12">
                <span className="text-4xl">🛒</span>
                <p className="text-sm font-semibold">Cart is empty</p>
                <p className="text-xs text-gray-400 text-center max-w-[200px]">
                  Scan a barcode with your scanner or click an item to start sale.
                </p>
              </div>
            ) : (
              cart.map((item) => {
                const lineTotal = (item.price * item.quantity).toFixed(2);
                const isWeighed = item.is_weight_scale;

                return (
                  <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex-1 pr-2">
                      <p className="font-bold text-gray-900 truncate">{item.name}</p>
                      <p className="text-[11px] text-gray-500">
                        {isWeighed
                          ? `${item.quantity} ${item.unit || 'kg'} @ $${item.price.toFixed(2)}/${item.unit || 'kg'}`
                          : `${item.quantity} x $${item.price.toFixed(2)}`}
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1.5 mr-3">
                      <button
                        onClick={() => updateQuantity(item.id, isWeighed ? -0.25 : -1)}
                        className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded font-bold text-gray-700 flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-extrabold text-gray-800">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, isWeighed ? 0.25 : 1)}
                        className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded font-bold text-gray-700 flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="font-extrabold text-sm text-gray-900">${lineTotal}</p>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-[10px] text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Totals & Checkout Box */}
          <div className="p-4 bg-slate-50 border-t border-gray-200 space-y-3">
            {/* Discount selector */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-600 font-semibold">Special Discount:</span>
              <div className="flex gap-1">
                {[0, 5, 10, 15].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setDiscountPercent(pct)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      discountPercent === pct
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Discount ({discountPercent}%):</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tax (VAT 10%):</span>
                <span>${taxAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Grand Total Banner */}
            <div className="p-3 bg-slate-900 text-white rounded-xl flex justify-between items-baseline shadow-inner">
              <span className="text-sm font-bold text-slate-300 uppercase">AMOUNT DUE:</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">
                ${grandTotal.toFixed(2)}
              </span>
            </div>

            {/* Big Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setPaymentMethod('Cash');
                  setAmountTendered(grandTotal.toFixed(2));
                  setShowPaymentModal(true);
                }}
                disabled={cart.length === 0}
                className="py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold rounded-xl shadow-lg flex items-center justify-center gap-1.5 text-sm transition-all"
              >
                <span>💵</span> Cash / Pay (F10)
              </button>
              <button
                onClick={() => {
                  setPaymentMethod('Card');
                  setAmountTendered(grandTotal.toFixed(2));
                  setShowPaymentModal(true);
                }}
                disabled={cart.length === 0}
                className="py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-extrabold rounded-xl shadow-lg flex items-center justify-center gap-1.5 text-sm transition-all"
              >
                <span>💳</span> Card Checkout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL 1: SCALE / WEIGHING MODAL --- */}
      {showScaleModal && scaleItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="text-center">
              <span className="text-3xl">⚖️</span>
              <h3 className="font-extrabold text-lg text-gray-900 mt-1">{scaleItem.name}</h3>
              <p className="text-xs text-gray-500">Unit Price: ${scaleItem.price.toFixed(2)} / {scaleItem.unit || 'kg'}</p>
            </div>

            {/* Digital Scale Readout Display */}
            <div className="bg-slate-900 p-4 rounded-xl text-center font-mono">
              <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">DIGITAL SCALE WEIGHT (KG)</span>
              <div className="text-3xl font-extrabold text-white mt-1">
                {parseFloat(scaleWeight || 0).toFixed(3)} <span className="text-sm text-gray-400">kg</span>
              </div>
              <div className="text-xs text-emerald-300 font-bold mt-1">
                Calculated Price: ${(parseFloat(scaleWeight || 0) * scaleItem.price).toFixed(2)}
              </div>
            </div>

            {/* Quick Weight Selectors */}
            <div className="grid grid-cols-4 gap-2">
              {['0.25', '0.50', '1.00', '1.50', '2.00', '2.50', '3.00', '5.00'].map((w) => (
                <button
                  key={w}
                  onClick={() => setScaleWeight(w)}
                  className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    scaleWeight === w ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {w} kg
                </button>
              ))}
            </div>

            {/* Custom Weight Input */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Custom Weight (kg):</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={scaleWeight}
                onChange={(e) => setScaleWeight(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl font-mono text-base font-bold text-center"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowScaleModal(false)}
                className="flex-1 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmScaleWeight}
                className="flex-1 py-2.5 bg-emerald-600 text-white font-extrabold rounded-xl hover:bg-emerald-500 shadow-md transition-all text-sm"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: PAYMENT & FAST CASH TENDER --- */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💵</span>
                <div>
                  <h3 className="font-extrabold text-lg text-gray-900">Checkout & Tender</h3>
                  <p className="text-xs text-gray-500">Total Due: <strong className="text-emerald-700 font-mono text-sm">${grandTotal.toFixed(2)}</strong></p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'Cash', label: 'Cash', icon: '💵' },
                { id: 'Card', label: 'Card', icon: '💳' },
                { id: 'QR / Wallet', label: 'Digital', icon: '📱' },
                { id: 'Split', label: 'Split', icon: '🔄' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className={`py-2 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === m.id
                      ? 'bg-slate-900 text-white border-slate-900 shadow'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'
                  }`}
                >
                  <span className="text-base">{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            {/* Fast Cash Tender Buttons (if Cash mode) */}
            {paymentMethod === 'Cash' && (
              <div className="space-y-3">
                <div className="grid grid-cols-5 gap-2">
                  <button
                    onClick={() => setAmountTendered(grandTotal.toFixed(2))}
                    className="py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-extrabold rounded-lg border border-emerald-300"
                  >
                    Exact
                  </button>
                  {[5, 10, 20, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setAmountTendered(amt.toString())}
                      className="py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs font-extrabold rounded-lg border border-gray-300"
                    >
                      ${amt}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Amount Tendered ($):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    placeholder="Enter cash given by customer..."
                    className="w-full px-4 py-3 border-2 border-emerald-500 rounded-xl text-2xl font-extrabold text-center font-mono focus:outline-none"
                    autoFocus
                  />
                </div>

                {/* Change Due Display Banner */}
                <div className={`p-4 rounded-xl text-center ${
                  changeDue > 0 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-800'
                }`}>
                  <span className="text-xs uppercase font-extrabold tracking-wider">CHANGE DUE:</span>
                  <div className="text-3xl font-black font-mono mt-0.5">
                    ${changeDue.toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleProcessPayment}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-xl text-base transition-all flex items-center justify-center gap-2"
            >
              <span>✅</span> Complete Transaction & Print Receipt
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL 3: PRICE CHECK / LOOKUP (F3) --- */}
      {showPriceCheckModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-gray-900 flex items-center gap-2">
                <span>🔍</span> Price Check & Stock Lookup
              </h3>
              <button
                onClick={() => { setShowPriceCheckModal(false); setPriceCheckItem(null); }}
                className="text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              placeholder="Scan or enter barcode / SKU..."
              className="w-full px-4 py-2.5 border-2 border-purple-500 rounded-xl font-mono text-sm"
              autoFocus
              onChange={(e) => {
                const item = storageEngine.getItemByBarcode(e.target.value.trim());
                setPriceCheckItem(item || null);
              }}
            />

            {priceCheckItem ? (
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 space-y-2">
                <h4 className="font-extrabold text-purple-900 text-base">{priceCheckItem.name}</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                  <div>
                    <span className="text-gray-500">Retail Price:</span>
                    <p className="text-xl font-black text-purple-800">${priceCheckItem.price.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Stock on Hand:</span>
                    <p className="text-xl font-bold text-gray-900">{priceCheckItem.stock_quantity} {priceCheckItem.unit || 'pcs'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Department:</span>
                    <p className="font-semibold">{priceCheckItem.department || 'General'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Expiry Date:</span>
                    <p className="font-semibold">{priceCheckItem.expiry_date || 'N/A'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">Scan an item to view price and stock.</p>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL 4: HELD CARTS (PARKED TICKETS) --- */}
      {showHeldCartsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-gray-900">Held / Parked Shopping Carts</h3>
              <button onClick={() => setShowHeldCartsModal(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            {heldCarts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No held carts currently parked.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {heldCarts.map((h) => (
                  <div key={h.id} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-gray-800">{h.customer_name}</p>
                      <p className="text-gray-500">{h.items?.length || 0} items • Held at {new Date(h.held_at).toLocaleTimeString()}</p>
                      <p className="font-extrabold text-emerald-700">${parseFloat(h.total || 0).toFixed(2)}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleRecallCart(h.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg"
                      >
                        Recall
                      </button>
                      <button
                        onClick={() => storageEngine.deleteHeldCart(h.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL 5: CUSTOMER SELECTION & LOYALTY --- */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-gray-900">Customer & Loyalty</h3>
              <button onClick={() => setShowCustomerModal(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowNewCustomerForm((visible) => !visible);
                setCustomerFormError('');
              }}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-700"
            >
              {showNewCustomerForm ? 'Cancel registration' : '+ Register new customer'}
            </button>

            {showNewCustomerForm && (
              <form onSubmit={handleRegisterCustomer} className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <h4 className="text-sm font-extrabold text-slate-800">New CRM member</h4>
                {customerFormError && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    {customerFormError}
                  </p>
                )}
                <label className="block text-xs font-bold text-slate-700">
                  Customer name
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(event) => {
                      setNewCustomer({ ...newCustomer, name: event.target.value });
                      setCustomerFormError('');
                    }}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Enter full name"
                    autoComplete="name"
                    maxLength={100}
                    required
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Mobile number
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(event) => {
                      setNewCustomer({ ...newCustomer, phone: event.target.value });
                      setCustomerFormError('');
                    }}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="e.g. +971 50 123 4567"
                    autoComplete="tel"
                    maxLength={24}
                    required
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Email <span className="font-normal text-slate-400">(optional)</span>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(event) => setNewCustomer({ ...newCustomer, email: event.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="name@example.com"
                    autoComplete="email"
                  />
                </label>
                <button type="submit" className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-slate-800">
                  Save & select customer
                </button>
              </form>
            )}

            <input
              type="text"
              placeholder="Search by customer name, phone, or scan membership card..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-xs"
              autoFocus
            />

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {customers.length === 0 && (
                <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">No registered customers yet. Register one above.</p>
              )}
              {customers
                .filter(c => String(c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone && c.phone.includes(customerSearch)))
                .map((cust) => (
                  <div
                    key={cust.id}
                    onClick={() => { setSelectedCustomer(cust); setShowCustomerModal(false); }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        setSelectedCustomer(cust);
                        setShowCustomerModal(false);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="p-3 bg-gray-50 hover:bg-emerald-50 rounded-xl border border-gray-200 cursor-pointer flex justify-between items-center text-xs"
                  >
                    <div>
                      <p className="font-bold text-gray-900">{cust.name}</p>
                      <p className="text-gray-500">{cust.phone || 'No phone'}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-md text-[10px]">
                        {cust.loyaltyPoints ?? cust.points ?? 0} pts
                      </span>
                      <p className="text-[10px] text-gray-500">{cust.tier || 'Standard'}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* --- THERMAL RECEIPT MODAL --- */}
      {completedOrder && (
        <ThermalReceipt
          order={completedOrder}
          onClose={() => setCompletedOrder(null)}
        />
      )}

      {/* --- CASH DRAWER & SHIFT MANAGER MODAL --- */}
      <ShiftManager
        isOpen={showShiftManager}
        onClose={() => setShowShiftManager(false)}
        currentCashier={activeShift?.cashier_name || 'Admin'}
      />
    </div>
  );
}
