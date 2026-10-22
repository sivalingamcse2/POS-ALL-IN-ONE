import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const getLocalDate = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getOrderDate = order => {
  const date = new Date(order.created_at || order.date || '');
  return Number.isNaN(date.getTime()) ? '' : getLocalDate(date);
};

const getServiceDetails = order => {
  const explicitType = String(order.service_type || '').trim();
  const tableName = String(order.table_name || '').trim();
  const roomNumber = String(order.room_number || '').trim();
  const isRoomService = /room/i.test(explicitType) || Boolean(roomNumber) || /^room\b/i.test(tableName);
  const isDineIn = /dine[\s-]?in/i.test(explicitType)
    || Boolean(order.table_id && !isRoomService)
    || /^(table|vip)\b/i.test(tableName);

  return {
    type: isRoomService ? 'Room service' : isDineIn ? 'Dine-in' : explicitType || order.order_type || 'Takeaway',
    location: isRoomService
      ? `Room ${roomNumber || tableName.replace(/^room\s*/i, '') || '—'}`
      : tableName || (order.table_id ? `Table ${order.table_id}` : '')
  };
};

export default function KitchenDisplay() {
  const { activeRestaurant } = useAuth();
  const [orders, setOrders] = useState([]);
  const [reportOrders, setReportOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [activeView, setActiveView] = useState('queue');
  const [reportType, setReportType] = useState('daily');
  const [reportDate, setReportDate] = useState(getLocalDate(new Date()));
  const [reportStartDate, setReportStartDate] = useState(getLocalDate(new Date()));
  const [reportEndDate, setReportEndDate] = useState(getLocalDate(new Date()));
  const [reportError, setReportError] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [elapsedTimes, setElapsedTimes] = useState({});

  useEffect(() => {
    const fetchOrders = async () => {
      let allOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
      try {
        const restaurantId = activeRestaurant?.id || 1;
        const response = await fetch(`/api/public/kitchen-orders?restaurant_id=${restaurantId}`, {
          headers: { 'x-restaurant-id': String(restaurantId) }
        });
        if (!response.ok) throw new Error(`Kitchen feed returned ${response.status}`);
        const serverOrders = await response.json();
        allOrders = [...serverOrders, ...allOrders.filter(localOrder => !serverOrders.some(order => order.id === localOrder.id))];
      } catch (error) {
        console.warn('KDS server sync unavailable; using local orders', error.message);
      }

      allOrders = allOrders.map(order => ({ ...order, status: order.status === 'Held' ? 'Pending' : order.status }));
      const kitchenOrders = allOrders.filter(order => (
        Number(order.restaurant_id) === Number(activeRestaurant?.id)
        && ['Pending', 'Preparing', 'Ready', 'Completed'].includes(order.status)
      ));
      const visibleOrders = kitchenOrders.filter(order => (
        statusFilter === 'active'
          ? ['Pending', 'Preparing'].includes(order.status)
          : statusFilter === 'Completed' ? ['Ready', 'Completed'].includes(order.status) : order.status === statusFilter
      ));
      setOrders(visibleOrders.sort((a, b) => (
        new Date(a.created_at || a.date || 0) - new Date(b.created_at || b.date || 0)
      )));
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [activeRestaurant, statusFilter]);

  useEffect(() => {
    if (activeView !== 'reports') return undefined;

    const startDate = reportType === 'daily' ? reportDate : reportStartDate;
    const endDate = reportType === 'daily' ? reportDate : reportEndDate;
    if (!startDate || !endDate || startDate > endDate) {
      setReportOrders([]);
      setReportError('');
      setReportLoading(false);
      return undefined;
    }

    let cancelled = false;
    const loadReport = async () => {
      setReportLoading(true);
      setReportError('');
      try {
        const restaurantId = activeRestaurant?.id || 1;
        const params = new URLSearchParams({
          restaurant_id: String(restaurantId),
          start_date: startDate,
          end_date: endDate,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        });
        const response = await fetch(`/api/public/kitchen-orders?${params}`, {
          headers: { 'x-restaurant-id': String(restaurantId) }
        });
        if (!response.ok) throw new Error(`Report request returned ${response.status}`);
        const serverOrders = await response.json();
        if (!cancelled) {
          setReportOrders(serverOrders.filter(order => Number(order.restaurant_id) === Number(restaurantId)));
        }
      } catch (error) {
        if (!cancelled) {
          const localOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]').filter(order => (
            Number(order.restaurant_id) === Number(activeRestaurant?.id)
            && ['Pending', 'Preparing', 'Ready', 'Completed'].includes(order.status === 'Held' ? 'Pending' : order.status)
            && getOrderDate(order) >= startDate
            && getOrderDate(order) <= endDate
          ));
          setReportOrders(localOrders);
          setReportError(`Could not load the server report. Showing saved local orders instead. (${error.message})`);
        }
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    };

    loadReport();
    return () => { cancelled = true; };
  }, [activeView, activeRestaurant, reportType, reportDate, reportStartDate, reportEndDate]);

  useEffect(() => {
    const updateElapsed = () => {
      const now = new Date();
      const times = {};
      orders.forEach(order => {
        const createdAt = new Date(order.created_at || order.date || now);
        times[order.id] = Number.isNaN(createdAt.getTime())
          ? 0
          : Math.max(0, Math.floor((now - createdAt) / 1000));
      });
      setElapsedTimes(times);
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [orders]);

  const updateStatus = async (orderId, newStatus) => {
    const savedStatus = newStatus === 'Ready' ? 'Completed' : newStatus;
    const allOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
    const updated = allOrders.map(order => order.id === orderId ? { ...order, status: savedStatus } : order);
    localStorage.setItem('pos_orders', JSON.stringify(updated));
    setOrders(current => current.map(order => order.id === orderId ? { ...order, status: savedStatus } : order));
    await fetch(`/api/public/kitchen-orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: savedStatus })
    }).catch(error => console.warn('KDS status sync unavailable', error.message));
  };

  const updateItemStatus = (orderId, itemIndex, itemStatus) => {
    const allOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
    const updated = allOrders.map(order => {
      if (order.id !== orderId) return order;
      const items = (order.items || []).map((item, index) => (
        index === itemIndex ? { ...item, kitchen_status: itemStatus } : item
      ));
      const statuses = items.map(item => item.kitchen_status || 'Order Accepted');
      const orderStatus = statuses.every(status => status === 'Ready')
        ? 'Completed'
        : statuses.some(status => status === 'Preparing') ? 'Preparing' : 'Pending';
      return { ...order, items, status: orderStatus };
    });
    localStorage.setItem('pos_orders', JSON.stringify(updated));
    const changedOrder = updated.find(order => order.id === orderId);
    setOrders(current => current.map(order => order.id === orderId ? changedOrder : order));
    fetch(`/api/public/kitchen-orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: changedOrder.status })
    }).catch(error => console.warn('KDS item status sync unavailable', error.message));
    setSelectedItem(null);
  };

  const reportStart = reportType === 'daily' ? reportDate : reportStartDate;
  const reportEnd = reportType === 'daily' ? reportDate : reportEndDate;
  const reportRows = reportOrders
    .filter(order => getOrderDate(order) >= reportStart && getOrderDate(order) <= reportEnd)
    .sort((a, b) => new Date(a.created_at || a.date || 0) - new Date(b.created_at || b.date || 0));
  const reportSummary = {
    orders: reportRows.length,
    completed: reportRows.filter(order => ['Ready', 'Completed'].includes(order.status)).length,
    inProgress: reportRows.filter(order => ['Pending', 'Preparing'].includes(order.status)).length,
    items: reportRows.reduce((total, order) => total + (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0), 0)
  };

  const exportToExcel = () => {
    const escapeCsv = value => {
      const text = String(value ?? '');
      const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safeText.replace(/"/g, '""')}"`;
    };
    const rows = [
      ['Order', 'Date', 'Time', 'Service', 'Location', 'Items', 'Quantity', 'Status'],
      ...reportRows.map(order => {
        const { type, location } = getServiceDetails(order);
        const createdAt = new Date(order.created_at || order.date || '');
        const itemNames = (order.items || []).map(item => `${item.item_name || item.name || 'Menu item'} x${item.quantity || 0}`).join('; ');
        const quantity = (order.items || []).reduce((total, item) => total + (Number(item.quantity) || 0), 0);
        return [
          order.id,
          getOrderDate(order),
          Number.isNaN(createdAt.getTime()) ? '' : createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type,
          location,
          itemNames,
          quantity,
          order.status
        ];
      })
    ];
    const csv = `\uFEFF${rows.map(row => row.map(escapeCsv).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `kitchen_report_${reportStart}_to_${reportEnd}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportToPdf = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=700');
    if (!printWindow) {
      setReportError('Allow pop-ups to open the printable report, then choose Save as PDF in the print dialog.');
      return;
    }
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
    const tableRows = reportRows.map(order => {
      const { type, location } = getServiceDetails(order);
      const createdAt = new Date(order.created_at || order.date || '');
      const itemNames = (order.items || []).map(item => `${item.item_name || item.name || 'Menu item'} x${item.quantity || 0}`).join(', ');
      return `<tr>
        <td>${escapeHtml(order.id)}</td>
        <td>${escapeHtml(getOrderDate(order))}</td>
        <td>${escapeHtml(Number.isNaN(createdAt.getTime()) ? '' : createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</td>
        <td>${escapeHtml(type)}</td>
        <td>${escapeHtml(location)}</td>
        <td>${escapeHtml(itemNames)}</td>
        <td>${escapeHtml(order.status)}</td>
      </tr>`;
    }).join('');
    printWindow.document.write(`<!doctype html>
      <html><head><title>Kitchen Report</title><style>
        body { font-family: Arial, sans-serif; color: #0f172a; padding: 28px; }
        h1 { margin: 0 0 6px; } p { color: #475569; margin: 0 0 20px; }
        .summary { display: flex; gap: 24px; margin-bottom: 20px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #e2e8f0; } tr { page-break-inside: avoid; }
        @page { size: landscape; margin: 12mm; }
      </style></head><body>
        <h1>${escapeHtml(activeRestaurant?.name || 'Restaurant')} — Kitchen Report</h1>
        <p>Period: ${escapeHtml(reportStart)} to ${escapeHtml(reportEnd)}</p>
        <div class="summary"><span>Orders: ${reportSummary.orders}</span><span>Completed: ${reportSummary.completed}</span><span>In progress: ${reportSummary.inProgress}</span><span>Items: ${reportSummary.items}</span></div>
        <table><thead><tr><th>Order</th><th>Date</th><th>Time</th><th>Service</th><th>Location</th><th>Items</th><th>Status</th></tr></thead>
        <tbody>${tableRows || '<tr><td colspan="7">No kitchen orders in this period.</td></tr>'}</tbody></table>
      </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="flex h-[calc(100vh-40px)] min-h-[560px] flex-col overflow-hidden rounded-2xl bg-slate-100 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-900 px-5 py-4 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-xs font-black text-slate-950">KDS</div>
          <div>
            <h1 className="text-lg font-extrabold tracking-wide text-white">Kitchen Display</h1>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="text-xs font-medium text-slate-300">{activeRestaurant?.name} · Live order queue</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-xl border border-slate-700 bg-slate-800 p-1">
            {[
              { id: 'queue', label: 'Order queue' },
              { id: 'reports', label: 'Reports' }
            ].map(view => (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition ${activeView === view.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-slate-700'}`}
              >
                {view.label}
              </button>
            ))}
          </div>
          {activeView === 'queue' && (
            <div className="flex gap-1 rounded-xl border border-slate-700 bg-slate-800 p-1">
              {['active', 'Pending', 'Preparing', 'Completed'].map(filter => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition ${statusFilter === filter ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-slate-700'}`}
                >
                  {filter === 'active' ? 'All Active' : filter}
                </button>
              ))}
            </div>
          )}
          <div className="min-w-16 text-right font-mono text-lg font-bold text-emerald-300">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </header>

      {activeView === 'reports' ? (
        <main className="flex-1 overflow-y-auto p-4 sm:p-5">
          <section className="mb-5 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1.5 text-xs font-bold text-slate-600">
                Report type
                <select
                  value={reportType}
                  onChange={event => setReportType(event.target.value)}
                  className="min-w-40 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800"
                >
                  <option value="daily">Daily report</option>
                  <option value="custom">Custom date range</option>
                </select>
              </label>
              {reportType === 'daily' ? (
                <label className="grid gap-1.5 text-xs font-bold text-slate-600">
                  Report date
                  <input
                    type="date"
                    value={reportDate}
                    onChange={event => setReportDate(event.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800"
                  />
                </label>
              ) : (
                <>
                  <label className="grid gap-1.5 text-xs font-bold text-slate-600">
                    Start date
                    <input
                      type="date"
                      value={reportStartDate}
                      max={reportEndDate}
                      onChange={event => setReportStartDate(event.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800"
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-slate-600">
                    End date
                    <input
                      type="date"
                      value={reportEndDate}
                      min={reportStartDate}
                      onChange={event => setReportEndDate(event.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800"
                    />
                  </label>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportToExcel}
                disabled={reportLoading || !reportRows.length}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Download Excel (CSV)
              </button>
              <button
                type="button"
                onClick={exportToPdf}
                disabled={reportLoading}
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Download PDF
              </button>
            </div>
          </section>

          {reportStart && reportEnd && reportStart > reportEnd && (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Start date must be on or before end date.</p>
          )}
          {reportError && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{reportError}</p>}

          <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: 'Orders', value: reportSummary.orders, color: 'text-slate-900' },
              { label: 'Completed', value: reportSummary.completed, color: 'text-emerald-700' },
              { label: 'In progress', value: reportSummary.inProgress, color: 'text-amber-700' },
              { label: 'Items ordered', value: reportSummary.items, color: 'text-sky-700' }
            ].map(metric => (
              <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold text-slate-500">{metric.label}</p>
                <p className={`mt-1 text-2xl font-extrabold ${metric.color}`}>{reportLoading ? '—' : metric.value}</p>
              </div>
            ))}
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-extrabold text-slate-900">Kitchen order details</h2>
              <p className="text-xs font-semibold text-slate-500">{reportStart} to {reportEnd} · {reportLoading ? 'Loading…' : `${reportRows.length} orders`}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-extrabold">Order</th>
                    <th className="px-4 py-3 font-extrabold">Date & time</th>
                    <th className="px-4 py-3 font-extrabold">Service</th>
                    <th className="px-4 py-3 font-extrabold">Location</th>
                    <th className="px-4 py-3 font-extrabold">Items</th>
                    <th className="px-4 py-3 font-extrabold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!reportLoading && reportRows.map(order => {
                    const createdAt = new Date(order.created_at || order.date || '');
                    const { type, location } = getServiceDetails(order);
                    return (
                      <tr key={order.id} className="align-top">
                        <td className="px-4 py-3 font-extrabold text-slate-800">#{order.id}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {getOrderDate(order)}<br />
                          {Number.isNaN(createdAt.getTime()) ? '—' : createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{type}</td>
                        <td className="px-4 py-3 text-slate-600">{location || '—'}</td>
                        <td className="max-w-sm px-4 py-3 text-slate-600">
                          {(order.items || []).map(item => `${item.item_name || item.name || 'Menu item'} × ${item.quantity || 0}`).join(', ') || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold text-slate-700">{order.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {!reportLoading && reportRows.length === 0 && (
                    <tr><td colSpan="6" className="px-4 py-14 text-center text-sm font-medium text-slate-500">No kitchen orders found for this period.</td></tr>
                  )}
                  {reportLoading && (
                    <tr><td colSpan="6" className="px-4 py-14 text-center text-sm font-medium text-slate-500">Loading kitchen report…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      ) : (
      <main className="flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {orders.map(order => {
            const explicitType = String(order.service_type || '').trim();
            const tableName = String(order.table_name || '').trim();
            const roomNumber = String(order.room_number || '').trim();
            const isRoomService = /room/i.test(explicitType) || Boolean(roomNumber) || /^room\b/i.test(tableName);
            const isDineIn = /dine[\s-]?in/i.test(explicitType)
              || Boolean(order.table_id && !isRoomService)
              || /^(table|vip)\b/i.test(tableName);
            const serviceType = isRoomService
              ? 'Room service'
              : isDineIn ? 'Dine-in' : explicitType || order.order_type || 'Restaurant order';
            const serviceLocation = isRoomService
              ? `Room ${roomNumber || tableName.replace(/^room\s*/i, '') || '—'}`
              : tableName || (order.table_id ? `Table ${order.table_id}` : '');
            const createdAt = new Date(order.created_at || order.date || Date.now());
            const elapsed = elapsedTimes[order.id] || 0;

            return (
              <article key={order.id} className="flex max-h-[calc(100vh-150px)] min-h-[320px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className={`border-b px-4 py-3 ${order.status === 'Preparing' ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${isRoomService ? 'bg-violet-100 text-violet-800' : isDineIn ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-700'}`}>
                          {serviceType}
                        </span>
                        {serviceLocation && <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-sm">{serviceLocation}</span>}
                      </div>
                      <p className="truncate text-base font-extrabold text-slate-900">{order.customer_name || 'Guest order'}</p>
                      {order.customer_phone && <p className="mt-0.5 truncate text-xs text-slate-500">{order.customer_phone}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Order #{order.id}</p>
                      <p className={`mt-1 font-mono text-lg font-extrabold ${elapsed > 600 ? 'animate-pulse text-rose-600' : 'text-slate-800'}`}>
                        {Math.floor(elapsed / 60)}:{elapsed % 60 < 10 ? '0' : ''}{elapsed % 60}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-slate-500">
                    <span>{Number.isNaN(createdAt.getTime()) ? 'Time unavailable' : createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className={`rounded-full px-2 py-0.5 font-bold ${order.status === 'Preparing' ? 'bg-amber-100 text-amber-800' : order.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                      {order.status}
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto bg-white p-3">
                  {(order.items || []).map((item, index) => (
                    <div key={index} className="border-b border-slate-100 pb-2 last:border-0">
                      <button
                        type="button"
                        disabled={order.status === 'Ready' || order.status === 'Completed'}
                        onClick={() => setSelectedItem(
                          selectedItem?.orderId === order.id && selectedItem.itemIndex === index
                            ? null
                            : { orderId: order.id, itemIndex: index }
                        )}
                        className="flex w-full items-start text-left disabled:cursor-default"
                      >
                        <span className="mr-3 flex h-8 min-w-8 items-center justify-center rounded-lg bg-emerald-50 px-2 text-sm font-extrabold text-emerald-800">
                          {item.quantity}×
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold leading-snug text-slate-800">{item.item_name || item.name || 'Menu item'}</span>
                          {item.notes && <span className="mt-1 block text-xs font-medium text-amber-700">{item.notes}</span>}
                          <span className="mt-1 block text-[10px] font-semibold text-slate-500">
                            {item.kitchen_status || 'Order Accepted'}{order.status !== 'Ready' && order.status !== 'Completed' ? ' · Tap for status' : ''}
                          </span>
                        </span>
                      </button>
                      {selectedItem?.orderId === order.id && selectedItem.itemIndex === index && order.status !== 'Ready' && order.status !== 'Completed' && (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {['Order Accepted', 'Preparing', 'Ready'].map(itemStatus => (
                            <button
                              key={itemStatus}
                              type="button"
                              onClick={() => updateItemStatus(order.id, index, itemStatus)}
                              className={`rounded-xl px-2 py-2.5 text-[10px] font-bold ${item.kitchen_status === itemStatus ? 'bg-emerald-500 text-slate-950' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                            >
                              {itemStatus}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 border-t border-slate-100 bg-slate-50 p-3">
                  {order.status === 'Pending' && (
                    <button onClick={() => updateStatus(order.id, 'Preparing')} className="flex-1 rounded-xl bg-amber-500 py-3 text-xs font-extrabold text-white transition hover:bg-amber-600 active:scale-[0.98]">
                      Start cooking
                    </button>
                  )}
                  {order.status === 'Preparing' && (
                    <button onClick={() => updateStatus(order.id, 'Ready')} className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-extrabold text-white transition hover:bg-emerald-700 active:scale-[0.98]">
                      Mark ready
                    </button>
                  )}
                  {order.status === 'Ready' && (
                    <button onClick={() => updateStatus(order.id, 'Completed')} className="flex-1 rounded-xl bg-slate-700 py-3 text-xs font-extrabold text-white transition hover:bg-slate-800 active:scale-[0.98]">
                      Finish order
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {orders.length === 0 && (
            <div className="col-span-full flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">🍽️</div>
              <h2 className="text-lg font-extrabold text-slate-800">No {statusFilter === 'active' ? 'active' : statusFilter.toLowerCase()} orders</h2>
              <p className="mt-1 text-sm text-slate-500">New dine-in and room service orders will appear here.</p>
            </div>
          )}
        </div>
      </main>
      )}
    </div>
  );
}
