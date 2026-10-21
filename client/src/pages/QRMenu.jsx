import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { posApi, reportApi } from '../api';
import { useAuth } from '../context/AuthContext';

const localDate = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const orderLocalDate = order => {
  const date = new Date(order.created_at || order.date || '');
  return Number.isNaN(date.getTime()) ? '' : localDate(date);
};

export default function QRMenu() {
  const { activeRestaurant } = useAuth();
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState(null);
  const [serverIp, setServerIp] = useState(window.location.hostname);
  const [networkAddresses, setNetworkAddresses] = useState([]);
  const [hostChecking, setHostChecking] = useState(false);
  const [hostError, setHostError] = useState('');
  const [tables, setTables] = useState([]);
  const [activeTab, setActiveTab] = useState('tables');
  const [tableName, setTableName] = useState('');
  const [tableCapacity, setTableCapacity] = useState('4');
  const [tableError, setTableError] = useState('');
  const [reportType, setReportType] = useState('daily');
  const [reportDate, setReportDate] = useState(localDate(new Date()));
  const [startDate, setStartDate] = useState(localDate(new Date()));
  const [endDate, setEndDate] = useState(localDate(new Date()));
  const [orders, setOrders] = useState([]);
  const [serverReport, setServerReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  const getLocalTables = useCallback(() => {
    const savedTables = JSON.parse(localStorage.getItem('pos_tables') || '[]');
    if (savedTables.length > 0) return savedTables;
    const defaultTables = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      table_name: `Table ${index + 1}`,
      status: 'available',
      restaurant_id: activeRestaurant?.id || 1
    }));
    localStorage.setItem('pos_tables', JSON.stringify(defaultTables));
    return defaultTables;
  }, [activeRestaurant?.id]);

  const refreshTables = useCallback(async () => {
    const localTables = getLocalTables().filter(table => (
      !table.restaurant_id || Number(table.restaurant_id) === Number(activeRestaurant?.id)
    ));
    try {
      const response = await fetch(`/api/public/tables?restaurant_id=${activeRestaurant?.id || 1}`, {
        headers: { 'x-restaurant-id': String(activeRestaurant?.id || 1) }
      });
      if (!response.ok) throw new Error(`Table feed returned ${response.status}`);
      const serverTables = (await response.json())
        .filter(table => table.id !== null && table.id !== undefined)
        .map(table => ({ ...table, table_name: table.table_name || table.name || `Table ${table.id}` }));
      const combined = [...serverTables, ...localTables.filter(local => !serverTables.some(remote => Number(remote.id) === Number(local.id)))];
      setTables(current => JSON.stringify(current) === JSON.stringify(combined) ? current : combined);
    } catch (error) {
      console.error('Error fetching tables:', error);
      const localOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
      const occupiedIds = localOrders
        .filter(order => !['Paid', 'Cancelled'].includes(order.status))
        .map(order => String(order.table_id));
      const fallbackTables = localTables.map(table => ({
        ...table,
        status: occupiedIds.includes(String(table.id)) ? 'occupied' : table.status || 'available'
      }));
      setTables(current => JSON.stringify(current) === JSON.stringify(fallbackTables) ? current : fallbackTables);
    }
  }, [activeRestaurant?.id, getLocalTables]);

  useEffect(() => {
    refreshTables();
    const interval = setInterval(refreshTables, 5000);
    return () => clearInterval(interval);
  }, [refreshTables]);

  useEffect(() => {
    let cancelled = false;
    const findReachableHost = async () => {
      try {
        const response = await fetch('/api/public/network-addresses');
        if (!response.ok) throw new Error(`Network address lookup returned ${response.status}`);
        const { addresses = [] } = await response.json();
        if (cancelled) return;
        setNetworkAddresses(addresses);

        const configuredHost = localStorage.getItem('qr_server_host');
        if (configuredHost && /^https?:\/\//i.test(configuredHost)) {
          try {
            const configuredUrl = new URL(configuredHost);
            if (['http:', 'https:'].includes(configuredUrl.protocol)) {
              setServerIp(configuredHost);
              setHostError('');
              return;
            }
          } catch {
            localStorage.removeItem('qr_server_host');
          }
        }

        if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) {
          setServerIp(configuredHost || window.location.hostname);
          return;
        }

        setHostChecking(true);
        const savedHost = localStorage.getItem('qr_server_host');
        const usableSavedHost = savedHost && !['localhost', '127.0.0.1', '::1'].includes(savedHost.toLowerCase())
          ? savedHost
          : null;
        const candidates = [...new Set([usableSavedHost, ...addresses].filter(Boolean))];
        for (const host of candidates) {
          try {
            const response = await fetch(`${window.location.protocol}//${host}:${window.location.port}/api/health`, {
              signal: AbortSignal.timeout(2000)
            });
            if (response.ok) {
              if (!cancelled) {
                setServerIp(host);
                localStorage.setItem('qr_server_host', host);
                setHostError('');
              }
              break;
            }
          } catch {
            continue;
          }
        }
        if (!cancelled) {
          setHostError(current => current || 'Choose the Wi-Fi address that your phone uses to connect to this computer.');
          setHostChecking(false);
        }
      } catch (error) {
        if (!cancelled) {
          setHostError(`Could not detect a network address: ${error.message}`);
          setHostChecking(false);
        }
      }
    };
    findReachableHost();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
    setOrders(savedOrders.filter(order => Number(order.restaurant_id) === Number(activeRestaurant?.id)));
  }, [activeRestaurant?.id, activeTab]);

  const generateQR = table => setSelectedTable(table);
  const reportStart = reportType === 'daily' ? reportDate : startDate;
  const reportEnd = reportType === 'daily' ? reportDate : endDate;
  const reportOrders = useMemo(() => orders.filter(order => (
    String(order.status).toLowerCase() === 'paid'
    && orderLocalDate(order) >= reportStart
    && orderLocalDate(order) <= reportEnd
  )), [orders, reportStart, reportEnd]);
  const reportSummary = useMemo(() => {
    const itemTotals = new Map();
    let revenue = 0;
    reportOrders.forEach(order => {
      revenue += Number(order.total_amount ?? order.total ?? 0);
      (order.items || []).forEach(item => {
        const name = item.item_name || item.name || 'Menu item';
        const key = `${item.item_id ?? item.id ?? name}:${name}`;
        const row = itemTotals.get(key) || { item_name: name, quantity: 0, revenue: 0 };
        const quantity = Number(item.quantity) || 0;
        row.quantity += quantity;
        row.revenue += Number(item.price || 0) * quantity;
        itemTotals.set(key, row);
      });
    });
    return serverReport || {
      revenue,
      orderCount: reportOrders.length,
      items: [...itemTotals.values()].sort((a, b) => b.revenue - a.revenue)
    };
  }, [reportOrders, serverReport]);

  useEffect(() => {
    if (activeTab !== 'reports' || !reportStart || !reportEnd || reportStart > reportEnd) {
      setServerReport(null);
      setReportLoading(false);
      setReportError('');
      return undefined;
    }

    let cancelled = false;
    const loadSystemReport = async () => {
      setReportLoading(true);
      setReportError('');
      try {
        const [itemsResponse, salesResponse] = await Promise.all([
          reportApi.getItemSales(reportStart, reportEnd),
          reportType === 'daily'
            ? reportApi.getDailySales(reportStart)
            : reportApi.getSalesRange(reportStart, reportEnd)
        ]);
        const salesRows = Array.isArray(salesResponse.data) ? salesResponse.data : [salesResponse.data];
        const totals = salesRows.reduce((summary, row) => ({
          orderCount: summary.orderCount + (Number(row.total_orders) || 0),
          revenue: summary.revenue + (Number(row.total_sales) || 0)
        }), { orderCount: 0, revenue: 0 });
        if (!cancelled) {
          setServerReport({
            ...totals,
            items: (itemsResponse.data || []).map(item => ({
              item_name: item.item_name || 'Menu item',
              quantity: Number(item.total_quantity) || 0,
              revenue: Number(item.total_revenue) || 0
            }))
          });
        }
      } catch (error) {
        if (!cancelled) {
          setServerReport(null);
          setReportError(`Could not load the system report; showing this device's saved paid orders. ${error.response?.data?.error || error.message}`);
        }
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    };
    loadSystemReport();
    return () => { cancelled = true; };
  }, [activeTab, reportStart, reportEnd, reportType]);

  const getGuestUrl = tableId => {
    const address = serverIp.trim();
    if (/^https?:\/\//i.test(address)) {
      return `${address.replace(/\/+$/, '')}/order/${tableId}`;
    }
    const host = address.replace(/\/.*$/, '');
    const port = window.location.port ? `:${window.location.port}` : '';
    return `${window.location.protocol}//${host}${port}/order/${tableId}`;
  };

  const addTable = async event => {
    event.preventDefault();
    const cleanName = tableName.trim();
    if (!cleanName) {
      setTableError('Enter a name for the table.');
      return;
    }
    if (tables.some(table => table.table_name?.trim().toLowerCase() === cleanName.toLowerCase())) {
      setTableError('A table with this name already exists.');
      return;
    }

    const newTable = {
      table_name: cleanName,
      capacity: Math.max(1, Number.parseInt(tableCapacity, 10) || 4),
      restaurant_id: activeRestaurant?.id || 1,
      status: 'available'
    };
    try {
      const response = await posApi.createTable(newTable);
      const savedTable = { ...newTable, ...response.data };
      const savedTables = JSON.parse(localStorage.getItem('pos_tables') || '[]');
      localStorage.setItem('pos_tables', JSON.stringify([...savedTables, savedTable]));
      setTableName('');
      setTableCapacity('4');
      setTableError('');
      await refreshTables();
    } catch (error) {
      if (error.response && error.response.status !== 403) {
        setTableError(error.response.data?.error || 'Could not create the table. Check your table permissions.');
        return;
      }
      const savedTables = JSON.parse(localStorage.getItem('pos_tables') || '[]');
      const localId = -Date.now();
      const localTable = { ...newTable, id: localId, local_only: true };
      localStorage.setItem('pos_tables', JSON.stringify([...savedTables, localTable]));
      setTableName('');
      setTableCapacity('4');
      setTableError(error.response
        ? 'Your account cannot add server tables. This table is saved on this device only.'
        : 'Table saved on this device only. Connect to the server to sync it for other devices.');
      await refreshTables();
    }
  };

  const exportCsv = () => {
    const escapeCsv = value => {
      const text = String(value ?? '');
      const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safeText.replace(/"/g, '""')}"`;
    };
    const rows = [
      ['Item', 'Quantity sold', 'Sales'],
      ...reportSummary.items.map(item => [item.item_name, item.quantity, item.revenue.toFixed(2)])
    ];
    const content = `\uFEFF${rows.map(row => row.map(escapeCsv).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr_sales_${reportStart}_to_${reportEnd}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportPdf = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      window.alert('Allow pop-ups to open the report, then choose Save as PDF in the print dialog.');
      return;
    }
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
    const rows = reportSummary.items.map(item => (
      `<tr><td>${escapeHtml(item.item_name)}</td><td>${item.quantity}</td><td>${item.revenue.toFixed(2)}</td></tr>`
    )).join('');
    printWindow.document.write(`<!doctype html><html><head><title>QR Sales Report</title><style>
      body{font-family:Arial,sans-serif;padding:28px;color:#0f172a}h1{margin-bottom:4px}
      p{color:#475569}table{border-collapse:collapse;width:100%;margin-top:24px}
      th,td{border:1px solid #cbd5e1;padding:10px;text-align:left}th{background:#f1f5f9}
      @page{margin:16mm}
    </style></head><body><h1>${escapeHtml(activeRestaurant?.name || 'Restaurant')} — Sales Report</h1>
      <p>Period: ${escapeHtml(reportStart)} to ${escapeHtml(reportEnd)}</p>
      <p>Paid orders: ${reportSummary.orderCount} · Total sales: ${(activeRestaurant?.currency || '$')}${reportSummary.revenue.toFixed(2)}</p>
      <table><thead><tr><th>Item</th><th>Quantity sold</th><th>Sales</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3">No paid item sales in this period.</td></tr>'}</tbody></table>
      </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleReset = () => {
    if (confirm('This will reset all menu and table data to defaults. Continue?')) {
      localStorage.removeItem('pos_menu_items');
      localStorage.removeItem('pos_categories');
      localStorage.removeItem('pos_tables');
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-sm">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-300">Restaurant tools</p>
          <h1 className="mt-1 text-xl font-extrabold text-white">QR Ordering</h1>
          <p className="mt-1 text-xs text-slate-300">Manage table codes and review item sales.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/order/${tables[0]?.id || 1}`)}
            className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400"
          >
            Open menu preview
          </button>
          <label className="grid gap-1 text-[10px] font-bold text-slate-300">
            Phone-accessible address
            <input
              type="text"
              list="qr-network-addresses"
              value={serverIp}
              onChange={event => {
                const host = event.target.value.trim();
                setServerIp(host);
                localStorage.setItem('qr_server_host', host);
              }}
              placeholder="192.168.0.145 or https://…trycloudflare.com"
              className="w-48 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-white"
            />
            <datalist id="qr-network-addresses">
              {networkAddresses.map(address => <option key={address} value={address} />)}
            </datalist>
            <span className="max-w-56 text-[9px] leading-relaxed text-slate-400">
              {hostChecking
                ? 'Finding an address reachable on this network…'
                : /^https?:\/\//i.test(serverIp.trim())
                  ? 'Works from any network while this computer and tunnel stay online.'
                  : hostError || 'Use a public HTTPS tunnel URL for phones on other networks.'}
            </span>
          </label>
          <button onClick={handleReset} className="rounded-xl border border-rose-400/30 px-3 py-2 text-[10px] font-bold text-rose-200 hover:bg-rose-500/10">
            Reset system data
          </button>
        </div>
      </header>

      <nav className="flex gap-2">
        {[{ id: 'tables', label: 'Tables & QR codes' }, { id: 'reports', label: 'Sales reports' }].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${activeTab === tab.id ? 'bg-emerald-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'tables' ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-base font-extrabold text-slate-900">Add a table manually</h2>
              <p className="mt-1 text-xs text-slate-500">Create a table and generate its guest ordering QR code.</p>
            </div>
            <form onSubmit={addTable} className="flex flex-wrap items-end gap-3">
              <label className="grid flex-1 gap-1.5 text-xs font-bold text-slate-600">
                Table name
                <input
                  value={tableName}
                  onChange={event => setTableName(event.target.value)}
                  placeholder="e.g. Patio 01 or VIP 02"
                  className="min-w-52 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                  maxLength={60}
                />
              </label>
              <label className="grid w-32 gap-1.5 text-xs font-bold text-slate-600">
                Seats
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={tableCapacity}
                  onChange={event => setTableCapacity(event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </label>
              <button type="submit" className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-700">Add table</button>
            </form>
            {tableError && <p className="mt-3 text-xs font-semibold text-amber-700">{tableError}</p>}
          </section>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total tables', value: tables.length },
              { label: 'Available', value: tables.filter(table => table.status !== 'occupied' && Number(table.active_orders) === 0).length },
              { label: 'In use', value: tables.filter(table => table.status === 'occupied' || Number(table.active_orders) > 0).length },
              { label: 'QR access', value: 'Active' }
            ].map(metric => (
              <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold text-slate-500">{metric.label}</p>
                <p className="mt-1 text-xl font-extrabold text-slate-900">{metric.value}</p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Table QR codes</h2>
                <p className="mt-1 text-xs text-slate-500">Select a code to print it or open its guest menu. Print fresh codes after changing the phone-accessible host.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-extrabold text-emerald-700">Guest ordering enabled</span>
            </div>
            {tables.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {tables.map(table => {
                  const isOccupied = table.status === 'occupied' || Number(table.active_orders) > 0;
                  return (
                    <button
                      type="button"
                      key={`${table.id}-${table.table_name}`}
                      onClick={() => generateQR(table)}
                      className="group rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white hover:shadow-md"
                    >
                      <div className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-white p-2">
                        <LocalQrCode value={getGuestUrl(table.id)} label={table.table_name} />
                      </div>
                      <p className="truncate text-sm font-extrabold text-slate-800">{table.table_name}</p>
                      <p className={`mt-1 text-[10px] font-bold ${isOccupied ? 'text-amber-700' : 'text-emerald-700'}`}>{isOccupied ? 'In use' : 'Available'}</p>
                      {table.local_only && <p className="mt-1 text-[9px] font-semibold text-amber-700">This device only</p>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm font-semibold text-slate-500">No tables yet. Add one above to create a QR code.</div>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1.5 text-xs font-bold text-slate-600">
                Report type
                <select value={reportType} onChange={event => setReportType(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                  <option value="daily">Daily sales</option>
                  <option value="custom">Custom date range</option>
                </select>
              </label>
              {reportType === 'daily' ? (
                <label className="grid gap-1.5 text-xs font-bold text-slate-600">
                  Report date
                  <input type="date" value={reportDate} onChange={event => setReportDate(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
                </label>
              ) : (
                <>
                  <label className="grid gap-1.5 text-xs font-bold text-slate-600">
                    Start date
                    <input type="date" value={startDate} max={endDate} onChange={event => setStartDate(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-slate-600">
                    End date
                    <input type="date" value={endDate} min={startDate} onChange={event => setEndDate(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
                  </label>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={exportCsv} disabled={reportLoading || reportStart > reportEnd || !reportSummary.items.length} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50">Download Excel (CSV)</button>
              <button type="button" onClick={exportPdf} disabled={reportLoading || reportStart > reportEnd} className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50">Download PDF</button>
            </div>
          </section>
          {reportStart > reportEnd && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Start date must be on or before end date.</p>}
          {reportLoading && <p className="text-xs font-semibold text-slate-500">Loading system sales data…</p>}
          {reportError && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{reportError}</p>}
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-500">Paid orders</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{reportLoading ? '—' : reportSummary.orderCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-500">Sales total</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-700">{reportLoading ? '—' : `${activeRestaurant?.currency || '$'}${reportSummary.revenue.toFixed(2)}`}</p>
            </div>
          </section>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-extrabold text-slate-900">All items sold</h2>
              <p className="mt-1 text-xs text-slate-500">{reportStart} to {reportEnd} · Items from paid orders</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-3 font-extrabold">Item</th><th className="px-4 py-3 font-extrabold">Quantity sold</th><th className="px-4 py-3 font-extrabold">Sales</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportLoading ? (
                    <tr><td colSpan="3" className="px-4 py-12 text-center text-sm font-medium text-slate-500">Loading item sales…</td></tr>
                  ) : reportSummary.items.map(item => (
                    <tr key={item.item_name}>
                      <td className="px-4 py-3 font-bold text-slate-800">{item.item_name}</td>
                      <td className="px-4 py-3 text-slate-600">{item.quantity}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{activeRestaurant?.currency || '$'}{item.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                  {!reportSummary.items.length && <tr><td colSpan="3" className="px-4 py-12 text-center text-sm font-medium text-slate-500">No paid item sales in this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {selectedTable && (
        <div className="qr-print-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="qr-print-card w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl">
            <div className="mx-auto mb-3 w-48 rounded-2xl border border-slate-200 bg-white p-3">
              <LocalQrCode value={getGuestUrl(selectedTable.id)} label={selectedTable.table_name} />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">{selectedTable.table_name}</h2>
            <p className="mt-1 text-xs text-slate-500">Scan to open the guest menu and place an order.</p>
            <p className="mt-2 break-all rounded-lg bg-slate-50 px-2 py-1.5 font-mono text-[10px] text-slate-600">{getGuestUrl(selectedTable.id)}</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setSelectedTable(null)} className="qr-print-actions flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600">Close</button>
              <button type="button" onClick={() => window.print()} className="qr-print-actions flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white">Print QR</button>
              <button type="button" onClick={() => navigator.clipboard.writeText(getGuestUrl(selectedTable.id))} className="qr-print-actions flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-extrabold text-slate-700">Copy link</button>
              <button type="button" onClick={() => navigate(`/order/${selectedTable.id}`)} className="qr-print-actions flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-extrabold text-white">Open menu</button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .qr-print-overlay, .qr-print-overlay * { visibility: visible !important; }
          .qr-print-overlay { position: absolute !important; inset: 0 !important; display: block !important; padding: 0 !important; background: #fff !important; }
          .qr-print-card { width: 100% !important; max-width: none !important; border: 0 !important; box-shadow: none !important; }
          .qr-print-actions { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function LocalQrCode({ value, label }) {
  const [image, setImage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 360,
      color: { dark: '#0f172a', light: '#ffffff' }
    }).then(dataUrl => {
      if (!cancelled) {
        setImage(dataUrl);
        setError('');
      }
    }).catch(qrError => {
      if (!cancelled) setError(qrError.message || 'QR code could not be generated.');
    });
    return () => { cancelled = true; };
  }, [value]);

  if (error) return <div role="alert" className="flex h-full items-center justify-center p-2 text-center text-xs font-bold text-rose-700">{error}</div>;
  if (!image) return <div className="flex h-full items-center justify-center text-xs font-semibold text-slate-400">Generating QR…</div>;
  return <img src={image} alt={`QR code for ${label}`} className="h-full w-full object-contain" />;
}
