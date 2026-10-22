import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { posApi, menuApi } from '../api';
import { useAuth } from '../context/AuthContext';
import ShiftManager from '../components/ShiftManager';
import ThermalReceipt from '../components/ThermalReceipt';
import { getRestaurantMenuCategories, isAssignedToRestaurant } from '../utils/restaurantMenu';

export default function POS() {
  const navigate = useNavigate();
  const { user, activeRestaurant } = useAuth();
  const queryClient = useQueryClient();
  const [showShiftManager, setShowShiftManager] = useState(false);
  const [apiOrders, setApiOrders] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerError, setCustomerError] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState(''); // 'full', 'split', 'later'
  const [cashAmount, setCashAmount] = useState(0);
  const [cardAmount, setCardAmount] = useState(0);
  const [amountTendered, setAmountTendered] = useState('');
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customers, setCustomers] = useState(() => {
    const saved = localStorage.getItem('pos_customers');
    return saved ? JSON.parse(saved) : [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [showOrderPage, setShowOrderPage] = useState(false);
  const [nextOrderNumber, setNextOrderNumber] = useState(() => {
    return parseInt(localStorage.getItem('nextOrderNumber')) || 1;
  });

  // Fetch Data from Server
  const { data: tables = [], isLoading: tablesLoading, refetch: refetchTables } = useQuery({
    queryKey: ['tables', activeRestaurant?.id],
    queryFn: async () => {
      try {
        const res = await posApi.getTables();
        return res.data;
      } catch (err) {
        const saved = localStorage.getItem('pos_tables');
        return saved ? JSON.parse(saved) : [];
      }
    },
    enabled: !!activeRestaurant,
  });

  const { data: categories = [], refetch: refetchCategories } = useQuery({
    queryKey: ['categories', activeRestaurant?.id],
    queryFn: async () => {
      try {
        const res = await menuApi.getCategories();
        const restaurantId = Number(activeRestaurant?.id || 1);
        const savedCategories = JSON.parse(localStorage.getItem('pos_categories') || '[]');
        const localItems = JSON.parse(localStorage.getItem('pos_menu_items') || '[]');
        const allCategories = [...(res.data || []), ...savedCategories];
        const assignedCategories = getRestaurantMenuCategories(allCategories, localItems, restaurantId)
          .filter(category => category.type !== 'supermarket');
        const categoryById = new Map(assignedCategories.map(category => [String(category.id), category]));
        return [...categoryById.values()];
      } catch (err) {
        const saved = localStorage.getItem('pos_categories');
        const restaurantId = Number(activeRestaurant?.id || 1);
        const savedItems = JSON.parse(localStorage.getItem('pos_menu_items') || '[]');
        return saved ? getRestaurantMenuCategories(JSON.parse(saved), savedItems, restaurantId)
          .filter(category => category.type !== 'supermarket') : restaurantId === 1 ? [
          { id: 1, name: 'Appetizers' },
          { id: 2, name: 'Main Course' },
          { id: 3, name: 'Desserts' },
          { id: 4, name: 'Beverages' },
        ] : [];
      }
    },
    enabled: !!activeRestaurant,
  });

  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ['items', activeRestaurant?.id],
    queryFn: async () => {
      try {
        const res = await menuApi.getItems();
        const restaurantId = Number(activeRestaurant?.id || 1);
        const localItems = JSON.parse(localStorage.getItem('pos_menu_items') || '[]')
          .filter(item => isAssignedToRestaurant(item, restaurantId)
            && item.is_active !== false
            && (item.is_restaurant || (!item.is_supermarket && !item.barcode)));
        const serverItems = (res.data || []).filter(item => (
          isAssignedToRestaurant(item, restaurantId)
          && item.is_active !== false
          && (item.is_restaurant || (!item.is_supermarket && !item.barcode))
        ));
        const mergedItems = new Map(serverItems.map(item => [String(item.id), item]));
        localItems.forEach(item => mergedItems.set(String(item.id), item));
        return [...mergedItems.values()];
      } catch (err) {
        const saved = localStorage.getItem('pos_menu_items');
        const restaurantId = Number(activeRestaurant?.id || 1);
        return saved ? JSON.parse(saved).filter(item => (
          isAssignedToRestaurant(item, restaurantId)
          && item.is_active !== false
          && (item.is_restaurant || (!item.is_supermarket && !item.barcode))
        )) : restaurantId === 1 ? [
          { id: 1, name: 'Caesar Salad', price: 12.50, category_id: 1, is_active: true },
          { id: 2, name: 'Chicken Wings', price: 15.00, category_id: 1, is_active: true },
          { id: 3, name: 'Steak', price: 35.00, category_id: 2, is_active: true },
          { id: 4, name: 'Grilled Salmon', price: 28.00, category_id: 2, is_active: true },
          { id: 5, name: 'Pasta Carbonara', price: 18.00, category_id: 2, is_active: true },
          { id: 6, name: 'Chocolate Cake', price: 8.50, category_id: 3, is_active: true },
          { id: 7, name: 'Ice Cream', price: 6.00, category_id: 3, is_active: true },
          { id: 8, name: 'Coffee', price: 4.50, category_id: 4, is_active: true },
          { id: 9, name: 'Fresh Juice', price: 6.50, category_id: 4, is_active: true },
        ] : [];
      }
    },
    enabled: !!activeRestaurant,
  });

  // Sync data regularly
  const lastOrderCountRef = useRef(0);
  useEffect(() => {
    const syncData = async () => {
      try {
        // Fetch orders from API - include all statuses for guest orders
        const ordersRes = await posApi.getOrders({ status: 'Held' }).catch(() => ({ data: [] }));
        const fetchedApiOrders = ordersRes.data || [];
        setApiOrders(fetchedApiOrders);
        
        // Also fetch 'open' orders that might be guest orders
        const openOrdersRes = await posApi.getOrders({ status: 'open' }).catch(() => ({ data: [] }));
        const openOrders = openOrdersRes.data || [];
        const guestOpenOrders = openOrders.filter(order => order.is_guest_order === true);
        
        // Combine Held and guest Open orders
        const allRelevantOrders = [...fetchedApiOrders, ...guestOpenOrders];
        
        // Fetch orders from LocalStorage
        const localOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
        
        // Merge them for the UI
        const combinedOrders = [...allRelevantOrders, ...localOrders];
        
        if (combinedOrders.length > lastOrderCountRef.current) {
          const newOrder = combinedOrders[0];
          // If lastOrderCountRef.current is 0, it's the first load, don't alert
          if (lastOrderCountRef.current > 0 && (newOrder.is_guest_order || !newOrder.user_id)) {
             alert(`🔔 NEW GUEST ORDER: Table ${newOrder.table_name || newOrder.table_id}`);
          }
          lastOrderCountRef.current = combinedOrders.length;
        }
        
        const savedCustomers = localStorage.getItem('pos_customers');
        if (savedCustomers) setCustomers(JSON.parse(savedCustomers));
        
        if (refetchTables) refetchTables();
        if (refetchItems) refetchItems();
      } catch (err) {
        console.error('Sync error:', err);
      }
    };
    
    // Set initial count
    const initSync = async () => {
      const ordersRes = await posApi.getOrders({ status: 'Held' }).catch(() => ({ data: [] }));
      const openOrdersRes = await posApi.getOrders({ status: 'open' }).catch(() => ({ data: [] }));
      const openOrders = openOrdersRes.data || [];
      const guestOpenOrders = openOrders.filter(order => order.is_guest_order === true);
      const allRelevantOrders = [...ordersRes.data || [], ...guestOpenOrders];
      const localOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
      lastOrderCountRef.current = allRelevantOrders.length + localOrders.length;
    };
    initSync();

    window.addEventListener('storage', syncData);
    const interval = setInterval(syncData, 5000); // Poll every 5s
    
    return () => {
      window.removeEventListener('storage', syncData);
      clearInterval(interval);
    };
  }, [refetchTables, refetchItems]);

  // Listen for storage changes
  useEffect(() => {
    const handleStorageChange = () => {
      refetchTables();
      refetchCategories();
      refetchItems();
    };
    window.addEventListener('storage', handleStorageChange);
    
    const interval = setInterval(handleStorageChange, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [refetchTables, refetchCategories, refetchItems]);

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => menuApi.getLowStock(10).then(res => res.data),
    enabled: !!activeRestaurant,
  });

  const displayTables = tables;
  const displayCategories = categories;
  const displayItems = items
    .filter(item => !selectedCategory || parseInt(item.category_id) === parseInt(selectedCategory))
    .filter(item => 
      searchQuery === '' || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const createOrderMutation = useMutation({
    mutationFn: (data) => posApi.createOrder(data),
    onSuccess: (res) => {
      setCurrentOrder(res.data);
      queryClient.invalidateQueries(['tables']);
    },
  });

  const addItemMutation = useMutation({
    mutationFn: ({ orderId, item }) => posApi.addOrderItem(orderId, item),
    onSuccess: () => {
      queryClient.invalidateQueries(['order', currentOrder?.id]);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }) => posApi.updateOrderStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries(['tables']);
      queryClient.invalidateQueries(['orders']);
      setCurrentOrder(null);
      setOrderItems([]);
      setSelectedTable(null);
      setDiscount(0);
    },
  });

  const [isListening, setIsListening] = useState(false);

  const startVoiceCommand = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Voice recognition not supported in this browser.");
      return;
    }
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      const command = event.results[0][0].transcript.toLowerCase();
      console.log('Voice Command:', command);
      
      // Match item name
      const matchedItem = items.find(i => command.includes(i.name.toLowerCase()));
      if (matchedItem) {
        handleAddItem(matchedItem);
        alert(`Added ${matchedItem.name} via Voice!`);
      } else if (command.includes('checkout') || command.includes('pay')) {
        handlePlaceOrder();
      } else {
        alert(`Command not recognized: "${command}"`);
      }
    };
    recognition.start();
  };

  const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxRate = activeRestaurant?.tax_rate || 0;
  const discountAmount = discountPercentage > 0 ? subtotal * (discountPercentage / 100) : discount;
  const taxAmount = (subtotal - discountAmount) * (taxRate / 100);
  const total = subtotal + taxAmount - discountAmount;
  const changeDue = Math.max(0, (parseFloat(amountTendered) || 0) - total);

  const handleTableSelect = async (table) => {
    setSelectedTable(table);
    
    try {
      // 1. Check API first for orders on this table
      const res = await posApi.getOrders({ table_id: table.id, status: 'Held' }).catch(() => ({ data: [] }));
      let tableOrder = res.data?.[0];
      
      // 2. Fallback to LocalStorage
      if (!tableOrder) {
        const savedOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
        tableOrder = savedOrders.find(o => 
          parseInt(o.table_id) === parseInt(table.id) && 
          (o.status === 'Held' || o.status === 'Pending' || o.status === 'Preparing')
        );
      }
      
      if (tableOrder) {
        // If it's an API order, we might need to fetch full items
        if (tableOrder.id && !tableOrder.items) {
          const fullOrderRes = await posApi.getOrderById(tableOrder.id).catch(() => null);
          if (fullOrderRes) tableOrder = fullOrderRes.data;
        }

        setCurrentOrder(tableOrder);
        setOrderItems(tableOrder.items || []);
        setCustomerName(tableOrder.customer_name || (tableOrder.is_guest_order || !tableOrder.user_id ? 'Guest Order' : ''));
        setCustomerPhone(tableOrder.customer_phone || '');
        setEmployeeId(tableOrder.employee_id || '');
        setSelectedCustomerId(tableOrder.customer_id || '');
        setDiscountPercentage(tableOrder.discount_percentage || 0);
      } else {
        setCurrentOrder(null);
        setOrderItems([]);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerError('');
        setEmployeeId('');
        setSelectedCustomerId('');
        setDiscountPercentage(0);
      }
    } catch (err) {
      console.error('Error loading table order:', err);
    }
  };

  const handleHoldBill = async () => {
    if (!selectedTable || orderItems.length === 0) return;

    // Save to localStorage as held order
    const heldOrder = {
      id: currentOrder?.id || Date.now(),
      restaurant_id: activeRestaurant?.id,
      table_id: selectedTable.id,
      table_name: selectedTable.table_name,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total_amount: total,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_id: selectedCustomerId,
      employee_id: employeeId,
      items: orderItems,
      date: new Date().toLocaleString(),
      status: 'Held',
      payment_method: 'N/A'
    };

    const existingOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
    const otherOrders = existingOrders.filter(o => !(o.table_id === selectedTable.id && o.status === 'Held'));
    localStorage.setItem('pos_orders', JSON.stringify([heldOrder, ...otherOrders]));

    // Update table status to occupied
    const allTables = JSON.parse(localStorage.getItem('pos_tables') || '[]');
    const updatedTables = allTables.map(t => 
      t.id === selectedTable.id ? { ...t, status: 'occupied' } : t
    );
    localStorage.setItem('pos_tables', JSON.stringify(updatedTables));

    alert('Bill held successfully!');
    
    // Clear current order
    setSelectedTable(null);
    setOrderItems([]);
    setCurrentOrder(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerError('');
    setSelectedCustomerId('');
    setEmployeeId('');
    setDiscountPercentage(0);
    setDiscount(0);
  };

  const handleAddItem = (item) => {
    // Check stock
    if (item.stock_quantity !== undefined && item.stock_quantity <= 0) {
      alert(`Item "${item.name}" is out of stock!`);
      return;
    }

    const existingIndex = orderItems.findIndex(oi => oi.id === item.id);
    
    if (existingIndex >= 0) {
      const updated = [...orderItems];
      // Check if adding one more exceeds stock
      if (item.stock_quantity !== undefined && updated[existingIndex].quantity >= item.stock_quantity) {
        alert(`Cannot add more "${item.name}". Only ${item.stock_quantity} in stock.`);
        return;
      }
      updated[existingIndex].quantity += 1;
      setOrderItems(updated);
    } else {
      setOrderItems([...orderItems, {
        id: item.id,
        item_id: item.id,
        item_name: item.name,
        quantity: 1,
        price: parseFloat(item.price),
      }]);
    }
  };

  const handleRemoveItem = (index) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleUpdateQuantity = (index, qty) => {
    if (qty <= 0) {
      handleRemoveItem(index);
      return;
    }
    const orderItem = orderItems[index];
    const menuItem = items.find(i => i.id === orderItem.id);
    
    if (menuItem && menuItem.stock_quantity !== undefined && qty > menuItem.stock_quantity) {
      alert(`Cannot set quantity to ${qty}. Only ${menuItem.stock_quantity} available in stock.`);
      return;
    }

    const updated = [...orderItems];
    updated[index].quantity = qty;
    setOrderItems(updated);
  };

  const handlePlaceOrder = () => {
    if (!selectedTable || orderItems.length === 0) return;

    const orderData = {
      id: nextOrderNumber,
      restaurant_id: activeRestaurant?.id,
      table_id: selectedTable.id,
      table_name: selectedTable.table_name,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total_amount: total,
      customer_name: customerName,
      customer_phone: customerPhone,
      employee_id: employeeId,
      customer_id: selectedCustomerId || null,
      items: orderItems
    };

    setCurrentOrder(orderData);
    setShowPaymentModal(true);
    setPaymentType('select');
    setAmountTendered(total.toFixed(2));
    
    // Update table status to occupied
    const allTables = JSON.parse(localStorage.getItem('pos_tables') || '[]');
    const updatedTables = allTables.map(t => 
      t.id === selectedTable.id ? { ...t, status: 'occupied' } : t
    );
    localStorage.setItem('pos_tables', JSON.stringify(updatedTables));
    refetchTables();
    
    // Increment order number for next time
    const newNumber = nextOrderNumber + 1;
    setNextOrderNumber(newNumber);
    localStorage.setItem('nextOrderNumber', newNumber.toString());
  };

  const handlePayment = async (paymentMethod) => {
    if (!selectedTable || orderItems.length === 0) return;
    
    const status = paymentMethod === 'later' ? 'Pending' : 'Paid';
    const normalizedMethod = paymentMethod === 'later' ? 'N/A' : paymentMethod;
    const tenderedAmount = paymentMethod === 'later'
      ? 0
      : paymentMethod === 'split'
        ? Number(cashAmount) + Number(cardAmount)
        : paymentMethod === 'cash'
          ? (parseFloat(amountTendered) || 0)
          : total;
    const changeAmount = paymentMethod === 'cash' ? Math.max(0, tenderedAmount - total) : 0;

    if (paymentMethod === 'cash' && tenderedAmount < total) {
      alert('Tendered cash is less than the total amount due.');
      return;
    }
    if (paymentMethod === 'split' && Math.round(tenderedAmount * 100) !== Math.round(total * 100)) {
      alert('Cash and card amounts must add up to the total bill.');
      return;
    }
    
    // Blockchain Security: Generate Hash
    const blockchainLog = JSON.parse(localStorage.getItem('pos_blockchain_log') || '[]');
    const previousHash = blockchainLog.length > 0 ? blockchainLog[0].hash : '0000000000000000';
    const orderDataString = JSON.stringify(orderItems) + total + new Date().toISOString() + previousHash;
    const currentHash = btoa(orderDataString).substring(0, 32); // Simple b64 hash for simulation

    const newOrder = {
      id: currentOrder?.id || nextOrderNumber,
      restaurant_id: activeRestaurant?.id,
      table_id: selectedTable.id,
      table_name: selectedTable.table_name,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total_amount: total,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_id: selectedCustomerId,
      employee_id: employeeId,
      items: orderItems,
      date: new Date().toLocaleString(),
      created_at: new Date().toISOString(),
      status: status,
      payment_method: normalizedMethod,
      amount_tendered: tenderedAmount,
      change_due: changeAmount,
      cash_amount: paymentMethod === 'split' ? Number(cashAmount) : undefined,
      card_amount: paymentMethod === 'split' ? Number(cardAmount) : undefined,
      total,
      discount: discountAmount,
      business_type: 'restaurant',
      order_type: 'Restaurant Table Service',
      blockchain_hash: currentHash,
      previous_hash: previousHash
    };

    // Update Blockchain Log
    if (status === 'Paid') {
      const logEntry = {
        order_id: newOrder.id,
        hash: currentHash,
        prev: previousHash,
        timestamp: new Date().toISOString(),
        amount: total
      };
      localStorage.setItem('pos_blockchain_log', JSON.stringify([logEntry, ...blockchainLog]));

      // Update inventory (Auto-Update Stock)
      const allMenuItems = JSON.parse(localStorage.getItem('pos_menu_items') || '[]');
      const updatedMenuItems = allMenuItems.map(item => {
        const orderItem = orderItems.find(oi => oi.id === item.id);
        if (orderItem) {
          return { ...item, stock_quantity: Math.max(0, (item.stock_quantity || 0) - orderItem.quantity) };
        }
        return item;
      });
      localStorage.setItem('pos_menu_items', JSON.stringify(updatedMenuItems));
    }
    
    const existingOrders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
    const otherOrders = existingOrders.filter(o => !(o.table_id === selectedTable.id && o.status === 'Held'));
    localStorage.setItem('pos_orders', JSON.stringify([newOrder, ...otherOrders]));

    // Add loyalty activity only after a completed payment.
    if (status === 'Paid' && selectedCustomerId) {
      const savedCustomers = JSON.parse(localStorage.getItem('pos_customers') || '[]');
      const updatedCustomers = savedCustomers.map(c => {
        if (String(c.id) === String(selectedCustomerId)) {
          const loyaltyPoints = Number(c.loyaltyPoints ?? c.points ?? 0) + Math.floor(total);
          let tier = 'Standard';
          if (loyaltyPoints > 750) tier = 'Platinum';
          else if (loyaltyPoints > 300) tier = 'Gold';
          else if (loyaltyPoints > 100) tier = 'Silver';
          return {
            ...c,
            phone: customerPhone.trim() || c.phone || '',
            visits: (c.visits || 0) + 1,
            totalSpent: (c.totalSpent || 0) + total,
            loyaltyPoints,
            points: loyaltyPoints,
            tier,
            lastVisit: new Date().toISOString().split('T')[0],
          };
        }
        return c;
      });
      localStorage.setItem('pos_customers', JSON.stringify(updatedCustomers));
      setCustomers(updatedCustomers);
    }

    // Update table status
    const allTables = JSON.parse(localStorage.getItem('pos_tables') || '[]');
    const updatedTables = allTables.map(t => 
      t.id === selectedTable.id ? { ...t, status: status === 'Paid' ? 'available' : 'occupied' } : t
    );
    localStorage.setItem('pos_tables', JSON.stringify(updatedTables));

    setReceiptOrder({
      ...newOrder,
      order_number: newOrder.id,
      customer: customerName ? {
        name: customerName,
        phone: customerPhone,
        tier: customers.find(customer => String(customer.id) === String(selectedCustomerId))?.tier || 'Standard',
      } : null,
      cashier: user?.username || employeeId || 'Admin',
    });

    if (!currentOrder) {
      const newNumber = nextOrderNumber + 1;
      setNextOrderNumber(newNumber);
      localStorage.setItem('nextOrderNumber', newNumber.toString());
    }
    
    // Reset everything for next order
    setOrderItems([]);
    setSelectedTable(null);
    setCurrentOrder(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerError('');
    setSelectedCustomerId('');
    setEmployeeId('');
    setDiscountPercentage(0);
    setDiscount(0);
    setShowPaymentModal(false);
    setPaymentType('');
    setCashAmount(0);
    setCardAmount(0);
    setAmountTendered('');
  };

  const handlePreviewBill = () => {
    const now = new Date().toISOString();
    setReceiptOrder({
      id: currentOrder?.id || nextOrderNumber,
      order_number: currentOrder?.id || nextOrderNumber,
      created_at: now,
      status: 'Unpaid',
      table_id: selectedTable?.id,
      table_name: selectedTable?.table_name,
      subtotal,
      tax_amount: taxAmount,
      discount: discountAmount,
      total,
      total_amount: total,
      payment_method: 'Unpaid',
      amount_tendered: 0,
      change_due: 0,
      items: orderItems.map(item => ({ ...item, name: item.item_name })),
      customer: customerName ? { name: customerName, phone: customerPhone } : null,
      cashier: user?.username || employeeId || 'Admin',
      business_type: 'restaurant',
    });
  };

  const isChromeless = new URLSearchParams(window.location.search).get('chromeless') === '1';

  return (
    <div className={`flex ${isChromeless ? 'h-screen' : 'h-[calc(100vh-140px)]'} min-h-[560px] flex-col gap-3 font-sans`}>
      {/* Top Banner: Restaurant Mode Bar */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-md">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 font-black shadow-sm">S</div>
          <div>
            <h2 className="!text-white text-sm font-extrabold leading-tight tracking-wide">RESTAURANT POS</h2>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              <p className="text-[10px] font-semibold text-emerald-300">Terminal ready · Table service · Kitchen orders</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShiftManager(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-100 transition hover:bg-slate-700"
          >
            <span>💼</span> Shift & Drawer
          </button>
          <button
            onClick={() => navigate('/supermarket-pos')}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-400"
          >
            <span>🛒</span> Switch to Supermarket POS
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        {/* Left Panel - Tables & Menu */}
        <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
        {/* Incoming Guest Orders Shelf */}
        {apiOrders.length > 0 && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 shadow-sm">
            <h3 className="mb-2 flex justify-between text-xs font-extrabold uppercase tracking-wide text-blue-900">
              <span>🔔 Incoming guest orders ({apiOrders.length})</span>
              <span className="text-emerald-700">● Live</span>
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
              {apiOrders.map(order => (
                <button
                  key={order.id}
                  onClick={() => {
                    const table = tables.find(t => t.id === order.table_id);
                    if (table) handleTableSelect(table);
                    else alert(`Order #${order.id} for ${order.table_name || 'Unknown Table'}`);
                  }}
                  className="flex-none rounded-xl border border-blue-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md active:scale-95"
                >
                  <p className="text-[10px] font-bold uppercase text-blue-600">Table {order.table_name || order.table_id}</p>
                  <p className="text-sm font-extrabold text-slate-900">{activeRestaurant?.currency || '$'}{(Number(order.total_amount) || 0).toFixed(2)}</p>
                  <p className="mt-1 text-[9px] font-bold uppercase text-slate-400">ID: #{order.id}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tables */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">Floor plan</p>
              <h2 className="mt-0.5 text-base font-extrabold text-slate-900">Choose a table</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
              {displayTables?.length || 0} tables
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-5">
            {displayTables?.map((table) => (
              <button
                key={table.id}
                onClick={() => handleTableSelect(table)}
                className={`relative rounded-xl border p-3 text-center transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  selectedTable?.id === table.id
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-900/10'
                    : table.active_orders > 0
                    ? 'border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-400'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'
                }`}
              >
                {table.active_orders > 0 && (
                  <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-extrabold text-white shadow">
                    {table.active_orders}
                  </div>
                )}
                <p className="text-sm font-extrabold">{table.table_name}</p>
                <p className="mt-1 text-[10px] opacity-75">Capacity: {table.capacity ?? '—'}</p>
                <p className="mt-1 text-[9px] font-extrabold uppercase tracking-wide">
                  {table.active_orders > 0 ? 'ORDERED' : 'AVAILABLE'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Categories & Items */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {/* Search Bar & Voice */}
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              placeholder="Search menu items..."
            />
            <button 
              onClick={startVoiceCommand}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition ${isListening ? 'animate-pulse bg-rose-600' : 'bg-slate-900 hover:bg-slate-800'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              {isListening ? 'Listening...' : 'Voice Order'}
            </button>
          </div>
          
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition ${
                !selectedCategory
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
              }`}
            >
              All Items
            </button>
            {displayCategories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition ${
                  selectedCategory === cat.id
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          
          <div className="grid min-h-0 grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3 2xl:grid-cols-4">
            {displayItems?.filter(i => i.is_active).map((item) => (
              <button
                key={item.id}
                onClick={() => handleAddItem(item)}
                disabled={!selectedTable}
              className="group relative flex min-h-28 flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-sm font-bold leading-5 text-slate-800 group-hover:text-emerald-800">{item.name}</p>
                <p className="shrink-0 text-sm font-extrabold text-emerald-700">{activeRestaurant?.currency || 'USD'}{parseFloat(item.price).toFixed(2)}</p>
                </div>
                
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                  (item.stock_quantity || 0) <= 5 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                  }`}>
                  Stock {item.stock_quantity ?? 'N/A'}
                  </span>
                  
                  {(item.stock_quantity || 0) <= 0 && (
                    <span className="text-[10px] font-bold text-red-600 uppercase">Out of Stock</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Order */}
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-extrabold text-slate-900">
          {selectedTable ? `Order - ${selectedTable.table_name}` : 'Select a Table'}
        </h2>

        {/* Branch Switcher (Optional Quick Switch) */}
        <div className="mb-3 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">Branch: {activeRestaurant?.name}</span>
        </div>

        {/* Customer Details */}
        <div className="mb-3 space-y-2 border-b border-slate-100 pb-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">Select registered customer</label>
            <select 
              value={selectedCustomerId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedCustomerId(id);
                setCustomerError('');
                if (id) {
                  const cust = customers.find(c => String(c.id) === id);
                  if (cust) {
                    setCustomerName(cust.name || '');
                    setCustomerPhone(cust.phone || '');
                  }
                } else {
                  setCustomerName('');
                  setCustomerPhone('');
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
            >
              <option value="">-- Walk-in / enter customer details --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">Customer name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setSelectedCustomerId('');
                  setCustomerError('');
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                placeholder="Enter customer name"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">Mobile number</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => {
                  setCustomerPhone(e.target.value);
                  setSelectedCustomerId('');
                  setCustomerError('');
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                placeholder="e.g. +971 50 123 4567"
                autoComplete="tel"
              />
            </div>
          </div>
          {selectedCustomerId && (() => {
            const selectedCustomer = customers.find((customer) => String(customer.id) === String(selectedCustomerId));
            const loyaltyPoints = Number(selectedCustomer?.loyaltyPoints ?? selectedCustomer?.points ?? 0);
            return selectedCustomer ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                CRM member · {loyaltyPoints} loyalty points · {selectedCustomer.tier || 'Standard'} tier
              </p>
            ) : null;
          })()}
          {customerError && <p role="alert" className="text-xs font-semibold text-red-600">{customerError}</p>}
          <button
            onClick={() => {
              const name = customerName.trim();
              const phone = customerPhone.trim();
              const normalizedPhone = phone.replace(/\D/g, '');
              if (!name) {
                setCustomerError('Enter the customer name before adding them to CRM.');
                return;
              }
              if (normalizedPhone.length < 7 || normalizedPhone.length > 15) {
                setCustomerError('Enter a valid mobile number with 7 to 15 digits.');
                return;
              }

              const existingCustomer = customers.find(
                (customer) => String(customer.phone || '').replace(/\D/g, '') === normalizedPhone,
              );
              if (existingCustomer) {
                setSelectedCustomerId(String(existingCustomer.id));
                setCustomerName(existingCustomer.name || name);
                setCustomerPhone(existingCustomer.phone || phone);
                setCustomerError('This mobile number is already in CRM. The existing customer is selected.');
                return;
              }

              const newCustomer = {
                id: Date.now(),
                name,
                phone,
                email: '',
                visits: 0,
                totalSpent: 0,
                loyaltyPoints: 0,
                points: 0,
                tier: 'Standard',
                lastVisit: 'Never',
                created_at: new Date().toISOString()
              };
              const updated = [...customers, newCustomer];
              setCustomers(updated);
              localStorage.setItem('pos_customers', JSON.stringify(updated));
              setSelectedCustomerId(String(newCustomer.id));
              setCustomerError('');
            }}
            className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100"
            type="button"
          >
            + Add customer to CRM & loyalty
          </button>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">Employee ID</label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              placeholder="Employee ID"
            />
          </div>
        </div>

        {/* Order Items */}
        <div className="mb-3 min-h-0 flex-1 overflow-y-auto">
          {orderItems.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs font-medium text-slate-400">No items added</p>
          ) : (
            <div className="space-y-3">
              {orderItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800">{item.item_name}</p>
                    <p className="text-[11px] font-bold text-emerald-700">{activeRestaurant?.currency || 'USD'}{item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateQuantity(index, item.quantity - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-200"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-xs font-extrabold text-slate-800">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQuantity(index, item.quantity + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-200"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="px-1 text-lg font-bold text-rose-500 transition hover:text-rose-700"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Discount */}
        <div className="mb-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">Discount percentage (%)</label>
            <input
              type="number"
              value={discountPercentage}
              onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              min="0"
              max="100"
            />
          </div>
        </div>

        {/* Totals */}
        <div className="space-y-1.5 border-t border-slate-100 pt-3 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-bold text-slate-800">{activeRestaurant?.currency || 'USD'}{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Tax ({taxRate}%)</span>
            <span>{activeRestaurant?.currency || 'USD'}{taxAmount.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Discount{discountPercentage > 0 ? ` (${discountPercentage}%)` : ''}</span>
              <span>-{activeRestaurant?.currency || 'USD'}{discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2.5 text-white">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-300">Amount due</span>
            <span className="text-lg font-extrabold leading-none text-emerald-400">{activeRestaurant?.currency || 'USD'}{total.toFixed(2)}</span>
          </div>
        </div>
              
        {/* Payment Details */}
        {paymentType === 'split' && (
          <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <div className="flex justify-between"><span>Cash Paid:</span><span>{activeRestaurant?.currency || 'USD'}{cashAmount.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Card Paid:</span><span>{activeRestaurant?.currency || 'USD'}{cardAmount.toFixed(2)}</span></div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={handlePlaceOrder}
              disabled={!selectedTable || orderItems.length === 0}
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              Checkout / Bill
            </button>
            <button
              onClick={handleHoldBill}
              disabled={!selectedTable || orderItems.length === 0}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
            >
              Hold Bill
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-xl">🧾</span>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Bill checkout</h2>
                  <p className="text-xs text-slate-500">Table {selectedTable?.table_name} · Order #{currentOrder?.id}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowPaymentModal(false); setPaymentType(''); }}
                className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close bill checkout"
              >✕</button>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
              <div className="min-w-0 rounded-xl border border-slate-200">
                <div className="flex justify-between border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                  <span>Order items</span><span>{orderItems.length} lines</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 px-3">
                  {orderItems.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="flex justify-between gap-3 py-2 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-800">{item.item_name}</p>
                        <p className="text-[10px] text-slate-500">{item.quantity} × {activeRestaurant?.currency || 'USD'}{Number(item.price).toFixed(2)}</p>
                      </div>
                      <span className="shrink-0 font-bold text-slate-800">{activeRestaurant?.currency || 'USD'}{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5 border-t border-slate-100 bg-slate-50 px-3 py-3 text-xs">
                  <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{activeRestaurant?.currency || 'USD'}{subtotal.toFixed(2)}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between font-semibold text-emerald-700"><span>Discount{discountPercentage > 0 ? ` (${discountPercentage}%)` : ''}</span><span>-{activeRestaurant?.currency || 'USD'}{discountAmount.toFixed(2)}</span></div>}
                  <div className="flex justify-between text-slate-500"><span>Tax ({taxRate}%)</span><span>{activeRestaurant?.currency || 'USD'}{taxAmount.toFixed(2)}</span></div>
                  <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2.5 text-white">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-300">Amount due</span>
                    <span className="text-xl font-extrabold leading-none text-emerald-400">{activeRestaurant?.currency || 'USD'}{total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Payment method</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'cash', label: 'Cash', icon: '💵' },
                    { id: 'card', label: 'Card', icon: '💳' },
                    { id: 'apple_pay', label: 'Apple Pay', icon: '' },
                    { id: 'google_pay', label: 'Google Pay', icon: '📱' },
                    { id: 'crypto', label: 'Crypto', icon: '₿' },
                    { id: 'split', label: 'Split', icon: '🔄' },
                    { id: 'later', label: 'Pay later', icon: '⏳' },
                  ].map(method => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => {
                        setPaymentType(method.id);
                        if (method.id === 'cash') setAmountTendered(total.toFixed(2));
                        if (method.id === 'split') {
                          const halfCash = Math.floor(total * 50) / 100;
                          setCashAmount(halfCash);
                          setCardAmount(Number((total - halfCash).toFixed(2)));
                        }
                      }}
                      className={`rounded-xl border px-2 py-2 text-xs font-bold transition ${
                        paymentType === method.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="mr-1">{method.icon}</span>{method.label}
                    </button>
                  ))}
                </div>

                {paymentType === 'cash' && (
                  <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                    <div className="grid grid-cols-3 gap-1.5">
                      <button onClick={() => setAmountTendered(total.toFixed(2))} className="rounded-lg border border-emerald-200 bg-white py-1.5 text-[10px] font-extrabold text-emerald-800">Exact</button>
                      {[10, 20, 50, 100, 200].map(amount => (
                        <button key={amount} onClick={() => setAmountTendered(String(amount))} className="rounded-lg border border-slate-200 bg-white py-1.5 text-[10px] font-bold text-slate-700">{activeRestaurant?.currency || 'USD'}{amount}</button>
                      ))}
                    </div>
                    <label className="block text-[11px] font-bold text-slate-600">
                      Amount tendered
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amountTendered}
                        onChange={event => setAmountTendered(event.target.value)}
                        className="mt-1 w-full rounded-xl border-2 border-emerald-300 bg-white px-3 py-2 text-center text-xl font-extrabold text-slate-900 outline-none focus:border-emerald-500"
                      />
                    </label>
                    <div className={`rounded-xl px-3 py-2 text-center ${changeDue > 0 ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700'}`}>
                      <span className="text-[10px] font-extrabold uppercase tracking-wide">Change due</span>
                      <p className="text-2xl font-black">{activeRestaurant?.currency || 'USD'}{changeDue.toFixed(2)}</p>
                    </div>
                  </div>
                )}

                {paymentType === 'split' && (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <label className="block text-[11px] font-bold text-slate-600">Cash amount
                      <input type="number" min="0" step="0.01" value={cashAmount} onChange={event => {
                        const cash = Math.max(0, Number(event.target.value) || 0);
                        setCashAmount(cash);
                        setCardAmount(Number(Math.max(0, total - cash).toFixed(2)));
                      }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
                    </label>
                    <label className="block text-[11px] font-bold text-slate-600">Card amount
                      <input type="number" min="0" step="0.01" value={cardAmount} onChange={event => {
                        const card = Math.max(0, Number(event.target.value) || 0);
                        setCardAmount(card);
                        setCashAmount(Number(Math.max(0, total - card).toFixed(2)));
                      }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
                    </label>
                  </div>
                )}
                {paymentType === 'later' && <p className="rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800">This bill will be saved as pending payment.</p>}

                <button
                  type="button"
                  onClick={handlePreviewBill}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50"
                >🧾 Preview / Print Bill</button>
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 pt-3">
              {paymentType !== 'select' && (
                <button onClick={() => setPaymentType('select')} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50">Back</button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (paymentType === 'select') {
                    setPaymentType('cash');
                    setAmountTendered(total.toFixed(2));
                  } else {
                    handlePayment(paymentType);
                  }
                }}
                disabled={paymentType === 'select' || (paymentType === 'cash' && (parseFloat(amountTendered) || 0) < total) || (paymentType === 'split' && Math.round((Number(cashAmount) + Number(cardAmount)) * 100) !== Math.round(total * 100))}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {paymentType === 'later' ? 'Save pending bill' : 'Complete payment'}
              </button>
            </div>
          </div>
        </div>
      )}
      {receiptOrder && (
        <ThermalReceipt
          order={receiptOrder}
          storeInfo={{
            name: activeRestaurant?.name || 'Restaurant',
            address: activeRestaurant?.address || '',
            phone: activeRestaurant?.phone || '',
            currency: activeRestaurant?.currency || 'USD',
          }}
          onClose={() => setReceiptOrder(null)}
        />
      )}
      </div>

      {/* Cash Drawer & Shift Manager Modal */}
      <ShiftManager
        isOpen={showShiftManager}
        onClose={() => setShowShiftManager(false)}
        currentCashier={user?.username || 'Admin'}
      />
    </div>
  );
}
