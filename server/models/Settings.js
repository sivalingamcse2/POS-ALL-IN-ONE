const db = require('../config/db');

const DEFAULT_SECURITY_POLICY = Object.freeze({
  sessionTimeoutMinutes: 30,
  requireStrongPasswords: true,
  maxFailedLogins: 5,
});

const Settings = {
  defaultSecurityPolicy: { ...DEFAULT_SECURITY_POLICY },

  async getSecurityPolicy() {
    if (!db.isPgConnected()) {
      const state = db.getLocalDb();
      state.system_settings ||= {};
      return {
        ...DEFAULT_SECURITY_POLICY,
        ...(state.system_settings.security_policy || {}),
      };
    }
    const result = await db.query(
      'SELECT value FROM system_settings WHERE key = $1',
      ['security_policy']
    );
    return {
      ...DEFAULT_SECURITY_POLICY,
      ...(result.rows[0]?.value || {}),
    };
  },

  async saveSecurityPolicy(policy) {
    const value = {
      sessionTimeoutMinutes: Number(policy.sessionTimeoutMinutes),
      requireStrongPasswords: Boolean(policy.requireStrongPasswords),
      maxFailedLogins: Number(policy.maxFailedLogins),
    };
    if (!db.isPgConnected()) {
      const state = db.getLocalDb();
      state.system_settings ||= {};
      state.system_settings.security_policy = value;
      db.saveLocalDb();
      return value;
    }

    const result = await db.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
       RETURNING value`,
      ['security_policy', JSON.stringify(value)]
    );
    return result.rows[0].value;
  },

  async getMenuAssignment(restaurantId) {
    if (!db.isPgConnected()) {
      const state = db.getLocalDb();
      const explicitAssignments = (state.menu_assignments || [])
        .filter(assignment => Number(assignment.restaurant_id) === Number(restaurantId));
      const hasExplicitAssignments = explicitAssignments.length > 0
        || (state.menu_assignments || []).some(
          assignment => Number(assignment.restaurant_id) === Number(restaurantId)
        );
      const items = state.items || [];
      const categories = state.categories || [];
      return items.map(item => ({
        id: item.id,
        name: item.name,
        category_id: item.category_id,
        category_name: categories.find(category => Number(category.id) === Number(item.category_id))?.name || '',
        price: item.price,
        restaurant_id: item.restaurant_id,
        assigned: hasExplicitAssignments
          ? explicitAssignments.some(assignment => Number(assignment.item_id) === Number(item.id))
          : Number(item.restaurant_id || 1) === Number(restaurantId),
      }));
    }

    const result = await db.query(
      `SELECT i.id, i.name, i.category_id, c.name AS category_name, i.price,
              i.restaurant_id,
              EXISTS (
                SELECT 1 FROM restaurant_menu_items assignment
                WHERE assignment.item_id = i.id AND assignment.restaurant_id = $1
              ) AS assigned
       FROM items i
       LEFT JOIN categories c ON c.id = i.category_id
       ORDER BY c.name, i.name`,
      [restaurantId]
    );
    return result.rows;
  },

  async saveMenuAssignment(restaurantId, itemIds) {
    const ids = [...new Set(itemIds.map(Number))];
    if (!db.isPgConnected()) {
      const state = db.getLocalDb();
      const existsRestaurant = (state.restaurants || []).some(
        restaurant => Number(restaurant.id) === Number(restaurantId)
      );
      const knownIds = new Set((state.items || []).map(item => Number(item.id)));
      if (!existsRestaurant) {
        const error = new Error('Store not found');
        error.status = 404;
        throw error;
      }
      if (ids.some(id => !knownIds.has(id))) {
        const error = new Error('One or more menu items do not exist');
        error.status = 400;
        throw error;
      }
      state.menu_assignments = (state.menu_assignments || []).filter(
        assignment => Number(assignment.restaurant_id) !== Number(restaurantId)
      );
      state.menu_assignments.push(...ids.map(itemId => ({
        restaurant_id: Number(restaurantId),
        item_id: itemId,
      })));
      db.saveLocalDb();
      return ids;
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const storeResult = await client.query('SELECT id FROM restaurants WHERE id = $1', [restaurantId]);
      if (!storeResult.rows[0]) {
        const error = new Error('Store not found');
        error.status = 404;
        throw error;
      }
      if (ids.length > 0) {
        const itemResult = await client.query(
          'SELECT id FROM items WHERE id = ANY($1::integer[])',
          [ids]
        );
        if (itemResult.rows.length !== ids.length) {
          const error = new Error('One or more menu items do not exist');
          error.status = 400;
          throw error;
        }
      }
      await client.query('DELETE FROM restaurant_menu_items WHERE restaurant_id = $1', [restaurantId]);
      for (const itemId of ids) {
        await client.query(
          `INSERT INTO restaurant_menu_items (restaurant_id, item_id)
           VALUES ($1, $2)`,
          [restaurantId, itemId]
        );
      }
      await client.query('COMMIT');
      return ids;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};

module.exports = Settings;
