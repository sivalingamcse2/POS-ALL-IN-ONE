import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ThermalReceipt from '../components/ThermalReceipt';
import { getRestaurantMenuCategories, isAssignedToRestaurant } from '../utils/restaurantMenu';

const paymentOptions = [
  { id: 'Cash at counter', label: 'Cash', detail: 'Pay with cash at the counter' },
  { id: 'Card at counter', label: 'Card', detail: 'Pay by card with staff' },
  { id: 'Room charge', label: 'Room charge', detail: 'Request a charge to your room' }
];

export default function GuestOrdering() {
  const { tableId } = useParams();
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [view, setView] = useState('menu');
  const [table, setTable] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [addedItemEffect, setAddedItemEffect] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuLoadError, setMenuLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(paymentOptions[0].id);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const tId = Number.parseInt(tableId, 10);
        const config = { headers: { 'x-restaurant-id': 1 } };
        const tablesRes = await axios.get('/api/public/tables', config).catch(() => ({ data: [] }));
        const serverTables = tablesRes.data || [];
        const savedTables = JSON.parse(localStorage.getItem('pos_tables') || '[]');
        const foundTable = serverTables.find(item => String(item.id) === String(tId))
          || savedTables.find(item => String(item.id) === String(tId));
        const activeRestId = foundTable?.restaurant_id || 1;
        setTable(foundTable || { id: tId, table_name: `Table ${tId}`, restaurant_id: activeRestId });

        const restConfig = { headers: { 'x-restaurant-id': activeRestId } };
        let items = [];
        let cats = [];
        let fetchError = '';
        try {
          const [itemsRes, catsRes] = await Promise.all([
            axios.get('/api/menu/items', restConfig),
            axios.get('/api/menu/categories', restConfig)
          ]);
          items = itemsRes.data || [];
          cats = catsRes.data || [];
        } catch (error) {
          fetchError = error.response?.data?.message || error.message || 'Could not reach the restaurant menu.';
          console.error('Online menu request failed', error);
        }
        const localItems = JSON.parse(localStorage.getItem('pos_menu_items') || '[]')
          .filter(item => isAssignedToRestaurant(item, activeRestId));
        const itemsById = new Map(items.map(item => [String(item.id), item]));
        localItems.forEach(item => itemsById.set(String(item.id), item));
        items = [...itemsById.values()];
        const localCategories = JSON.parse(localStorage.getItem('pos_categories') || '[]');
        const categoriesById = new Map(cats.map(category => [String(category.id), category]));
        localCategories.forEach(category => categoriesById.set(String(category.id), category));
        cats = [...categoriesById.values()];
        items = items.filter(item => isAssignedToRestaurant(item, activeRestId));
        cats = getRestaurantMenuCategories(cats, items, activeRestId);
        const retailCategoryIds = new Set(cats
          .filter(category => /produce|grocery|supermarket|dairy|bakery|household|personal care|beverages?\s*&\s*drinks/i.test(category.name || ''))
          .map(category => String(category.id)));
        const restaurantItems = items.filter(item => (
          item.is_restaurant
          || (!item.is_supermarket && !item.barcode && !retailCategoryIds.has(String(item.category_id)))
        ));
        const visibleItems = restaurantItems.length
          ? restaurantItems
          : items.filter(item => !item.barcode && !retailCategoryIds.has(String(item.category_id)));
        const activeItems = visibleItems.filter(item => item.is_active !== false);
        setMenuItems(activeItems);
        setCategories(cats.filter(category => !retailCategoryIds.has(String(category.id))));
        setMenuLoadError(activeItems.length
          ? ''
          : fetchError || 'No active restaurant menu items are available. Please contact the restaurant staff.');
        const restaurants = JSON.parse(localStorage.getItem('pos_restaurants') || '[]');
        const localRestaurant = restaurants.find(item => Number(item.id) === Number(activeRestId));
        setRestaurant({ id: activeRestId, currency: localRestaurant?.currency || '$', name: localRestaurant?.name || 'SIVARA Dining' });
      } catch (error) {
        console.error('Guest menu load failed', error);
        setMenuLoadError(error.message || 'The guest menu could not be loaded.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [tableId]);

  const addToCart = item => {
    setCart(current => {
      const existing = current.find(cartItem => String(cartItem.id) === String(item.id));
      return existing
        ? current.map(cartItem => String(cartItem.id) === String(item.id) ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem)
        : [...current, { ...item, quantity: 1 }];
    });
    setAddedItemEffect(item.id);
    window.setTimeout(() => setAddedItemEffect(null), 500);
  };

  const updateQuantity = (id, delta) => {
    setCart(current => current
      .map(item => String(item.id) === String(id) ? { ...item, quantity: item.quantity + delta } : item)
      .filter(item => item.quantity > 0));
  };

  const filteredItems = selectedCategory === 'All'
    ? menuItems
    : menuItems.filter(item => categories.find(category => String(category.id) === String(item.category_id))?.name === selectedCategory);
  const itemCount = cart.reduce((count, item) => count + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
  const currency = restaurant?.currency || '$';

  const handlePlaceOrder = async event => {
    event.preventDefault();
    if (!cart.length || submitting) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      window.alert('Enter your name and mobile number to continue.');
      return;
    }
    if (paymentMethod === 'Room charge' && !roomNumber.trim()) {
      window.alert('Enter your room number to request a room charge.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    const timestamp = new Date().toISOString();
    const newOrder = {
      restaurant_id: restaurant?.id || 1,
      table_id: table?.id,
      table_name: table?.table_name || `Table ${tableId}`,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer: { name: customerName.trim(), phone: customerPhone.trim() },
      room_number: roomNumber.trim(),
      subtotal: total,
      total_amount: total,
      total,
      items: cart.map(item => ({
        id: item.id,
        item_id: item.id,
        item_name: item.name,
        name: item.name,
        quantity: item.quantity,
        price: Number(item.price) || 0
      })),
      date: timestamp,
      created_at: timestamp,
      status: 'Pending',
      payment_method: paymentMethod,
      amount_tendered: 0,
      is_guest_order: true,
      business_type: 'restaurant'
    };

    try {
      const config = { headers: { 'x-restaurant-id': restaurant?.id || 1 } };
      const response = await axios.post('/api/public/orders/new', newOrder, config);
      const savedOrder = { ...newOrder, ...response.data, items: newOrder.items };
      setConfirmedOrder(savedOrder);
      const localOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
      localStorage.setItem('pos_orders', JSON.stringify([savedOrder, ...localOrders.filter(order => String(order.id) !== String(savedOrder.id))]));
      setCart([]);
      setView('success');
    } catch (error) {
      console.error('Guest order submission failed', error);
      setSubmitError(error.response?.data?.detail || error.response?.data?.error || error.message || 'The order could not be sent. Please try again or ask staff for help.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-300">Loading menu…</p>
        </div>
      </div>
    );
  }

  if (view === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl sm:p-9">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-3xl font-black text-emerald-700">✓</div>
          <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-700">Order sent to kitchen</p>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Thank you, {confirmedOrder?.customer_name}!</h1>
          <p className="mt-2 text-sm text-slate-500">Order #{confirmedOrder?.id} · {table?.table_name}</p>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-left">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Order total</span><strong className="text-slate-900">{currency}{totalFromOrder(confirmedOrder).toFixed(2)}</strong></div>
            <div className="mt-2 flex justify-between text-sm"><span className="text-slate-500">Payment</span><strong className="text-slate-900">{confirmedOrder?.payment_method}</strong></div>
            <p className="mt-3 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-500">Payment has not been processed online. Please settle with the restaurant staff.</p>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => setShowReceipt(true)} className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-xs font-extrabold text-white hover:bg-slate-800">Print bill</button>
            <button type="button" onClick={() => { setConfirmedOrder(null); setView('menu'); }} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-extrabold text-white hover:bg-emerald-700">Order more</button>
          </div>
          {showReceipt && <ThermalReceipt order={confirmedOrder} storeInfo={restaurant} onClose={() => setShowReceipt(false)} />}
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-32 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900 px-4 py-4 text-white shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-300">{restaurant?.name || 'SIVARA Dining'}</p>
            <h1 className="mt-1 text-lg font-extrabold text-white">Guest menu</h1>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-right">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Your table</p>
            <p className="text-sm font-extrabold text-white">{table?.table_name || `Table ${tableId}`}</p>
          </div>
        </div>
      </header>

      <nav className="sticky top-[76px] z-20 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {['All', ...categories.map(category => category.name)].map(category => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`shrink-0 border-b-2 px-4 py-3 text-xs font-extrabold transition ${selectedCategory === category ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {category}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6">
        <section className="rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-600 p-5 text-white shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-100">Fresh from our kitchen</p>
          <h2 className="mt-2 text-xl font-extrabold text-white">Choose something you’ll love.</h2>
          <p className="mt-1 text-xs text-emerald-50">Add your favorites to the order and we’ll send them to the kitchen.</p>
        </section>

        {menuLoadError && (
          <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            {menuLoadError}
          </section>
        )}
        {filteredItems.length ? (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map(item => (
              <article key={item.id} className={`flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm transition ${addedItemEffect === item.id ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}>
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-2xl">🍽️</div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-extrabold text-slate-900">{item.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description || 'Freshly prepared to order.'}</p>
                  <p className="mt-2 text-sm font-extrabold text-emerald-700">{currency}{Number(item.price || 0).toFixed(2)}</p>
                </div>
                <button type="button" aria-label={`Add ${item.name}`} onClick={() => addToCart(item)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xl font-bold text-white hover:bg-emerald-700">
                  {addedItemEffect === item.id ? '✓' : '+'}
                </button>
              </article>
            ))}
          </section>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center text-sm font-semibold text-slate-500">No items are available in this category.</div>
        )}
      </main>

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-12px_36px_rgba(15,23,42,0.12)] backdrop-blur sm:p-4">
          <form onSubmit={handlePlaceOrder} className="mx-auto grid max-h-[70vh] max-w-6xl gap-3 overflow-y-auto sm:grid-cols-[1fr_1fr_1fr_1.2fr_auto] sm:items-end">
            {submitError && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 sm:col-span-5">{submitError}</p>}
            <label className="grid gap-1 text-[10px] font-extrabold text-slate-600">
              Customer name *
              <input required value={customerName} onChange={event => setCustomerName(event.target.value)} placeholder="Full name" className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs" />
            </label>
            <label className="grid gap-1 text-[10px] font-extrabold text-slate-600">
              Mobile number *
              <input required type="tel" value={customerPhone} onChange={event => setCustomerPhone(event.target.value)} placeholder="Mobile number" className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs" />
            </label>
            <label className="grid gap-1 text-[10px] font-extrabold text-slate-600">
              Room number {paymentMethod === 'Room charge' ? '*' : '(optional)'}
              <input required={paymentMethod === 'Room charge'} value={roomNumber} onChange={event => setRoomNumber(event.target.value)} placeholder="For room service" className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs" />
            </label>
            <label className="grid gap-1 text-[10px] font-extrabold text-slate-600">
              Payment preference
              <select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs">
                {paymentOptions.map(option => <option key={option.id} value={option.id}>{option.label} — {option.detail}</option>)}
              </select>
            </label>
            <button disabled={submitting} type="submit" className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60">
              {submitting ? 'Sending…' : `Send order · ${currency}${total.toFixed(2)} (${itemCount})`}
            </button>
          </form>
          <div className="mx-auto mt-2 flex max-w-6xl flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
            <span className="font-bold text-slate-600">Your order:</span>
            {cart.map(item => (
              <span key={item.id} className="inline-flex items-center gap-1.5">
                {item.name}
                <button type="button" aria-label={`Remove one ${item.name}`} onClick={() => updateQuantity(item.id, -1)} className="font-bold text-rose-600">−</button>
                <strong>{item.quantity}</strong>
                <button type="button" aria-label={`Add one ${item.name}`} onClick={() => updateQuantity(item.id, 1)} className="font-bold text-emerald-700">+</button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function totalFromOrder(order) {
  return Number(order?.total_amount ?? order?.total ?? 0);
}
