import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

// Offline/demo session used when no API server is reachable (e.g. the static
// GitHub Pages deployment). The rest of the app already runs on localStorage
// data, so an admin session works fully client-side in that mode.
const DEMO_TOKEN = 'demo-mode';
const DEMO_USER = {
  id: 1,
  username: 'admin',
  role: 'Admin',
  role_name: 'Admin',
  permissions: { POS: true, Inventory: true, Reports: true, UserMgmt: true, Settings: true },
  restaurants: [{ id: 1, name: 'SIVARA Main Branch', address: '123 Commercial Plaza', currency: 'USD', tax_rate: 10 }],
  restaurant_id: 1,
};

const safeJsonParse = (raw, fallback) => {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activeRestaurant, setActiveRestaurant] = useState(() => {
    const saved = localStorage.getItem('active_restaurant');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize restaurants if empty
    let restaurants = JSON.parse(localStorage.getItem('pos_restaurants') || '[]');
    if (restaurants.length === 0) {
      restaurants = [{
        id: 1,
        name: 'SIVARA Main Branch',
        address: '123 Hospitality Way, Silicon Valley',
        phone: '+1-555-SIVARA',
        email: 'info@sivara-group.com',
        currency: '$',
        tax_rate: 10.00
      }];
      localStorage.setItem('pos_restaurants', JSON.stringify(restaurants));
      localStorage.setItem('pos_restaurant', JSON.stringify(restaurants[0]));
    }

    // Initialize Categories
    const existingCats = JSON.parse(localStorage.getItem('pos_categories') || '[]');
    if (existingCats.length === 0) {
      const defaultCategories = [
        { id: 1, name: 'Appetizers' },
        { id: 2, name: 'Main Course' },
        { id: 3, name: 'Desserts' },
        { id: 4, name: 'Beverages' },
      ];
      localStorage.setItem('pos_categories', JSON.stringify(defaultCategories));
    }

    // Initialize Menu Items
    const existingItems = JSON.parse(localStorage.getItem('pos_menu_items') || '[]');
    if (existingItems.length === 0) {
      const defaultItems = [
        { id: 1, name: 'Caesar Salad', price: 12.50, category_id: 1, is_active: true, stock_quantity: 50, description: 'Crisp romaine, parmesan, and garlic croutons.' },
        { id: 2, name: 'Truffle Fries', price: 9.00, category_id: 1, is_active: true, stock_quantity: 100, description: 'Golden fries tossed in white truffle oil.' },
        { id: 3, name: 'SIVARA Signature Steak', price: 45.00, category_id: 2, is_active: true, stock_quantity: 20, description: 'Aged ribeye with red wine reduction.' },
        { id: 4, name: 'Grilled Salmon', price: 28.00, category_id: 2, is_active: true, stock_quantity: 15, description: 'Wild-caught salmon with lemon butter sauce.' },
        { id: 5, name: 'Pasta Carbonara', price: 18.00, category_id: 2, is_active: true, stock_quantity: 30, description: 'Creamy egg sauce with crispy pancetta.' },
        { id: 6, name: 'Lava Cake', price: 12.00, category_id: 3, is_active: true, stock_quantity: 25, description: 'Warm chocolate cake with melting center.' },
        { id: 7, name: 'Vanilla Bean Gelato', price: 6.00, category_id: 3, is_active: true, stock_quantity: 40, description: 'Smooth Madagascar vanilla bean ice cream.' },
        { id: 8, name: 'Espresso Martini', price: 14.00, category_id: 4, is_active: true, stock_quantity: 100, description: 'Vodka, espresso, and coffee liqueur.' },
        { id: 9, name: 'Fresh Watermelon Juice', price: 7.50, category_id: 4, is_active: true, stock_quantity: 50, description: 'Pure squeezed watermelon with mint.' },
      ];
      localStorage.setItem('pos_menu_items', JSON.stringify(defaultItems));
    }

    // Initialize Tables
    const existingTables = JSON.parse(localStorage.getItem('pos_tables') || '[]');
    if (existingTables.length === 0) {
      const defaultTables = [
        { id: 1, table_name: 'Table 01', status: 'available' },
        { id: 2, table_name: 'Table 02', status: 'available' },
        { id: 3, table_name: 'Table 03', status: 'available' },
        { id: 4, table_name: 'Table 04', status: 'available' },
        { id: 5, table_name: 'Table 05', status: 'available' },
        { id: 6, table_name: 'VIP 01', status: 'available' },
      ];
      localStorage.setItem('pos_tables', JSON.stringify(defaultTables));
    }
    
    const validateSession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Demo sessions never call the server; restore them from local storage.
      if (token === DEMO_TOKEN) {
        const savedUser = safeJsonParse(localStorage.getItem('user'), null);
        if (savedUser && savedUser.username) {
          setUser(savedUser);
          const savedRestaurant = safeJsonParse(localStorage.getItem('active_restaurant'), null);
          setActiveRestaurant(savedRestaurant || savedUser.restaurants?.[0] || null);
        } else {
          localStorage.removeItem('token');
          setUser(null);
        }
        setLoading(false);
        return;
      }

      try {
        localStorage.removeItem('active_restaurant');
        const { data: serverUser } = await authApi.me();
        setUser(serverUser);
        localStorage.setItem('user', JSON.stringify(serverUser));
        const permittedRestaurants = serverUser.restaurants || [];
        const selectedRestaurant = permittedRestaurants.find(
          restaurant => Number(restaurant.id) === Number(serverUser.restaurant_id)
        ) || permittedRestaurants[0] || null;
        if (selectedRestaurant) {
          setActiveRestaurant(selectedRestaurant);
          localStorage.setItem('active_restaurant', JSON.stringify(selectedRestaurant));
        } else {
          setActiveRestaurant(null);
          localStorage.removeItem('active_restaurant');
        }
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setActiveRestaurant(null);
        console.error('Unable to restore the authenticated session:', error);
      } finally {
        setLoading(false);
      }
    };
    validateSession();
  }, []);

  const switchRestaurant = (res) => {
    setActiveRestaurant(res);
    localStorage.setItem('active_restaurant', JSON.stringify(res));
  };

  const login = async (username, password) => {
    try {
      const { data } = await authApi.login({ identifier: username, password });
      const userData = data.user;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      const selectedRestaurant = userData.restaurants?.find(
        restaurant => Number(restaurant.id) === Number(userData.restaurant_id)
      ) || userData.restaurants?.[0] || null;
      setActiveRestaurant(selectedRestaurant);
      if (selectedRestaurant) {
        localStorage.setItem('active_restaurant', JSON.stringify(selectedRestaurant));
      } else {
        localStorage.removeItem('active_restaurant');
      }
      return userData;
    } catch (error) {
      // Static hosting (GitHub Pages) rejects POSTs with 405 and has no /api at
      // all (404 / network failure). In that situation, allow the advertised
      // demo credentials to start a local-only session so the UI stays usable.
      const status = error.response?.status;
      const serverUnreachable = !error.response || status === 404 || status === 405;
      if (serverUnreachable && username === 'admin' && password === 'admin123') {
        localStorage.setItem('token', DEMO_TOKEN);
        localStorage.setItem('user', JSON.stringify(DEMO_USER));
        localStorage.setItem('active_restaurant', JSON.stringify(DEMO_USER.restaurants[0]));
        setUser(DEMO_USER);
        setActiveRestaurant(DEMO_USER.restaurants[0]);
        return DEMO_USER;
      }
      throw new Error(error.response?.data?.error || error.message || 'Login failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const hasPermission = (module, action = 'View') => {
    if (!user?.permissions) return false;
    // Admins always have permission
    if (user.role_name === 'Admin' || user.role === 'Admin') return true;
    const permission = user.permissions[module];
    return permission === true || permission?.[action] === true;
  };

  const isAdmin = () => {
    return user?.role_name === 'Admin';
  };

  const value = {
    user,
    setUser,
    activeRestaurant,
    setActiveRestaurant,
    switchRestaurant,
    loading,
    login,
    logout,
    hasPermission,
    isAdmin,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}