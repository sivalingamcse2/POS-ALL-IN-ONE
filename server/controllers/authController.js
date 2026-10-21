const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Activity = require('../models/Activity');
const Restaurant = require('../models/Restaurant');
require('dotenv').config();

const authController = {
  async login(req, res) {
    try {
      const { username, identifier = username, password } = req.body;

      if (!identifier || !password) {
        return res.status(400).json({ error: 'Username, employee ID, or email and password are required' });
      }

      const user = await User.findByUsername(identifier);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isMatch = await User.verifyPassword(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (!user.is_active || (user.account_status && user.account_status !== 'active')) {
        return res.status(403).json({
          error: user.account_status === 'pending_activation'
            ? 'Complete account setup using your activation link before signing in'
            : 'Account is suspended',
        });
      }

      // Get allowed restaurants
      const restaurants = user.role_name === 'Admin'
        ? await Restaurant.findAll()
        : await User.getRestaurants(user.id);
      
      // Update last login
      await User.updateLastLogin(user.id);
      await Activity.create({
        user_id: user.id,
        restaurant_id: restaurants.find(restaurant => restaurant.is_default)?.id || restaurants[0]?.id || null,
        action: 'Login',
        details: 'Successful employee sign-in',
      });

      const userData = {
        id: user.id,
        username: user.username,
        email: user.email,
        role_id: user.role_id,
        role: user.role_name,
        role_name: user.role_name,
        permissions: user.permissions,
        restaurants,
        restaurant_id: restaurants.find(restaurant => restaurant.is_default)?.id || restaurants[0]?.id,
        full_name: user.full_name,
        employee_id: user.employee_id,
        token_version: Number(user.token_version) || 0,
      };

      // Create token
      const token = jwt.sign(userData, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      });

      res.json({
        token,
        user: userData
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Server error during login' });
    }
  },

  async logout(req, res) {
    try {
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Server error during logout' });
    }
  },

  async me(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const restaurants = user.role_name === 'Admin'
        ? await Restaurant.findAll()
        : await User.getRestaurants(user.id);

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        role_id: user.role_id,
        role: user.role_name,
        role_name: user.role_name,
        permissions: user.permissions,
        restaurants,
        restaurant_id: restaurants.find(restaurant => restaurant.is_default)?.id || restaurants[0]?.id,
        full_name: user.full_name,
        employee_id: user.employee_id,
        token_version: Number(user.token_version) || 0,
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async changePassword(req, res) {
    try {
      const { current_password, new_password } = req.body;
      if (
        typeof new_password !== 'string'
        || new_password.length < 12
        || new_password.length > 128
      ) {
        return res.status(400).json({ error: 'Password must be between 12 and 128 characters' });
      }
      const user = await User.findByUsername(req.user.username);
      if (!user || !(await User.verifyPassword(current_password, user.password))) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      await User.updatePassword(req.user.id, new_password);
      let auditWarning = null;
      try {
        await Activity.create({
          user_id: req.user.id,
          restaurant_id: req.user.restaurant_id,
          action: 'Change Password',
          details: 'Employee changed their own password',
        });
      } catch (auditError) {
        console.error('Audit log write failed for password change:', auditError);
        auditWarning = 'Your password changed, but its audit record could not be saved.';
      }
      res.json({ message: 'Password changed. Please sign in again.', audit_warning: auditWarning });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = authController;
