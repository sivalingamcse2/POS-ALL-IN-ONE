const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
require('dotenv').config();

const authenticateToken = async (req, res, next) => {
  console.log(`[AUTH_CHECK] Incoming: ${req.method} ${req.originalUrl} from ${req.ip}`);
  // Helper to detect if request is from local network
  const isLocalIP = (ip) => {
    if (!ip) return false;
    const cleanIP = ip.replace('::ffff:', '').trim();
    
    const isLocal = (
      cleanIP === '127.0.0.1' || 
      cleanIP === '::1' || 
      cleanIP.startsWith('192.168.') || 
      cleanIP.startsWith('10.') || 
      cleanIP.startsWith('172.16.') || 
      cleanIP.startsWith('172.17.') || 
      cleanIP.startsWith('172.18.') || 
      cleanIP.startsWith('172.19.') || 
      cleanIP.startsWith('172.20.') || 
      cleanIP.startsWith('172.21.') || 
      cleanIP.startsWith('172.22.') || 
      cleanIP.startsWith('172.23.') || 
      cleanIP.startsWith('172.24.') || 
      cleanIP.startsWith('172.25.') || 
      cleanIP.startsWith('172.26.') || 
      cleanIP.startsWith('172.27.') || 
      cleanIP.startsWith('172.28.') || 
      cleanIP.startsWith('172.29.') || 
      cleanIP.startsWith('172.30.') || 
      cleanIP.startsWith('172.31.') ||
      cleanIP.startsWith('fe80:') || // IPv6 Link-Local
      cleanIP.startsWith('fc00:') || // IPv6 Unique Local
      cleanIP.startsWith('fd00:')    // IPv6 Unique Local
    );

    console.log(`[NET_CHECK] IP: ${ip} | Clean: ${cleanIP} | Local: ${isLocal}`);
    return isLocal;
  };

  const clientIP = req.ip || req.connection.remoteAddress;

  // GLOBAL NETWORK LOCK: Only allow Local/Hotel Wi-Fi
  if (!isLocalIP(clientIP)) {
    console.warn(`[GLOBAL_SECURITY] Blocked external request from: ${clientIP}`);
    return res.status(403).json({ 
      error: 'NETWORK_RESTRICTED', 
      message: 'Access Denied. This system is only accessible via the internal Hotel Wi-Fi network for security reasons.' 
    });
  }

  // 0. ABSOLUTE BYPASS FOR GUESTS
  // These read paths are public for guest menu/QR browsing ONLY when no token is
  // present. If a staff Bearer token IS supplied we must continue to full
  // validation below so req.user is populated and checkPermission/Admin works.
  const bypassPaths = ['/api/public/', '/api/pos/orders/guest', '/api/pos/tables', '/api/menu/items', '/api/menu/categories'];
  if (bypassPaths.some(path => req.originalUrl.includes(path))) {
    if (req.method === 'GET' || req.method === 'POST' || req.method === 'OPTIONS') {
      const guestToken = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];
      if (!guestToken) {
        return next();
      }
    }
  }

  // 1. Regular Token Validation
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const restaurantId = req.headers['x-restaurant-id'];

  if (!token) {
    console.warn(`[AUTH_DENIED] No token for: ${req.originalUrl}`);
    return res.status(401).json({ error: 'SYSTEM_PROTECTED_AREA_ACCESS_DENIED' });
  }

  let tokenUser;
  try {
    tokenUser = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  try {
    const currentUser = await User.findById(tokenUser.id);
    if (
      !currentUser
      || !currentUser.is_active
      || (currentUser.account_status && currentUser.account_status !== 'active')
    ) {
      return res.status(401).json({ error: 'Account is inactive or no longer available' });
    }
    if (Number(tokenUser.token_version || 0) !== Number(currentUser.token_version || 0)) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }

    const roleName = currentUser.role_name || tokenUser.role;
    const isAdmin = roleName === 'Admin';
    const restaurants = isAdmin
      ? await Restaurant.findAll()
      : await User.getRestaurants(currentUser.id);
    const requestedRestaurantId = restaurantId || tokenUser.restaurant_id || restaurants[0]?.id;
    const selectedRestaurant = restaurants.find(
      restaurant => Number(restaurant.id) === Number(requestedRestaurantId)
    );

    if (!selectedRestaurant) {
      return res.status(403).json({ error: 'Access denied for this restaurant' });
    }

    req.user = {
      ...tokenUser,
      id: currentUser.id,
      username: currentUser.username,
      role_id: currentUser.role_id,
      role: roleName,
      role_name: roleName,
      permissions: currentUser.permissions || {},
      full_name: currentUser.full_name,
      employee_id: currentUser.employee_id,
      token_version: Number(currentUser.token_version) || 0,
      restaurants,
      restaurant_id: Number(selectedRestaurant.id),
      restaurant_ids: restaurants.map(restaurant => Number(restaurant.id)),
    };
    return next();
  } catch (error) {
    console.error('Authentication context lookup error:', error);
    return res.status(500).json({ error: 'Unable to verify account access' });
  }
};

const checkPermission = (module, action = 'View') => {
  return (req, res, next) => {
    if (req.user?.role_name === 'Admin') return next();

    const permission = req.user?.permissions?.[module];
    const allowed = typeof permission === 'boolean'
      ? permission
      : permission?.[action] === true;
    if (!allowed) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    return next();
  };
};

const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    const { role } = req.user;
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Access denied. Role not authorized.' });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  checkPermission,
  checkRole
};
