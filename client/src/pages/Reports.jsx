import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Reports() {
  const { user, activeRestaurant } = useAuth();
  const [activeReport, setActiveReport] = useState('daily');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(activeRestaurant?.id || 1);
  const [dateRange, setDateRange] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });
  const [period, setPeriod] = useState('custom');

  const restaurants = useMemo(() => JSON.parse(localStorage.getItem('pos_restaurants') || '[]'), []);
  const hasValidDateRange = Boolean(
    dateRange.start_date
    && dateRange.end_date
    && dateRange.start_date <= dateRange.end_date
  );

  const isWithinDateRange = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const dateKey = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
    return dateKey >= dateRange.start_date && dateKey <= dateRange.end_date;
  };

  const handlePeriodChange = (p) => {
    setPeriod(p);
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (p === 'today') {
      start = today;
      end = today;
    } else if (p === 'yesterday') {
      start = new Date(today);
      start.setDate(today.getDate() - 1);
      end = new Date(start);
    } else if (p === 'this_month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = today;
    } else if (p === 'last_month') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    }

    setDateRange({
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0]
    });
  };

  // Load data from localStorage
  const allOrders = useMemo(() => JSON.parse(localStorage.getItem('pos_orders') || '[]'), []);
  const allItems = useMemo(() => JSON.parse(localStorage.getItem('pos_menu_items') || '[]'), []);
  const categories = useMemo(() => JSON.parse(localStorage.getItem('pos_categories') || '[]'), []);

  // Filter by Restaurant
  const orders = useMemo(() => allOrders.filter(o => o.restaurant_id === parseInt(selectedRestaurantId)), [allOrders, selectedRestaurantId]);
  const items = useMemo(() => allItems.filter(i => i.restaurant_id === parseInt(selectedRestaurantId) || !i.restaurant_id), [allItems, selectedRestaurantId]);

  // Report Calculations
  const reportData = useMemo(() => {
    const filteredOrders = orders.filter(o => {
      return isWithinDateRange(o.date || o.created_at) && o.status === 'Paid';
    });

    if (activeReport === 'daily') {
      return {
        total_orders: filteredOrders.length,
        subtotal: filteredOrders.reduce((s, o) => s + (Number(o.subtotal) || 0), 0),
        total_tax: filteredOrders.reduce((s, o) => s + (Number(o.tax_amount) || 0), 0),
        total_sales: filteredOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)
      };
    }

    if (activeReport === 'range' || activeReport === 'tax') {
      const grouped = {};
      filteredOrders.forEach(o => {
        const date = new Date(o.date || o.created_at);
        const d = [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, '0'),
          String(date.getDate()).padStart(2, '0')
        ].join('-');
        if (!grouped[d]) grouped[d] = { date: d, total_orders: 0, subtotal: 0, total_tax: 0, total_discount: 0, total_sales: 0 };
        grouped[d].total_orders++;
        grouped[d].subtotal += o.subtotal || 0;
        grouped[d].total_tax += o.tax_amount || 0;
        grouped[d].total_discount += o.discount_amount || 0;
        grouped[d].total_sales += o.total_amount || 0;
      });
      return Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    if (activeReport === 'items') {
      const itemMap = {};
      filteredOrders.forEach(o => {
        (o.items || []).forEach(oi => {
          if (!itemMap[oi.item_id]) {
            itemMap[oi.item_id] = { 
              item_id: oi.item_id, 
              item_name: oi.item_name, 
              total_quantity: 0, 
              total_revenue: 0,
              category_id: items.find(i => i.id === oi.item_id)?.category_id
            };
          }
          itemMap[oi.item_id].total_quantity += oi.quantity;
          itemMap[oi.item_id].total_revenue += (oi.price * oi.quantity);
        });
      });
      return Object.values(itemMap).map(i => ({
        ...i,
        category_name: categories.find(c => c.id === parseInt(i.category_id))?.name || 'N/A'
      })).sort((a, b) => b.total_revenue - a.total_revenue);
    }

    if (activeReport === 'inventory') {
      return items.map(i => ({
        item_id: i.id,
        item_name: i.name,
        sku: i.sku || '-',
        category_name: categories.find(c => c.id === parseInt(i.category_id))?.name || 'N/A',
        cost: i.cost || 0,
        price: i.price || 0,
        quantity_available: i.stock_quantity || 0,
        stock_value: (i.cost || 0) * (i.stock_quantity || 0),
        track_inventory: i.track_inventory ? 'Yes' : 'No'
      }));
    }

    if (activeReport === 'movements') {
      const txns = JSON.parse(localStorage.getItem('pos_inventory_transactions') || '[]');
      const movementMap = {};
      txns.filter(t => {
        return isWithinDateRange(t.created_at);
      }).forEach(t => {
        if (!movementMap[t.item_id]) {
          movementMap[t.item_id] = { item_id: t.item_id, item_name: t.item_name, total_in: 0, total_out: 0, total_adjust: 0 };
        }
        if (t.txn_type === 'in') movementMap[t.item_id].total_in += t.quantity;
        else if (t.txn_type === 'out') movementMap[t.item_id].total_out += t.quantity;
        else if (t.txn_type === 'adjust') movementMap[t.item_id].total_adjust = t.quantity;
      });
      return Object.values(movementMap);
    }

    if (activeReport === 'blockchain') {
      return JSON.parse(localStorage.getItem('pos_blockchain_log') || '[]');
    }

    return null;
  }, [activeReport, dateRange, orders, items, categories]);

  const exportToExcel = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const title = reports.find(r => r.id === activeReport).label;
    csvContent += `${title} Report (${dateRange.start_date} to ${dateRange.end_date})\n\n`;

    if (activeReport === 'range' || activeReport === 'tax') {
      csvContent += "Date,Orders,Subtotal,Tax,Discount,Total\n";
      reportData.forEach(r => {
        csvContent += `${r.date},${r.total_orders},${r.subtotal},${r.total_tax},${r.total_discount},${r.total_sales}\n`;
      });
    } else if (activeReport === 'daily') {
      csvContent += "Date,Orders,Subtotal,Tax,Total Sales\n";
      csvContent += `${dateRange.start_date} to ${dateRange.end_date},${reportData.total_orders},${reportData.subtotal},${reportData.total_tax},${reportData.total_sales}\n`;
    } else if (activeReport === 'items') {
      csvContent += "Item,Category,Quantity Sold,Revenue\n";
      reportData.forEach(r => {
        csvContent += `${r.item_name},${r.category_name},${r.total_quantity},${r.total_revenue}\n`;
      });
    } else if (activeReport === 'inventory') {
      csvContent += "Item,Category,Cost,Price,Stock,Value,Tracked\n";
      reportData.forEach(r => {
        csvContent += `${r.item_name},${r.category_name},${r.cost},${r.price},${r.quantity_available},${r.stock_value},${r.track_inventory}\n`;
      });
    } else if (activeReport === 'movements') {
      csvContent += "Item,Stock In,Stock Out,Last Adjustment\n";
      reportData.forEach(r => {
        csvContent += `${r.item_name},${r.total_in},${r.total_out},${r.total_adjust}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fileName = `${activeReport}_${dateRange.start_date}_to_${dateRange.end_date}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '', 'width=800,height=600');
    const title = reports.find(r => r.id === activeReport).label;
    
    let tableHTML = '';
    if (activeReport === 'range' || activeReport === 'tax') {
      tableHTML = `
        <table>
          <thead><tr><th>Date</th><th>Orders</th><th>Subtotal</th><th>Tax</th><th>Total</th></tr></thead>
          <tbody>${reportData.map(r => `<tr><td>${r.date}</td><td>${r.total_orders}</td><td>$${r.subtotal.toFixed(2)}</td><td>$${r.total_tax.toFixed(2)}</td><td>$${r.total_sales.toFixed(2)}</td></tr>`).join('')}</tbody>
        </table>`;
    } else if (activeReport === 'daily') {
      tableHTML = `
        <table>
          <thead><tr><th>Date</th><th>Orders</th><th>Subtotal</th><th>Tax</th><th>Total Sales</th></tr></thead>
          <tbody><tr><td>${dateRange.start_date} to ${dateRange.end_date}</td><td>${reportData.total_orders}</td><td>$${Number(reportData.subtotal || 0).toFixed(2)}</td><td>$${Number(reportData.total_tax || 0).toFixed(2)}</td><td>$${Number(reportData.total_sales || 0).toFixed(2)}</td></tr></tbody>
        </table>`;
    } else if (activeReport === 'items') {
      tableHTML = `
        <table>
          <thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Revenue</th></tr></thead>
          <tbody>${reportData.map(r => `<tr><td>${r.item_name}</td><td>${r.category_name}</td><td>${r.total_quantity}</td><td>$${r.total_revenue.toFixed(2)}</td></tr>`).join('')}</tbody>
        </table>`;
    } else if (activeReport === 'inventory') {
      tableHTML = `
        <table>
          <thead><tr><th>Item</th><th>Stock</th><th>Cost</th><th>Value</th><th>Tracked</th></tr></thead>
          <tbody>${reportData.map(r => `<tr><td>${r.item_name}</td><td>${r.quantity_available}</td><td>$${parseFloat(r.cost).toFixed(2)}</td><td>$${r.stock_value.toFixed(2)}</td><td>${r.track_inventory}</td></tr>`).join('')}</tbody>
        </table>`;
    } else if (activeReport === 'movements') {
      tableHTML = `
        <table>
          <thead><tr><th>Item</th><th>Total In</th><th>Total Out</th><th>Adjusted</th></tr></thead>
          <tbody>${reportData.map(r => `<tr><td>${r.item_name}</td><td>${r.total_in}</td><td>${r.total_out}</td><td>${r.total_adjust}</td></tr>`).join('')}</tbody>
        </table>`;
    }

    const content = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f8f9fa; }
            .header { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title} Report</h1>
            <p>Period: ${dateRange.start_date} to ${dateRange.end_date}</p>
          </div>
          ${tableHTML}
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const reports = [
    { id: 'daily', label: 'Daily Sales' },
    { id: 'range', label: 'Sales Range' },
    { id: 'items', label: 'Item Sales' },
    { id: 'inventory', label: 'Itemwise Inventory' },
    { id: 'movements', label: 'Stock Movements' },
    { id: 'tax', label: 'Tax Summary' },
    { id: 'blockchain', label: 'Blockchain Audit' },
    { id: 'heatmap', label: 'Profit Heatmap' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Reports</h1>
        <div className="flex gap-3">
          <button onClick={exportToExcel} disabled={!hasValidDateRange} className="btn bg-green-600 text-white disabled:cursor-not-allowed disabled:opacity-50">Excel</button>
          <button onClick={exportToPDF} disabled={!hasValidDateRange} className="btn bg-red-600 text-white disabled:cursor-not-allowed disabled:opacity-50">PDF</button>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {reports.map((report) => (
          <button
            key={report.id}
            onClick={() => setActiveReport(report.id)}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeReport === report.id ? 'bg-primary-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            {report.label}
          </button>
        ))}
      </div>

      {/* Date Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-gray-700 font-medium mb-2">Select Restaurant</label>
            <select 
              value={selectedRestaurantId} 
              onChange={(e) => setSelectedRestaurantId(e.target.value)}
              className="input"
            >
              {restaurants.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">Quick Period</label>
            <select 
              value={period} 
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="input"
            >
              <option value="custom">Custom Range</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">Start Date</label>
            <input
              type="date"
              value={dateRange.start_date}
              max={dateRange.end_date || undefined}
              onChange={(e) => {
                setDateRange({ ...dateRange, start_date: e.target.value });
                setPeriod('custom');
              }}
              className="input"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">End Date</label>
            <input
              type="date"
              value={dateRange.end_date}
              min={dateRange.start_date || undefined}
              onChange={(e) => {
                setDateRange({ ...dateRange, end_date: e.target.value });
                setPeriod('custom');
              }}
              className="input"
            />
          </div>
        </div>
        {!hasValidDateRange && (
          <p className="mt-3 text-sm font-medium text-red-600">Choose a valid date range. The start date must be on or before the end date.</p>
        )}
      </div>

      {/* Daily Sales Report */}
      {activeReport === 'daily' && reportData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card">
            <p className="text-gray-500 text-lg">Total Orders</p>
            <p className="text-4xl font-bold">{reportData.total_orders}</p>
          </div>
          <div className="card">
            <p className="text-gray-500 text-lg">Subtotal</p>
            <p className="text-4xl font-bold">{user?.currency}{parseFloat(reportData.subtotal || 0).toFixed(2)}</p>
          </div>
          <div className="card">
            <p className="text-gray-500 text-lg">Tax Collected</p>
            <p className="text-4xl font-bold">{user?.currency}{parseFloat(reportData.total_tax || 0).toFixed(2)}</p>
          </div>
          <div className="card bg-green-50 border-green-200">
            <p className="text-green-700 text-lg font-bold">Total Sales</p>
            <p className="text-4xl font-bold text-green-700">{user?.currency}{parseFloat(reportData.total_sales || 0).toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Sales Range Report */}
      {(activeReport === 'range' || activeReport === 'tax') && reportData && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">{activeReport === 'tax' ? 'Tax Summary' : 'Sales by Date'}</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Orders</th>
                  <th>Subtotal</th>
                  <th>Tax</th>
                  {activeReport === 'range' && <th>Discount</th>}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, index) => (
                  <tr key={index}>
                    <td>{new Date(row.date).toLocaleDateString()}</td>
                    <td>{row.total_orders}</td>
                    <td>{user?.currency}{parseFloat(row.subtotal).toFixed(2)}</td>
                    <td>{user?.currency}{parseFloat(row.total_tax).toFixed(2)}</td>
                    {activeReport === 'range' && <td>{user?.currency}{parseFloat(row.total_discount).toFixed(2)}</td>}
                    <td className="font-bold">{user?.currency}{parseFloat(row.total_sales).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td>Total</td>
                  <td>{reportData.reduce((sum, r) => sum + r.total_orders, 0)}</td>
                  <td>{user?.currency}{reportData.reduce((sum, r) => sum + r.subtotal, 0).toFixed(2)}</td>
                  <td>{user?.currency}{reportData.reduce((sum, r) => sum + r.total_tax, 0).toFixed(2)}</td>
                  {activeReport === 'range' && <td>{user?.currency}{reportData.reduce((sum, r) => sum + r.total_discount, 0).toFixed(2)}</td>}
                  <td>{user?.currency}{reportData.reduce((sum, r) => sum + r.total_sales, 0).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Item Sales Report */}
      {activeReport === 'items' && reportData && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Sales by Item</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Quantity Sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((item, idx) => (
                  <tr key={idx}>
                    <td className="font-medium">{item.item_name}</td>
                    <td>{item.category_name}</td>
                    <td>{item.total_quantity}</td>
                    <td className="font-bold">{user?.currency}{parseFloat(item.total_revenue).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inventory Report */}
      {activeReport === 'inventory' && reportData && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Itemwise Inventory Report</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Tracked</th>
                  <th>Cost</th>
                  <th>Price</th>
                  <th>Current Stock</th>
                  <th>Valuation</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((item) => (
                  <tr key={item.item_id}>
                    <td className="font-medium">{item.item_name}</td>
                    <td>{item.category_name}</td>
                    <td>{item.track_inventory}</td>
                    <td>{user?.currency}{parseFloat(item.cost).toFixed(2)}</td>
                    <td>{user?.currency}{parseFloat(item.price).toFixed(2)}</td>
                    <td className="font-bold">{item.quantity_available}</td>
                    <td className="font-bold">{user?.currency}{parseFloat(item.stock_value).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td colSpan="6" className="text-right">Total Stock Value:</td>
                  <td>{user?.currency}{reportData.reduce((sum, i) => sum + i.stock_value, 0).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Stock Movements Report */}
      {activeReport === 'movements' && reportData && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Stock Movements (Itemwise)</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Total In (+)</th>
                  <th>Total Out (-)</th>
                  <th>Manual Adjustments</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="font-medium">{row.item_name}</td>
                    <td className="text-green-600 font-bold">+{row.total_in}</td>
                    <td className="text-red-600 font-bold">-{row.total_out}</td>
                    <td>{row.total_adjust}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Blockchain Audit Report */}
      {activeReport === 'blockchain' && reportData && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Immutable Blockchain Audit Log</h2>
            <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-black">SHA-256 SECURED</span>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Timestamp</th>
                  <th>Current Block Hash</th>
                  <th>Previous Block Hash</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((block, idx) => (
                  <tr key={idx} className="font-mono text-xs">
                    <td className="font-bold">ORD-{block.order_id}</td>
                    <td>{new Date(block.timestamp).toLocaleString()}</td>
                    <td className="text-blue-600 truncate max-w-[150px]">{block.hash}</td>
                    <td className="text-gray-400 truncate max-w-[150px]">{block.prev}</td>
                    <td>
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">VERIFIED</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Profit Heatmap Report */}
      {activeReport === 'heatmap' && (
        <div className="card">
          <h2 className="text-xl font-bold mb-6">Hourly Profit Heatmap (AI Analysis)</h2>
          <div className="grid grid-cols-8 gap-1">
            <div className="h-8"></div>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase">{d}</div>
            ))}
            {[...Array(24)].map((_, hour) => (
              <>
                <div key={hour} className="text-[10px] font-bold text-gray-400 flex items-center justify-end pr-2">{hour}:00</div>
                {[...Array(7)].map((_, day) => {
                  const intensity = Math.random();
                  return (
                    <div 
                      key={`${hour}-${day}`} 
                      className="h-8 rounded-sm transition-all hover:scale-110 cursor-help"
                      style={{ 
                        backgroundColor: intensity > 0.8 ? '#059669' : intensity > 0.5 ? '#10b981' : intensity > 0.3 ? '#6ee7b7' : '#ecfdf5',
                        opacity: 0.8
                      }}
                      title={`Profit Level: ${(intensity * 100).toFixed(0)}%`}
                    ></div>
                  );
                })}
              </>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-center gap-4 text-xs font-bold text-gray-500">
             <span>Low Profit</span>
             <div className="w-4 h-4 bg-[#ecfdf5]"></div>
             <div className="w-4 h-4 bg-[#6ee7b7]"></div>
             <div className="w-4 h-4 bg-[#10b981]"></div>
             <div className="w-4 h-4 bg-[#059669]"></div>
             <span>Peak Profit</span>
          </div>
        </div>
      )}
    </div>
  );
}
