import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import storageEngine from '../services/storageEngine';
import { authApi } from '../api';

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', permission: null },
  { path: '/supermarket-pos', label: 'Supermarket POS', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z', permission: 'POS', highlight: true },
  { path: '/pos', label: 'Restaurant POS', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', permission: 'POS' },
  { path: '/mobile-pos', label: 'Mobile POS', icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z', permission: 'POS' },
  { path: '/kds', label: 'Kitchen (KDS)', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2', permission: null },
  { path: '/qr-menu', label: 'QR Ordering', icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z', permission: null },
  { path: '/orders', label: 'Orders History', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', permission: null },
  { path: '/inventory', label: 'Inventory & Expiry', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', permission: 'Inventory' },
  { path: '/menu', label: 'Menu & Items', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', permission: 'Inventory' },
  { path: '/storage', label: 'Storage & Cloud', icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z', permission: null, highlight: true },
  { path: '/reports', label: 'Reports', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', permission: 'Reports' },
  { path: '/crm', label: 'CRM & Loyalty', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', permission: null },
  { path: '/hrms', label: 'HRMS', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', permission: null },
  { path: '/users', label: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', permission: 'UserMgmt' },
  { path: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', permission: null },
];

export default function Layout() {
  const { user, activeRestaurant, switchRestaurant, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Mobile POS opens as a slide-over drawer instead of a full page.
  const [mobilePosMounted, setMobilePosMounted] = useState(false);
  const [mobilePosOpen, setMobilePosOpen] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirmation: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Live Storage & Cloud Sync stats
  const [syncStats, setSyncStats] = useState(() => storageEngine.getStorageStats());
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsub = storageEngine.subscribe(() => {
      setSyncStats(storageEngine.getStorageStats());
    });
    return unsub;
  }, []);

  const openMobilePos = () => {
    setMobilePosMounted(true);
    // Double rAF: the panel must paint off-screen first, then slide to translate-x-0.
    requestAnimationFrame(() => requestAnimationFrame(() => setMobilePosOpen(true)));
  };

  const closeMobilePos = () => setMobilePosOpen(false);

  useEffect(() => {
    if (!mobilePosOpen) return;
    const onKey = event => { if (event.key === 'Escape') setMobilePosOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobilePosOpen]);

  const routerBase = import.meta.env.VITE_ROUTER_BASE || '/';
  const mobilePosSrc = `${routerBase === '/' ? '' : routerBase}/mobile-pos?chromeless=1`;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handlePasswordChange = async event => {
    event.preventDefault();
    setPasswordError('');
    if (passwordForm.new_password !== passwordForm.confirmation) {
      setPasswordError('The new passwords do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      const result = await authApi.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      await logout();
      navigate('/login', {
        replace: true,
        state: { notice: result.data.audit_warning || result.data.message },
      });
    } catch (error) {
      setPasswordError(error.response?.data?.error || 'Unable to change password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleQuickSync = async () => {
    setIsSyncing(true);
    await storageEngine.triggerSync();
    setIsSyncing(false);
  };

  const filteredMenuItems = menuItems.filter(item => 
    item.permission === null || hasPermission(item.permission)
  );

  const isSupermarketActive = location.pathname === '/supermarket-pos';
  const isRestaurantActive = location.pathname === '/pos';

  // Chromeless mode: rendered inside the Mobile POS drawer iframe (no sidebar/header).
  if (new URLSearchParams(location.search).get('chromeless') === '1') {
    return (
      <main className="app-main h-screen flex-1 overflow-auto bg-slate-100">
        <Outlet />
      </main>
    );
  }

  return (
    <div className="app-shell flex h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} flex flex-col border-r border-slate-800 bg-slate-900 text-white transition-all duration-300`}>
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className={`${!sidebarOpen && 'hidden'}`}>
            <h1 className="flex items-center gap-1.5 text-lg font-extrabold tracking-wide text-white">
              <span className="text-emerald-400">⚡</span> SIVARA POS
            </h1>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Supermarket & Dining</p>
          </div>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? 'M11 19l-7-7 7-7m8 14l-7-7 7-7' : 'M13 5l7 7-7 7M5 5l7 7-7 7'} />
            </svg>
          </button>
        </div>
        
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {filteredMenuItems.map(item => item.path === '/mobile-pos' ? (
            <button
              key={item.path}
              type="button"
              onClick={openMobilePos}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all ${
                mobilePosOpen
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ) : (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950/30'
                    : item.highlight
                    ? 'text-emerald-400 hover:bg-slate-800'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer with Storage Mode Indicator */}
        {sidebarOpen && (
          <div className="border-t border-slate-800 bg-slate-950/50 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Storage Engine:</span>
              <span className="text-emerald-400 font-bold uppercase text-[10px]">
                {syncStats.mode === 'hybrid' ? '⚡ Hybrid' : syncStats.mode === 'local' ? '💾 Local Only' : '☁️ Cloud'}
              </span>
            </div>
            {syncStats.pendingSyncCount > 0 && (
              <p className="text-amber-400 text-[10px] mt-1 font-semibold">
                ⚠️ {syncStats.pendingSyncCount} offline orders queued
              </p>
            )}
          </div>
        )}
      </aside>

      {/* Page Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">{activeRestaurant?.name || 'SIVARA Group'}</h2>
              <p className="text-[11px] font-semibold text-slate-500">{activeRestaurant?.currency || 'USD'} • Enterprise POS v2.0</p>
            </div>

            {/* Quick Dual-Mode Switcher */}
            <div className="hidden items-center rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-bold md:flex">
              <button
                onClick={() => navigate('/supermarket-pos')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  isSupermarketActive
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>🛒</span> Supermarket Mode
              </button>
              <button
                onClick={() => navigate('/pos')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  isRestaurantActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🍽️</span> Restaurant Mode
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Live Cloud/Local Sync Pill */}
            <div
              onClick={() => navigate('/storage')}
              className={`cursor-pointer px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all ${
                syncStats.pendingSyncCount > 0
                  ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                  : syncStats.mode === 'local'
                  ? 'bg-purple-50 border-purple-300 text-purple-800 hover:bg-purple-100'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
              }`}
              title="Click to manage Cloud & Local Storage"
            >
              <span className={`w-2.5 h-2.5 rounded-full ${
                syncStats.pendingSyncCount > 0 ? 'bg-amber-500 animate-pulse' : syncStats.mode === 'local' ? 'bg-purple-500' : 'bg-emerald-500'
              }`} />
              <span>
                {syncStats.pendingSyncCount > 0
                  ? `Offline Queue (${syncStats.pendingSyncCount})`
                  : syncStats.mode === 'local'
                  ? 'Local Storage (Air-Gapped)'
                  : 'Cloud Synced'}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleQuickSync(); }}
                className="text-[10px] p-0.5 hover:scale-110 transition-transform"
                title="Trigger immediate sync"
              >
                <span className={isSyncing ? 'animate-spin inline-block' : ''}>🔄</span>
              </button>
            </div>

            {/* User Profile */}
            <div className="text-right">
              <p className="text-xs font-extrabold text-slate-800">{user?.username || 'Admin'}</p>
              <p className="text-[10px] font-semibold text-slate-500">{user?.role_name || 'Administrator'}</p>
            </div>

            <button
              type="button"
              onClick={() => { setPasswordError(''); setPasswordForm({ current_password: '', new_password: '', confirmation: '' }); setShowPasswordForm(true); }}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50"
            >
              Password
            </button>
            <button
              onClick={handleLogout}
              className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-200"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="app-main flex-1 overflow-auto p-4 sm:p-5">
          <Outlet />
        </main>
      </div>
      {showPasswordForm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handlePasswordChange} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900">Change your password</h2>
            <p className="mb-5 mt-1 text-sm text-slate-500">Changing it revokes your active sessions and signs you out.</p>
            {passwordError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{passwordError}</p>}
            {[
              ['current_password', 'Current password', 'current-password'],
              ['new_password', 'New password', 'new-password'],
              ['confirmation', 'Confirm new password', 'new-password'],
            ].map(([field, label, autoComplete]) => (
              <label key={field} className="mb-4 block text-sm font-semibold text-slate-700">
                {label}
                <input
                  type="password"
                  autoComplete={autoComplete}
                  minLength={field === 'current_password' ? undefined : 12}
                  maxLength={128}
                  required
                  value={passwordForm[field]}
                  onChange={event => setPasswordForm(previous => ({ ...previous, [field]: event.target.value }))}
                  className="input mt-1"
                />
              </label>
            ))}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowPasswordForm(false)} className="btn border border-gray-300 bg-white text-gray-700">Cancel</button>
              <button type="submit" disabled={passwordSaving} className="btn btn-primary">{passwordSaving ? 'Updating…' : 'Change password'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Mobile POS slide-in drawer */}
      {mobilePosMounted && (
        <div className={`fixed inset-0 z-[80] ${mobilePosOpen ? '' : 'pointer-events-none'}`} role="dialog" aria-label="Mobile POS">
          <div
            onClick={closeMobilePos}
            className={`absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-300 ${mobilePosOpen ? 'opacity-100' : 'opacity-0'}`}
          />
          <div className={`absolute right-0 top-0 flex h-full w-full max-w-[440px] flex-col bg-slate-100 shadow-2xl transition-transform duration-300 ease-out ${mobilePosOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5 text-white">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-sm font-black">S</div>
                <div>
                  <p className="text-xs font-extrabold leading-tight tracking-wide">MOBILE POS</p>
                  <p className="text-[9px] font-semibold text-emerald-300">Slide-over terminal</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeMobilePos}
                aria-label="Close Mobile POS"
                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-200 transition hover:bg-slate-700 hover:text-white"
              >✕ Close</button>
            </div>
            <iframe title="Mobile POS Terminal" src={mobilePosSrc} className="min-h-0 w-full flex-1 border-0 bg-slate-100" />
          </div>
        </div>
      )}
    </div>
  );
}
