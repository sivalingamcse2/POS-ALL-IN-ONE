import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { storageApi } from '../api';

const formatOrderDate = value => {
  if (!value || value === '—') return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const getLocalDateKey = value => {
  if (!value || value === '—') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getBillCategory = order => {
  const status = String(order.status || '').toLowerCase();
  const paymentMethod = String(order.payment_method || '').toLowerCase();
  if (order.source === 'local-held' || status === 'held') return 'held';
  if (
    status === 'split'
    ||
    paymentMethod.includes('split')
    || Number(order.cash_amount) > 0 && Number(order.card_amount) > 0
  ) return 'split';
  if (['paid', 'completed'].includes(status)) return 'completed';
  if (['pending', 'open', 'unpaid', 'preparing', 'ready'].includes(status)) return 'pending';
  return 'completed';
};

const getBillLabel = order => ({
  pending: 'Pending',
  held: 'Held',
  split: 'Split',
  completed: 'Completed'
}[getBillCategory(order)]);

const getBillBadgeClass = order => ({
  pending: 'bg-yellow-100 text-yellow-800',
  held: 'bg-blue-100 text-blue-800',
  split: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800'
}[getBillCategory(order)]);

const getTodayDate = () => getLocalDateKey(new Date());

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');
  const [reportMode, setReportMode] = useState('daily');
  const [reportDate, setReportDate] = useState(getTodayDate);
  const [startDate, setStartDate] = useState(getTodayDate);
  const [endDate, setEndDate] = useState(getTodayDate);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItems, setEditingItems] = useState([]);
  const [allMenuItems] = useState([
    { id: 1, name: 'Caesar Salad', price: 12.50 },
    { id: 2, name: 'Chicken Wings', price: 15.00 },
    { id: 3, name: 'Steak', price: 35.00 },
    { id: 4, name: 'Grilled Salmon', price: 28.00 },
    { id: 5, name: 'Pasta Carbonara', price: 18.00 },
    { id: 6, name: 'Chocolate Cake', price: 8.50 },
    { id: 7, name: 'Ice Cream', price: 6.00 },
    { id: 8, name: 'Coffee', price: 4.50 },
    { id: 9, name: 'Fresh Juice', price: 6.50 },
  ]);

  useEffect(() => {
    let cancelled = false;
    const loadOrders = async () => {
      setOrdersLoading(true);
      setOrdersError('');
      try {
        const response = await storageApi.getOrders();
        const serverOrders = Array.isArray(response.data) ? response.data : [];
        const localOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
        const heldCarts = JSON.parse(localStorage.getItem('pos_held_carts') || '[]');
        const ordersById = new Map();

        [...localOrders, ...serverOrders].forEach(order => {
          const normalizedOrder = {
            ...order,
            id: order.id ?? order.order_number,
            date: order.date || order.created_at || '—',
            table_name: order.table_name || 'Takeaway',
            customer_name: order.customer_name || order.customer?.name || order.customer || 'Walk-in',
            employee_id: order.employee_id || order.staff_name || order.cashier || '—',
            total_amount: Number(order.total_amount ?? order.total) || 0,
            items: Array.isArray(order.items) ? order.items.map(item => ({
              ...item,
              name: item.name || item.item_name || item.product_name || 'Menu item',
              quantity: Number(item.quantity) || 0,
              price: Number(item.price) || 0
            })) : []
          };
          ordersById.set(String(normalizedOrder.id), normalizedOrder);
        });

        heldCarts.forEach(heldCart => {
          const heldOrder = {
            ...heldCart,
            id: heldCart.id,
            order_number: heldCart.id,
            created_at: heldCart.held_at,
            date: heldCart.held_at,
            table_name: heldCart.table_name || 'Held bill',
            customer_name: heldCart.customer_name || 'Walk-in',
            total_amount: Number(heldCart.total ?? heldCart.total_amount) || 0,
            status: 'Held',
            payment_method: '—',
            items: Array.isArray(heldCart.items) ? heldCart.items : [],
            source: 'local-held'
          };
          ordersById.set(String(heldOrder.id), heldOrder);
        });

        const loadedOrders = [...ordersById.values()]
          .sort((a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0));
        if (!cancelled) setOrders(loadedOrders);
      } catch (error) {
        console.error('Error loading order history:', error);
        const localOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
        const heldCarts = JSON.parse(localStorage.getItem('pos_held_carts') || '[]');
        if (!cancelled) {
          setOrders(localOrders.map(order => ({
            ...order,
            date: order.date || order.created_at || '—',
            table_name: order.table_name || 'Takeaway',
            customer_name: order.customer_name || order.customer?.name || order.customer || 'Walk-in',
            total_amount: Number(order.total_amount ?? order.total) || 0,
            items: Array.isArray(order.items) ? order.items : []
          })).concat(heldCarts.map(heldCart => ({
            ...heldCart,
            id: heldCart.id,
            order_number: heldCart.id,
            created_at: heldCart.held_at,
            date: heldCart.held_at,
            table_name: heldCart.table_name || 'Held bill',
            customer_name: heldCart.customer_name || 'Walk-in',
            total_amount: Number(heldCart.total ?? heldCart.total_amount) || 0,
            status: 'Held',
            payment_method: '—',
            items: Array.isArray(heldCart.items) ? heldCart.items : [],
            source: 'local-held'
          }))));
          setOrdersError(`Could not load all server orders. Showing orders saved on this device only. ${error.response?.data?.error || error.message}`);
        }
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    };

    loadOrders();
    return () => { cancelled = true; };
  }, []);

  const handleDeleteOrder = (orderId) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      const updatedOrders = orders.filter(o => o.id !== orderId);
      setOrders(updatedOrders);
      const localOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]')
        .filter(order => String(order.id) !== String(orderId));
      localStorage.setItem('pos_orders', JSON.stringify(localOrders));
      
      const order = orders.find(o => o.id === orderId);
      if (order?.source === 'local-held') {
        const heldCarts = JSON.parse(localStorage.getItem('pos_held_carts') || '[]')
          .filter(cart => String(cart.id) !== String(orderId));
        localStorage.setItem('pos_held_carts', JSON.stringify(heldCarts));
      }
      if (order?.source !== 'server' && order && (order.status === 'Held' || order.status === 'Pending')) {
        const tables = JSON.parse(localStorage.getItem('pos_tables') || '[]');
        const updatedTables = tables.map(t => 
          t.table_name === order.table_name ? { ...t, status: 'available' } : t
        );
        localStorage.setItem('pos_tables', JSON.stringify(updatedTables));
      }
    }
  };

  const handleUpdateOrder = () => {
    const subtotal = editingItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxAmount = subtotal * 0.10; // Default 10%
    const total = subtotal + taxAmount;

    const updatedOrders = orders.map(o => {
      if (o.id === selectedOrder.id) {
        return {
          ...o,
          items: editingItems,
          total_amount: total,
          status: 'Paid',
          payment_method: 'Cash'
        };
      }
      return o;
    });

    setOrders(updatedOrders);
    localStorage.setItem('pos_orders', JSON.stringify(updatedOrders));
    
    // Reset table if it was pending
    if (selectedOrder.status === 'Pending') {
      const tables = JSON.parse(localStorage.getItem('pos_tables') || '[]');
      const updatedTables = tables.map(t => 
        t.table_name === selectedOrder.table_name ? { ...t, status: 'available' } : t
      );
      localStorage.setItem('pos_tables', JSON.stringify(updatedTables));
    }

    alert('Order updated and marked as Paid via Cash');
    setSelectedOrder(null);
    setIsEditing(false);
  };

  const addItemToOrder = (menuItem) => {
    const existing = editingItems.find(i => i.name === menuItem.name);
    if (existing) {
      setEditingItems(editingItems.map(i => 
        i.name === menuItem.name ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setEditingItems([...editingItems, { ...menuItem, quantity: 1 }]);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');

  const dateFilteredOrders = orders.filter(order => {
    const orderDate = getLocalDateKey(order.created_at || order.date);
    if (!orderDate) return false;
    if (reportMode === 'daily') return orderDate === reportDate;
    return Boolean(startDate && endDate && startDate <= endDate && orderDate >= startDate && orderDate <= endDate);
  });

  const statusCounts = dateFilteredOrders.reduce((counts, order) => {
    counts[getBillCategory(order)] += 1;
    return counts;
  }, { pending: 0, held: 0, split: 0, completed: 0 });

  const completedSales = dateFilteredOrders
    .filter(order => ['completed', 'split'].includes(getBillCategory(order)))
    .reduce((total, order) => total + Number(order.total_amount || 0), 0);

  const filteredOrders = dateFilteredOrders.filter(order => (
    statusFilter === 'all' || getBillCategory(order) === statusFilter
  )).filter(order => 
    String(order.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(order.order_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(order.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(order.table_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportToExcel = () => {
    const headers = ['Order ID', 'Date', 'Table', 'Customer', 'Employee', 'Total', 'Status', 'Payment'];
    const rows = filteredOrders.map(order => [
      order.order_number || order.id,
      formatOrderDate(order.date),
      order.table_name,
      order.customer_name,
      order.employee_id,
      Number(order.total_amount || 0).toFixed(2),
      order.status,
      order.payment_method
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    const content = `
      <html>
        <head>
          <title>Orders Report</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { bg-color: #f4f4f4; }
            h1 { text-align: center; }
          </style>
        </head>
        <body>
          <h1>Orders Report</h1>
          <p>Generated on: ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Table</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredOrders.map(order => `
                <tr>
                  <td>${order.id}</td>
                  <td>${formatOrderDate(order.date)}</td>
                  <td>${order.table_name}</td>
                  <td>${order.customer_name}</td>
                  <td>${user?.currency}${Number(order.total_amount || 0).toFixed(2)}</td>
                  <td>${order.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Orders Management</h1>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="btn btn-secondary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Excel
          </button>
          <button onClick={exportToPDF} className="btn btn-primary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Sales & bill report</h2>
            <p className="mt-1 text-sm text-gray-500">Review daily sales or choose a custom date range.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-semibold text-gray-600">
              Report period
              <select
                className="input"
                value={reportMode}
                onChange={event => setReportMode(event.target.value)}
              >
                <option value="daily">Daily sales</option>
                <option value="range">Custom date range</option>
              </select>
            </label>
            {reportMode === 'daily' ? (
              <label className="grid gap-1 text-xs font-semibold text-gray-600">
                Sales date
                <input className="input" type="date" value={reportDate} onChange={event => setReportDate(event.target.value)} />
              </label>
            ) : (
              <>
                <label className="grid gap-1 text-xs font-semibold text-gray-600">
                  Start date
                  <input className="input" type="date" value={startDate} max={endDate || undefined} onChange={event => setStartDate(event.target.value)} />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-gray-600">
                  End date
                  <input className="input" type="date" value={endDate} min={startDate || undefined} onChange={event => setEndDate(event.target.value)} />
                </label>
              </>
            )}
          </div>
        </div>

        {reportMode === 'range' && startDate && endDate && startDate > endDate && (
          <p role="alert" className="text-sm font-semibold text-red-600">Start date must be on or before end date.</p>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: 'Bills', value: dateFilteredOrders.length },
            { label: 'Completed sales', value: `${user?.currency || '$'}${completedSales.toFixed(2)}` },
            { label: 'Pending bills', value: statusCounts.pending },
            { label: 'Held bills', value: statusCounts.held },
            { label: 'Split bills', value: statusCounts.split }
          ].map(metric => (
            <div key={metric.label} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-500">{metric.label}</p>
              <p className="mt-1 text-xl font-extrabold text-gray-900">{metric.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="card">
        {ordersError && (
          <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {ordersError}
          </p>
        )}
        <div className="mb-4 flex flex-wrap gap-2" aria-label="Filter bills by status">
          {[
            { id: 'all', label: `All (${dateFilteredOrders.length})` },
            { id: 'pending', label: `Pending (${statusCounts.pending})` },
            { id: 'held', label: `Held (${statusCounts.held})` },
            { id: 'split', label: `Split (${statusCounts.split})` },
            { id: 'completed', label: `Completed (${statusCounts.completed})` }
          ].map(filter => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={statusFilter === filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                statusFilter === filter.id
                  ? 'bg-slate-900 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by ID, Table or Customer..."
            className="input w-full md:w-1/3"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <p className="mt-2 text-xs text-gray-500">
            Showing {filteredOrders.length} of {orders.length} orders
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-sm">
              <tr>
                <th className="px-6 py-4">Order ID</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Table</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ordersLoading ? (
                <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">Loading order history…</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">No orders found.</td></tr>
              ) : filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{order.order_number || order.id}</td>
                  <td className="px-6 py-4 text-gray-600">{formatOrderDate(order.date)}</td>
                  <td className="px-6 py-4 text-gray-600">{order.table_name}</td>
                  <td className="px-6 py-4 text-gray-600">{order.customer_name}</td>
                  <td className="px-6 py-4 font-bold text-primary-600">
                    {user?.currency}{Number(order.total_amount || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getBillBadgeClass(order)}`}>
                      {getBillLabel(order)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-primary-600 hover:text-primary-800 font-medium"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDeleteOrder(order.id)}
                        disabled={order.source === 'server'}
                        title={order.source === 'server' ? 'Server-synced orders cannot be deleted from this device.' : undefined}
                        className="text-red-500 hover:text-red-700 font-medium disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Order Details - {selectedOrder.id}</h2>
              <div className="flex gap-2">
                {!isEditing && (selectedOrder.status === 'Pending' || selectedOrder.status === 'Held') && (
                  <button 
                    onClick={() => {
                      setIsEditing(true);
                      setEditingItems([...selectedOrder.items]);
                    }}
                    className="btn btn-primary px-4 py-2"
                  >
                    Edit & Pay Cash
                  </button>
                )}
                <button onClick={() => { setSelectedOrder(null); setIsEditing(false); }} className="text-gray-500 hover:text-gray-700">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {isEditing && (
              <div className="mb-6 p-4 border-2 border-primary-100 rounded-lg bg-primary-50">
                <h3 className="font-bold mb-3">Add Menu Items:</h3>
                <div className="grid grid-cols-3 gap-2">
                  {allMenuItems.map(item => (
                    <button 
                      key={item.id}
                      onClick={() => addItemToOrder(item)}
                      className="p-2 bg-white rounded shadow text-sm hover:bg-gray-100"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="space-y-2">
                <p className="text-gray-600">Date: <span className="text-gray-900 font-medium">{selectedOrder.date}</span></p>
                <p className="text-gray-600">Table: <span className="text-gray-900 font-medium">{selectedOrder.table_name}</span></p>
                <p className="text-gray-600">Customer: <span className="text-gray-900 font-medium">{selectedOrder.customer_name}</span></p>
              </div>
              <div className="space-y-2 text-right">
                <p className="text-gray-600">Employee: <span className="text-gray-900 font-medium">{selectedOrder.employee_id || '—'}</span></p>
                <p className="text-gray-600">Status: <span className={`font-bold ${selectedOrder.status === 'Paid' ? 'text-green-600' : 'text-yellow-600'}`}>{selectedOrder.status}</span></p>
                <p className="text-gray-600">Payment: <span className="text-gray-900 font-medium">{selectedOrder.payment_method}</span></p>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden mb-6">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left">Item Name</th>
                    <th className="px-4 py-2 text-center">Qty</th>
                    <th className="px-4 py-2 text-right">Price</th>
                    <th className="px-4 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(isEditing ? editingItems : selectedOrder.items).map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2">{item.name}</td>
                      <td className="px-4 py-2 text-center">
                        {isEditing ? (
                          <div className="flex justify-center items-center gap-2">
                            <button onClick={() => {
                              const updated = editingItems.map((it, i) => i === idx ? { ...it, quantity: Math.max(0, it.quantity - 1) } : it).filter(it => it.quantity > 0);
                              setEditingItems(updated);
                            }} className="w-6 h-6 bg-gray-200 rounded">-</button>
                            {item.quantity}
                            <button onClick={() => {
                              const updated = editingItems.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it);
                              setEditingItems(updated);
                            }} className="w-6 h-6 bg-gray-200 rounded">+</button>
                          </div>
                        ) : item.quantity}
                      </td>
                      <td className="px-4 py-2 text-right">{user?.currency}{Number(item.price || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-medium">
                        {user?.currency}{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-bold">
                  <tr>
                    <td colSpan="3" className="px-4 py-3 text-right text-lg">Total Amount:</td>
                    <td className="px-4 py-3 text-right text-lg text-primary-600">
                      {user?.currency}{(isEditing ? editingItems.reduce((sum, item) => sum + (item.price * item.quantity), 0) * 1.10 : selectedOrder.total_amount).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end gap-3">
              {isEditing ? (
                <>
                  <button onClick={() => setIsEditing(false)} className="btn btn-secondary px-8 py-2">Cancel</button>
                  <button onClick={handleUpdateOrder} className="btn btn-primary px-8 py-2">Save & Pay Cash</button>
                </>
              ) : (
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="btn btn-secondary px-8 py-2"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
