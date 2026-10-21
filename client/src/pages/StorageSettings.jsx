import { useState, useEffect } from 'react';
import storageEngine, { DEFAULT_ITEMS, DEFAULT_CATEGORIES } from '../services/storageEngine';

export default function StorageSettings() {
  const [mode, setMode] = useState(() => storageEngine.getStorageMode());
  const [businessMode, setBusinessMode] = useState(() => storageEngine.getBusinessMode());
  const [cloudUrl, setCloudUrl] = useState(() => storageEngine.getCloudUrl());
  const [stats, setStats] = useState(() => storageEngine.getStorageStats());
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [pingLatency, setPingLatency] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);

  useEffect(() => {
    const unsub = storageEngine.subscribe(() => {
      setStats(storageEngine.getStorageStats());
    });
    return unsub;
  }, []);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    storageEngine.setStorageMode(newMode);
  };

  const handleBusinessModeChange = (newBusMode) => {
    setBusinessMode(newBusMode);
    storageEngine.setBusinessMode(newBusMode);
  };

  const handleSaveCloudUrl = (e) => {
    e.preventDefault();
    storageEngine.setCloudUrl(cloudUrl);
    alert('Cloud Server URL updated successfully!');
  };

  const handleTestConnection = async () => {
    setPingLatency('Testing...');
    const startTime = performance.now();
    try {
      const res = await fetch(`${cloudUrl}/health`, { method: 'GET' });
      const latency = Math.round(performance.now() - startTime);
      if (res.ok) {
        setPingLatency(`Connected! Latency: ${latency}ms`);
      } else {
        setPingLatency(`Server reachable (HTTP ${res.status}) in ${latency}ms`);
      }
    } catch (err) {
      setPingLatency(`Failed: Server unreachable (${err.message})`);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg('Synchronizing data with Cloud...');
    try {
      const result = await storageEngine.triggerSync();
      setSyncStatusMsg(result.message || 'Sync completed successfully!');
      setStats(storageEngine.getStorageStats());
    } catch (err) {
      setSyncStatusMsg(`Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(''), 5000);
    }
  };

  const handleExportBackup = () => {
    storageEngine.exportFullBackup();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          setRestoreFile(parsed);
        } catch (err) {
          alert('Invalid JSON file format!');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleConfirmRestore = () => {
    if (!restoreFile) return;
    if (window.confirm('Restore system from this backup? Current local data will be replaced.')) {
      const result = storageEngine.importFullBackup(restoreFile);
      if (result.success) {
        alert('Database restored successfully from backup!');
        setStats(storageEngine.getStorageStats());
        setRestoreFile(null);
      } else {
        alert(`Restore error: ${result.error}`);
      }
    }
  };

  const handleResetCatalog = () => {
    if (window.confirm('Reset both Restaurant & Supermarket items to factory defaults?')) {
      storageEngine.saveCategories(DEFAULT_CATEGORIES);
      storageEngine.saveItems(DEFAULT_ITEMS);
      setStats(storageEngine.getStorageStats());
      alert('Factory product catalog restored successfully!');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Title */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2">
            <span>☁️</span> Cloud & Local Storage Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure offline resilience, cloud synchronization, automatic backups, and store architecture.
          </p>
        </div>

        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow flex items-center gap-2 transition-all text-sm"
        >
          <span className={isSyncing ? 'animate-spin' : ''}>🔄</span>
          {isSyncing ? 'Syncing...' : 'Sync Cloud Now'}
        </button>
      </div>

      {syncStatusMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <span>ℹ️</span> {syncStatusMsg}
        </div>
      )}

      {/* 1. STORAGE MODE SELECTOR (CARD) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span>⚙️</span> Choose Primary Storage Architecture
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Hybrid Mode */}
          <div
            onClick={() => handleModeChange('hybrid')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              mode === 'hybrid'
                ? 'border-emerald-500 bg-emerald-50/50 shadow-md ring-2 ring-emerald-200'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">⚡</span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full">
                RECOMMENDED
              </span>
            </div>
            <h3 className="font-extrabold text-gray-900 text-sm">Hybrid Auto-Sync</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Cloud primary with automatic local offline fallback. If your internet drops, registers continue selling with zero interruption and auto-sync when online.
            </p>
          </div>

          {/* Local Only Mode */}
          <div
            onClick={() => handleModeChange('local')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              mode === 'local'
                ? 'border-purple-500 bg-purple-50/50 shadow-md ring-2 ring-purple-200'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">💾</span>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-extrabold rounded-full">
                AIR-GAPPED
              </span>
            </div>
            <h3 className="font-extrabold text-gray-900 text-sm">Local Storage Only</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              100% offline standalone operation. All inventory, sales, and shifts are stored on this device without external cloud communication.
            </p>
          </div>

          {/* Cloud Only Mode */}
          <div
            onClick={() => handleModeChange('cloud')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              mode === 'cloud'
                ? 'border-blue-500 bg-blue-50/50 shadow-md ring-2 ring-blue-200'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">☁️</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-full">
                MULTI-STORE
              </span>
            </div>
            <h3 className="font-extrabold text-gray-900 text-sm">Cloud Storage Only</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Real-time centralized cloud database. Ideal for multi-counter chains needing instant global stock updates across all terminals.
            </p>
          </div>
        </div>
      </div>

      {/* 2. LIVE STORAGE & QUEUE METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-center">
          <span className="text-xs text-gray-500 font-semibold uppercase">Supermarket SKUs</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{stats.supermarketItemsCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-center">
          <span className="text-xs text-gray-500 font-semibold uppercase">Restaurant Dishes</span>
          <p className="text-2xl font-black text-amber-600 mt-1">{stats.restaurantItemsCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-center">
          <span className="text-xs text-gray-500 font-semibold uppercase">Offline Queue</span>
          <p className={`text-2xl font-black mt-1 ${stats.pendingSyncCount > 0 ? 'text-amber-500' : 'text-gray-400'}`}>
            {stats.pendingSyncCount} <span className="text-xs text-gray-500">pending</span>
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-center">
          <span className="text-xs text-gray-500 font-semibold uppercase">Local Storage Size</span>
          <p className="text-2xl font-black text-purple-600 mt-1">{stats.storageSizeKB} <span className="text-xs text-gray-400">KB</span></p>
        </div>
      </div>

      {/* 3. CLOUD SERVER CONFIGURATION */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span>🌐</span> Cloud Server & Sync Settings
        </h2>

        <form onSubmit={handleSaveCloudUrl} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Cloud API Server URL / Remote Host:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={cloudUrl}
                onChange={(e) => setCloudUrl(e.target.value)}
                placeholder="http://localhost:5001/api or https://api.mysupermarketpos.com"
                className="flex-1 px-3 py-2 border rounded-xl font-mono text-sm"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition-all"
              >
                Test Ping
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all"
              >
                Save URL
              </button>
            </div>
            {pingLatency && (
              <p className={`text-xs mt-1 font-semibold ${pingLatency.includes('Connected') ? 'text-emerald-600' : 'text-red-500'}`}>
                {pingLatency}
              </p>
            )}
          </div>
        </form>
      </div>

      {/* 4. BUSINESS MODE & STORE CONTEXT */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span>🏪</span> Primary Terminal Mode
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => handleBusinessModeChange('supermarket')}
            className={`p-4 rounded-xl border-2 cursor-pointer flex items-center gap-3 transition-all ${
              businessMode === 'supermarket' ? 'border-emerald-500 bg-emerald-50/50' : 'border-gray-200 bg-white'
            }`}
          >
            <span className="text-3xl">🛒</span>
            <div>
              <h4 className="font-bold text-sm text-gray-900">Supermarket / Retail Mode</h4>
              <p className="text-xs text-gray-500">Barcode scanner, fast change tender, weighable produce.</p>
            </div>
          </div>

          <div
            onClick={() => handleBusinessModeChange('restaurant')}
            className={`p-4 rounded-xl border-2 cursor-pointer flex items-center gap-3 transition-all ${
              businessMode === 'restaurant' ? 'border-amber-500 bg-amber-50/50' : 'border-gray-200 bg-white'
            }`}
          >
            <span className="text-3xl">🍽️</span>
            <div>
              <h4 className="font-bold text-sm text-gray-900">Restaurant / Dining Mode</h4>
              <p className="text-xs text-gray-500">Table management, kitchen display system, split bills.</p>
            </div>
          </div>
        </div>
      </div>

      {/* 5. BACKUP & RESTORE ACTIONS */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span>📦</span> Database Backup & Restore
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Export Full Backup */}
          <div className="p-4 border rounded-xl flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-sm text-gray-800">Export System Backup</h4>
              <p className="text-xs text-gray-500 mt-1">
                Download complete JSON snapshot of all products, categories, orders, customers, and shifts.
              </p>
            </div>
            <button
              onClick={handleExportBackup}
              className="mt-4 w-full py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all"
            >
              📥 Download Backup (.json)
            </button>
          </div>

          {/* Restore Backup */}
          <div className="p-4 border rounded-xl flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-sm text-gray-800">Restore from File</h4>
              <p className="text-xs text-gray-500 mt-1">
                Upload a previously saved `.json` backup file to restore system state.
              </p>
            </div>
            <div className="mt-3 space-y-2">
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
              {restoreFile && (
                <button
                  onClick={handleConfirmRestore}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
                >
                  Confirm Restore
                </button>
              )}
            </div>
          </div>

          {/* Factory Reset Catalog */}
          <div className="p-4 border rounded-xl flex flex-col justify-between bg-red-50/30">
            <div>
              <h4 className="font-bold text-sm text-red-900">Restore Factory Catalog</h4>
              <p className="text-xs text-gray-500 mt-1">
                Resets default supermarket items (produce, dairy, snacks) and restaurant menu items.
              </p>
            </div>
            <button
              onClick={handleResetCatalog}
              className="mt-4 w-full py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all"
            >
              ↺ Reset Sample Catalog
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
