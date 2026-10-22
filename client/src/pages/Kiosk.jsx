import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getRestaurantMenuCategories, isAssignedToRestaurant } from '../utils/restaurantMenu';

export default function Kiosk() {
  const { activeRestaurant } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);

  const categories = JSON.parse(localStorage.getItem('pos_categories') || '[]');
  const items = JSON.parse(localStorage.getItem('pos_menu_items') || '[]');
  const restaurantId = Number(activeRestaurant?.id || 1);
  const branchCategories = getRestaurantMenuCategories(categories, items, restaurantId)
    .filter(category => category.type === 'restaurant' || !category.type);

  const filteredItems = items.filter(i => (
    isAssignedToRestaurant(i, restaurantId)
    && (i.is_restaurant || (!i.is_supermarket && !i.barcode))
    && (!selectedCategory || parseInt(i.category_id) === parseInt(selectedCategory))
    && i.is_active !== false
  ));

  const addToCart = (item) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(c => c.id !== id));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = () => {
    const orderNumber = Math.floor(1000 + Math.random() * 9000);
    const newOrder = {
      id: orderNumber,
      restaurant_id: activeRestaurant?.id,
      table_name: 'KIOSK-01',
      subtotal: total,
      total_amount: total,
      items: cart.map(c => ({ item_id: c.id, item_name: c.name, quantity: c.quantity, price: c.price })),
      date: new Date().toLocaleString(),
      status: 'Paid',
      payment_method: 'Digital Kiosk',
      customer_name: 'Kiosk Customer'
    };

    const orders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
    localStorage.setItem('pos_orders', JSON.stringify([newOrder, ...orders]));
    
    setOrderComplete(true);
    setCart([]);
  };

  if (orderComplete) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-10 text-center">
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h1 className="text-4xl font-black text-gray-800 mb-2">THANK YOU!</h1>
        <p className="text-xl text-gray-600 mb-8">Your order has been sent to the kitchen.</p>
        <div className="bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-gray-300 mb-10">
          <p className="text-sm uppercase font-bold text-gray-500">Order Number</p>
          <p className="text-6xl font-black text-primary-600">#{Math.floor(1000 + Math.random() * 9000)}</p>
        </div>
        <button 
          onClick={() => setOrderComplete(false)}
          className="btn btn-primary px-12 py-4 text-2xl rounded-2xl"
        >
          START NEW ORDER
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      {/* Sidebar Categories */}
      <div className="w-32 bg-white border-r flex flex-col items-center py-6 gap-6 shadow-xl">
        <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl mb-4">SG</div>
        <button 
          onClick={() => setSelectedCategory(null)}
          className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${!selectedCategory ? 'bg-primary-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500'}`}
        >
          <span className="text-[10px] font-bold uppercase">All</span>
        </button>
        {branchCategories.map(cat => (
          <button 
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${selectedCategory === cat.id ? 'bg-primary-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500'}`}
          >
            <span className="text-[10px] font-bold uppercase">{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl font-black text-gray-800">ALL IN ONE <span className="text-primary-600">SELF-ORDER</span></h1>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-400">WELCOME TO</p>
            <p className="text-xl font-bold text-gray-800">{activeRestaurant?.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white rounded-3xl p-5 shadow-sm border border-transparent hover:border-primary-500 transition-all group flex flex-col h-full">
              <div className="w-full aspect-square bg-gray-100 rounded-2xl mb-4 overflow-hidden flex items-center justify-center relative">
                <span className="text-gray-300 text-4xl">🍴</span>
                <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black text-primary-600 shadow-sm border border-white">
                  {activeRestaurant?.currency}{item.price}
                </div>
              </div>
              <h3 className="text-lg font-black text-gray-800 mb-1 group-hover:text-primary-600 transition-colors">{item.name}</h3>
              <p className="text-xs text-gray-400 mb-6 flex-1 line-clamp-2">Premium quality ingredients prepared with AI-optimized cooking techniques.</p>
              <button 
                onClick={() => addToCart(item)}
                className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
              >
                <span>ADD TO ORDER</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Right Cart Summary */}
      <div className="w-[450px] bg-white border-l shadow-2xl flex flex-col">
        <div className="p-8 border-b">
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            YOUR ORDER 
            <span className="bg-primary-100 text-primary-600 text-sm px-2 py-0.5 rounded-full">{cart.length}</span>
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
              <div className="w-20 h-20 border-4 border-gray-400 rounded-full mb-4 flex items-center justify-center text-4xl">🛒</div>
              <p className="text-xl font-bold">Your cart is empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center gap-4 group">
                <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center text-xl">🍴</div>
                <div className="flex-1">
                  <p className="font-black text-gray-800">{item.name}</p>
                  <p className="text-primary-600 font-bold">{activeRestaurant?.currency}{item.price} x {item.quantity}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-500 flex items-center justify-center transition-all"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-8 bg-gray-50 border-t space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase">Total Amount</p>
              <p className="text-4xl font-black text-gray-800">{activeRestaurant?.currency}{total.toFixed(2)}</p>
            </div>
          </div>
          <button 
            disabled={cart.length === 0}
            onClick={() => setShowCheckout(true)}
            className="w-full bg-primary-600 text-white py-5 rounded-2xl font-black text-xl shadow-lg shadow-primary-200 disabled:opacity-30 disabled:shadow-none hover:bg-primary-700 transition-all flex items-center justify-center gap-3"
          >
            <span>CHECKOUT NOW</span>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 z-50">
          <div className="bg-white rounded-[40px] w-full max-w-4xl p-12 overflow-hidden relative">
            <h2 className="text-4xl font-black text-center mb-10">SELECT PAYMENT</h2>
            <div className="grid grid-cols-3 gap-8 mb-10">
              <button onClick={handleCheckout} className="p-8 bg-gray-50 rounded-3xl border-4 border-transparent hover:border-primary-600 flex flex-col items-center gap-4 transition-all group">
                <span className="text-5xl group-hover:scale-110 transition-transform">💳</span>
                <span className="font-black text-xl uppercase">Tap & Pay</span>
              </button>
              <button onClick={handleCheckout} className="p-8 bg-gray-50 rounded-3xl border-4 border-transparent hover:border-primary-600 flex flex-col items-center gap-4 transition-all group">
                <span className="text-5xl group-hover:scale-110 transition-transform">📱</span>
                <span className="font-black text-xl uppercase">Apple/Google Pay</span>
              </button>
              <button onClick={handleCheckout} className="p-8 bg-gray-50 rounded-3xl border-4 border-transparent hover:border-primary-600 flex flex-col items-center gap-4 transition-all group">
                <span className="text-5xl group-hover:scale-110 transition-transform">₿</span>
                <span className="font-black text-xl uppercase">Crypto Pay</span>
              </button>
            </div>
            <button 
              onClick={() => setShowCheckout(false)}
              className="w-full py-4 text-gray-400 font-bold uppercase tracking-widest hover:text-gray-800 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
