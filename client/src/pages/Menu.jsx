import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAssignedRestaurantIds, getRestaurantMenuCategories, isAssignedToRestaurant } from '../utils/restaurantMenu';

const readRestaurantRows = key => {
  const rows = JSON.parse(localStorage.getItem(key) || '[]');
  const migratedRows = rows.map(row => ({
    ...row,
    restaurant_id: row.restaurant_id || 1
  }));
  if (JSON.stringify(rows) !== JSON.stringify(migratedRows)) {
    localStorage.setItem(key, JSON.stringify(migratedRows));
  }
  return migratedRows;
};

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

export default function Menu() {
  const { user, activeRestaurant, switchRestaurant } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('items');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [items, setItems] = useState(() => readRestaurantRows('pos_menu_items'));
  const [categories, setCategories] = useState(() => readRestaurantRows('pos_categories'));
  const allRestaurants = useMemo(() => {
    const savedRestaurants = JSON.parse(localStorage.getItem('pos_restaurants') || '[]');
    const allowedIds = user?.restaurants?.map(restaurant => String(restaurant.id));
    const isAdmin = user?.role_name === 'Admin' || user?.role === 'Admin';
    const visibleRestaurants = allowedIds?.length && !isAdmin
      ? savedRestaurants.filter(restaurant => allowedIds.includes(String(restaurant.id)))
      : savedRestaurants;
    return visibleRestaurants.length ? visibleRestaurants : (activeRestaurant ? [activeRestaurant] : []);
  }, [activeRestaurant, user?.restaurants, user?.role_name, user?.role]);
  const canAssignAcrossRestaurants = user?.role_name === 'Admin' || user?.role === 'Admin';

  const restaurantId = Number(activeRestaurant?.id || 1);
  const restaurantItems = useMemo(
    () => items.filter(item => isAssignedToRestaurant(item, restaurantId)),
    [items, restaurantId]
  );
  const restaurantCategories = useMemo(
    () => getRestaurantMenuCategories(categories, restaurantItems, restaurantId),
    [categories, restaurantId, restaurantItems]
  );

  const reportRows = useMemo(() => restaurantItems.map(item => ({
    id: item.id,
    name: item.name || 'Unnamed item',
    category: restaurantCategories.find(category => String(category.id) === String(item.category_id))?.name || '—',
    sku: item.sku || item.barcode || '—',
    price: Number(item.price) || 0,
    cost: Number(item.cost ?? item.cost_price) || 0,
    stock: Number(item.stock_quantity) || 0,
    status: item.is_active === false ? 'Inactive' : 'Active',
    type: item.is_supermarket || item.barcode ? 'Supermarket' : 'Restaurant'
  })).sort((a, b) => a.name.localeCompare(b.name)), [restaurantCategories, restaurantItems]);

  const handleUpdateItems = newItems => {
    setItems(newItems);
    localStorage.setItem('pos_menu_items', JSON.stringify(newItems));
  };

  const handleUpdateCategories = newCategories => {
    setCategories(newCategories);
    localStorage.setItem('pos_categories', JSON.stringify(newCategories));
  };

  const handleRestaurantAssignment = (item, targetRestaurantId, assigned) => {
    const selectedIds = new Set(getAssignedRestaurantIds(item));
    if (assigned) selectedIds.add(String(targetRestaurantId));
    else selectedIds.delete(String(targetRestaurantId));
    const restaurantIds = [...selectedIds];
    handleUpdateItems(items.map(current => current.id === item.id
      ? {
          ...current,
          restaurant_ids: restaurantIds,
          restaurant_id: Number(restaurantIds[0] || current.restaurant_id || restaurantId)
        }
      : current));
  };

  const handleSubmit = event => {
    event.preventDefault();
    if (activeTab === 'items') {
      const assignedRestaurantIds = canAssignAcrossRestaurants
        ? (formData.restaurant_ids || [String(restaurantId)]).map(String)
        : editingItem
          ? getAssignedRestaurantIds(editingItem)
          : [String(restaurantId)];
      const itemData = {
        ...formData,
        restaurant_id: Number(assignedRestaurantIds[0] || editingItem?.restaurant_id || restaurantId),
        restaurant_ids: assignedRestaurantIds,
        price: Number(formData.price) || 0,
        cost: Number(formData.cost) || 0,
        category_id: formData.category_id || null
      };
      if (editingItem) {
        handleUpdateItems(items.map(item => item.id === editingItem.id
          ? { ...itemData, id: item.id, stock_quantity: formData.stock_quantity ?? item.stock_quantity }
          : item));
      } else {
        handleUpdateItems([...items, {
          ...itemData,
          id: Date.now(),
          is_active: formData.is_active !== false,
          stock_quantity: Number(formData.stock_quantity) || 0
        }]);
      }
    } else if (editingItem) {
      handleUpdateCategories(categories.map(category => category.id === editingItem.id
        ? { ...formData, id: category.id, restaurant_id: restaurantId }
        : category));
    } else {
      handleUpdateCategories([...categories, { ...formData, id: Date.now(), restaurant_id: restaurantId }]);
    }
    setShowModal(false);
    setEditingItem(null);
    setFormData({});
  };

  const handleDeleteItem = id => {
    if (window.confirm('Delete this item?')) {
      handleUpdateItems(items.filter(item => item.id !== id));
    }
  };

  const handleDeleteCategory = id => {
    if (window.confirm('Delete this category? Items in this category will become uncategorized.')) {
      handleUpdateCategories(categories.filter(category => category.id !== id));
    }
  };

  const handleEdit = object => {
    setEditingItem(object);
    setFormData({
      ...object,
      restaurant_ids: getAssignedRestaurantIds(object)
    });
    setShowModal(true);
  };

  const exportToExcel = () => {
    const escapeCsv = value => {
      const rawText = String(value ?? '');
      const text = /^[\s]*[=+\-@]/.test(rawText) ? `'${rawText}` : rawText;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = [
      ['Item', 'Category', 'SKU / Barcode', 'Price', 'Cost', 'Stock', 'Status', 'Menu type'],
      ...reportRows.map(row => [
        row.name, row.category, row.sku, row.price.toFixed(2), row.cost.toFixed(2), row.stock, row.status, row.type
      ])
    ];
    const content = `\uFEFF${rows.map(row => row.map(escapeCsv).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `menu_list_${restaurantId}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportToPdf = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      window.alert('Allow pop-ups to open the report, then choose Save as PDF in the print dialog.');
      return;
    }
    const rows = reportRows.map(row => `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.category)}</td>
        <td>${escapeHtml(row.sku)}</td>
        <td>${escapeHtml(activeRestaurant?.currency || user?.currency || '$')}${row.price.toFixed(2)}</td>
        <td>${escapeHtml(activeRestaurant?.currency || user?.currency || '$')}${row.cost.toFixed(2)}</td>
        <td>${row.stock}</td>
        <td>${row.status}</td>
        <td>${row.type}</td>
      </tr>
    `).join('');
    printWindow.document.write(`
      <!doctype html>
      <html><head><title>Whole Menu List</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #172033; }
          h1 { margin-bottom: 6px; }
          p { color: #526075; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th, td { border: 1px solid #d8dee8; padding: 10px; text-align: left; }
          th { background: #f1f5f9; }
          .total { margin-top: 16px; font-weight: bold; text-align: right; }
        </style>
      </head><body>
        <h1>${escapeHtml(activeRestaurant?.name || 'Restaurant')} — Whole Menu List</h1>
        <p>${reportRows.length} menu items</p>
        <table><thead><tr><th>Item</th><th>Category</th><th>SKU / Barcode</th><th>Price</th><th>Cost</th><th>Stock</th><th>Status</th><th>Menu type</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="8">No menu items are assigned to this restaurant.</td></tr>'}</tbody>
        </table>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {(activeTab === 'items' || activeTab === 'categories') && (
            <button
              onClick={() => {
                setEditingItem(null);
                setFormData({
                  is_active: true,
                  track_inventory: true,
                  restaurant_id: restaurantId,
                  restaurant_ids: [String(restaurantId)]
                });
                setShowModal(true);
              }}
              className="btn btn-primary text-lg"
            >
              + Add {activeTab === 'items' ? 'Item' : 'Category'}
            </button>
          )}
        </div>
      </div>

      <section className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-800">Choose restaurant</h2>
            <p className="mt-1 text-sm text-gray-500">Select a restaurant to see and manage its menu. The same selection is used by Restaurant POS.</p>
          </div>
          <button type="button" onClick={() => navigate('/pos')} className="btn btn-primary">
            Open {activeRestaurant?.name || 'restaurant'} POS
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          {allRestaurants.map(restaurant => (
            <button
              key={restaurant.id}
              type="button"
              aria-pressed={Number(activeRestaurant?.id) === Number(restaurant.id)}
              onClick={() => switchRestaurant(restaurant)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                Number(activeRestaurant?.id) === Number(restaurant.id)
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              <span className="block text-sm font-bold">{restaurant.name}</span>
              <span className="mt-1 block text-xs">{Number(activeRestaurant?.id) === Number(restaurant.id) ? 'Selected restaurant' : 'Show this restaurant menu'}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Menu summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Menu items', value: restaurantItems.length, detail: 'Assigned to selected restaurant' },
          { label: 'Active items', value: restaurantItems.filter(item => item.is_active !== false).length, detail: 'Available to sell in POS' },
          { label: 'Categories', value: restaurantCategories.length, detail: 'Available for this menu' }
        ].map(metric => (
          <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{metric.value}</p>
            <p className="mt-1 text-xs text-slate-500">{metric.detail}</p>
          </div>
        ))}
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { id: 'items', label: 'Menu Items' },
          { id: 'categories', label: 'Categories' },
          ...(canAssignAcrossRestaurants ? [{ id: 'assignments', label: 'Restaurant Assignments' }] : []),
          { id: 'catalog', label: 'Whole Menu List' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === tab.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'items' && (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Category</th><th className="text-right">Price</th><th className="text-right">Cost</th><th className="text-right">Stock</th><th>Status</th><th>Assigned restaurants</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {restaurantItems.map(item => (
                  <tr key={item.id}>
                    <td className="font-medium text-lg">{item.name}</td>
                    <td>{restaurantCategories.find(category => String(category.id) === String(item.category_id))?.name || '-'}</td>
                    <td className="text-right text-base font-semibold tabular-nums">{activeRestaurant?.currency || user?.currency || '$'}{Number(item.price || 0).toFixed(2)}</td>
                    <td className="text-right tabular-nums">{activeRestaurant?.currency || user?.currency || '$'}{Number(item.cost || 0).toFixed(2)}</td>
                    <td className={`text-right tabular-nums ${Number(item.stock_quantity) <= 10 ? 'font-bold text-red-600' : ''}`}>{item.stock_quantity ?? 0}</td>
                    <td>
                      <span className={`rounded-full px-3 py-1 text-sm ${item.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {item.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {allRestaurants
                          .filter(restaurant => getAssignedRestaurantIds(item).includes(String(restaurant.id)))
                          .map(restaurant => (
                            <span key={restaurant.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                              {restaurant.name}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td>
                      <button onClick={() => alert(`Launching AR Preview for ${item.name}...\nPlace the virtual dish on your table.`)} className="mr-3 font-bold text-indigo-600 hover:underline">AR View</button>
                      <button onClick={() => handleEdit(item)} className="mr-3 text-primary-600 hover:underline">Edit</button>
                      <button onClick={() => handleDeleteItem(item.id)} className="text-red-600 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
                {restaurantItems.length === 0 && <tr><td colSpan="8" className="py-8 text-center text-gray-500">No items are assigned to this restaurant yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Name</th><th>Description</th><th>Actions</th></tr></thead>
              <tbody>
                {restaurantCategories.map(category => (
                  <tr key={category.id}>
                    <td className="font-medium text-lg">{category.name}</td>
                    <td>{category.description || '-'}</td>
                    <td>
                      <button onClick={() => handleEdit(category)} className="mr-3 text-primary-600 hover:underline">Edit</button>
                      <button onClick={() => handleDeleteCategory(category.id)} className="text-red-600 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
                {restaurantCategories.length === 0 && <tr><td colSpan="3" className="py-8 text-center text-gray-500">No categories are assigned to this restaurant yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'assignments' && canAssignAcrossRestaurants && (
        <section className="card space-y-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">Menu access</p>
            <h2 className="mt-1 text-lg font-extrabold text-slate-900">Assign menu items to restaurants</h2>
            <p className="mt-1 text-sm text-slate-500">Select each branch where an item should be available. Changes are reflected in that branch’s Restaurant POS menu.</p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="min-w-52">Menu item</th>
                  <th>Category</th>
                  {allRestaurants.map(restaurant => (
                    <th key={restaurant.id} className="min-w-40 text-center">{restaurant.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="font-semibold text-slate-800">{item.name}</td>
                    <td className="text-slate-500">
                      {categories.find(category => String(category.id) === String(item.category_id))?.name || '—'}
                    </td>
                    {allRestaurants.map(restaurant => (
                      <td key={restaurant.id} className="text-center">
                        <label className="inline-flex cursor-pointer items-center justify-center gap-2 text-sm font-medium text-slate-600">
                          <input
                            type="checkbox"
                            aria-label={`Assign ${item.name} to ${restaurant.name}`}
                            checked={getAssignedRestaurantIds(item).includes(String(restaurant.id))}
                            onChange={event => handleRestaurantAssignment(item, restaurant.id, event.target.checked)}
                            className="h-4 w-4 accent-emerald-600"
                          />
                          <span>{getAssignedRestaurantIds(item).includes(String(restaurant.id)) ? 'Assigned' : 'Not assigned'}</span>
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={allRestaurants.length + 2} className="py-8 text-center text-slate-500">Add menu items before assigning them to restaurants.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'catalog' && (
        <div className="space-y-5">
          <section className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Whole Menu List</h2>
                <p className="mt-1 text-sm text-gray-500">Complete menu for {activeRestaurant?.name || 'the selected restaurant'}.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={exportToExcel} className="btn bg-green-600 text-white">Download Excel</button>
                <button type="button" onClick={exportToPdf} className="btn bg-red-600 text-white">Download PDF</button>
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-600">{reportRows.length} menu items</p>
          </section>
          <section className="card overflow-x-auto">
            <table className="table w-full">
              <thead><tr><th>Item</th><th>Category</th><th>SKU / Barcode</th><th className="text-right">Price</th><th className="text-right">Cost</th><th className="text-right">Stock</th><th>Status</th><th>Menu type</th></tr></thead>
              <tbody>
                {reportRows.length === 0 ? (
                  <tr><td colSpan="8" className="py-8 text-center text-gray-500">No menu items are assigned to this restaurant yet.</td></tr>
                ) : reportRows.map(row => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.category}</td>
                    <td>{row.sku}</td>
                    <td className="text-right tabular-nums">{activeRestaurant?.currency || user?.currency || '$'}{row.price.toFixed(2)}</td>
                    <td className="text-right tabular-nums">{activeRestaurant?.currency || user?.currency || '$'}{row.cost.toFixed(2)}</td>
                    <td className="text-right tabular-nums">{row.stock}</td>
                    <td>{row.status}</td>
                    <td>{row.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
            <h2 className="mb-4 text-2xl font-bold">
              {editingItem ? `Edit ${activeTab === 'items' ? 'Item' : 'Category'}` : `Add ${activeTab === 'items' ? 'Item' : 'Category'}`}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block font-medium text-gray-700">Name</label>
                  <input type="text" value={formData.name || ''} onChange={event => setFormData({ ...formData, name: event.target.value })} className="input" required />
                </div>
                {activeTab === 'items' && (
                  <>
                    <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                      {canAssignAcrossRestaurants
                        ? 'Restaurant access is controlled by the assignments below.'
                        : <>This item will be available only at <span className="font-bold">{activeRestaurant?.name || 'the selected restaurant'}</span>.</>}
                    </div>
                    {canAssignAcrossRestaurants ? (
                      <fieldset className="rounded-xl border border-slate-200 p-4">
                        <legend className="px-1 text-sm font-bold text-slate-700">Restaurant access</legend>
                        <p className="mb-3 text-xs text-slate-500">Choose which restaurant POS screens can sell this item.</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {allRestaurants.map(restaurant => (
                            <label key={restaurant.id} className="flex cursor-pointer items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-emerald-50">
                              <input
                                type="checkbox"
                                checked={(formData.restaurant_ids || []).includes(String(restaurant.id))}
                                onChange={event => {
                                  const selectedIds = new Set((formData.restaurant_ids || []).map(String));
                                  if (event.target.checked) selectedIds.add(String(restaurant.id));
                                  else selectedIds.delete(String(restaurant.id));
                                  setFormData({ ...formData, restaurant_ids: [...selectedIds] });
                                }}
                                className="h-4 w-4 accent-emerald-600"
                              />
                              <span>{restaurant.name}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ) : (
                      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                        Restaurant access is managed by an administrator.
                      </p>
                    )}
                    <div>
                      <label className="mb-2 block font-medium text-gray-700">Category</label>
                      <select value={formData.category_id || ''} onChange={event => setFormData({ ...formData, category_id: event.target.value })} className="input">
                        <option value="">Select Category</option>
                        {restaurantCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="mb-2 block font-medium text-gray-700">Price</label><input type="number" min="0" step="0.01" value={formData.price ?? ''} onChange={event => setFormData({ ...formData, price: event.target.value })} className="input" required /></div>
                      <div><label className="mb-2 block font-medium text-gray-700">Cost</label><input type="number" min="0" step="0.01" value={formData.cost ?? ''} onChange={event => setFormData({ ...formData, cost: event.target.value })} className="input" /></div>
                    </div>
                    <div>
                      <label className="mb-2 block font-medium text-gray-700">Stock Quantity</label>
                      <input type="number" min="0" value={formData.stock_quantity ?? ''} onChange={event => setFormData({ ...formData, stock_quantity: parseInt(event.target.value, 10) || 0 })} className="input" placeholder="0" />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2"><input type="checkbox" checked={formData.is_active !== false} onChange={event => setFormData({ ...formData, is_active: event.target.checked })} />Active</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={formData.track_inventory !== false} onChange={event => setFormData({ ...formData, track_inventory: event.target.checked })} />Track Inventory</label>
                    </div>
                  </>
                )}
                {activeTab === 'categories' && (
                  <div><label className="mb-2 block font-medium text-gray-700">Description</label><textarea value={formData.description || ''} onChange={event => setFormData({ ...formData, description: event.target.value })} className="input" rows="3" /></div>
                )}
              </div>
              <div className="mt-6 flex gap-4">
                <button type="submit" className="btn btn-primary flex-1">{editingItem ? 'Update' : 'Create'}</button>
                <button type="button" onClick={() => { setShowModal(false); setEditingItem(null); setFormData({}); }} className="btn btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
