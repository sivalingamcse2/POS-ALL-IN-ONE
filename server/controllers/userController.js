const User = require('../models/User');
const Role = require('../models/Role');
const Activity = require('../models/Activity');
const Restaurant = require('../models/Restaurant');

const PASSWORD_MIN_LENGTH = 12;
const PERMISSION_ACTIONS = ['View', 'Create', 'Edit', 'Delete', 'Approve', 'Export', 'Import', 'Print'];

const fail = (res, error, action) => {
  console.error(`${action} error:`, error);
  if (error.code === 'ROLE_IN_USE') {
    return res.status(409).json({ error: 'This role is built-in or assigned to employees and cannot be deleted' });
  }
  if (error.code === '23505') {
    return res.status(409).json({ error: 'Username, email, or employee ID is already in use' });
  }
  if (error.code === '23503') {
    return res.status(400).json({ error: 'Selected role or restaurant does not exist' });
  }
  return res.status(500).json({ error: 'Server error' });
};

const isAdmin = req => req.user?.role_name === 'Admin';
const userInScope = (target, req) => isAdmin(req)
  || (target.restaurant_ids || []).some(id => req.user?.restaurant_ids?.includes(Number(id)));

const grants = (permissions, module, action) => (
  permissions?.[module] === true || permissions?.[module]?.[action] === true
);

const roleWithinActorAccess = (permissions, req) => {
  if (isAdmin(req)) return true;
  return Object.keys(permissions || {}).every(module => (
    PERMISSION_ACTIONS.every(action => (
      !grants(permissions, module, action) || grants(req.user?.permissions, module, action)
    ))
  ));
};

const canManageTarget = (target, req) => userInScope(target, req)
  && (isAdmin(req) || (
    target.role_name !== 'Admin'
    && roleWithinActorAccess(target.permissions, req)
  ));

const validatePassword = password => (
  typeof password === 'string'
  && password.length >= PASSWORD_MIN_LENGTH
  && password.length <= 128
);

const validEmployeeProfile = ({ username, email, full_name, employee_id }) => (
  typeof username === 'string' && username.trim().length > 0 && username.trim().length <= 100
  && typeof full_name === 'string' && full_name.trim().length > 0 && full_name.trim().length <= 150
  && typeof employee_id === 'string' && employee_id.trim().length > 0 && employee_id.trim().length <= 50
  && (email == null || email === '' || (
    typeof email === 'string'
    && email.length <= 255
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ))
);

const logActivity = async (req, action, details) => {
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
    return 'The account change succeeded, but its audit record could not be saved.';
  }
};

const getAssignedRestaurants = async ids => {
  const allRestaurants = await Restaurant.findAll();
  const byId = new Map(allRestaurants.map(restaurant => [Number(restaurant.id), restaurant]));
  if (ids.some(id => !byId.has(id))) return null;
  return ids.map(id => byId.get(id));
};

const userController = {
  async getAll(req, res) {
    try {
      const requestedId = req.query.restaurant_id
        ? Number(req.query.restaurant_id)
        : (isAdmin(req) ? null : req.user.restaurant_id);
      if (!isAdmin(req) && !req.user.restaurant_ids.includes(Number(requestedId))) {
        return res.status(403).json({ error: 'Access denied for this restaurant' });
      }
      const users = await User.findAll(requestedId);
      res.json(users.filter(user => canManageTarget(user, req)));
    } catch (error) {
      return fail(res, error, 'Get users');
    }
  },

  async getById(req, res) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (!canManageTarget(user, req)) return res.status(403).json({ error: 'Access denied for this employee' });
      res.json(user);
    } catch (error) {
      return fail(res, error, 'Get user');
    }
  },

  async create(req, res) {
    try {
      const { username, email, full_name, employee_id, restaurant_ids, role_id } = req.body;
      if (
        !validEmployeeProfile(req.body)
        || !Array.isArray(restaurant_ids) || restaurant_ids.length === 0
        || !role_id
      ) {
        return res.status(400).json({ error: 'Name, employee ID, username, role, and at least one restaurant are required' });
      }
      const assignedIds = [...new Set(restaurant_ids.map(Number))];
      if (assignedIds.some(id => !Number.isInteger(id) || id <= 0)) {
        return res.status(400).json({ error: 'Restaurant assignments are invalid' });
      }
      if (!isAdmin(req) && assignedIds.some(id => !req.user.restaurant_ids.includes(id))) {
        return res.status(403).json({ error: 'You can only assign employees to your restaurants' });
      }
      const assignedRestaurants = await getAssignedRestaurants(assignedIds);
      if (!assignedRestaurants) {
        return res.status(400).json({ error: 'One or more assigned restaurants do not exist' });
      }
      const role = await Role.findById(role_id);
      if (!role) return res.status(400).json({ error: 'Selected role does not exist' });
      if (!roleWithinActorAccess(role.permissions, req)) {
        return res.status(403).json({ error: 'You cannot assign a role with permissions greater than your own' });
      }

      const result = await User.create({
        username,
        email,
        full_name,
        employee_id,
        restaurant_ids: assignedIds,
        restaurants: assignedRestaurants,
        role_id,
        role_name: role.name,
        permissions: role.permissions,
      });
      const auditWarning = await logActivity(req, 'Create Employee', `Created employee ${employee_id} (${username})`);
      res.status(201).json({
        user: result.user,
        activation_token: result.invitationToken,
        activation_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        audit_warning: auditWarning,
      });
    } catch (error) {
      return fail(res, error, 'Create employee');
    }
  },

  async update(req, res) {
    try {
      const currentUser = await User.findById(req.params.id);
      if (!currentUser) return res.status(404).json({ error: 'User not found' });
      if (!canManageTarget(currentUser, req)) return res.status(403).json({ error: 'Access denied for this employee' });

      const { username, email, full_name, employee_id, restaurant_ids, role_id, account_status } = req.body;
      if (
        !validEmployeeProfile(req.body)
        || !role_id
        || !Array.isArray(restaurant_ids) || restaurant_ids.length === 0
        || !['active', 'suspended', 'pending_activation'].includes(account_status)
      ) {
        return res.status(400).json({ error: 'Employee identity, role, status, and restaurant assignments are required' });
      }
      if (Number(req.params.id) === Number(req.user.id) && account_status !== 'active') {
        return res.status(400).json({ error: 'You cannot suspend your own account' });
      }
      if (account_status === 'pending_activation' && currentUser.account_status !== 'pending_activation') {
        return res.status(400).json({ error: 'Use the password setup workflow to create a pending activation' });
      }
      const assignedIds = [...new Set(restaurant_ids.map(Number))];
      if (assignedIds.some(id => !Number.isInteger(id) || id <= 0)) {
        return res.status(400).json({ error: 'Restaurant assignments are invalid' });
      }
      if (!isAdmin(req) && assignedIds.some(id => !req.user.restaurant_ids.includes(id))) {
        return res.status(403).json({ error: 'You can only assign employees to your restaurants' });
      }
      if (!(await getAssignedRestaurants(assignedIds))) {
        return res.status(400).json({ error: 'One or more assigned restaurants do not exist' });
      }
      const role = await Role.findById(role_id);
      if (!role) return res.status(400).json({ error: 'Selected role does not exist' });
      if (!roleWithinActorAccess(role.permissions, req)) {
        return res.status(403).json({ error: 'You cannot assign a role with permissions greater than your own' });
      }
      if (
        account_status === 'active'
        && currentUser.account_status === 'pending_activation'
        && !currentUser.is_active
      ) {
        return res.status(400).json({ error: 'Pending employees must set their password using their activation link' });
      }

      const updated = await User.update(req.params.id, {
        username,
        email,
        full_name,
        employee_id,
        restaurant_ids: assignedIds,
        role_id,
        account_status,
      });
      const auditWarning = await logActivity(req, 'Update Employee Access', `Updated employee ${employee_id} (${username})`);
      res.json({ user: updated, audit_warning: auditWarning });
    } catch (error) {
      return fail(res, error, 'Update employee');
    }
  },

  async resetPassword(req, res) {
    try {
      const target = await User.findById(req.params.id);
      if (!target) return res.status(404).json({ error: 'User not found' });
      if (!canManageTarget(target, req)) return res.status(403).json({ error: 'Access denied for this employee' });
      const result = await User.issuePasswordSetup(req.params.id);
      const auditWarning = await logActivity(req, 'Initiate Password Setup', `Issued a single-use password setup link for ${target.employee_id || target.username}`);
      res.json({
        message: 'Single-use password setup link created. Share it with the employee through a trusted channel.',
        activation_token: result.invitationToken,
        activation_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        audit_warning: auditWarning,
      });
    } catch (error) {
      return fail(res, error, 'Initiate password setup');
    }
  },

  async activate(req, res) {
    try {
      const { token, password } = req.body;
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token) || !validatePassword(password)) {
        return res.status(400).json({ error: `A valid setup token and password of at least ${PASSWORD_MIN_LENGTH} characters are required` });
      }
      const user = await User.activateWithToken(token, password);
      if (!user) return res.status(400).json({ error: 'Setup link is invalid or expired' });
      let auditWarning = null;
      try {
        await Activity.create({
          user_id: user.id,
          restaurant_id: user.restaurants?.[0]?.id || null,
          action: 'Activate Employee Account',
          details: 'Employee completed password setup',
        });
      } catch (error) {
        console.error('Audit log write failed for account activation:', error);
        auditWarning = 'Your password was set, but the audit record could not be saved.';
      }
      res.json({ message: 'Password set successfully. You can now sign in.', audit_warning: auditWarning });
    } catch (error) {
      return fail(res, error, 'Activate employee account');
    }
  },

  async delete(req, res) {
    try {
      if (Number(req.params.id) === Number(req.user.id)) {
        return res.status(400).json({ error: 'You cannot suspend your own account' });
      }
      const target = await User.findById(req.params.id);
      if (!target) return res.status(404).json({ error: 'User not found' });
      if (!canManageTarget(target, req)) return res.status(403).json({ error: 'Access denied for this employee' });
      await User.delete(req.params.id);
      const auditWarning = await logActivity(req, 'Suspend Employee', `Suspended employee ${target.employee_id || target.username}`);
      res.json({ message: 'Employee suspended. Existing sessions have been revoked.', audit_warning: auditWarning });
    } catch (error) {
      return fail(res, error, 'Suspend employee');
    }
  },

  async getAllRoles(req, res) {
    try {
      res.json(await Role.findAll());
    } catch (error) {
      return fail(res, error, 'Get roles');
    }
  },

  async getRoleById(req, res) {
    try {
      const role = await Role.findById(req.params.id);
      if (!role) return res.status(404).json({ error: 'Role not found' });
      res.json(role);
    } catch (error) {
      return fail(res, error, 'Get role');
    }
  },

  async createRole(req, res) {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Only an Admin can manage roles' });
    try {
      if (
        typeof req.body.name !== 'string' || !req.body.name.trim() || req.body.name.trim().length > 100
        || !req.body.permissions || typeof req.body.permissions !== 'object' || Array.isArray(req.body.permissions)
      ) {
        return res.status(400).json({ error: 'Role name and permissions are required' });
      }
      const role = await Role.create(req.body);
      const auditWarning = await logActivity(req, 'Create Role', `Created role ${role.name}`);
      res.status(201).json({ role, audit_warning: auditWarning });
    } catch (error) {
      return fail(res, error, 'Create role');
    }
  },

  async updateRole(req, res) {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Only an Admin can manage roles' });
    try {
      if (
        typeof req.body.name !== 'string' || !req.body.name.trim() || req.body.name.trim().length > 100
        || !req.body.permissions || typeof req.body.permissions !== 'object' || Array.isArray(req.body.permissions)
      ) {
        return res.status(400).json({ error: 'Role name and permissions are required' });
      }
      const existingRole = await Role.findById(req.params.id);
      if (!existingRole) return res.status(404).json({ error: 'Role not found' });
      if (existingRole.name === 'Admin' && req.body.name.trim() !== 'Admin') {
        return res.status(400).json({ error: 'The built-in Admin role cannot be renamed' });
      }
      const role = await Role.update(req.params.id, req.body);
      if (!role) return res.status(404).json({ error: 'Role not found' });
      const auditWarning = await logActivity(req, 'Update Role Permissions', `Updated permissions for role ${role.name}`);
      res.json({ role, audit_warning: auditWarning });
    } catch (error) {
      return fail(res, error, 'Update role');
    }
  },

  async deleteRole(req, res) {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Only an Admin can manage roles' });
    try {
      const role = await Role.delete(req.params.id);
      if (!role) return res.status(404).json({ error: 'Role not found' });
      const auditWarning = await logActivity(req, 'Delete Role', `Deleted role ${role.name}`);
      res.json({ message: 'Role deleted successfully', audit_warning: auditWarning });
    } catch (error) {
      return fail(res, error, 'Delete role');
    }
  },

  async getActivities(req, res) {
    try {
      const requestedId = req.query.restaurant_id
        ? Number(req.query.restaurant_id)
        : (isAdmin(req) ? null : req.user.restaurant_id);
      if (!isAdmin(req) && !req.user.restaurant_ids.includes(requestedId)) {
        return res.status(403).json({ error: 'Access denied for this restaurant' });
      }
      res.json(await Activity.findAll({
        restaurant_id: requestedId,
        user_id: req.query.user_id,
        start_date: req.query.start_date,
        end_date: req.query.end_date,
      }));
    } catch (error) {
      return fail(res, error, 'Get activities');
    }
  },
};

module.exports = userController;
