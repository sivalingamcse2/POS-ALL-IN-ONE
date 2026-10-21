const Restaurant = require('../models/Restaurant');

const validateRestaurant = body => {
  const name = String(body.name || '').trim();
  const businessType = body.business_type || 'restaurant';
  const taxRate = Number(body.tax_rate ?? 0);
  const seatingCapacity = Number(body.seating_capacity ?? 0);
  if (!name || name.length > 255) return { error: 'Store name is required and must be 255 characters or fewer' };
  if (!['restaurant', 'supermarket'].includes(businessType)) {
    return { error: 'Store type must be restaurant or supermarket' };
  }
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    return { error: 'Tax rate must be between 0 and 100' };
  }
  if (!Number.isInteger(seatingCapacity) || seatingCapacity < 0) {
    return { error: 'Seating capacity must be a non-negative whole number' };
  }

  return {
    value: {
      name,
      business_type: businessType,
      address: String(body.address || '').trim(),
      phone: String(body.phone || '').trim(),
      email: String(body.email || '').trim(),
      currency: String(body.currency || 'USD').trim(),
      tax_rate: taxRate,
      website: String(body.website || '').trim(),
      manager_name: String(body.manager_name || '').trim(),
      operating_hours: String(body.operating_hours || '').trim(),
      seating_capacity: seatingCapacity,
    },
  };
};

const restaurantController = {
  async getAll(req, res) {
    try {
      const restaurants = req.user?.role_name === 'Admin'
        ? await Restaurant.findAll()
        : req.user?.restaurants || [];
      res.json(restaurants);
    } catch (error) {
      console.error('Get restaurants error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getById(req, res) {
    try {
      const isAssigned = req.user?.restaurants?.some(
        restaurant => Number(restaurant.id) === Number(req.params.id)
      );
      if (!isAssigned) {
        return res.status(403).json({ error: 'Access denied for this restaurant' });
      }
      const restaurant = await Restaurant.findById(req.params.id);
      if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      res.json(restaurant);
    } catch (error) {
      console.error('Get restaurant error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async create(req, res) {
    try {
      const validation = validateRestaurant(req.body);
      if (validation.error) return res.status(400).json({ error: validation.error });
      const restaurant = await Restaurant.create(validation.value);
      res.status(201).json(restaurant);
    } catch (error) {
      console.error('Create restaurant error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async update(req, res) {
    try {
      const validation = validateRestaurant(req.body);
      if (validation.error) return res.status(400).json({ error: validation.error });
      const restaurant = await Restaurant.update(req.params.id, validation.value);
      if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      res.json(restaurant);
    } catch (error) {
      console.error('Update restaurant error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async delete(req, res) {
    try {
      const restaurant = await Restaurant.delete(req.params.id);
      if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      res.json({ message: 'Restaurant deleted successfully' });
    } catch (error) {
      console.error('Delete restaurant error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = restaurantController;
