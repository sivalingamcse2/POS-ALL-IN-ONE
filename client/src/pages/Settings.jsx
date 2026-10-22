import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { restaurantApi, settingsApi, userApi } from '../api';

const permissionGroups = [
  { key: 'Dashboard', label: 'Dashboard', description: 'Overview and performance information' },
  { key: 'POS', label: 'Point of Sale', description: 'Sales, payments, refunds, and shifts' },
  { key: 'Orders', label: 'Orders', description: 'Order history and order status' },
  { key: 'Kitchen', label: 'Kitchen Display', description: 'Kitchen tickets and preparation status' },
  { key: 'Inventory', label: 'Inventory & Menu', description: 'Stock, menu items, and categories' },
  { key: 'Reports', label: 'Reports', description: 'Sales and operational reports' },
  { key: 'CRM', label: 'CRM', description: 'Customers, guests, and loyalty data' },
  { key: 'Employees', label: 'Employees & HRMS', description: 'Employee records and HR workflows' },
  { key: 'UserMgmt', label: 'Users & Roles', description: 'Accounts, roles, and activity logs' },
  { key: 'Settings', label: 'System Settings', description: 'Branches, tables, and configuration' },
];

const permissionActions = ['View', 'Add', 'Create', 'Edit', 'Delete', 'Export', 'Import', 'Approve', 'Print'];
const SETTINGS_KEY = 'pos_settings_prototype';
const blankRestaurant = {
  name: '',
  business_type: 'restaurant',
  address: '',
  phone: '',
  email: '',
  currency: 'USD',
  tax_rate: 10,
  website: '',
  manager_name: '',
  operating_hours: '',
  seating_capacity: 0,
};

const restaurantErrorMessage = error => (
  error.response?.data?.error || error.message || 'Unable to save the store. Please try again.'
);

const readLocalArray = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.error(`Unable to read ${key} from local storage:`, error);
    return [];
  }
};

const readLocalObject = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  } catch (error) {
    console.error(`Unable to read ${key} from local storage:`, error);
    return fallback;
  }
};

const normalizeServerLogs = rows => (rows || []).map(row => ({
  id: row.id,
  timestamp: row.created_at || row.timestamp,
  username: row.username || 'Admin',
  action: row.action,
  details: row.details || '',
}));

// The settings server is only considered "absent" when a request fails at the
// network level (no HTTP response at all). If the server answered — even with an
// error status — it exists, so we must NOT drop the page into browser demo mode.
const isServerUnreachable = error => !error?.response;

const emptyUserPermissions = () => permissionGroups.reduce((permissions, group) => {
  permissions[group.key] = permissionActions.reduce((actions, action) => {
    actions[action] = false;
    return actions;
  }, {});
  return permissions;
}, {});

export default function Settings() {
  const { user, setUser, activeRestaurant, setActiveRestaurant, switchRestaurant, isAdmin: checkIsAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('restaurant');
  
  // Get user's accessible restaurants
  const userRestaurants = user?.restaurants || [];
  const isAdmin = checkIsAdmin();
  const [accessUsers, setAccessUsers] = useState(() => {
    const storedUsers = readLocalArray('pos_users');
    if (storedUsers.length) return storedUsers;
    return user ? [{
      id: user.id,
      username: user.username,
      email: user.email,
      role_id: user.role_id,
      role_name: user.role_name || user.role,
      restaurant_id: user.restaurant_id || user.restaurants?.[0]?.id,
      restaurants: user.restaurants || [],
      is_active: true,
    }] : [];
  });
  const [roles, setRoles] = useState(() => {
    const storedRoles = readLocalArray('pos_roles');
    return storedRoles.length ? storedRoles : [
      { id: 1, name: 'Admin', permissions: { POS: true, Inventory: true, Reports: true, UserMgmt: true, Settings: true } },
      { id: 2, name: 'Manager', permissions: { POS: true, Inventory: true, Reports: true, UserMgmt: false, Settings: false } },
      { id: 3, name: 'Cashier', permissions: { POS: true, Inventory: false, Reports: false, UserMgmt: false, Settings: false } },
      { id: 4, name: 'Kitchen', permissions: { POS: false, Inventory: false, Reports: false, UserMgmt: false, Settings: false } },
    ];
  });
  const [selectedAccessUserId, setSelectedAccessUserId] = useState(() => {
    const savedUsers = readLocalArray('pos_users');
    return savedUsers[0]?.id || user?.id || '';
  });
  const [userPermissions, setUserPermissions] = useState(() => readLocalObject('pos_user_permissions', {}));
  const [accessSaved, setAccessSaved] = useState(false);
  const [selectedMenuRestaurantId, setSelectedMenuRestaurantId] = useState(() => {
    const saved = localStorage.getItem('pos_settings_menu_restaurant_id');
    if (saved) return saved;
    return readLocalObject('active_restaurant', {}).id || '';
  });
  const [menuItems, setMenuItems] = useState(() => readLocalArray('pos_menu_items'));
  const [securityPolicy, setSecurityPolicy] = useState(() => ({
    sessionTimeoutMinutes: 30,
    requireStrongPasswords: true,
    requireMfaForAdmins: false,
    maxFailedLogins: 5,
    ...(readLocalObject(SETTINGS_KEY, {}).securityPolicy
      || readLocalObject('pos_settings_security_policy', {})),
  }));
  const [auditLogs, setAuditLogs] = useState(() => readLocalArray('pos_settings_audit'));
  const [settingsSaved, setSettingsSaved] = useState(false);
  // Server persistence: true once the settings API answers; false = offline demo (localStorage).
  const [serverMode, setServerMode] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [assignedItemIds, setAssignedItemIds] = useState([]);
  const [menuReloadKey, setMenuReloadKey] = useState(0);
  const [probeKey, setProbeKey] = useState(0);

  const selectedAccessUser = accessUsers.find(accessUser => String(accessUser.id) === String(selectedAccessUserId));
  const selectedAccessRole = roles
    .find(role => String(role.id) === String(selectedAccessUser?.role_id));
  const selectedPermissions = selectedAccessUser
    ? userPermissions[selectedAccessUser.id] || emptyUserPermissions()
    : emptyUserPermissions();

  const toggleUserPermission = (module, action) => {
    setAccessSaved(false);
    setSettingsSaved(false);
    const current = userPermissions[selectedAccessUser.id] || emptyUserPermissions();
    const nextValue = !current[module]?.[action];
    setUserPermissions(previous => {
      return {
        ...previous,
        [selectedAccessUser.id]: {
          ...current,
          [module]: {
            ...current[module],
            [action]: nextValue,
          },
        },
      };
    });
    setAuditLogs(logs => [{
      id: Date.now(),
      timestamp: new Date().toISOString(),
      username: user?.username || 'Admin',
      action: `${nextValue ? 'Granted' : 'Revoked'} ${action}`,
      details: `${module} permission ${nextValue ? 'enabled for' : 'removed from'} ${selectedAccessUser.username}`,
    }, ...logs].slice(0, 200));
  };

  const saveUserPermissions = () => {
    localStorage.setItem('pos_user_permissions', JSON.stringify(userPermissions));
    setAccessSaved(true);
    setAuditLogs(logs => [{
      id: Date.now(),
      timestamp: new Date().toISOString(),
      username: user?.username || 'Admin',
      action: 'Saved demo permissions',
      details: `Saved permission overrides for ${selectedAccessUser?.username || 'selected user'}`,
    }, ...logs].slice(0, 200));
  };
  
  // Multi-Restaurant state
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const [restaurantError, setRestaurantError] = useState('');
  const [restaurantNotice, setRestaurantNotice] = useState('');
  const [restaurantSaving, setRestaurantSaving] = useState(false);
  const [restaurantForm, setRestaurantForm] = useState(blankRestaurant);
  const [editingResId, setEditingResId] = useState(null);

  // Tables state (Filtered by active restaurant)
  const [allTables, setAllTables] = useState(() => {
    const saved = localStorage.getItem('pos_tables');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    // Migration: If tables exist without restaurant_id, assign them to ID 1 (default)
    const migrated = parsed.map(t => ({
      ...t,
      restaurant_id: t.restaurant_id || 1
    }));
    return migrated;
  });

  const tables = allTables.filter(table => Number(table.restaurant_id) === Number(activeRestaurant?.id));
  const visibleRestaurants = isAdmin
    ? restaurants
    : restaurants.filter(restaurant => userRestaurants.some(access => Number(access.id) === Number(restaurant.id)));
  const [tableForm, setTableForm] = useState({ table_name: '', capacity: 4 });

  useEffect(() => {
    let current = true;
    setRestaurantsLoading(true);
    setRestaurantError('');
    restaurantApi.getAll()
      .then(({ data }) => {
        if (!current) return;
        const stores = data.map(store => ({
          ...store,
          business_type: store.business_type || 'restaurant',
        }));
        setRestaurants(stores);
        localStorage.setItem('pos_restaurants', JSON.stringify(stores));
      })
      .catch(error => {
        if (current) setRestaurantError(restaurantErrorMessage(error));
      })
      .finally(() => {
        if (current) setRestaurantsLoading(false);
      });
    return () => { current = false; };
  }, [user?.id]);
  useEffect(() => localStorage.setItem('pos_tables', JSON.stringify(allTables)), [allTables]);
  useEffect(() => localStorage.setItem('pos_menu_items', JSON.stringify(menuItems)), [menuItems]);
  useEffect(() => localStorage.setItem('pos_settings_audit', JSON.stringify(auditLogs)), [auditLogs]);
  useEffect(() => {
    localStorage.setItem('pos_settings_security_policy', JSON.stringify(securityPolicy));
  }, [securityPolicy]);

  const updateSelectedUser = (updates) => {
    if (!selectedAccessUser) return;
    const updatedUser = { ...selectedAccessUser, ...updates };
    if (updates.role_id !== undefined) {
      updatedUser.role_name = roles.find(role => String(role.id) === String(updates.role_id))?.name || '';
    }
    if (updates.restaurant_ids !== undefined) {
      const assignedRestaurants = restaurants.filter(restaurant => (
        updates.restaurant_ids.map(String).includes(String(restaurant.id))
      ));
      updatedUser.restaurants = assignedRestaurants;
      updatedUser.restaurant_id = assignedRestaurants[0]?.id || '';
      updatedUser.restaurant_name = assignedRestaurants.map(restaurant => restaurant.name).join(', ');
    }
    setAccessUsers(previous => previous.map(accessUser => (
      String(accessUser.id) === String(selectedAccessUser.id) ? updatedUser : accessUser
    )));
    setSettingsSaved(false);
    if (serverMode) {
      const assignedIds = (updatedUser.restaurants || []).map(item => Number(item.id));
      userApi.update(selectedAccessUser.id, {
        username: updatedUser.username,
        email: updatedUser.email || '',
        full_name: updatedUser.full_name || updatedUser.username,
        employee_id: String(updatedUser.employee_id || 'SELF'),
        role_id: Number(updatedUser.role_id) || 0,
        restaurant_ids: assignedIds.length ? assignedIds : [Number(updatedUser.restaurant_id) || 1],
        account_status: updatedUser.account_status || 'active',
      })
        .then(() => {
          if (String(selectedAccessUser.id) === String(user?.id)) {
            const nextUser = { ...user, role_id: updatedUser.role_id, role_name: updatedUser.role_name, role: updatedUser.role_name, restaurants: updatedUser.restaurants, restaurant_id: updatedUser.restaurant_id };
            setUser(nextUser);
            localStorage.setItem('user', JSON.stringify(nextUser));
          }
          settingsApi.getAuditLog()
            .then(({ data }) => setAuditLogs(normalizeServerLogs(data)))
            .catch(() => {});
        })
        .catch(error => { if (isServerUnreachable(error)) setServerMode(false); });
    }
  };

  const toggleMenuAssignment = (itemId) => {
    if (serverMode) {
      setAssignedItemIds(previous => (
        previous.map(String).includes(String(itemId))
          ? previous.filter(id => String(id) !== String(itemId))
          : [...previous, Number(itemId)]
      ));
      setSettingsSaved(false);
      return;
    }
    const restaurantId = String(selectedMenuRestaurantId);
    setMenuItems(previous => previous.map(item => {
      if (String(item.id) !== String(itemId)) return item;
      const assignedIds = Array.isArray(item.restaurant_ids)
        ? item.restaurant_ids.map(String)
        : [String(item.restaurant_id || 1)];
      const nextIds = assignedIds.includes(restaurantId)
        ? assignedIds.filter(id => id !== restaurantId)
        : [...assignedIds, restaurantId];
      return {
        ...item,
        restaurant_id: Number(nextIds[0] || restaurantId),
        restaurant_ids: nextIds,
      };
    }));
    setSettingsSaved(false);
    const item = menuItems.find(menuItem => String(menuItem.id) === String(itemId));
    setAuditLogs(logs => [{
      id: Date.now(),
      timestamp: new Date().toISOString(),
      username: user?.username || 'Admin',
      action: 'Changed demo menu assignment',
      details: `${item?.name || `Item ${itemId}`} at ${restaurants.find(restaurant => String(restaurant.id) === restaurantId)?.name || 'selected outlet'}`,
    }, ...logs].slice(0, 200));
  };

  const saveMenuAssignment = async () => {
    if (!serverMode || !selectedMenuRestaurantId) return;
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsNotice('');
    try {
      await settingsApi.saveMenuAssignment(selectedMenuRestaurantId, assignedItemIds);
      setMenuReloadKey(key => key + 1);
      setSettingsSaved(true);
      setSettingsNotice('Menu assignment saved on the server.');
      refreshAuditLog();
    } catch (error) {
      if (error.response) {
        setSettingsError(error.response?.data?.error || 'Unable to save the menu assignment.');
      } else {
        setServerMode(false);
      }
    } finally {
      setSettingsSaving(false);
    }
  };

  const saveSecurityPolicy = async () => {
    if (!serverMode) return;
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsNotice('');
    try {
      const { data } = await settingsApi.saveSecurityPolicy({
        sessionTimeoutMinutes: Number(securityPolicy.sessionTimeoutMinutes),
        requireStrongPasswords: Boolean(securityPolicy.requireStrongPasswords),
        maxFailedLogins: Number(securityPolicy.maxFailedLogins),
      });
      if (data.policy) setSecurityPolicy(previous => ({ ...previous, ...data.policy }));
      setSettingsSaved(true);
      setSettingsNotice(data.audit_warning || 'Security policy saved on the server.');
      refreshAuditLog();
    } catch (error) {
      if (error.response) {
        setSettingsError(error.response?.data?.error || 'Unable to save the security policy.');
      } else {
        setServerMode(false);
      }
    } finally {
      setSettingsSaving(false);
    }
  };

  const getSettingsSnapshot = () => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    restaurants,
    tables: allTables,
    users: accessUsers.map(accessUser => Object.fromEntries(
      Object.entries(accessUser).filter(([key]) => !['password', 'password_hash'].includes(key))
    )),
    roles,
    userPermissions,
    menuAssignments: menuItems.map(item => ({
      item_id: item.id,
      restaurant_ids: Array.isArray(item.restaurant_ids)
        ? item.restaurant_ids
        : [item.restaurant_id || 1],
    })),
    securityPolicy,
    auditLogs,
  });

  const saveSettings = async () => {
    if (serverMode) {
      setSettingsSaving(true);
      setSettingsError('');
      setSettingsNotice('');
      try {
        const { data } = await settingsApi.saveSecurityPolicy({
          sessionTimeoutMinutes: Number(securityPolicy.sessionTimeoutMinutes),
          requireStrongPasswords: Boolean(securityPolicy.requireStrongPasswords),
          maxFailedLogins: Number(securityPolicy.maxFailedLogins),
        });
        if (data.policy) setSecurityPolicy(previous => ({ ...previous, ...data.policy }));
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(getSettingsSnapshot()));
        localStorage.setItem('pos_settings_menu_restaurant_id', String(selectedMenuRestaurantId || ''));
        setSettingsNotice(data.audit_warning || 'Settings saved on the server.');
        refreshAuditLog();
      } catch (error) {
        setSettingsError(error.response?.data?.error || 'Unable to save settings on the server.');
      } finally {
        setSettingsSaving(false);
      }
      setSettingsSaved(true);
      return;
    }
    const savedLog = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      username: user?.username || 'Admin',
      action: 'Saved demo settings',
      details: 'Saved the current settings configuration in this browser',
    };
    const settings = {
      ...getSettingsSnapshot(),
      auditLogs: [savedLog, ...auditLogs].slice(0, 200),
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem('pos_settings_security_policy', JSON.stringify(securityPolicy));
    localStorage.setItem('pos_settings_menu_restaurant_id', String(selectedMenuRestaurantId || ''));
    setAuditLogs(settings.auditLogs);
    setSettingsSaved(true);
  };

  const exportSettings = () => {
    const configuration = getSettingsSnapshot();
    const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(configuration, null, 2)], {
      type: 'application/json',
    }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `pos-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  };

  // Server-backed loads: fall back to browser-only demo mode when the API can't answer
  // (e.g. the static GitHub Pages build, which has no backend).
  useEffect(() => {
    let current = true;
    const savedPolicy = readLocalObject(SETTINGS_KEY, {}).securityPolicy
      || readLocalObject('pos_settings_security_policy', null);
    settingsApi.getSecurityPolicy()
      .then(({ data }) => {
        if (!current) return;
        setServerMode(true);
        setSecurityPolicy(previous => ({ ...previous, ...data }));
        return Promise.all([userApi.getAll(), userApi.getRoles()])
          .then(([usersResult, rolesResult]) => {
            if (!current) return;
            if (usersResult.data?.length) setAccessUsers(usersResult.data);
            if (rolesResult.data?.length) setRoles(rolesResult.data);
          })
          .catch(() => {});
      })
      .catch(error => {
        if (!current) return;
        if (isServerUnreachable(error)) {
          setServerMode(false);
          if (savedPolicy) setSecurityPolicy(previous => ({ ...previous, ...savedPolicy }));
        } else {
          // The server responded (e.g. an auth or transient error) — it is present.
          setServerMode(true);
        }
      });
    return () => { current = false; };
  }, [probeKey]);

  useEffect(() => {
    if (!serverMode || !selectedMenuRestaurantId) return;
    let current = true;
    settingsApi.getMenuAssignment(selectedMenuRestaurantId)
      .then(({ data }) => {
        if (!current) return;
        setMenuItems(data);
        setAssignedItemIds(data.filter(item => item.assigned).map(item => Number(item.id)));
      })
      .catch(error => {
        // Keep server mode intact: a menu-assignment read error is handled in the UI,
        // it does not mean the backend disappeared.
        if (current && isServerUnreachable(error)) setServerMode(false);
      });
    return () => { current = false; };
  }, [serverMode, selectedMenuRestaurantId, menuReloadKey]);

  const refreshAuditLog = () => {
    if (!serverMode) return;
    settingsApi.getAuditLog()
      .then(({ data }) => setAuditLogs(normalizeServerLogs(data)))
      .catch(error => { if (isServerUnreachable(error)) setServerMode(false); });
  };

  useEffect(() => { if (serverMode) refreshAuditLog(); }, [serverMode]);

  const handleSaveRestaurant = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      setRestaurantError('Only administrators can manage stores.');
      return;
    }

    setRestaurantSaving(true);
    setRestaurantError('');
    setRestaurantNotice('');
    const payload = {
      ...restaurantForm,
      tax_rate: Number(restaurantForm.tax_rate),
      seating_capacity: Number(restaurantForm.seating_capacity) || 0,
    };

    try {
      const { data } = editingResId
        ? await restaurantApi.update(editingResId, payload)
        : await restaurantApi.create(payload);
      const savedStore = {
        ...data,
        business_type: data.business_type || payload.business_type,
      };
      const updatedRestaurants = editingResId
        ? restaurants.map(store => Number(store.id) === Number(savedStore.id) ? savedStore : store)
        : [...restaurants, savedStore].sort((a, b) => a.name.localeCompare(b.name));
      setRestaurants(updatedRestaurants);
      localStorage.setItem('pos_restaurants', JSON.stringify(updatedRestaurants));

      const updatedUser = {
        ...user,
        restaurants: editingResId
          ? (user.restaurants || []).map(store => Number(store.id) === Number(savedStore.id) ? savedStore : store)
          : [...(user.restaurants || []), savedStore],
      };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));

      if (!editingResId || Number(activeRestaurant?.id) === Number(savedStore.id)) {
        setActiveRestaurant(savedStore);
        localStorage.setItem('active_restaurant', JSON.stringify(savedStore));
      }
      setEditingResId(null);
      setRestaurantForm(blankRestaurant);
      setRestaurantNotice(
        `${savedStore.business_type === 'supermarket' ? 'Supermarket store' : 'Restaurant branch'} ${editingResId ? 'updated' : 'created'} successfully.`
      );
    } catch (error) {
      setRestaurantError(restaurantErrorMessage(error));
    } finally {
      setRestaurantSaving(false);
    }
  };

  const deleteRestaurant = async (store) => {
    if (restaurants.length <= 1) {
      setRestaurantError('At least one store must remain.');
      return;
    }
    const storeType = store.business_type === 'supermarket' ? 'supermarket store' : 'restaurant branch';
    if (!window.confirm(`Permanently delete "${store.name}" (${storeType})? This also deletes its associated orders, inventory, tables, and activity records.`)) {
      return;
    }

    setRestaurantError('');
    setRestaurantNotice('');
    try {
      await restaurantApi.delete(store.id);
      const filtered = restaurants.filter(existing => Number(existing.id) !== Number(store.id));
      setRestaurants(filtered);
      localStorage.setItem('pos_restaurants', JSON.stringify(filtered));
      setAllTables(previous => previous.filter(table => Number(table.restaurant_id) !== Number(store.id)));
      const updatedUser = {
        ...user,
        restaurants: (user.restaurants || []).filter(existing => Number(existing.id) !== Number(store.id)),
      };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));

      if (Number(activeRestaurant?.id) === Number(store.id)) {
        setActiveRestaurant(filtered[0] || null);
        if (filtered[0]) localStorage.setItem('active_restaurant', JSON.stringify(filtered[0]));
        else localStorage.removeItem('active_restaurant');
      }
      if (Number(selectedMenuRestaurantId) === Number(store.id)) {
        const nextStoreId = filtered[0]?.id || '';
        setSelectedMenuRestaurantId(nextStoreId);
        localStorage.setItem('pos_settings_menu_restaurant_id', String(nextStoreId));
      }
      setRestaurantNotice(`${storeType} deleted.`);
    } catch (error) {
      setRestaurantError(restaurantErrorMessage(error));
    }
  };

  const handleAddTable = (e) => {
    e.preventDefault();
    const newTable = {
      id: Date.now(),
      ...tableForm,
      restaurant_id: activeRestaurant?.id || 1,
      status: 'available'
    };
    setAllTables([...allTables, newTable]);
    setTableForm({ table_name: '', capacity: 4 });
  };

  const deleteTable = (id) => {
    if (window.confirm('Delete this table?')) {
      setAllTables(allTables.filter(t => t.id !== id));
    }
  };

  const toggleTableStatus = (id) => {
    setAllTables(allTables.map(t => 
      t.id === id ? { ...t, status: t.status === 'available' ? 'occupied' : 'available' } : t
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">Central administration</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">System Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Manage restaurant operations and access from one place.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">
            <span className="font-semibold text-slate-500">Active store</span>
            <span className="ml-2 font-bold text-slate-900">{activeRestaurant?.name || 'No outlet selected'}</span>
          </div>
          <button type="button" onClick={saveSettings} disabled={settingsSaving} className="btn btn-primary text-sm disabled:opacity-60">{settingsSaving ? 'Saving…' : 'Save settings'}</button>
          <button type="button" onClick={exportSettings} className="btn btn-secondary text-sm">Export JSON</button>
        </div>
      </div>
      {serverMode === null ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Checking the settings server…</div>
      ) : serverMode ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Security policy, menu assignment, user roles, and the audit log are saved on the server.
          {settingsSaved && <span className="ml-2 font-bold text-emerald-700" role="status">Saved.</span>}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            No settings server detected — this is the browser demo mode, so settings are saved in this browser only.
            {settingsSaved && <span className="ml-2 font-bold text-emerald-700" role="status">Saved in this browser.</span>}
          </span>
          <button
            type="button"
            onClick={() => { setServerMode(null); setProbeKey(key => key + 1); }}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100"
          >
            Reconnect to server
          </button>
        </div>
      )}
      {settingsNotice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{settingsNotice}</div>}
      {settingsError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{settingsError}</div>}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {[
          { id: 'restaurant', label: 'Branches' },
          { id: 'tables', label: 'Tables' },
          { id: 'menu', label: 'Menu Assignment' },
          { id: 'security', label: 'Security & Audit' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
              activeTab === tab.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Restaurant Settings */}
      {activeTab === 'restaurant' && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="card !bg-blue-50 !border-l-4 !border-l-blue-500">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div>
                <h3 className="font-bold text-blue-900 mb-1">Multi-Store Management</h3>
                <p className="text-sm text-blue-700">
                  You can access <strong>{visibleRestaurants.length}</strong> store(s), including restaurant branches and supermarkets.
                  {isAdmin ? ' Add each supermarket location here, then switch the active store to manage its POS catalog.' : ' Contact an administrator to request access to another store.'}
                </p>
              </div>
            </div>
          </div>

          {restaurantError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{restaurantError}</div>}
          {restaurantNotice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{restaurantNotice}</div>}
          {restaurantsLoading && <div role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Loading stores…</div>}

          {isAdmin && (
          <div className="card !border-t-4 !border-t-emerald-600 shadow-sm">
            <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">Store directory</p>
            <h2 className="mb-6 text-xl font-extrabold text-slate-900">{editingResId ? 'Edit Store or Branch' : 'Add a Store or Branch'}</h2>
              <form onSubmit={handleSaveRestaurant} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-700">Store / Branch Name</label>
                    <input
                      type="text"
                      value={restaurantForm.name}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, name: e.target.value })}
                      className="input"
                      required
                      maxLength="255"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-700">Store Type</label>
                    <select
                      value={restaurantForm.business_type || 'restaurant'}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, business_type: e.target.value })}
                      className="input"
                    >
                      <option value="restaurant">Restaurant branch</option>
                      <option value="supermarket">Supermarket store</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-700">Business Email</label>
                    <input
                      type="email"
                      value={restaurantForm.email}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, email: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Address</label>
                  <textarea
                    value={restaurantForm.address}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, address: e.target.value })}
                    className="input"
                    rows="2"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-700">Phone</label>
                    <input
                      type="text"
                      value={restaurantForm.phone}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, phone: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-700">Currency</label>
                    <select
                      value={restaurantForm.currency}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, currency: e.target.value })}
                      className="input"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="INR">INR (₹)</option>
                      <option value="AED">AED (د.إ)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="JPY">JPY (¥)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-700">Tax (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={restaurantForm.tax_rate}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, tax_rate: e.target.value })}
                      className="input"
                      required
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Website (Optional)</label>
                    <input
                      type="url"
                      value={restaurantForm.website}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, website: e.target.value })}
                      className="input"
                      placeholder="https://example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Manager Name (Optional)</label>
                    <input
                      type="text"
                      value={restaurantForm.manager_name}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, manager_name: e.target.value })}
                      className="input"
                      placeholder="Manager's full name"
                    />
                  </div>
                </div>

                <div className={`grid grid-cols-1 gap-4 ${restaurantForm.business_type === 'restaurant' ? 'md:grid-cols-2' : ''}`}>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Operating Hours (Optional)</label>
                    <input
                      type="text"
                      value={restaurantForm.operating_hours}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, operating_hours: e.target.value })}
                      className="input"
                      placeholder="e.g., Mon-Fri 9AM-10PM"
                    />
                  </div>
                  {restaurantForm.business_type === 'restaurant' && <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Seating Capacity (Optional)</label>
                    <input
                      type="number"
                      value={restaurantForm.seating_capacity}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, seating_capacity: parseInt(e.target.value) || 0 })}
                      className="input"
                      placeholder="Total seats"
                      min="0"
                    />
                  </div>}
                </div>

                <div className="flex gap-4">
                  <button type="submit" disabled={restaurantSaving} className="btn btn-primary flex-1 py-3 disabled:opacity-60">
                    {restaurantSaving ? 'Saving…' : editingResId ? 'Save Store Changes' : 'Add Store'}
                  </button>
                  {editingResId && (
                    <button type="button" onClick={() => {
                      setEditingResId(null);
                      setRestaurantForm(blankRestaurant);
                    }} className="btn bg-gray-200 px-8">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Restaurant List with CRUD */}
          <div className="card border border-slate-200 shadow-sm">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">All locations</p>
                <h2 className="mt-1 text-xl font-extrabold text-slate-900">Stores & Branches</h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm font-semibold text-slate-600">{visibleRestaurants.length} location(s)</div>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setEditingResId(null);
                      setRestaurantError('');
                      setRestaurantNotice('');
                      setRestaurantForm(blankRestaurant);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="btn btn-primary px-4 py-2 text-sm"
                  >
                    + Add Store
                  </button>
                )}
              </div>
            </div>
            {!restaurantsLoading && visibleRestaurants.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm font-medium text-slate-500">
                No locations found. Add your first supermarket store or restaurant branch.
              </p>
            ) : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleRestaurants.map(res => (
                <div key={res.id} className={`p-5 rounded-xl border-2 transition-all ${
                  Number(activeRestaurant?.id) === Number(res.id) ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-extrabold text-slate-900">{res.name}</h3>
                        {Number(activeRestaurant?.id) === Number(res.id) && (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">Active</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">ID: {res.id}</span>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${res.business_type === 'supermarket' ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'}`}>
                          {res.business_type === 'supermarket' ? 'Supermarket' : 'Restaurant'}
                        </span>
                      </div>
                    </div>
                    {isAdmin && <div className="flex gap-1">
                      <button 
                        onClick={() => {
                          setEditingResId(res.id);
                          setRestaurantError('');
                          setRestaurantNotice('');
                          setRestaurantForm({
                            ...blankRestaurant,
                            ...res,
                            address: res.address || '',
                            phone: res.phone || '',
                            email: res.email || '',
                            website: res.website || '',
                            manager_name: res.manager_name || '',
                            operating_hours: res.operating_hours || '',
                          });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="rounded-lg p-2 text-emerald-700 transition hover:bg-emerald-100"
                        title="Edit store"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                      </button>
                      <button 
                        onClick={() => deleteRestaurant(res)}
                        className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 hover:text-red-800"
                        title="Permanently delete store and its associated records"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </div>}
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                      <span className="text-gray-600">{res.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                      <span className="text-gray-500">{res.address}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      <span className="text-gray-600 font-semibold">{res.currency}</span>
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-600">Tax: {res.tax_rate}%</span>
                    </div>
                    {res.manager_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        <span className="text-gray-600">Manager: {res.manager_name}</span>
                      </div>
                    )}
                    {res.business_type === 'restaurant' && res.seating_capacity > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        <span className="text-gray-600">Capacity: {res.seating_capacity} seats</span>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => switchRestaurant(res)}
                    disabled={Number(activeRestaurant?.id) === Number(res.id)}
                    className={`w-full rounded-lg py-2.5 text-sm font-bold transition ${
                      Number(activeRestaurant?.id) === Number(res.id)
                        ? 'cursor-default bg-emerald-600 text-white'
                        : 'bg-slate-900 text-white hover:bg-slate-700'
                    }`}
                  >
                    {Number(activeRestaurant?.id) === Number(res.id) ? '✓ Currently Active' : `Switch to ${res.business_type === 'supermarket' ? 'this Store' : 'this Branch'}`}
                  </button>
                </div>
              ))}
            </div>}
          </div>
        </div>
      )}

      {activeTab === 'menu' && (
        <section className="space-y-5">
          <div className="card">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">Outlet menu visibility</p>
                <h2 className="mt-1 text-xl font-extrabold text-slate-900">Menu Assignment</h2>
                <p className="mt-1 text-sm text-slate-500">Choose which existing menu items are assigned to an outlet.</p>
              </div>
              <label className="w-full max-w-sm text-sm font-bold text-slate-700">
                Restaurant
                <select
                  value={selectedMenuRestaurantId || restaurants[0]?.id || ''}
                  onChange={(event) => {
                    setSelectedMenuRestaurantId(event.target.value);
                    localStorage.setItem('pos_settings_menu_restaurant_id', event.target.value);
                  }}
                  className="input mt-1"
                >
                  {restaurants.map(restaurant => (
                    <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {restaurants.length === 0 ? (
            <div className="card text-sm text-slate-500">Add a restaurant before assigning menu items.</div>
          ) : menuItems.length === 0 ? (
            <div className="card text-sm text-slate-500">No menu items exist for this outlet yet. Add items in Menu &amp; Items first.</div>
          ) : (
            <div className="card overflow-x-auto">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">{serverMode ? 'Tick the items this outlet should sell, then save the assignment to the server.' : 'Demo mode: assignments are kept in this browser until a server is reachable.'}</p>
                {serverMode && (
                  <button type="button" onClick={saveMenuAssignment} disabled={settingsSaving} className="btn btn-primary text-sm disabled:opacity-60">
                    {settingsSaving ? 'Saving…' : 'Save assignment'}
                  </button>
                )}
              </div>
              <table className="table min-w-[620px]">
                <thead>
                  <tr><th>Item</th><th>Category</th><th>Price</th><th className="text-center">Available at outlet</th></tr>
                </thead>
                <tbody>
                  {menuItems.map(item => {
                    const assignedIds = Array.isArray(item.restaurant_ids)
                      ? item.restaurant_ids.map(String)
                      : [String(item.restaurant_id || 1)];
                    const isAssigned = serverMode
                      ? assignedItemIds.map(String).includes(String(item.id))
                      : assignedIds.includes(String(selectedMenuRestaurantId || restaurants[0]?.id));
                    return (
                      <tr key={item.id}>
                        <td className="font-bold text-slate-800">{item.name}</td>
                        <td>{item.category_name || '—'}</td>
                        <td>{item.price}</td>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => toggleMenuAssignment(item.id)}
                            aria-label={`${item.name} available at ${restaurants.find(restaurant => String(restaurant.id) === String(selectedMenuRestaurantId || restaurants[0]?.id))?.name}`}
                            className="h-5 w-5 accent-emerald-600"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'security' && (
        <section className="space-y-5">
          <div className={`card !border-l-4 ${serverMode ? '!border-l-emerald-500' : '!border-l-amber-400'}`}>
            <p className={`text-xs font-extrabold uppercase tracking-wide ${serverMode ? 'text-emerald-700' : 'text-amber-700'}`}>{serverMode ? 'Server policy' : 'Demo policy only'}</p>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900">Security & Audit</h2>
            <p className="mt-2 text-sm text-slate-600">{serverMode ? 'This policy is stored on the server and recorded in the audit log when saved.' : 'These example policies are saved in this browser only; they do not change authentication, session expiry, or MFA enforcement.'}</p>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm font-bold text-slate-700">
                Session timeout (minutes)
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={securityPolicy.sessionTimeoutMinutes}
                  onChange={(event) => {
                    setSecurityPolicy(previous => ({ ...previous, sessionTimeoutMinutes: Number(event.target.value) }));
                    setSettingsSaved(false);
                  }}
                  className="input mt-1"
                />
              </label>
              <label className="text-sm font-bold text-slate-700">
                Maximum failed login attempts
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={securityPolicy.maxFailedLogins}
                  onChange={(event) => {
                    setSecurityPolicy(previous => ({ ...previous, maxFailedLogins: Number(event.target.value) }));
                    setSettingsSaved(false);
                  }}
                  className="input mt-1"
                />
              </label>
              <label className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={securityPolicy.requireStrongPasswords}
                  onChange={(event) => {
                    setSecurityPolicy(previous => ({ ...previous, requireStrongPasswords: event.target.checked }));
                    setSettingsSaved(false);
                  }}
                  className="h-5 w-5 accent-emerald-600"
                />
                Require strong passwords (example policy)
              </label>
              <label className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={securityPolicy.requireMfaForAdmins}
                  onChange={(event) => {
                    setSecurityPolicy(previous => ({ ...previous, requireMfaForAdmins: event.target.checked }));
                    setSettingsSaved(false);
                  }}
                  className="h-5 w-5 accent-emerald-600"
                />
                Require MFA for admins (example policy)
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {serverMode && (
                <button
                  type="button"
                  onClick={saveSecurityPolicy}
                  disabled={settingsSaving}
                  className="btn btn-primary text-sm disabled:opacity-60"
                >
                  {settingsSaving ? 'Saving…' : 'Save policy on server'}
                </button>
              )}
              {!serverMode && (
                <button
                  type="button"
                  onClick={() => {
                    setAuditLogs(logs => [{
                      id: Date.now(),
                      timestamp: new Date().toISOString(),
                      username: user?.username || 'Admin',
                      action: 'Reviewed demo security policy',
                      details: 'Opened Security & Audit settings',
                    }, ...logs].slice(0, 200));
                  }}
                  className="btn btn-secondary text-sm"
                >
                  Record policy review
                </button>
              )}
            </div>
          </div>
          <div className="card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Settings activity log</h3>
                <p className="text-sm text-slate-500">{serverMode ? 'Recorded by the server — the same log is visible from every browser.' : 'Recent changes recorded by this demo in this browser.'}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAuditLogs([]);
                  setSettingsSaved(false);
                }}
                disabled={!auditLogs.length || serverMode}
                title={serverMode ? 'The audit log is server-recorded and cannot be cleared here' : undefined}
                className="btn btn-secondary text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear log
              </button>
            </div>
            {auditLogs.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No settings activity recorded yet.</p>
            ) : (
              <div className="table-container">
                <table className="table min-w-[600px]">
                  <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
                  <tbody>
                    {auditLogs.map(log => (
                      <tr key={log.id}>
                        <td>{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="font-bold">{log.username}</td>
                        <td>{log.action}</td>
                        <td>{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tables Management */}
      {activeTab === 'tables' && (
        <div className="space-y-6">
          <div className="card shadow-lg border-l-4 border-primary-500">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Add New Dining Table</h2>
            <form onSubmit={handleAddTable} className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Table Name</label>
                <input
                  type="text"
                  value={tableForm.table_name}
                  onChange={(e) => setTableForm({ ...tableForm, table_name: e.target.value })}
                  placeholder="e.g. Window 1"
                  className="input"
                  required
                />
              </div>
              <div className="w-32">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Capacity</label>
                <input
                  type="number"
                  value={tableForm.capacity}
                  onChange={(e) => setTableForm({ ...tableForm, capacity: parseInt(e.target.value) })}
                  className="input"
                  min="1"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary px-8">
                Add Table
              </button>
            </form>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {tables.map((table) => (
              <div
                key={table.id}
                className={`relative group p-6 rounded-2xl text-center border-2 transition-all ${
                  table.status === 'occupied'
                    ? 'border-yellow-400 bg-yellow-50 shadow-inner'
                    : 'border-gray-200 bg-white shadow-sm hover:shadow-md'
                }`}
              >
                <button 
                  onClick={() => deleteTable(table.id)}
                  className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>

                <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${
                  table.status === 'occupied' ? 'bg-yellow-200 text-yellow-700' : 'bg-green-100 text-green-700'
                }`}>
                  <span className="font-bold text-lg">{table.table_name.match(/\d+/)?.[0] || 'T'}</span>
                </div>

                <p className="font-bold text-gray-800 text-lg mb-1">{table.table_name}</p>
                <p className="text-gray-500 text-sm mb-3 font-medium">Capacity: {table.capacity}</p>
                
                <button
                  onClick={() => toggleTableStatus(table.id)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold uppercase transition-colors ${
                    table.status === 'occupied' 
                      ? 'bg-green-600 text-white hover:bg-green-700' 
                      : 'bg-yellow-500 text-white hover:bg-yellow-600'
                  }`}
                >
                  {table.status === 'occupied' ? 'Free Table' : 'Mark Occupied'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Directory-style user permissions */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="card !border-l-4 !border-l-primary-500">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary-600 mb-1">Privilege Management</p>
                <h2 className="text-2xl font-bold text-gray-800">User Access Permissions</h2>
                <p className="text-gray-500 mt-1">{serverMode ? 'Role and outlet assignment save to the server automatically; action overrides remain a local matrix.' : 'Demo mode: role assignment, outlet assignment, and action overrides are stored in this browser.'}</p>
              </div>
              <div className="w-full lg:w-80">
                <label className="block text-sm font-bold text-gray-700 mb-1">Select user</label>
                <select
                  value={selectedAccessUserId}
                  onChange={(event) => { setSelectedAccessUserId(event.target.value); setAccessSaved(false); }}
                  className="input"
                >
                  {accessUsers.map(accessUser => (
                    <option key={accessUser.id} value={accessUser.id}>{accessUser.username} ({accessUser.role_name})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {selectedAccessUser && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card bg-gray-900 text-white">
                  <p className="text-xs uppercase tracking-wider text-gray-400">Account</p>
                  <p className="text-xl font-bold mt-1">{selectedAccessUser.username}</p>
                  <p className="text-sm text-gray-400 mt-1">{selectedAccessUser.email}</p>
                </div>
                <div className="card bg-blue-50 border-blue-100">
                  <p className="text-xs uppercase tracking-wider text-blue-600">Inherited role</p>
                  <p className="text-xl font-bold text-blue-900 mt-1">{selectedAccessRole?.name || selectedAccessUser.role_name}</p>
                  <p className="text-sm text-blue-700 mt-1">Role defaults remain visible below.</p>
                </div>
                <div className="card bg-green-50 border-green-100">
                  <p className="text-xs uppercase tracking-wider text-green-700">Prototype mode</p>
                  <p className="text-xl font-bold text-green-900 mt-1">Local demo access</p>
                  <p className="text-sm text-green-700 mt-1">Settings here do not authorize server requests.</p>
                </div>
              </div>

              <div className="card">
                <h3 className="mb-1 text-lg font-extrabold text-slate-900">User assignment</h3>
                <p className="mb-4 text-sm text-slate-500">Choose a demo role and the outlets this user can access in the prototype.</p>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <label className="text-sm font-bold text-slate-700">
                    Role
                    <select
                      value={selectedAccessUser.role_id || ''}
                      onChange={(event) => updateSelectedUser({ role_id: event.target.value })}
                      className="input mt-1"
                    >
                      <option value="">Select role</option>
                      {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                    {serverMode && <p className="mt-1 text-xs font-semibold text-emerald-700">Role changes save on the server automatically.</p>}
                  </label>
                  <fieldset>
                    <legend className="mb-2 text-sm font-bold text-slate-700">Assigned restaurants</legend>
                    <div className="space-y-2">
                      {restaurants.map(restaurant => {
                        const assignedIds = selectedAccessUser.restaurants?.map(item => String(item.id))
                          || (selectedAccessUser.restaurant_id ? [String(selectedAccessUser.restaurant_id)] : []);
                        const isAssigned = assignedIds.includes(String(restaurant.id));
                        return (
                          <label key={restaurant.id} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={(event) => {
                                const nextIds = event.target.checked
                                  ? [...new Set([...assignedIds, String(restaurant.id)])]
                                  : assignedIds.filter(id => id !== String(restaurant.id));
                                updateSelectedUser({ restaurant_ids: nextIds });
                              }}
                              className="h-4 w-4 accent-emerald-600"
                            />
                            {restaurant.name}
                          </label>
                        );
                      })}
                      {restaurants.length === 0 && <p className="text-sm text-slate-500">Create a restaurant first.</p>}
                    </div>
                  </fieldset>
                </div>
              </div>

              <div className="card p-0 overflow-hidden">
                <div className="p-5 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Permission options</h3>
                    <p className="text-sm text-gray-500">Action overrides are a browser-side matrix; the server enforces the assigned role's permissions.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setUserPermissions(previous => ({
                        ...previous,
                        [selectedAccessUser.id]: permissionGroups.reduce((permissions, group) => {
                          permissions[group.key] = permissionActions.reduce((actions, action) => ({ ...actions, [action]: true }), {});
                          return permissions;
                        }, {}),
                      }))}
                      className="btn btn-secondary text-sm"
                    >Grant all
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserPermissions(previous => ({ ...previous, [selectedAccessUser.id]: emptyUserPermissions() }))}
                      className="btn btn-secondary text-sm"
                    >Revoke all
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="table min-w-[760px]">
                    <thead>
                      <tr>
                        <th className="w-[32%]">Directory group</th>
                        {permissionActions.map(action => <th key={action} className="text-center whitespace-nowrap">{action}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {permissionGroups.map(group => (
                        <tr key={group.key}>
                          <td>
                            <p className="font-bold text-gray-800">{group.label}</p>
                            <p className="text-xs text-gray-500 mt-1">{group.description}</p>
                          </td>
                          {permissionActions.map(action => {
                            const checked = selectedPermissions[group.key]?.[action] === true;
                            return (
                              <td key={action} className="text-center">
                                <button
                                  type="button"
                                  aria-pressed={checked}
                                  onClick={() => toggleUserPermission(group.key, action)}
                                  className={`w-10 h-10 rounded-lg border-2 font-bold transition-colors ${checked ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-300 hover:border-primary-300 hover:text-primary-500'}`}
                                  title={`${checked ? 'Remove' : 'Grant'} ${action} access to ${group.label}`}
                                >
                                  {checked ? '✓' : '−'}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className={`text-sm font-semibold ${accessSaved ? 'text-green-700' : 'text-gray-500'}`}>
                    {accessSaved ? (serverMode ? 'Permissions saved on the server.' : 'Permissions saved in this browser.') : 'Unsaved permission changes'}
                  </p>
                  <button type="button" onClick={saveUserPermissions} className="btn btn-primary">{serverMode ? 'Save permissions' : 'Save demo permissions'}</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}