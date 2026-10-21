import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import storageEngine from '../services/storageEngine';

export default function Inventory() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'supermarket', 'restaurant', 'low_stock', 'expiry', 'transactions', 'labels'
  const [showModal, setShowModal] = useState(false);
  const [showItemEditModal, setShowItemEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ txn_type: 'in', quantity: 0, item_id: '', notes: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // Item Edit Form
  const [itemForm, setItemForm] = useState({
    name: '',
    barcode: '',
    sku: '',
    category_id: 101,
    department: 'Fresh Produce',
    price: 0,
    cost_price: 0,
    unit: 'pcs',
    is_weight_scale: false,
    stock_quantity: 50,
    reorder_level: 10,
    expiry_date: '',
    batch_number: '',
    is_supermarket: true,
    is_restaurant: false,
    description: ''
  });

  const [items, setItems] = useState(() => storageEngine.getItems());
  const [categories, setCategories] = useState(() => storageEngine.getCategories());
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('pos_inventory_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const unsub = storageEngine.subscribe((event) => {
      if (event === 'items_updated') setItems(storageEngine.getItems());
      if (event === 'categories_updated') setCategories(storageEngine.getCategories());
    });
    return unsub;
  }, []);

  const handleUpdateStock = (itemId, type, qty, notes) => {
    const updatedItems = items.map(item => {
      if (item.id === parseInt(itemId)) {
        let newStock = parseFloat(item.stock_quantity || 0);
        if (type === 'in') newStock += qty;
        else if (type === 'out') newStock -= qty;
        else if (type === 'adjust') newStock = qty;
        return { ...item, stock_quantity: Math.max(0, newStock) };
      }
      return item;
    });

    setItems(updatedItems);
    storageEngine.saveItems(updatedItems);

    const targetItem = items.find(i => i.id === parseInt(itemId));
    const newTxn = {
      id: Date.now(),
      item_id: itemId,
      item_name: targetItem?.name,
      txn_type: type,
      quantity: qty,
      notes: notes,
      username: user?.username || 'Admin',
      created_at: new Date().toISOString()
    };

    const updatedTxns = [newTxn, ...transactions];
    setTransactions(updatedTxns);
    localStorage.setItem('pos_inventory_transactions', JSON.stringify(updatedTxns));
  };

  const handleSaveProduct = (e) => {
    e.preventDefault();
    if (editingItem) {
      const updated = items.map(i => i.id === editingItem.id ? { ...itemForm, id: i.id } : i);
      setItems(updated);
      storageEngine.saveItems(updated);
    } else {
      const newItem = {
        ...itemForm,
        id: Date.now(),
        price: parseFloat(itemForm.price || 0),
        cost_price: parseFloat(itemForm.cost_price || 0),
        stock_quantity: parseFloat(itemForm.stock_quantity || 0),
        reorder_level: parseFloat(itemForm.reorder_level || 10),
      };
      const updated = [newItem, ...items];
      setItems(updated);
      storageEngine.saveItems(updated);
    }
    setShowItemEditModal(false);
    setEditingItem(null);
  };

  const handleSmartAutoReorder = () => {
    let reorderedCount = 0;
    const updatedItems = items.map(item => {
      const stock = item.stock_quantity || 0;
      const reorderAt = item.reorder_level || 10;
      if (stock <= reorderAt) {
        reorderedCount++;
        const addQty = 50;
        const newTxn = {
          id: Date.now() + Math.random(),
          item_id: item.id,
          item_name: item.name,
          txn_type: 'in',
          quantity: addQty,
          notes: 'AI Smart Auto-Reorder Replenishment',
          username: 'AI System',
          created_at: new Date().toISOString()
        };
        const savedTxns = JSON.parse(localStorage.getItem('pos_inventory_transactions') || '[]');
        localStorage.setItem('pos_inventory_transactions', JSON.stringify([newTxn, ...savedTxns]));
        setTransactions([newTxn, ...savedTxns]);
        return { ...item, stock_quantity: stock + addQty };
      }
      return item;
    });

    if (reorderedCount > 0) {
      setItems(updatedItems);
      storageEngine.saveItems(updatedItems);
      alert(`AI System: Automatically reordered & replenished ${reorderedCount} low-stock items!`);
    } else {
      alert("AI System: All stock levels are within safe parameters.");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.item_id) return;
    handleUpdateStock(formData.item_id, formData.txn_type, parseFloat(formData.quantity), formData.notes);
    setShowModal(false);
    setFormData({ txn_type: 'in', quantity: 0, item_id: '', notes: '' });
  };

  // Expiry status calculator
  const getExpiryStatus = (dateStr) => {
    if (!dateStr) return { status: 'none', label: 'No Expiry Set', color: 'text-gray-400 bg-gray-100' };
    const expDate = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { status: 'expired', label: `EXPIRED (${Math.abs(diffDays)}d ago)`, color: 'text-red-700 bg-red-100 border-red-300' };
    } else if (diffDays <= 7) {
      return { status: 'critical', label: `Expiring in ${diffDays}d!`, color: 'text-amber-800 bg-amber-100 border-amber-300' };
    } else if (diffDays <= 30) {
      return { status: 'warning', label: `Expires in ${diffDays}d`, color: 'text-yellow-800 bg-yellow-100 border-yellow-300' };
    }
    return { status: 'good', label: `Valid until ${dateStr}`, color: 'text-emerald-700 bg-emerald-100 border-emerald-300' };
  };

  // Filter Items
  const filteredItems = items.filter(i => {
    const query = searchQuery.toLowerCase();
    const matchSearch = i.name.toLowerCase().includes(query) ||
      (i.barcode && String(i.barcode).includes(query)) ||
      (i.sku && i.sku.toLowerCase().includes(query));

    if (!matchSearch) return false;

    if (activeTab === 'supermarket') return i.is_supermarket || i.barcode || i.is_weight_scale;
    if (activeTab === 'restaurant') return i.is_restaurant || !i.barcode;
    if (activeTab === 'low_stock') return (i.stock_quantity || 0) <= (i.reorder_level || 10);
    if (activeTab === 'expiry') {
      const exp = getExpiryStatus(i.expiry_date);
      return exp.status === 'expired' || exp.status === 'critical' || exp.status === 'warning';
    }
    return true;
  });

  const handlePrintLabels = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2">
            <span>📦</span> Advanced Inventory & Expiry Control
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Supermarket Barcodes, Weighing Scale Items, Batch/Lot Tracking & Restaurant Ingredients
          </p>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            onClick={() => {
              setEditingItem(null);
              setItemForm({
                name: '',
                barcode: '890' + Math.floor(100000000 + Math.random() * 900000000),
                sku: 'SKU-' + Math.floor(1000 + Math.random() * 9000),
                category_id: 101,
                department: 'Fresh Produce',
                price: 0,
                cost_price: 0,
                unit: 'pcs',
                is_weight_scale: false,
                stock_quantity: 50,
                reorder_level: 10,
                expiry_date: '',
                batch_number: 'LOT-' + Math.floor(1000 + Math.random() * 9000),
                is_supermarket: true,
                is_restaurant: false,
                description: ''
              });
              setShowItemEditModal(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow text-sm flex items-center gap-1.5 transition-all"
          >
            + Add New Product
          </button>

          <button
            onClick={handleSmartAutoReorder}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow text-sm flex items-center gap-1.5 transition-all"
          >
            <span>🤖</span> AI Auto-Reorder
          </button>

          <button
            onClick={() => setActiveTab('labels')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow text-sm flex items-center gap-1.5 transition-all"
          >
            <span>🏷️</span> Shelf Barcode Tags
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow text-sm flex items-center gap-1.5 transition-all"
          >
            Adjust Stock
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: `All Items (${items.length})` },
            { id: 'supermarket', label: '🛒 Supermarket Retail' },
            { id: 'restaurant', label: '🍽️ Restaurant Kitchen' },
            { id: 'low_stock', label: '⚠️ Low Stock (< 10)' },
            { id: 'expiry', label: '⏰ Expiry Alerts' },
            { id: 'transactions', label: '📋 Stock Logs' },
            { id: 'labels', label: '🏷️ Shelf Price Tags' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-sm ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab !== 'transactions' && activeTab !== 'labels' && (
          <div className="w-full md:w-72">
            <input
              type="text"
              placeholder="Search by barcode, SKU, name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        )}
      </div>

      {/* TAB 1: PRODUCT STOCK TABLE */}
      {activeTab !== 'transactions' && activeTab !== 'labels' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Product Name</th>
                  <th className="p-3.5">Barcode / SKU</th>
                  <th className="p-3.5">Department</th>
                  <th className="p-3.5">Stock Level</th>
                  <th className="p-3.5">Cost / Price</th>
                  <th className="p-3.5">Batch / Expiry</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map(item => {
                  const isLow = (item.stock_quantity || 0) <= (item.reorder_level || 10);
                  const expiry = getExpiryStatus(item.expiry_date);
                  const isWeighed = item.is_weight_scale;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3.5">
                        <div className="font-extrabold text-gray-900 text-sm">{item.name}</div>
                        <div className="text-[11px] text-gray-400">
                          {isWeighed ? '⚖️ Scale Weighed Item' : `Unit: ${item.unit || 'pcs'}`}
                        </div>
                      </td>

                      <td className="p-3.5 font-mono text-[11px]">
                        <div className="font-bold text-gray-800">{item.barcode || '—'}</div>
                        <div className="text-gray-400">{item.sku || 'No SKU'}</div>
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md font-semibold text-[11px]">
                          {item.department || categories.find(c => c.id === item.category_id)?.name || 'General'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-base font-extrabold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                            {item.stock_quantity || 0}
                          </span>
                          <span className="text-gray-500 text-[10px]">{item.unit || 'pcs'}</span>
                          {isLow && (
                            <span className="px-1.5 py-0.2 bg-red-100 text-red-700 text-[9px] font-bold rounded uppercase">
                              Low
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-black text-emerald-700 text-sm">${parseFloat(item.price || 0).toFixed(2)}</div>
                        <div className="text-gray-400 text-[10px]">Cost: ${parseFloat(item.cost_price || 0).toFixed(2)}</div>
                      </td>

                      <td className="p-3.5">
                        <div className="text-gray-700 font-mono text-[11px]">{item.batch_number || 'N/A'}</div>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border mt-0.5 ${expiry.color}`}>
                          {expiry.label}
                        </span>
                      </td>

                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setItemForm(item);
                            setShowItemEditModal(true);
                          }}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg text-xs transition-all"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SHELF BARCODE LABELS (PRINTABLE) */}
      {activeTab === 'labels' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center print:hidden bg-white p-4 rounded-2xl border">
            <div>
              <h3 className="font-bold text-gray-800">Printable Supermarket Shelf Tags</h3>
              <p className="text-xs text-gray-500">Aisle price labels with visual barcodes for scanning guns.</p>
            </div>
            <button
              onClick={handlePrintLabels}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow flex items-center gap-2 text-sm transition-all"
            >
              <span>🖨️</span> Print Shelf Tags (A4 / Label)
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 print:grid-cols-3 print:gap-2">
            {items.map(item => (
              <div
                key={item.id}
                className="bg-white p-3.5 rounded-xl border-2 border-dashed border-gray-300 print:border-gray-800 flex flex-col justify-between text-left space-y-2"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                    {item.department || 'GROCERY'}
                  </span>
                  <h4 className="font-extrabold text-xs text-gray-900 line-clamp-2 leading-tight">
                    {item.name}
                  </h4>
                </div>

                <div className="flex justify-between items-baseline border-t border-b border-gray-200 py-1">
                  <div>
                    <span className="text-[10px] text-gray-500">UNIT PRICE:</span>
                    <p className="text-xl font-black text-gray-900">${parseFloat(item.price).toFixed(2)}</p>
                  </div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase">
                    PER {item.unit || 'PCS'}
                  </span>
                </div>

                {/* Visual Barcode Graphic */}
                <div className="text-center pt-1">
                  <div className="flex justify-center items-center gap-[2px] h-6 bg-white">
                    {[2,1,3,1,2,3,1,2,1,3,2,1,2,1,3,1,2,1,3,2].map((w, i) => (
                      <span key={i} className="bg-black h-full inline-block" style={{ width: `${w}px` }} />
                    ))}
                  </div>
                  <p className="font-mono text-[9px] text-gray-600 tracking-widest mt-0.5 font-bold">
                    {item.barcode || item.sku || 'SKU-0000'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: STOCK TRANSACTIONS HISTORY */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 text-sm mb-3">Inventory Movement History</h3>
          <div className="divide-y divide-gray-100 text-xs">
            {transactions.map(t => (
              <div key={t.id} className="py-2.5 flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-900">{t.item_name || `Item #${t.item_id}`}</p>
                  <p className="text-gray-500 text-[11px]">{t.notes} • By {t.username}</p>
                </div>
                <div className="text-right">
                  <span className={`font-bold ${
                    t.txn_type === 'in' ? 'text-emerald-600' : t.txn_type === 'out' ? 'text-red-500' : 'text-blue-500'
                  }`}>
                    {t.txn_type === 'in' ? `+${t.quantity}` : t.txn_type === 'out' ? `-${t.quantity}` : `Set ${t.quantity}`}
                  </span>
                  <p className="text-[10px] text-gray-400">{new Date(t.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- MODAL 1: ADD / EDIT PRODUCT MODAL --- */}
      {showItemEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="font-bold text-lg text-gray-900">
                {editingItem ? 'Edit Product Details' : 'Add New Inventory Product'}
              </h3>
              <button onClick={() => setShowItemEditModal(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Product Name:</label>
                  <input
                    type="text"
                    required
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Barcode (EAN-13 / UPC):</label>
                  <input
                    type="text"
                    value={itemForm.barcode}
                    onChange={(e) => setItemForm({ ...itemForm, barcode: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Selling Price ($):</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={itemForm.price}
                    onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Cost Price ($):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemForm.cost_price}
                    onChange={(e) => setItemForm({ ...itemForm, cost_price: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Unit of Measure:</label>
                  <select
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl bg-white"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="g">Gram (g)</option>
                    <option value="bottle">Bottle</option>
                    <option value="can">Can</option>
                    <option value="pack">Pack / Carton</option>
                    <option value="portion">Portion (Kitchen)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Stock on Hand:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemForm.stock_quantity}
                    onChange={(e) => setItemForm({ ...itemForm, stock_quantity: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Min Reorder Level:</label>
                  <input
                    type="number"
                    value={itemForm.reorder_level}
                    onChange={(e) => setItemForm({ ...itemForm, reorder_level: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Batch / Lot Number:</label>
                  <input
                    type="text"
                    value={itemForm.batch_number}
                    onChange={(e) => setItemForm({ ...itemForm, batch_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Expiry Date:</label>
                  <input
                    type="date"
                    value={itemForm.expiry_date}
                    onChange={(e) => setItemForm({ ...itemForm, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemForm.is_weight_scale}
                    onChange={(e) => setItemForm({ ...itemForm, is_weight_scale: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <span className="font-bold text-gray-800">⚖️ Produce / Deli item weighed on scale (sold by kg/g)</span>
                </label>

                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemForm.is_supermarket}
                      onChange={(e) => setItemForm({ ...itemForm, is_supermarket: e.target.checked })}
                      className="rounded text-emerald-600"
                    />
                    <span>Available in Supermarket POS</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemForm.is_restaurant}
                      onChange={(e) => setItemForm({ ...itemForm, is_restaurant: e.target.checked })}
                      className="rounded text-emerald-600"
                    />
                    <span>Available in Restaurant POS</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowItemEditModal(false)}
                  className="flex-1 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: ADJUST STOCK TRANSACTION --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="font-bold text-lg text-gray-900">Record Stock Transaction</h3>
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Select Item:</label>
                <select
                  value={formData.item_id}
                  onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl bg-white"
                  required
                >
                  <option value="">-- Choose Item --</option>
                  {items.map(i => (
                    <option key={i.id} value={i.id}>{i.name} (Cur: {i.stock_quantity || 0})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Transaction Type:</label>
                <select
                  value={formData.txn_type}
                  onChange={(e) => setFormData({ ...formData, txn_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl bg-white"
                >
                  <option value="in">Stock In (Purchase / Restock)</option>
                  <option value="out">Stock Out (Damaged / Waste)</option>
                  <option value="adjust">Stock Count Audit (Set to Qty)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Quantity:</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Reason / Notes:</label>
                <input
                  type="text"
                  placeholder="e.g. Shipment received"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 bg-gray-200 text-gray-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
