import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_ITEMS } from '../services/storageEngine';
import { getRestaurantMenuCategories, isAssignedToRestaurant } from '../utils/restaurantMenu';

export default function MobilePOS() {
  const { activeRestaurant, hasPermission, logout } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [serviceType, setServiceType] = useState('Dine-In'); // 'Dine-In', 'Room Service', 'Takeaway', 'Retail'
  const [view, setView] = useState('service-type'); // 'service-type', 'tables', 'menu', 'cart', 'orders', 'guest-profile'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [modifyingItem, setEditingModifier] = useState(null);
  const [guestSearch, setGuestSearch] = useState('');
  const [activeOrders, setActiveOrders] = useState([]);
  const [customers, setCustomers] = useState(() => JSON.parse(localStorage.getItem('pos_customers') || '[]'));
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '' });
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const navigationItems = [
    ['Dashboard', '/dashboard'], ['POS', '/pos'], ['Mobile POS', '/mobile-pos'],
    ['Kitchen (KDS)', '/kds'], ['Orders', '/orders'], ['Menu', '/menu'],
    ['Inventory', '/inventory'], ['Reports', '/reports'], ['CRM', '/crm'],
    ['HRMS', '/hrms'], ['Users', '/users'], ['Settings', '/settings']
  ];

  const tables = JSON.parse(localStorage.getItem('pos_tables') || '[]');
  const items = JSON.parse(localStorage.getItem('pos_menu_items') || '[]');
  const categories = JSON.parse(localStorage.getItem('pos_categories') || '[]');
  const restaurantId = Number(activeRestaurant?.id || 1);
  const branchItems = items.filter(item => isAssignedToRestaurant(item, restaurantId));
  const restaurantItems = branchItems.filter(item => item.is_restaurant || (!item.is_supermarket && !item.barcode));
  const menuItems = restaurantItems.length > 0
    ? restaurantItems
    : restaurantId === 1 ? DEFAULT_ITEMS.filter(item => item.is_restaurant) : [];
  const menuCategories = getRestaurantMenuCategories(categories, menuItems, restaurantId)
    .filter(category => category.type === 'restaurant' || !category.type);

  useEffect(() => {
    const fetchOrders = () => {
      const allOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
      setActiveOrders(allOrders.filter(o => o.status !== 'Paid' && o.status !== 'Cancelled').slice(0, 10));
    };
    fetchOrders();
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, []);

  const addToCart = (item) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, quantity: 1, modifiers: '' }]);
    }
  };

  const updateModifier = (id, text) => {
    setCart(cart.map(c => c.id === id ? { ...c, modifiers: text } : c));
    setEditingModifier(null);
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(c => c.id !== id));
  };

  const saveCustomer = (event) => {
    event.preventDefault();
    if (!customerForm.name.trim() || !customerForm.phone.trim()) return alert('Enter customer name and mobile number');
    const existingCustomers = [...customers];
    const updatedCustomers = editingCustomerId
      ? existingCustomers.map(customer => customer.id === editingCustomerId ? { ...customer, name: customerForm.name.trim(), phone: customerForm.phone.trim() } : customer)
      : [{ id: Date.now(), name: customerForm.name.trim(), phone: customerForm.phone.trim(), totalSpent: 0, loyaltyPoints: 0 }, ...existingCustomers];
    setCustomers(updatedCustomers);
    localStorage.setItem('pos_customers', JSON.stringify(updatedCustomers));
    setCustomerForm({ name: '', phone: '' });
    setEditingCustomerId(null);
  };

  const editCustomer = (customer) => {
    setCustomerForm({ name: customer.name, phone: customer.phone || '' });
    setEditingCustomerId(customer.id);
  };

  const deleteCustomer = (id) => {
    if (!window.confirm('Delete this customer?')) return;
    const updatedCustomers = customers.filter(customer => customer.id !== id);
    setCustomers(updatedCustomers);
    localStorage.setItem('pos_customers', JSON.stringify(updatedCustomers));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handlePlaceOrder = () => {
    if (!customerName.trim()) return alert('Enter customer name');
    if (!customerPhone.trim()) return alert('Enter customer mobile number');
    if (serviceType === 'Dine-In' && !selectedTable) return alert('Select a table first');
    if (serviceType === 'Room Service' && !selectedRoom) return alert('Enter Room Number');
    
    const newOrder = {
      id: Math.floor(1000 + Math.random() * 9000),
      restaurant_id: activeRestaurant?.id,
      table_id: selectedTable?.id,
      table_name: serviceType === 'Room Service' ? `ROOM ${selectedRoom}` : selectedTable?.table_name || serviceType,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      room_number: serviceType === 'Room Service' ? selectedRoom : '',
      subtotal: total,
      total_amount: total,
      items: cart.map(c => ({ item_id: c.id, item_name: c.name, quantity: c.quantity, price: c.price, notes: c.modifiers })),
      date: new Date().toISOString(),
      status: 'Pending',
      payment_method: 'N/A',
      service_type: serviceType
    };

    const orders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
    localStorage.setItem('pos_orders', JSON.stringify([newOrder, ...orders]));
    
    if (selectedTable) {
      const updatedTables = tables.map(t => t.id === selectedTable.id ? { ...t, status: 'occupied' } : t);
      localStorage.setItem('pos_tables', JSON.stringify(updatedTables));
    }

    alert(`Order for ${newOrder.table_name} sent to KDS!`);
    setCart([]);
    setSelectedTable(null);
    setSelectedRoom('');
    setCustomerName('');
    setCustomerPhone('');
    setView('orders');
  };

  const handlePrintOrder = (order) => {
    const currency = activeRestaurant?.currency || '$';
    const receiptWindow = window.open('', '_blank', 'width=420,height=700');
    if (!receiptWindow) return alert('Allow pop-ups to print the receipt');
    receiptWindow.document.write(`
      <html><head><title>Receipt #${order.id}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#172b35}h1{text-align:center;font-size:22px}.meta{border-bottom:1px solid #ddd;padding-bottom:12px;margin-bottom:12px}.row{display:flex;justify-content:space-between;margin:8px 0}.total{border-top:2px solid #172b35;padding-top:12px;font-weight:bold;font-size:18px}</style>
      </head><body><h1>${activeRestaurant?.name || 'SIVARA POS'}</h1>
      <div class="meta">Receipt #${order.id}<br>${new Date(order.date).toLocaleString()}<br>Customer: ${order.customer_name || 'Walk-in'}<br>Mobile: ${order.customer_phone || 'N/A'}<br>${order.room_number ? `Room: ${order.room_number}` : `Service: ${order.service_type}`}</div>
      ${order.items.map(item => `<div class="row"><span>${item.quantity} x ${item.item_name}</span><span>${currency}${(item.price * item.quantity).toFixed(2)}</span></div>`).join('')}
      <div class="row total"><span>Total</span><span>${currency}${Number(order.total_amount).toFixed(2)}</span></div>
      <div class="row">Payment <span>${order.payment_method}</span></div><script>window.print();window.close();</script></body></html>`);
    receiptWindow.document.close();
  };

  const handlePayment = (order, method) => {
    const allOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
    const updatedOrders = allOrders.map(o => o.id === order.id ? { ...o, status: 'Paid', payment_method: method } : o);
    localStorage.setItem('pos_orders', JSON.stringify(updatedOrders));

    // Update inventory
    const allMenuItems = JSON.parse(localStorage.getItem('pos_menu_items') || '[]');
    const updatedMenuItems = allMenuItems.map(item => {
      const orderItem = order.items.find(oi => oi.item_id === item.id);
      if (orderItem) {
        return { ...item, stock_quantity: Math.max(0, (item.stock_quantity || 0) - orderItem.quantity) };
      }
      return item;
    });
    localStorage.setItem('pos_menu_items', JSON.stringify(updatedMenuItems));

    // Update table status
    if (order.table_id) {
      const allTables = JSON.parse(localStorage.getItem('pos_tables') || '[]');
      const updatedTables = allTables.map(t => t.id === order.table_id ? { ...t, status: 'available' } : t);
      localStorage.setItem('pos_tables', JSON.stringify(updatedTables));
    }

    alert(`Payment successful via ${method} for ${order.table_name}!`);
    setActiveOrders(updatedOrders.filter(o => o.status !== 'Paid' && o.status !== 'Cancelled').slice(0, 10));
  };

  const [settlingOrder, setSettlingOrder] = useState(null);

  return (
    <div className="mobile-pos app-main flex min-h-screen w-full bg-slate-100 font-sans">
      <aside className="hidden">
        <div className="border-b border-gray-700 p-4">
          <h1 className="text-xl font-bold">POS System</h1>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">Mobile workspace</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-4">
          {navigationItems.filter(([, path]) => path !== '/users' || hasPermission('UserMgmt')).map(([label, path]) => (
            <button key={path} type="button" onClick={() => navigate(path)} className={`mb-2 flex w-full items-center rounded-lg px-4 py-3 text-left text-lg font-bold transition-colors ${path === '/mobile-pos' ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
              {label}
            </button>
          ))}
        </nav>
        <button type="button" onClick={() => { logout(); navigate('/login'); }} className="border-t border-gray-700 p-4 text-left text-sm font-bold text-gray-400 hover:text-white">Sign out</button>
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <div className="flex min-h-screen w-full flex-col bg-slate-100">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-md sm:px-6">
        <div className="flex items-center gap-2">
           <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 font-black shadow-sm">S</div>
            <div>
              <h1 className="!text-white text-sm font-extrabold leading-tight tracking-wide">SIVARA MOBILE POS</h1>
              <div className="mt-0.5 flex items-center gap-1.5">
                 <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                <p className="text-[10px] font-semibold text-emerald-300">Terminal ready · Cloud sync</p>
              </div>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <button onClick={() => setView('guest-profile')} className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 transition-colors hover:text-emerald-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
           </button>
           <div className="border-l border-slate-700 pl-3 text-right">
              <p className="text-xs font-semibold leading-none text-slate-300">{activeRestaurant?.name}</p>
              <p className="mt-1 text-xs font-extrabold text-white">{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
           </div>
        </div>
      </div>

      {/* Navigation */}
      {view !== 'service-type' && (
        <div className="sticky top-[60px] z-20 flex overflow-x-auto border-b border-slate-200 bg-white shadow-sm no-scrollbar">
          {['service-type', 'tables', 'menu', 'cart', 'orders'].map(v => (
            <button 
              key={v}
              onClick={() => setView(v)}
              className={`flex-none border-b-[3px] px-4 py-3 text-xs font-bold capitalize transition-all sm:px-6 ${view === v ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {v.replace('-', ' ')} {v === 'cart' && cart.length > 0 && `(${cart.length})`}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-28 sm:px-6 lg:px-8">
        {view === 'service-type' && (
          <div className="w-full space-y-5">
             <div>
               <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Start a new order</p>
               <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Select service type</h2>
             </div>
             <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { id: 'Dine-In', icon: '🍽️', color: 'blue' },
                  { id: 'Room Service', icon: '🏨', color: 'emerald' },
                  { id: 'Takeaway', icon: '🥡', color: 'orange' },
                  { id: 'Retail', icon: '🛒', color: 'indigo' }
                ].map(type => (
                  <button 
                    key={type.id}
                    onClick={() => { setServiceType(type.id); setView(type.id === 'Dine-In' ? 'tables' : 'menu'); }}
                    className="group flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md active:scale-[0.98]"
                  >
                    <span className="text-3xl transition-transform group-hover:scale-110">{type.icon}</span>
                    <span className="text-sm font-bold text-slate-800">{type.id}</span>
                  </button>
                ))}
             </div>
          </div>
        )}

        {view === 'tables' && (
          <div className="w-full space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Dine-in service</p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-900">Select a table</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
              {tables.map(table => (
                <button 
                  key={table.id}
                  onClick={() => { setSelectedTable(table); setView('menu'); }}
                  className={`flex aspect-[1.25/1] flex-col items-center justify-center rounded-2xl border text-center transition-all ${selectedTable?.id === table.id ? 'scale-[0.98] border-emerald-600 bg-emerald-600 text-white shadow-md' : table.status === 'occupied' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:shadow-sm'}`}
                >
                  <span className="text-base font-extrabold">{table.table_name}</span>
                  <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">{table.status}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'menu' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-800">Customer details</p>
                <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">Required</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[9px] font-black uppercase tracking-widest text-emerald-700">Name *</label>
                <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full name" className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-3 text-sm font-bold text-gray-800 outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-black uppercase tracking-widest text-emerald-700">Mobile *</label>
                <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Mobile number" className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-3 text-sm font-bold text-gray-800 outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-black uppercase tracking-widest text-emerald-700">Order</label>
                <div className="rounded-lg border border-emerald-100 bg-white px-3 py-3 text-sm font-bold text-gray-700">{serviceType}{selectedTable ? ` • ${selectedTable.table_name}` : ''}</div>
              </div>
              </div>
            </div>
            {serviceType === 'Room Service' && (
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-4">
                 <label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-2 block">Enter Guest Room Number</label>
                 <input 
                   type="number" 
                   value={selectedRoom}
                   onChange={(e) => setSelectedRoom(e.target.value)}
                   placeholder="e.g. 101"
                   className="w-full bg-white border-2 border-emerald-200 rounded-xl px-4 py-3 font-black text-lg text-emerald-700 outline-none"
                 />
              </div>
            )}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition ${
                  selectedCategory === 'all'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
                }`}
              >
                All Items
              </button>
              {menuCategories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(String(cat.id))}
                  className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition ${
                    selectedCategory === String(cat.id)
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {menuItems.filter(item => (
                selectedCategory === 'all'
                || String(item.category_id ?? item.categoryId ?? '') === selectedCategory
              )).map(item => (
                <button 
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md active:scale-[0.98]"
                >
                  <div className="relative mb-2 flex aspect-[1.8/1] w-full items-center justify-center overflow-hidden rounded-xl bg-slate-50 text-xl">
                    <span aria-hidden="true">🍴</span>
                     {cart.find(c => c.id === item.id) && (
                       <div className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-xs font-extrabold text-white">{cart.find(c => c.id === item.id).quantity}</div>
                     )}
                  </div>
                  <p className="mb-1 truncate text-sm font-bold leading-tight text-slate-800">{item.name}</p>
                  <p className="text-sm font-extrabold text-emerald-700">{activeRestaurant?.currency}{item.price}</p>
                </button>
              ))}
              {menuItems.filter(item => (
                selectedCategory === 'all'
                || String(item.category_id ?? item.categoryId ?? '') === selectedCategory
              )).length === 0 && (
                <p className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                  No menu items in this category.
                </p>
              )}
            </div>
          </div>
        )}

        {view === 'cart' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
               <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Order Details</h2>
               <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                  {serviceType === 'Room Service' ? `Room ${selectedRoom || '?'}` : selectedTable?.table_name || serviceType}
               </span>
            </div>
            {cart.length === 0 ? (
              <div className="text-center py-20 opacity-20">
                <div className="text-4xl mb-2">🛒</div>
                <p className="font-black uppercase tracking-widest text-xs">Cart is empty</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-black text-gray-800 text-sm">{item.name}</p>
                        <p className="text-emerald-600 font-bold text-xs">{activeRestaurant?.currency}{item.price} x {item.quantity}</p>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => setEditingModifier(item)} className="p-2 bg-gray-50 rounded-xl text-gray-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                         <button onClick={() => removeFromCart(item.id)} className="p-2 bg-red-50 rounded-xl text-red-500 font-black">&times;</button>
                      </div>
                    </div>
                    {item.modifiers && (
                      <p className="mt-2 text-[10px] font-bold text-orange-500 italic bg-orange-50 px-2 py-1 rounded-lg">Modifier: {item.modifiers}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'orders' && (
          <div className="space-y-4">
             <h2 className="text-xl font-extrabold text-slate-900">Recent orders</h2>
             <div className="space-y-3">
                {activeOrders.map(order => (
                  <div key={order.id} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                     <div className="flex justify-between items-start mb-2">
                        <div>
                           <p className="font-black text-gray-800">{order.customer_name || 'Walk-in Customer'}</p>
                           <p className="text-xs font-bold text-gray-500">{order.customer_phone || 'No mobile number'}</p>
                           <p className="text-xs font-bold text-emerald-600">{order.table_name}{order.room_number ? ` • Room ${order.room_number}` : ''}</p>
                           <p className="text-[10px] font-bold text-gray-400">ORD-#{order.id} • {new Date(order.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${order.status === 'Ready' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>{order.status}</span>
                     </div>
                     <div className="space-y-1 mb-4">
                        {order.items.map((i, idx) => (
                          <p key={idx} className="text-xs text-gray-500 font-bold">{i.quantity}x {i.item_name}</p>
                        ))}
                     </div>
                     <div className="flex gap-2">
                        <button onClick={() => setSettlingOrder(order)} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700">Settle bill</button>
                        <button onClick={() => handlePrintOrder(order)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200" title="Print receipt">Print</button>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {view === 'guest-profile' && (
          <div className="space-y-6">
             <div className="flex justify-between items-center">
                <h2 className="text-xl font-extrabold text-slate-900">Guest profiles</h2>
                <button onClick={() => setView('menu')} className="text-gray-400 font-bold text-xs">Back</button>
             </div>
             <form onSubmit={saveCustomer} className="grid gap-2 rounded-2xl border border-blue-100 bg-blue-50/60 p-3 sm:grid-cols-[1fr_1fr_auto]">
               <input type="text" placeholder="Customer name" className="rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-blue-500" value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} required />
               <input type="tel" placeholder="Mobile number" className="rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-blue-500" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} required />
               <button type="submit" className="rounded-lg bg-blue-600 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white">{editingCustomerId ? 'Save Edit' : 'Add Customer'}</button>
             </form>
             <div className="flex gap-2">
               <input type="text" placeholder="Search guest history..." className="min-w-0 flex-1 rounded-2xl border-2 border-gray-100 bg-white px-5 py-4 font-bold text-gray-800 outline-none focus:border-emerald-500 transition-all" value={guestSearch} onChange={(e) => setGuestSearch(e.target.value)} />
               {editingCustomerId && <button type="button" onClick={() => { setEditingCustomerId(null); setCustomerForm({ name: '', phone: '' }); }} className="rounded-xl px-3 text-[10px] font-black uppercase text-gray-400">Cancel</button>}
             </div>
             <div className="space-y-3">
               {customers.filter(c => c.name.toLowerCase().includes(guestSearch.toLowerCase())).map(guest => (
                  <div key={guest.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                     <div className="flex items-start justify-between mb-2">
                        <div>
                      <p className="break-words font-black text-gray-800">{guest.name}</p>
                          <p className="text-xs font-bold text-gray-500">{guest.phone || 'No mobile number'}</p>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => editCustomer(guest)} className="rounded-lg bg-blue-50 px-3 py-2 text-[9px] font-black uppercase text-blue-600">Edit Details</button>
                          <button type="button" onClick={() => deleteCustomer(guest.id)} className="rounded-lg bg-red-50 px-3 py-2 text-[9px] font-black uppercase text-red-600">Delete</button>
                        </div>
                     </div>
                     <p className="text-xs text-gray-400 font-bold">Total Spent: ${guest.totalSpent?.toFixed(2)}</p>
                     <p className="text-xs text-gray-400 font-bold mb-4">Loyalty: {guest.loyaltyPoints} PTS</p>
                     <button className="w-full bg-emerald-50 text-emerald-600 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest">Apply Guest Discount</button>
                  </div>
                ))}
                {customers.filter(c => c.name.toLowerCase().includes(guestSearch.toLowerCase())).length === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
                    <p className="font-black uppercase tracking-widest text-xs text-gray-500">No customer profiles yet</p>
                    <p className="mt-2 text-xs font-medium text-gray-400">Add a name and mobile number above.</p>
                  </div>
                )}
             </div>
          </div>
        )}
      </div>

      {/* Settle Modal */}
      {settlingOrder && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
           <div className="relative w-full max-w-md space-y-5 overflow-hidden rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                 <div className="w-24 h-24 border-4 border-gray-900 rounded-full"></div>
              </div>
              <div className="text-center">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total to Pay</p>
                 <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">{activeRestaurant.currency}{settlingOrder.total_amount.toFixed(2)}</h3>
                 <p className="mt-2 text-xs font-semibold text-emerald-700">Order #{settlingOrder.id} · {settlingOrder.table_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                 {[
                   { id: 'Cash', icon: '💵' },
                   { id: 'Card', icon: '💳' },
                   { id: 'NFC', icon: '📱' },
                   { id: 'QR', icon: '🔗' },
                   { id: 'Room Charge', icon: '🏨' }
                 ].map(m => (
                   <button 
                     key={m.id}
                     onClick={() => { handlePayment(settlingOrder, m.id); setSettlingOrder(null); }}
                     className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-500 hover:bg-emerald-600 hover:text-white active:scale-[0.98]"
                   >
                     <span className="text-2xl">{m.icon}</span>
                     <span className="text-xs font-bold">{m.id}</span>
                   </button>
                 ))}
                 <button onClick={() => setSettlingOrder(null)} className="col-span-2 py-4 text-gray-400 font-black text-[10px] uppercase tracking-widest">Cancel</button>
              </div>
           </div>
        </div>
      )}

      {/* Item Modifier Modal */}
      {modifyingItem && (
        <div className="fixed inset-0 z-[100] flex items-end bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
           <div className="w-full space-y-5 rounded-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:p-6">
              <div className="flex justify-between items-center">
                 <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Modify {modifyingItem.name}</h3>
                 <button onClick={() => setEditingModifier(null)} className="text-gray-400 font-black text-2xl">&times;</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                 {['No Onion', 'Extra Cheese', 'Less Spicy', 'Well Done', 'Gluten Free'].map(tag => (
                   <button 
                     key={tag}
                     onClick={() => updateModifier(modifyingItem.id, tag)}
                     className="bg-gray-50 hover:bg-emerald-50 hover:text-emerald-600 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                   >
                     {tag}
                   </button>
                 ))}
              </div>
              <textarea 
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold text-xs outline-none focus:border-emerald-500"
                placeholder="Custom instruction..."
                rows="3"
                defaultValue={modifyingItem.modifiers}
                onBlur={(e) => updateModifier(modifyingItem.id, e.target.value)}
              />
           </div>
        </div>
      )}

      {/* Bottom Bar for Order/Send */}
      {cart.length > 0 && view !== 'service-type' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-md sm:px-6 lg:px-8">
           <div className="flex-1">
              <p className="text-xs font-semibold text-slate-500">Total amount</p>
              <p className="mt-1 text-lg font-extrabold leading-none text-slate-900">{activeRestaurant?.currency}{total.toFixed(2)}</p>
           </div>
           {view === 'cart' ? (
             <button 
               onClick={handlePlaceOrder}
               className="rounded-xl bg-emerald-600 px-5 py-3 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] sm:px-7"
             >
               Send to Kitchen
             </button>
           ) : (
             <button 
               onClick={() => setView('cart')}
               className="rounded-xl bg-slate-900 px-5 py-3 text-xs font-extrabold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98] sm:px-7"
             >
               Review Order ({cart.length})
             </button>
           )}
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
