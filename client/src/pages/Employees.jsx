import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Employees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState(() => {
    const saved = localStorage.getItem('pos_employees');
    if (saved) return JSON.parse(saved);
    const initial = [
      { id: 1, empCode: 'EMP001', name: 'Alice Brown', position: 'Manager', phone: '1234567890', email: 'alice@example.com', salary: 5000, commission_rate: 0, joinDate: '2022-01-15', status: 'Active' },
      { id: 2, empCode: 'EMP002', name: 'Bob Wilson', position: 'Waiter', phone: '0987654321', email: 'bob@example.com', salary: 2500, commission_rate: 5, joinDate: '2023-03-20', status: 'Active' },
      { id: 3, empCode: 'EMP003', name: 'Carol Davis', position: 'Chef', phone: '1122334455', email: 'carol@example.com', salary: 4000, commission_rate: 0, joinDate: '2022-06-10', status: 'Active' },
    ];
    localStorage.setItem('pos_employees', JSON.stringify(initial));
    return initial;
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ empCode: '', name: '', position: '', phone: '', email: '', salary: '', commission_rate: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });
  const [period, setPeriod] = useState('all');

  const handlePeriodChange = (p) => {
    setPeriod(p);
    if (p === 'all') return;
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

  // Calculate commissions from orders
  const orders = useMemo(() => JSON.parse(localStorage.getItem('pos_orders') || '[]'), []);
  
  const employeesWithCommission = useMemo(() => {
    const start = new Date(dateRange.start_date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.end_date);
    end.setHours(23, 59, 59, 999);

    return employees.map(emp => {
      const empSales = orders
        .filter(o => {
          if (o.employee_id !== emp.empCode || o.status !== 'Paid') return false;
          if (period === 'all') return true;
          const oDate = new Date(o.date);
          return oDate >= start && oDate <= end;
        })
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);
      
      const commission = (empSales * (emp.commission_rate || 0)) / 100;
      return { ...emp, totalSales: empSales, totalCommission: commission };
    });
  }, [employees, orders, dateRange, period]);

  const saveToLocal = (data) => {
    setEmployees(data);
    localStorage.setItem('pos_employees', JSON.stringify(data));
  };

  const handleAddEmployee = (e) => {
    e.preventDefault();
    if (editingId) {
      const updated = employees.map(emp => 
        emp.id === editingId ? { ...emp, ...formData } : emp
      );
      saveToLocal(updated);
      setEditingId(null);
    } else {
      const lastId = employees.length > 0 ? Math.max(...employees.map(e => e.id)) : 0;
      const nextId = lastId + 1;
      const empCode = `EMP${nextId.toString().padStart(3, '0')}`;
      
      const newEmployee = {
        id: nextId,
        ...formData,
        empCode: formData.empCode || empCode,
        salary: parseFloat(formData.salary) || 0,
        commission_rate: parseFloat(formData.commission_rate) || 0,
        joinDate: new Date().toISOString().split('T')[0],
        status: 'Active'
      };
      saveToLocal([...employees, newEmployee]);
    }
    setFormData({ empCode: '', name: '', position: '', phone: '', email: '', salary: '', commission_rate: 0 });
    setShowForm(false);
  };

  const handleEdit = (emp) => {
    setFormData(emp);
    setEditingId(emp.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this employee?')) {
      const filtered = employees.filter(e => e.id !== id);
      saveToLocal(filtered);
    }
  };

  const exportToExcel = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "EMP ID,Name,Position,Base Salary,Comm %,Total Sales,Earned Commission,Join Date\n";
    
    employeesWithCommission.forEach(emp => {
      csvContent += `${emp.empCode},${emp.name},${emp.position},${emp.salary},${emp.commission_rate}%,${emp.totalSales.toFixed(2)},${emp.totalCommission.toFixed(2)},${emp.joinDate}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fileName = `employees_payroll_${period}_${dateRange.start_date}${period === 'custom' ? '_to_' + dateRange.end_date : ''}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '', 'width=800,height=600');
    const content = `
      <html>
        <head>
          <title>Employee Payroll Report</title>
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
            <h1>Employee & Commission Report</h1>
            <p>Period: ${period === 'all' ? 'All Time' : `${dateRange.start_date} to ${dateRange.end_date}`}</p>
            <p>Generated on: ${new Date().toLocaleString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Position</th>
                <th>Base Salary</th>
                <th>Comm %</th>
                <th>Total Sales</th>
                <th>Commission</th>
                <th>Total Payable</th>
              </tr>
            </thead>
            <tbody>
              ${employeesWithCommission.map(emp => `
                <tr>
                  <td>${emp.empCode}</td>
                  <td>${emp.name}</td>
                  <td>${emp.position}</td>
                  <td>$${emp.salary.toFixed(2)}</td>
                  <td>${emp.commission_rate}%</td>
                  <td>$${emp.totalSales.toFixed(2)}</td>
                  <td>$${emp.totalCommission.toFixed(2)}</td>
                  <td>$${(emp.salary + emp.totalCommission).toFixed(2)}</td>
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

  const filteredEmployees = employeesWithCommission.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.empCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Employee Management</h1>
        <div className="flex gap-3">
          <button onClick={exportToExcel} className="btn bg-green-600 text-white">Excel</button>
          <button onClick={exportToPDF} className="btn bg-red-600 text-white">PDF</button>
          <button 
            onClick={() => {
              setEditingId(null);
              setFormData({ empCode: '', name: '', position: '', phone: '', email: '', salary: '', commission_rate: 0 });
              setShowForm(!showForm);
            }} 
            className="btn btn-primary"
          >
            {showForm ? 'Cancel' : '+ Add Employee'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search Employees</label>
          <input 
            type="text" 
            placeholder="Name or Employee ID..." 
            className="input w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quick Period</label>
          <select 
            value={period} 
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="input"
          >
            <option value="all">All Time</option>
            <option value="custom">Custom Range</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
          </select>
        </div>
        {period !== 'all' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input
                type="date"
                value={dateRange.start_date}
                onChange={(e) => {
                  setDateRange({ ...dateRange, start_date: e.target.value });
                  setPeriod('custom');
                }}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                type="date"
                value={dateRange.end_date}
                onChange={(e) => {
                  setDateRange({ ...dateRange, end_date: e.target.value });
                  setPeriod('custom');
                }}
                className="input"
              />
            </div>
          </>
        )}
      </div>

      {showForm && (
        <div className="card max-w-2xl animate-in fade-in slide-in-from-top-4">
          <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit' : 'Add'} Employee</h2>
          <form onSubmit={handleAddEmployee} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID (Optional)</label>
                <input
                  type="text"
                  placeholder="Auto-generated if empty"
                  value={formData.empCode}
                  onChange={(e) => setFormData({ ...formData, empCode: e.target.value })}
                  className="input"
                />
              </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <select
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select Position</option>
                  <option value="Manager">Manager</option>
                  <option value="Waiter">Waiter</option>
                  <option value="Chef">Chef</option>
                  <option value="Cashier">Cashier</option>
                  <option value="Kitchen Staff">Kitchen Staff</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Salary</label>
                <input
                  type="number"
                  value={formData.salary}
                  onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commission Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.commission_rate}
                  onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                  className="input"
                  placeholder="e.g. 5 for 5%"
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
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-full text-lg">
              {editingId ? 'Update Employee' : 'Register Employee'}
            </button>
          </form>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr className="bg-gray-50">
              <th>ID</th>
              <th>Employee Name</th>
              <th>Position</th>
              <th className="text-right">Base Salary</th>
              <th className="text-center">Comm %</th>
              <th className="text-right text-blue-600">Total Sales</th>
              <th className="text-right text-green-600">Commission</th>
              <th className="text-right">Total Payable</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp) => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="font-bold text-gray-600">{emp.empCode}</td>
                <td>
                  <div className="font-bold text-gray-800">{emp.name}</div>
                  <div className="text-xs text-gray-500">{emp.email}</div>
                </td>
                <td><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold uppercase">{emp.position}</span></td>
                <td className="text-right font-medium">${emp.salary.toFixed(2)}</td>
                <td className="text-center">{emp.commission_rate}%</td>
                <td className="text-right font-medium text-blue-600">${emp.totalSales.toFixed(2)}</td>
                <td className="text-right font-bold text-green-600">${emp.totalCommission.toFixed(2)}</td>
                <td className="text-right font-extrabold text-lg text-gray-900">${(emp.salary + emp.totalCommission).toFixed(2)}</td>
                <td className="text-right space-x-3">
                  <button onClick={() => handleEdit(emp)} className="text-primary-600 hover:text-primary-800 font-bold">Edit</button>
                  <button onClick={() => handleDelete(emp.id)} className="text-red-600 hover:text-red-800 font-bold">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
