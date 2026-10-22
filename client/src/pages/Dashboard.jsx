import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import storageEngine from '../services/storageEngine';
import { useAuth } from '../context/AuthContext';

const EXPENSES_KEY = 'pos_expenses';
const MONEY_OUTFLOWS = ['Supplies', 'Rent', 'Utilities', 'Payroll', 'Maintenance', 'Other'];

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readCollection(key) {
  const value = JSON.parse(localStorage.getItem(key) || '[]');
  return Array.isArray(value) ? value : [];
}

function Icon({ path, className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d={path} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MetricCard({ label, value, detail, icon, tone, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon path={icon} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
        <span className="mt-1 block truncate text-xl font-extrabold text-slate-900">{value}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{detail}</span>
      </span>
    </button>
  );
}

function PanelHeading({ eyebrow, title, action, onAction }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</p>
        <h2 className="mt-1 text-base font-extrabold text-slate-900">{title}</h2>
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded-lg px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50"
        >
          {action}
        </button>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { activeRestaurant, user } = useAuth();
  const [items, setItems] = useState(() => storageEngine.getItems());
  const [orders, setOrders] = useState(() => storageEngine.getOrders());
  const [employees, setEmployees] = useState(() => readCollection('pos_hrms_employees'));
  const [attendance, setAttendance] = useState(() => readCollection('pos_attendance'));
  const [leaves, setLeaves] = useState(() => readCollection('pos_leaves'));
  const [expenses, setExpenses] = useState(() => readCollection(EXPENSES_KEY));
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    category: 'Supplies',
    amount: '',
    date: localDateKey(),
  });

  const refreshData = useCallback(() => {
    setItems(storageEngine.getItems());
    setOrders(storageEngine.getOrders());
    setEmployees(readCollection('pos_hrms_employees'));
    setAttendance(readCollection('pos_attendance'));
    setLeaves(readCollection('pos_leaves'));
    setExpenses(readCollection(EXPENSES_KEY));
  }, []);

  useEffect(() => {
    const unsubscribe = storageEngine.subscribe((event) => {
      if (event === 'items_updated' || event === 'order_created') refreshData();
    });
    const handleStorage = (event) => {
      if (!event.key || [
        'pos_menu_items',
        'pos_orders',
        'pos_hrms_employees',
        'pos_attendance',
        'pos_leaves',
        EXPENSES_KEY,
      ].includes(event.key)) refreshData();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
    };
  }, [refreshData]);

  const todayKey = localDateKey();
  const monthPrefix = todayKey.slice(0, 7);
  const validSales = useMemo(() => orders.filter((order) => (
    ['paid', 'completed'].includes(String(order.status || '').toLowerCase())
    && (!order.restaurant_id || !activeRestaurant?.id || Number(order.restaurant_id) === Number(activeRestaurant.id))
  )), [activeRestaurant?.id, orders]);
  const visibleExpenses = useMemo(() => expenses.filter((expense) => (
    !expense.restaurant_id || !activeRestaurant?.id || Number(expense.restaurant_id) === Number(activeRestaurant.id)
  )), [activeRestaurant?.id, expenses]);
  const salesToday = validSales.filter((order) => localDateKey(order.created_at || order.date) === todayKey);
  const salesThisMonth = validSales.filter((order) => localDateKey(order.created_at || order.date).startsWith(monthPrefix));
  const expensesToday = visibleExpenses.filter((expense) => localDateKey(expense.date || expense.created_at) === todayKey);
  const expensesThisMonth = visibleExpenses.filter((expense) => localDateKey(expense.date || expense.created_at).startsWith(monthPrefix));
  const totalSalesToday = salesToday.reduce((sum, order) => sum + Number(order.total_amount ?? order.total ?? 0), 0);
  const totalSalesMonth = salesThisMonth.reduce((sum, order) => sum + Number(order.total_amount ?? order.total ?? 0), 0);
  const totalExpensesToday = expensesToday.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const totalExpensesMonth = expensesThisMonth.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const outOfStock = items.filter((item) => Number(item.stock_quantity || 0) <= 0);
  const lowStock = items.filter((item) => {
    const quantity = Number(item.stock_quantity || 0);
    const reorderLevel = Number(item.reorder_level || 10);
    return quantity > 0 && quantity <= reorderLevel;
  });
  const activeEmployees = employees.filter((employee) => (
    String(employee.employmentStatus || employee.status || 'Active').toLowerCase() === 'active'
  ));
  const todayAttendance = attendance.filter((record) => localDateKey(record.date) === todayKey);
  const presentToday = todayAttendance.filter((record) => (
    ['present', 'late'].includes(String(record.status || '').toLowerCase())
  )).length;
  const pendingLeaves = leaves.filter((leave) => String(leave.status || '').toLowerCase() === 'pending');
  const currency = activeRestaurant?.currency || '$';
  const formatMoney = (amount) => `${currency} ${Number(amount || 0).toFixed(2)}`;

  const salesByDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = localDateKey(date);
      return {
        key,
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        sales: 0,
        expenses: 0,
      };
    });
    const dayMap = new Map(days.map((day) => [day.key, day]));
    validSales.forEach((order) => {
      const key = localDateKey(order.created_at || order.date);
      const day = dayMap.get(key);
      if (day) day.sales += Number(order.total_amount ?? order.total ?? 0);
    });
    expenses.forEach((expense) => {
      const key = localDateKey(expense.date || expense.created_at);
      const day = dayMap.get(key);
      if (day) day.expenses += Number(expense.amount || 0);
    });
    return days;
  }, [validSales, visibleExpenses]);

  const maxChartValue = Math.max(1, ...salesByDay.flatMap((day) => [day.sales, day.expenses]));

  const saveExpense = (event) => {
    event.preventDefault();
    const amount = Number(expenseForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setExpenseError('Enter an expense amount greater than zero.');
      return;
    }

    const expense = {
      id: `EXP-${Date.now()}`,
      description: expenseForm.description.trim(),
      category: expenseForm.category,
      amount,
      date: expenseForm.date,
      created_at: new Date().toISOString(),
      restaurant_id: activeRestaurant?.id || null,
      created_by: JSON.parse(localStorage.getItem('user') || '{}').username || 'Admin',
    };
    const updatedExpenses = [expense, ...expenses];
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(updatedExpenses));
    setExpenses(updatedExpenses);
    setExpenseError('');
    setExpenseForm({ description: '', category: 'Supplies', amount: '', date: todayKey });
    setShowExpenseForm(false);
  };

  const removeExpense = (expenseId) => {
    const updatedExpenses = expenses.filter((expense) => expense.id !== expenseId);
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(updatedExpenses));
    setExpenses(updatedExpenses);
  };

  const recentExpenses = visibleExpenses.slice(0, 5);
  const recentLeaves = pendingLeaves.slice(0, 4);
  const stockAlerts = [...outOfStock, ...lowStock].slice(0, 5);

  return (
    <div className="dashboard-page min-h-full space-y-5 pb-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">Management overview</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            {activeRestaurant?.name || 'Your business'} · {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
          >
            Sales reports
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('sivara-open-drawer', { detail: '/pos' }))}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
          >
            Restaurant POS
          </button>
          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
          >
            {user?.role_name === 'Admin' || user?.role === 'Admin' ? 'Menu assignments' : 'Menu & items'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/supermarket-pos')}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Supermarket POS
          </button>
        </div>
      </div>

      <section aria-label="Business summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total sales today"
          value={formatMoney(totalSalesToday)}
          detail={`${salesToday.length} completed orders · month ${formatMoney(totalSalesMonth)}`}
          tone="bg-emerald-50 text-emerald-700"
          icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          onClick={() => navigate('/reports')}
        />
        <MetricCard
          label="Expenses today"
          value={formatMoney(totalExpensesToday)}
          detail={`${expensesToday.length} entries · month ${formatMoney(totalExpensesMonth)}`}
          tone="bg-rose-50 text-rose-700"
          icon="M12 8v8m-4-4h8m5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          onClick={() => setShowExpenseForm(true)}
        />
        <MetricCard
          label="Active employees"
          value={employees.length ? activeEmployees.length : '—'}
          detail={employees.length ? `${presentToday} present / late today` : 'No HRMS employee data'}
          tone="bg-blue-50 text-blue-700"
          icon="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m16 0v-2a4 4 0 0 0-3-3.87M14 3.13a4 4 0 0 1 0 7.75M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
          onClick={() => navigate('/hrms')}
        />
        <MetricCard
          label="Stock alerts"
          value={items.length ? outOfStock.length + lowStock.length : '—'}
          detail={items.length ? `${outOfStock.length} out of stock · ${lowStock.length} running low` : 'No inventory items'}
          tone="bg-amber-50 text-amber-700"
          icon="M12 9v4m0 4h.01M10.3 3.86 2.82 17a2 2 0 0 0 1.74 3h14.88a2 2 0 0 0 1.74-3L13.7 3.86a2 2 0 0 0-3.48 0Z"
          onClick={() => navigate('/inventory')}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <PanelHeading eyebrow="Performance" title="Sales & expenses · last 7 days" action="Full sales report" onAction={() => navigate('/reports')} />
          <div className="p-5">
            <div className="mb-4 flex gap-5 text-xs font-bold text-slate-600">
              <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Sales</span>
              <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-rose-400" />Expenses</span>
            </div>
            <div className="grid h-44 grid-cols-7 gap-3">
              {salesByDay.map((day) => (
                <div key={day.key} className="flex min-w-0 flex-col items-center justify-end gap-2">
                  <div className="flex h-full w-full items-end justify-center gap-1">
                    <div
                      title={`Sales: ${formatMoney(day.sales)}`}
                      className="min-h-1 w-3 rounded-t-md bg-emerald-500 transition-all"
                      style={{ height: `${(day.sales / maxChartValue) * 100}%` }}
                    />
                    <div
                      title={`Expenses: ${formatMoney(day.expenses)}`}
                      className="min-h-1 w-3 rounded-t-md bg-rose-400 transition-all"
                      style={{ height: `${(day.expenses / maxChartValue) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{day.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
              Month to date: <strong className="text-slate-700">{formatMoney(totalSalesMonth)}</strong> sales
              <span className="mx-2 text-slate-300">·</span>
              <strong className="text-slate-700">{formatMoney(totalExpensesMonth)}</strong> expenses
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <PanelHeading eyebrow="People" title="Employees & leave" action="Open HRMS" onAction={() => navigate('/hrms')} />
          <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
            <div className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Active staff</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{employees.length ? activeEmployees.length : '—'}</p>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Present / late</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-700">{employees.length ? presentToday : '—'}</p>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Leave pending</p>
              <p className="mt-1 text-2xl font-extrabold text-amber-600">{leaves.length ? pendingLeaves.length : '—'}</p>
            </div>
          </div>
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Requests to review</h3>
              <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                {leaves.length ? `${pendingLeaves.length} pending` : 'No records'}
              </span>
            </div>
            {recentLeaves.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">
                {leaves.length ? 'No pending leave requests.' : 'No leave requests have been recorded yet.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentLeaves.map((leave) => {
                  const employee = employees.find((record) => record.empCode === leave.employeeId);
                  return (
                    <li key={leave.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800">{employee?.fullName || leave.employeeId || 'Employee'}</p>
                        <p className="text-xs text-slate-500">{leave.leaveType || 'Leave'} · {leave.startDate || 'Date not set'}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">Pending</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <PanelHeading eyebrow="Stock control" title="Low & out-of-stock items" action="Manage inventory" onAction={() => navigate('/inventory')} />
          <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
            <div className="p-4">
              <p className="text-xs font-bold text-slate-500">Items needing reorder</p>
              <p className="mt-1 text-2xl font-extrabold text-amber-600">{lowStock.length}</p>
            </div>
            <div className="p-4">
              <p className="text-xs font-bold text-slate-500">Out of stock</p>
              <p className="mt-1 text-2xl font-extrabold text-rose-600">{outOfStock.length}</p>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="p-5 text-center text-sm text-slate-500">No inventory records found. Add products in Inventory to see stock levels.</p>
          ) : stockAlerts.length === 0 ? (
            <p className="p-5 text-center text-sm text-slate-500">All products are above their reorder levels.</p>
          ) : (
            <ul className="divide-y divide-slate-100 px-5">
              {stockAlerts.map((item) => {
                const quantity = Number(item.stock_quantity || 0);
                const isOut = quantity <= 0;
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500">Reorder at {Number(item.reorder_level || 10)} {item.unit || 'units'}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${isOut ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                      {isOut ? 'Out of stock' : `${quantity} left`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {items.length > 5 && stockAlerts.length > 0 && (
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Showing {stockAlerts.length} of {outOfStock.length + lowStock.length} stock alerts.</p>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <PanelHeading
            eyebrow="Expense tracking"
            title="Recent expenses"
            action="Add expense"
            onAction={() => { setExpenseError(''); setShowExpenseForm(true); }}
          />
          {recentExpenses.length === 0 ? (
            <div className="p-8 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <Icon path="M12 8v8m-4-4h8m5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </span>
              <p className="mt-3 text-sm font-bold text-slate-700">No expenses recorded yet</p>
              <p className="mt-1 text-xs text-slate-500">Add expenses to track daily and monthly business costs.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 px-5">
              {recentExpenses.map((expense) => (
                <li key={expense.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                    <Icon path="M12 8v8m-4-4h8m5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{expense.description || expense.category || 'Business expense'}</p>
                    <p className="text-xs text-slate-500">{expense.category || 'Other'} · {expense.date || localDateKey(expense.created_at)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold text-slate-900">{formatMoney(expense.amount)}</span>
                  <button
                    type="button"
                    onClick={() => removeExpense(expense.id)}
                    aria-label={`Remove ${expense.description || 'expense'}`}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Icon path="M6 7h12m-10 0 .7 13h6.6L16 7M9 7V4h6v3m-5 4v5m4-5v5" className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {showExpenseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowExpenseForm(false);
        }}>
          <form onSubmit={saveExpense} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" aria-labelledby="expense-form-title">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-rose-600">Expense entry</p>
                <h2 id="expense-form-title" className="mt-1 text-xl font-extrabold text-slate-900">Add business expense</h2>
              </div>
              <button type="button" onClick={() => setShowExpenseForm(false)} aria-label="Close expense form" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
            </div>
            {expenseError && <p role="alert" className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{expenseError}</p>}
            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-700">
                Description
                <input
                  required
                  maxLength={100}
                  value={expenseForm.description}
                  onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })}
                  placeholder="e.g. Cleaning supplies"
                  className="input mt-1.5"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-bold text-slate-700">
                  Category
                  <select value={expenseForm.category} onChange={(event) => setExpenseForm({ ...expenseForm, category: event.target.value })} className="input mt-1.5">
                    {MONEY_OUTFLOWS.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  Amount ({currency})
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={expenseForm.amount}
                    onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })}
                    placeholder="0.00"
                    className="input mt-1.5"
                  />
                </label>
              </div>
              <label className="block text-sm font-bold text-slate-700">
                Expense date
                <input type="date" required value={expenseForm.date} onChange={(event) => setExpenseForm({ ...expenseForm, date: event.target.value })} className="input mt-1.5" />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowExpenseForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-rose-700">Save expense</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
