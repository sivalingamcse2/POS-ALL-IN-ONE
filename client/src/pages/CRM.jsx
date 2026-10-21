import { useState } from 'react';

const toDateKey = (value) => {
  if (!value || value === 'Never') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

export default function CRM() {
  const [customers, setCustomers] = useState(() => {
    const saved = localStorage.getItem('pos_customers');
    const customerList = saved ? JSON.parse(saved) : [
      { id: 1, name: 'John Doe', phone: '1234567890', email: 'john@example.com', visits: 12, totalSpent: 450.50, loyaltyPoints: 450, lastVisit: '2024-01-20' },
      { id: 2, name: 'Jane Smith', phone: '0987654321', email: 'jane@example.com', visits: 8, totalSpent: 320.00, loyaltyPoints: 320, lastVisit: '2024-01-18' },
      { id: 3, name: 'Mike Johnson', phone: '1122334455', email: 'mike@example.com', visits: 15, totalSpent: 680.75, loyaltyPoints: 680, lastVisit: '2024-01-22' },
    ];
    return customerList.map((customer) => ({
      ...customer,
      visits: Number(customer.visits || 0),
      totalSpent: Number(customer.totalSpent || 0),
      loyaltyPoints: Number(customer.loyaltyPoints ?? customer.points ?? 0),
      lastVisit: customer.lastVisit || 'Never',
      tier: customer.tier || 'Standard',
    }));
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start_date: '', end_date: '' });
  const hasValidDateRange = Boolean(
    dateRange.start_date
    && dateRange.end_date
    && dateRange.start_date <= dateRange.end_date
  );

  const saveToLocal = (data) => {
    setCustomers(data);
    localStorage.setItem('pos_customers', JSON.stringify(data));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
      const updated = customers.map(c => 
        c.id === editingId ? { ...c, ...formData } : c
      );
      saveToLocal(updated);
      setEditingId(null);
    } else {
      const newCustomer = {
        id: Date.now(),
        ...formData,
        visits: 0,
        totalSpent: 0,
        loyaltyPoints: 0,
        lastVisit: 'Never'
      };
      saveToLocal([...customers, newCustomer]);
    }
    setFormData({ name: '', phone: '', email: '' });
    setShowForm(false);
  };

  const handleEdit = (customer) => {
    setFormData({ name: customer.name, phone: customer.phone, email: customer.email });
    setEditingId(customer.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this customer?')) {
      const filtered = customers.filter(c => c.id !== id);
      saveToLocal(filtered);
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase())
      || customer.phone.includes(searchTerm);
    const lastVisit = toDateKey(customer.lastVisit);
    const matchesDate = (!dateRange.start_date && !dateRange.end_date)
      || Boolean(lastVisit)
        && (!dateRange.start_date || lastVisit >= dateRange.start_date)
        && (!dateRange.end_date || lastVisit <= dateRange.end_date);
    return matchesSearch && matchesDate;
  });

  const exportToCsv = () => {
    const rows = [
      ['Customer', 'Phone', 'Email', 'Visits', 'Loyalty Points', 'Total Spent', 'Last Visit', 'Tier'],
      ...filteredCustomers.map((customer) => [
        customer.name,
        customer.phone,
        customer.email,
        customer.visits,
        customer.loyaltyPoints,
        Number(customer.totalSpent || 0).toFixed(2),
        customer.lastVisit,
        customer.tier,
      ]),
    ];
    const csvContent = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }));
    link.download = `crm_customers_${dateRange.start_date}_to_${dateRange.end_date}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  };

  const exportToPdf = () => {
    const printWindow = window.open('', '', 'width=900,height=700');
    if (!printWindow) {
      window.alert('Allow pop-ups to open the customer report for printing or PDF saving.');
      return;
    }
    const rows = filteredCustomers.map((customer) => `
      <tr>
        <td>${escapeHtml(customer.name)}</td>
        <td>${escapeHtml(customer.phone)}</td>
        <td>${escapeHtml(customer.email)}</td>
        <td>${customer.visits}</td>
        <td>${customer.loyaltyPoints}</td>
        <td>$${Number(customer.totalSpent || 0).toFixed(2)}</td>
        <td>${escapeHtml(customer.lastVisit)}</td>
        <td>${escapeHtml(customer.tier)}</td>
      </tr>`).join('');
    printWindow.document.write(`
      <!doctype html>
      <html><head><title>CRM Customer Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; }
          h1 { margin-bottom: 4px; }
          p { color: #475569; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          th { background: #f1f5f9; }
        </style>
      </head><body>
        <h1>CRM Customer Report</h1>
        <p>Last visit period: ${escapeHtml(dateRange.start_date)} to ${escapeHtml(dateRange.end_date)}</p>
        <table><thead><tr><th>Customer</th><th>Phone</th><th>Email</th><th>Visits</th><th>Points</th><th>Total Spent</th><th>Last Visit</th><th>Tier</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="8">No customers found for this date range.</td></tr>'}</tbody></table>
      </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black text-gray-800 tracking-tighter">SIVARA <span className="text-indigo-600">CRM & LOYALTY</span></h1>
        <div className="flex gap-3">
           <button onClick={exportToCsv} disabled={!hasValidDateRange} className="btn bg-green-600 text-white disabled:cursor-not-allowed disabled:opacity-50">Excel</button>
           <button onClick={exportToPdf} disabled={!hasValidDateRange} className="btn bg-red-600 text-white disabled:cursor-not-allowed disabled:opacity-50">PDF</button>
           <button 
             onClick={() => alert("SIVARA AI BOT:\n\nAnalyzing customer behavior...\nFound 12 guests who haven't visited in 30 days.\nSending personalized 15% discount coupons via WhatsApp...")}
             className="btn bg-indigo-600 text-white text-xs px-4 flex items-center gap-2 animate-pulse"
           >
             <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" /></svg>
             AI Marketing Bot
           </button>
           <button 
             onClick={() => {
               setEditingId(null);
               setFormData({ name: '', phone: '', email: '' });
               setShowForm(!showForm);
             }} 
             className="btn btn-primary text-xs px-6"
           >
             {showForm ? 'Cancel' : '+ New Customer'}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="card bg-gradient-to-br from-blue-500 to-blue-700 text-white border-none shadow-blue-200 shadow-xl p-6">
            <p className="text-xs uppercase font-black opacity-80 mb-1">Top Spender (AI)</p>
            <h3 className="text-2xl font-black">{customers.sort((a,b) => b.totalSpent - a.totalSpent)[0]?.name || 'N/A'}</h3>
            <p className="text-sm mt-4 font-bold bg-white/20 inline-block px-3 py-1 rounded-full">Total: ${Number(customers.sort((a,b) => b.totalSpent - a.totalSpent)[0]?.totalSpent || 0).toFixed(2)}</p>
         </div>
         <div className="card bg-gradient-to-br from-purple-500 to-purple-700 text-white border-none shadow-purple-200 shadow-xl p-6">
            <p className="text-xs uppercase font-black opacity-80 mb-1">Most Loyal (AI)</p>
            <h3 className="text-2xl font-black">{customers.sort((a,b) => b.visits - a.visits)[0]?.name || 'N/A'}</h3>
            <p className="text-sm mt-4 font-bold bg-white/20 inline-block px-3 py-1 rounded-full">{customers.sort((a,b) => b.visits - a.visits)[0]?.visits || '0'} Total Visits</p>
         </div>
         <div className="card bg-gradient-to-br from-orange-500 to-orange-700 text-white border-none shadow-orange-200 shadow-xl p-6">
            <p className="text-xs uppercase font-black opacity-80 mb-1">Churn Risk (AI)</p>
            <h3 className="text-2xl font-black">0 Customers</h3>
            <p className="text-sm mt-4 font-bold bg-white/20 inline-block px-3 py-1 rounded-full italic text-xs">AI predicts high retention this month</p>
         </div>
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-2 block font-medium text-gray-700">Start Date (Last Visit)</label>
            <input
              type="date"
              value={dateRange.start_date}
              max={dateRange.end_date || undefined}
              onChange={(event) => setDateRange({ ...dateRange, start_date: event.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="mb-2 block font-medium text-gray-700">End Date (Last Visit)</label>
            <input
              type="date"
              value={dateRange.end_date}
              min={dateRange.start_date || undefined}
              onChange={(event) => setDateRange({ ...dateRange, end_date: event.target.value })}
              className="input"
            />
          </div>
          <div className="flex-1">
            <label className="mb-2 block font-medium text-gray-700">Search Customers</label>
        <input 
          type="text" 
          placeholder="Search by name or phone..." 
          className="input w-full max-w-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
          </div>
        </div>
        {(dateRange.start_date || dateRange.end_date) && !hasValidDateRange && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-600">Enter both dates and make sure the start date is on or before the end date to download a report.</p>
        )}
      </div>

      {showForm && (
        <div className="card max-w-xl p-6">
          <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit' : 'Add'} Customer</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input"
              />
            </div>
            <button type="submit" className="btn btn-primary w-full text-lg">
              {editingId ? 'Update Customer' : 'Register Customer'}
            </button>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4 text-center">Visits</th>
                <th className="px-6 py-4 text-center">Loyalty Points</th>
                <th className="px-6 py-4 text-right">Total Spent</th>
                <th className="px-6 py-4">Last Visit</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-800">{customer.name}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">VIP TIER: {customer.tier}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-600">{customer.phone || 'No phone'}</div>
                    <div className="text-xs text-blue-500">{customer.email}</div>
                  </td>
                  <td className="px-6 py-4 text-center text-lg font-black text-gray-700">{customer.visits}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-black border border-yellow-200">
                      {customer.loyaltyPoints} PTS
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-emerald-600">${Number(customer.totalSpent || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-xs text-gray-500 font-bold uppercase">{customer.lastVisit}</td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button onClick={() => handleEdit(customer)} className="text-blue-600 font-black text-xs uppercase hover:underline">Edit</button>
                    <button onClick={() => handleDelete(customer.id)} className="text-red-600 font-black text-xs uppercase hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
