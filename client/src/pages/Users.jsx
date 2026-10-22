import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { restaurantApi, userApi } from '../api';

const modules = ['Dashboard', 'POS', 'Orders', 'Kitchen', 'Inventory', 'Reports', 'CRM', 'Employees', 'UserMgmt', 'Settings'];
const permissionActions = ['View', 'Create', 'Edit', 'Delete', 'Approve', 'Export', 'Import', 'Print'];
const blankEmployee = {
  full_name: '',
  employee_id: '',
  username: '',
  email: '',
  role_id: '',
  restaurant_ids: [],
  account_status: 'pending_activation',
};
const blankRole = {
  name: '',
  permissions: Object.fromEntries(modules.map(module => [
    module,
    Object.fromEntries(permissionActions.map(action => [action, false])),
  ])),
};

const normalizeRolePermissions = permissions => Object.fromEntries(modules.map(module => {
  const current = permissions?.[module];
  const actions = typeof current === 'boolean'
    ? Object.fromEntries(permissionActions.map(action => [action, current]))
    : { ...Object.fromEntries(permissionActions.map(action => [action, false])), ...current };
  return [module, actions];
}));

const messageFor = error => (
  error.response?.data?.error || error.message || 'The request failed. Please try again.'
);

export default function Users() {
  const { user: currentUser, activeRestaurant, hasPermission } = useAuth();
  const [tab, setTab] = useState('employees');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [activities, setActivities] = useState([]);
  const [search, setSearch] = useState('');
  const [employeeForm, setEmployeeForm] = useState(blankEmployee);
  const [roleForm, setRoleForm] = useState(blankRole);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isAdmin = currentUser?.role_name === 'Admin' || currentUser?.role === 'Admin';

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [userResult, roleResult, restaurantResult, activityResult] = await Promise.all([
        userApi.getAll(),
        userApi.getRoles(),
        restaurantApi.getAll(),
        userApi.getActivities(isAdmin ? undefined : { restaurant_id: activeRestaurant?.id }),
      ]);
      setUsers(userResult.data);
      setRoles(roleResult.data);
      setRestaurants(restaurantResult.data);
      setActivities(activityResult.data);
    } catch (loadError) {
      setError(messageFor(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeRestaurant?.id, isAdmin]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter(employee => [
      employee.full_name,
      employee.employee_id,
      employee.username,
      employee.email,
      employee.role_name,
      employee.restaurant_name,
    ].some(value => String(value || '').toLowerCase().includes(query)));
  }, [users, search]);

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activities;
    return activities.filter(activity => [
      activity.username,
      activity.action,
      activity.details,
    ].some(value => String(value || '').toLowerCase().includes(query)));
  }, [activities, search]);

  const activeCount = users.filter(employee => employee.account_status === 'active' || employee.is_active).length;
  const reviewCount = users.filter(employee => employee.account_status === 'pending_activation').length;
  const employeeLinkFromToken = token => `${window.location.origin}/activate?token=${encodeURIComponent(token)}`;

  const closeEmployeeForm = () => {
    setShowEmployeeForm(false);
    setEditingEmployee(null);
    setEmployeeForm(blankEmployee);
  };

  const submitEmployee = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (editingEmployee) {
        const result = await userApi.update(editingEmployee.id, {
          ...employeeForm,
          restaurant_ids: employeeForm.restaurant_ids.map(Number),
          role_id: Number(employeeForm.role_id),
        });
        setUsers(previous => previous.map(employee => (
          String(employee.id) === String(result.data.user.id) ? result.data.user : employee
        )));
        setNotice(result.data.audit_warning || 'Employee access updated. Their existing session has been revoked; role permissions are refreshed from the server on each request.');
        closeEmployeeForm();
      } else {
        const result = await userApi.create({
          ...employeeForm,
          restaurant_ids: employeeForm.restaurant_ids.map(Number),
          role_id: Number(employeeForm.role_id),
        });
        setInviteLink(employeeLinkFromToken(result.data.activation_token));
        setNotice(result.data.audit_warning || '');
        closeEmployeeForm();
        await loadData();
      }
      await reloadAudit();
    } catch (saveError) {
      setError(messageFor(saveError));
    } finally {
      setSaving(false);
    }
  };

  const reloadAudit = async () => {
    try {
      const result = await userApi.getActivities(isAdmin ? undefined : { restaurant_id: activeRestaurant?.id });
      setActivities(result.data);
    } catch (auditError) {
      console.error('Unable to refresh user access audit log:', auditError);
      setError(messageFor(auditError));
    }
  };

  const startEditEmployee = employee => {
    setEditingEmployee(employee);
    setEmployeeForm({
      full_name: employee.full_name || '',
      employee_id: employee.employee_id || '',
      username: employee.username || '',
      email: employee.email || '',
      role_id: String(employee.role_id || ''),
      restaurant_ids: (employee.restaurant_ids || employee.restaurants?.map(restaurant => restaurant.id) || []).map(String),
      account_status: employee.account_status || (employee.is_active ? 'active' : 'suspended'),
    });
    setShowEmployeeForm(true);
  };

  const createInvitation = async employee => {
    setError('');
    setNotice('');
    try {
      const result = await userApi.resetPassword(employee.id);
      setInviteLink(employeeLinkFromToken(result.data.activation_token));
      setNotice([result.data.message, result.data.audit_warning].filter(Boolean).join(' '));
      await reloadAudit();
    } catch (inviteError) {
      setError(messageFor(inviteError));
    }
  };

  const suspendEmployee = async employee => {
    if (String(employee.id) === String(currentUser?.id)) {
      setError('You cannot suspend your own account.');
      return;
    }
    const isActive = employee.account_status === 'active' || employee.is_active;
    if (isActive && !window.confirm(`Suspend ${employee.full_name || employee.username}? Their existing sessions will be revoked.`)) return;
    setError('');
    setNotice('');
    try {
      let auditWarning = null;
      if (isActive) {
        const result = await userApi.delete(employee.id);
        auditWarning = result.data.audit_warning;
      } else {
        const result = await userApi.update(employee.id, {
          full_name: employee.full_name,
          employee_id: employee.employee_id,
          username: employee.username,
          email: employee.email,
          role_id: Number(employee.role_id),
          restaurant_ids: (employee.restaurant_ids || []).map(Number),
          account_status: employee.account_status === 'pending_activation' ? 'pending_activation' : 'active',
        });
        auditWarning = result.data.audit_warning;
      }
      await loadData();
      setNotice(auditWarning || (isActive ? 'Employee suspended and existing sessions revoked.' : 'Employee reactivated.'));
    } catch (actionError) {
      setError(messageFor(actionError));
    }
  };

  const submitRole = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = editingRole
        ? await userApi.updateRole(editingRole.id, roleForm)
        : await userApi.createRole(roleForm);
      setShowRoleForm(false);
      setEditingRole(null);
      setRoleForm(blankRole);
      await loadData();
      setNotice(result.data.audit_warning || (editingRole ? 'Role permissions updated.' : 'Role created.'));
    } catch (saveError) {
      setError(messageFor(saveError));
    } finally {
      setSaving(false);
    }
  };

  const removeRole = async role => {
    if (!window.confirm(`Delete the ${role.name} role? Accounts using it will lose this role assignment.`)) return;
    setError('');
    try {
      const result = await userApi.deleteRole(role.id);
      await loadData();
      setNotice(result.data.audit_warning || 'Role deleted.');
    } catch (deleteError) {
      setError(messageFor(deleteError));
    }
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setNotice('Setup link copied. Share it with the employee through a trusted channel.');
    } catch (copyError) {
      setError('Could not copy automatically. Select and copy the setup link manually.');
    }
  };

  const downloadBlob = (content, type, filename) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const reportFileName = extension => `employee-access-${new Date().toISOString().slice(0, 10)}.${extension}`;

  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const buildEmployeeTable = () => {
    const columns = ['Employee ID', 'Name', 'Username', 'Email', 'Role', 'Restaurants', 'Status', 'Last login'];
    const rows = filteredUsers.map(employee => [
      employee.employee_id || '',
      employee.full_name || employee.username || '',
      employee.username || '',
      employee.email || '',
      employee.role_name || 'Unassigned',
      employee.restaurant_name || '',
      employee.account_status ? employee.account_status.replaceAll('_', ' ') : (employee.is_active ? 'active' : 'suspended'),
      employee.last_login ? new Date(employee.last_login).toLocaleString() : 'Never',
    ]);
    return { columns, rows };
  };

  const exportCsv = () => {
    const { columns, rows } = buildEmployeeTable();
    const escapeCsv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [columns, ...rows].map(row => row.map(escapeCsv).join(',')).join('\r\n');
    downloadBlob('\uFEFF' + csv, 'text/csv;charset=utf-8', reportFileName('csv'));
  };

  const exportExcel = () => {
    const { columns, rows } = buildEmployeeTable();
    const headerCells = columns.map(column => `<th style="background:#0f766e;color:#ffffff;padding:8px;border:1px solid #cbd5e1;text-align:left;">${escapeHtml(column)}</th>`).join('');
    const bodyRows = rows.map(row => `<tr>${row.map(cell => `<td style="padding:6px;border:1px solid #cbd5e1;">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Employee Access</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
    downloadBlob('\uFEFF' + html, 'application/vnd.ms-excel', reportFileName('xls'));
  };

  const exportPdf = () => {
    const { columns, rows } = buildEmployeeTable();
    const headerCells = columns.map(column => `<th>${escapeHtml(column)}</th>`).join('');
    const bodyRows = rows.length
      ? rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${columns.length}" style="text-align:center;padding:16px;color:#6b7280;">No employees found.</td></tr>`;
    const generatedAt = new Date().toLocaleString();
    const printWindow = window.open('', '_blank', 'width=1024,height=768');
    if (!printWindow) {
      setError('Please allow pop-ups in your browser, then try Download PDF again.');
      return;
    }
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Employee Access Report</title><style>
      *{box-sizing:border-box;}
      body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:24px;}
      .report-head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #0f766e;padding-bottom:12px;margin-bottom:16px;}
      .brand{font-size:20px;font-weight:bold;color:#0f766e;}
      .subtitle{font-size:13px;color:#475569;margin-top:4px;}
      .meta{font-size:11px;color:#64748b;text-align:right;}
      table{width:100%;border-collapse:collapse;font-size:11px;}
      th{background:#0f766e;color:#ffffff;padding:8px;border:1px solid #cbd5e1;text-align:left;}
      td{padding:6px;border:1px solid #cbd5e1;}
      tr:nth-child(even) td{background:#f8fafc;}
      .report-foot{margin-top:16px;font-size:10px;color:#94a3b8;text-align:center;}
      @media print{@page{size:A4 landscape;margin:12mm;}}
    </style></head><body>
      <div class="report-head"><div><div class="brand">ALL IN ONE POS</div><div class="subtitle">User &amp; Security Center &mdash; Employee Access</div></div><div class="meta">Generated: ${escapeHtml(generatedAt)}<br/>Total employees: ${rows.length}</div></div>
      <table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
      <div class="report-foot">&copy; ${new Date().getFullYear()} SIVARA GROUP &middot; All Rights Reserved</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
    </body></html>`);
    printWindow.document.close();
  };

  const toggleRestaurant = id => {
    const value = String(id);
    setEmployeeForm(previous => ({
      ...previous,
      restaurant_ids: previous.restaurant_ids.includes(value)
        ? previous.restaurant_ids.filter(restaurantId => restaurantId !== value)
        : [...previous.restaurant_ids, value],
    }));
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-end gap-4 sm:flex-row sm:justify-end sm:items-center">
        <div className="flex flex-wrap gap-2">
          {tab === 'employees' && hasPermission('UserMgmt', 'Export') && (
            <>
              <button type="button" onClick={exportCsv} className="btn border border-gray-300 bg-white text-gray-700">Export CSV</button>
              <button type="button" onClick={exportExcel} className="btn border border-emerald-600 bg-white text-emerald-700">Export Excel</button>
              <button type="button" onClick={exportPdf} className="btn border border-red-600 bg-white text-red-700">Download PDF</button>
            </>
          )}
          {tab === 'employees' && hasPermission('UserMgmt', 'Create') && (
            <button type="button" onClick={() => { setEmployeeForm(blankEmployee); setEditingEmployee(null); setShowEmployeeForm(true); }} className="btn btn-primary">
              + Create employee
            </button>
          )}
          {tab === 'roles' && isAdmin && (
            <button type="button" onClick={() => { setRoleForm(blankRole); setEditingRole(null); setShowRoleForm(true); }} className="btn btn-primary">
              + Add role
            </button>
          )}
        </div>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">{notice}</div>}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Employees', value: users.length, note: 'Accounts in your access scope', color: 'text-slate-900' },
          { label: 'Active users', value: activeCount, note: 'Can currently sign in', color: 'text-emerald-700' },
          { label: 'Need review', value: reviewCount, note: 'Waiting for secure password setup', color: 'text-amber-700' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.color}`}>{loading ? '—' : card.value}</p>
            <p className="mt-1 text-xs text-gray-500">{card.note}</p>
          </div>
        ))}
      </section>

      <nav className="flex w-fit gap-1 rounded-xl bg-gray-100 p-1" aria-label="User access sections">
        {[
          ['employees', 'Employees'],
          ['roles', 'Roles & permissions'],
          ['activity', 'Audit activity'],
        ].map(([key, label]) => (
          <button key={key} type="button" onClick={() => { setTab(key); setSearch(''); }} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
            {label}
          </button>
        ))}
      </nav>

      <div className="flex max-w-lg items-center gap-3">
        <input className="input" value={search} onChange={event => setSearch(event.target.value)} placeholder={`Search ${tab === 'activity' ? 'audit activity' : 'employees'}...`} />
        <button type="button" onClick={loadData} className="btn border border-gray-300 bg-white text-gray-700" disabled={loading}>Refresh</button>
      </div>

      {loading ? (
        <div className="card py-12 text-center text-sm font-medium text-gray-500">Loading access records…</div>
      ) : tab === 'employees' ? (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table min-w-[900px]">
              <thead><tr><th>Employee</th><th>Role</th><th>Restaurant access</th><th>Status</th><th>Last login</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {filteredUsers.map(employee => {
                  const status = employee.account_status || (employee.is_active ? 'active' : 'suspended');
                  const active = status === 'active';
                  return (
                    <tr key={employee.id}>
                      <td>
                        <p className="font-bold text-gray-900">{employee.full_name || employee.username}</p>
                        <p className="text-xs text-gray-500">{employee.employee_id || 'No employee ID'} · @{employee.username}</p>
                        <p className="text-xs text-gray-500">{employee.email || 'No email'}</p>
                      </td>
                      <td><span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">{employee.role_name || 'Unassigned'}</span></td>
                      <td className="max-w-[220px] whitespace-normal text-sm text-gray-600">{employee.restaurant_name || 'No restaurant assigned'}</td>
                      <td><span className={`rounded px-2 py-1 text-xs font-bold ${active ? 'bg-green-100 text-green-800' : status === 'pending_activation' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>{status.replaceAll('_', ' ')}</span></td>
                      <td className="text-sm text-gray-500">{employee.last_login ? new Date(employee.last_login).toLocaleString() : 'Never'}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-3 whitespace-nowrap">
                          {hasPermission('UserMgmt', 'Edit') && <button type="button" onClick={() => startEditEmployee(employee)} className="font-semibold text-primary-700 hover:underline">Edit</button>}
                          {hasPermission('UserMgmt', 'Edit') && <button type="button" onClick={() => createInvitation(employee)} className="font-semibold text-indigo-700 hover:underline">{status === 'pending_activation' ? 'Resend setup' : 'Reset password'}</button>}
                          {hasPermission('UserMgmt', active ? 'Delete' : 'Edit')
                            && String(employee.id) !== String(currentUser?.id)
                            && status !== 'pending_activation' && (
                            <button type="button" onClick={() => suspendEmployee(employee)} className={`font-semibold hover:underline ${active ? 'text-red-700' : 'text-emerald-700'}`}>{active ? 'Suspend' : 'Reactivate'}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredUsers.length && <tr><td colSpan="6" className="py-10 text-center text-sm text-gray-500">No employees found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'roles' ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {roles.map(role => (
            <article key={role.id} className="card border-t-4 border-primary-500">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div><h2 className="text-xl font-bold text-gray-900">{role.name}</h2><p className="text-xs text-gray-500">Module permissions</p></div>
                {isAdmin && <div className="flex gap-2">
                  <button type="button" onClick={() => { setEditingRole(role); setRoleForm({ name: role.name, permissions: normalizeRolePermissions(role.permissions) }); setShowRoleForm(true); }} className="text-sm font-semibold text-primary-700">Edit</button>
                  {role.name !== 'Admin' && <button type="button" onClick={() => removeRole(role)} className="text-sm font-semibold text-red-700">Delete</button>}
                </div>}
              </div>
              <div className="space-y-2">
                {modules.map(module => <div key={module} className="flex justify-between border-b border-gray-100 py-1 text-sm">
                  <span className="text-gray-600">{module}</span>
                  <span className="text-right text-xs text-gray-500">{permissionActions.filter(action => (
                    role.permissions?.[module] === true || role.permissions?.[module]?.[action] === true
                  )).join(', ') || 'No access'}</span>
                </div>)}
              </div>
            </article>
          ))}
          {!roles.length && <div className="card text-sm text-gray-500">No roles are configured.</div>}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table min-w-[700px]">
              <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead>
              <tbody>
                {filteredActivities.map(activity => <tr key={activity.id}>
                  <td className="whitespace-nowrap text-sm text-gray-500">{new Date(activity.created_at || activity.timestamp).toLocaleString()}</td>
                  <td className="font-semibold text-gray-700">{activity.username || 'System'}</td>
                  <td><span className="rounded bg-gray-100 px-2 py-1 text-xs font-bold uppercase">{activity.action}</span></td>
                  <td className="whitespace-normal text-sm text-gray-600">{activity.details}</td>
                </tr>)}
                {!filteredActivities.length && <tr><td colSpan="4" className="py-10 text-center text-sm text-gray-500">No matching activity.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showEmployeeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={submitEmployee} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900">{editingEmployee ? 'Edit employee access' : 'Create employee'}</h2>
            <p className="mb-5 mt-1 text-sm text-gray-500">{editingEmployee ? 'Changes are saved to the server and enforced on requests.' : 'A one-time password setup link will be created after saving.'}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['full_name', 'Employee name', 'text'],
                ['employee_id', 'Employee ID', 'text'],
                ['username', 'Username', 'text'],
                ['email', 'Email address', 'email'],
              ].map(([field, label, type]) => <label key={field} className="text-sm font-semibold text-gray-700">
                {label}
                <input type={type} value={employeeForm[field]} onChange={event => setEmployeeForm(previous => ({ ...previous, [field]: event.target.value }))} className="input mt-1" required={field !== 'email'} />
              </label>)}
              <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
                Role
                <select value={employeeForm.role_id} onChange={event => setEmployeeForm(previous => ({ ...previous, role_id: event.target.value }))} className="input mt-1" required>
                  <option value="">Select role</option>
                  {roles.map(role => <option key={role.id} value={role.id} disabled={!isAdmin && role.name === 'Admin'}>{role.name}</option>)}
                </select>
              </label>
              <fieldset className="sm:col-span-2">
                <legend className="mb-2 text-sm font-semibold text-gray-700">Assigned restaurants</legend>
                <div className="grid gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-2">
                  {restaurants.map(restaurant => <label key={restaurant.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={employeeForm.restaurant_ids.includes(String(restaurant.id))} onChange={() => toggleRestaurant(restaurant.id)} />
                    {restaurant.name}
                  </label>)}
                  {!restaurants.length && <p className="text-sm text-amber-700">No restaurants are available.</p>}
                </div>
              </fieldset>
              {editingEmployee && (
                <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
                  Account status
                  <select
                    value={employeeForm.account_status}
                    onChange={event => setEmployeeForm(previous => ({ ...previous, account_status: event.target.value }))}
                    className="input mt-1"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    {employeeForm.account_status === 'pending_activation' && <option value="pending_activation">Pending activation</option>}
                  </select>
                  {employeeForm.account_status === 'pending_activation' && <span className="mt-1 block text-xs font-normal text-amber-700">The employee must use their setup link before activation.</span>}
                </label>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeEmployeeForm} className="btn border border-gray-300 bg-white text-gray-700">Cancel</button>
              <button type="submit" disabled={saving || !employeeForm.restaurant_ids.length} className="btn btn-primary disabled:opacity-50">{saving ? 'Saving…' : editingEmployee ? 'Save changes' : 'Create & invite'}</button>
            </div>
          </form>
        </div>
      )}

      {showRoleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={submitRole} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-5 text-2xl font-bold">{editingRole ? 'Edit role' : 'Create role'}</h2>
            <label className="text-sm font-semibold text-gray-700">Role name
              <input value={roleForm.name} onChange={event => setRoleForm(previous => ({ ...previous, name: event.target.value }))} className="input mt-1" required />
            </label>
            <fieldset className="mt-5 space-y-2">
              <legend className="mb-2 text-sm font-semibold">Module access</legend>
              {modules.map(module => <div key={module} className="rounded-lg bg-gray-50 p-3">
                <p className="mb-2 text-sm font-bold text-gray-800">{module}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {permissionActions.map(action => <label key={action} className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={roleForm.permissions[module]?.[action] === true}
                      onChange={event => setRoleForm(previous => ({
                        ...previous,
                        permissions: {
                          ...previous.permissions,
                          [module]: { ...previous.permissions[module], [action]: event.target.checked },
                        },
                      }))}
                    />
                    {action}
                  </label>)}
                </div>
              </div>)}
            </fieldset>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowRoleForm(false)} className="btn border border-gray-300 bg-white text-gray-700">Cancel</button>
              <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save role'}</button>
            </div>
          </form>
        </div>
      )}

      {inviteLink && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900">Secure password setup link</h2>
            <p className="my-3 text-sm text-gray-600">This single-use link expires in 24 hours. It is shown only once; share it with the employee through a trusted channel. The system never displays an employee password.</p>
            {notice && <p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{notice}</p>}
            <input readOnly value={inviteLink} onFocus={event => event.target.select()} className="input text-sm" aria-label="Employee setup link" />
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setInviteLink('')} className="btn border border-gray-300 bg-white text-gray-700">Close</button>
              <button type="button" onClick={copyInviteLink} className="btn btn-primary">Copy setup link</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
