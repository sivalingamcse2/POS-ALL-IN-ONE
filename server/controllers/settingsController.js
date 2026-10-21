const Settings = require('../models/Settings');
const Activity = require('../models/Activity');

const writeSettingsActivity = async (req, action, details) => {
  try {
    await Activity.create({
      user_id: req.user.id,
      restaurant_id: req.user.restaurant_id,
      action,
      details,
    });
    return null;
  } catch (error) {
    console.error(`Audit log write failed for ${action}:`, error);
    return 'The setting was saved, but its audit record could not be saved.';
  }
};

const settingsController = {
  async getSecurityPolicy(req, res) {
    try {
      res.json(await Settings.getSecurityPolicy());
    } catch (error) {
      console.error('Get security policy error:', error);
      res.status(500).json({ error: 'Unable to load security policy' });
    }
  },

  async saveSecurityPolicy(req, res) {
    const { sessionTimeoutMinutes, requireStrongPasswords, maxFailedLogins } = req.body;
    const timeout = Number(sessionTimeoutMinutes);
    const attempts = Number(maxFailedLogins);
    if (!Number.isInteger(timeout) || timeout < 5 || timeout > 1440) {
      return res.status(400).json({ error: 'Session timeout must be between 5 and 1440 minutes' });
    }
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 20) {
      return res.status(400).json({ error: 'Maximum failed logins must be between 1 and 20' });
    }
    if (typeof requireStrongPasswords !== 'boolean') {
      return res.status(400).json({ error: 'Strong password policy must be enabled or disabled' });
    }

    try {
      const policy = await Settings.saveSecurityPolicy({
        sessionTimeoutMinutes: timeout,
        requireStrongPasswords,
        maxFailedLogins: attempts,
      });
      const auditWarning = await writeSettingsActivity(
        req,
        'Update Security Policy',
        `Set session timeout to ${timeout} minutes, maximum failed logins to ${attempts}, and strong password policy to ${requireStrongPasswords ? 'required' : 'not required'}`
      );
      res.json({ policy, audit_warning: auditWarning });
    } catch (error) {
      console.error('Save security policy error:', error);
      res.status(500).json({ error: 'Unable to save security policy' });
    }
  },

  async getMenuAssignment(req, res) {
    const restaurantId = Number(req.params.restaurantId);
    if (!Number.isInteger(restaurantId) || restaurantId < 1) {
      return res.status(400).json({ error: 'A valid store ID is required' });
    }
    try {
      res.json(await Settings.getMenuAssignment(restaurantId));
    } catch (error) {
      console.error('Get menu assignment error:', error);
      res.status(500).json({ error: 'Unable to load menu assignment' });
    }
  },

  async saveMenuAssignment(req, res) {
    const restaurantId = Number(req.params.restaurantId);
    const itemIds = req.body.item_ids;
    if (!Number.isInteger(restaurantId) || restaurantId < 1) {
      return res.status(400).json({ error: 'A valid store ID is required' });
    }
    if (!Array.isArray(itemIds) || itemIds.some(id => !Number.isInteger(Number(id)) || Number(id) < 1)) {
      return res.status(400).json({ error: 'Menu item IDs must be a list of positive integers' });
    }

    try {
      const savedIds = await Settings.saveMenuAssignment(restaurantId, itemIds);
      const auditWarning = await writeSettingsActivity(
        req,
        'Update Store Menu Assignment',
        `Assigned ${savedIds.length} menu items to store ${restaurantId}`
      );
      res.json({ restaurant_id: restaurantId, item_ids: savedIds, audit_warning: auditWarning });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message });
      console.error('Save menu assignment error:', error);
      res.status(500).json({ error: 'Unable to save menu assignment' });
    }
  },

  async getAuditLog(req, res) {
    try {
      const activities = await Activity.findAll({
        restaurant_id: req.query.restaurant_id || req.user.restaurant_id,
      });
      res.json(activities);
    } catch (error) {
      console.error('Get settings audit log error:', error);
      res.status(500).json({ error: 'Unable to load audit log' });
    }
  },
};

module.exports = settingsController;
