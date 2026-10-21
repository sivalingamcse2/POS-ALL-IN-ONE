const Category = require('../models/Category');
const Item = require('../models/Item');
const Activity = require('../models/Activity');

const menuController = {
  // Categories
  async getAllCategories(req, res) {
    try {
      const restaurantId = req.user ? req.user.restaurant_id : (req.headers['x-restaurant-id'] || 1);
      const categories = await Category.findAll(restaurantId);
      res.json(categories);
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getCategoryById(req, res) {
    try {
      const category = await Category.findById(req.params.id);
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }
      res.json(category);
    } catch (error) {
      console.error('Get category error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async createCategory(req, res) {
    try {
      const category = await Category.create({
        ...req.body,
        restaurant_id: req.user.restaurant_id
      });

      await Activity.create({
        user_id: req.user.id,
        restaurant_id: req.user.restaurant_id,
        action: 'Create Category',
        details: `Created category: ${category.name}`
      });

      res.status(201).json(category);
    } catch (error) {
      console.error('Create category error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async updateCategory(req, res) {
    try {
      const category = await Category.update(req.params.id, req.body);
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }
      res.json(category);
    } catch (error) {
      console.error('Update category error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async deleteCategory(req, res) {
    try {
      const category = await Category.delete(req.params.id);
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }
      res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      console.error('Delete category error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Items
  async getAllItems(req, res) {
    try {
      const restaurantId = req.user ? req.user.restaurant_id : (req.headers['x-restaurant-id'] || 1);
      const categoryId = req.query.category_id;
      const items = await Item.findAll(restaurantId, categoryId);
      res.json(items);
    } catch (error) {
      console.error('Get items error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getItemById(req, res) {
    try {
      const item = await Item.findById(req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.json(item);
    } catch (error) {
      console.error('Get item error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async createItem(req, res) {
    try {
      const item = await Item.create({
        ...req.body,
        restaurant_id: req.user.restaurant_id
      });

      await Activity.create({
        user_id: req.user.id,
        restaurant_id: req.user.restaurant_id,
        action: 'Create Item',
        details: `Created item: ${item.name}`
      });

      res.status(201).json(item);
    } catch (error) {
      console.error('Create item error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async updateItem(req, res) {
    try {
      const item = await Item.update(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.json(item);
    } catch (error) {
      console.error('Update item error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async deleteItem(req, res) {
    try {
      const item = await Item.delete(req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.json({ message: 'Item deleted successfully' });
    } catch (error) {
      console.error('Delete item error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getLowStockItems(req, res) {
    try {
      const threshold = parseInt(req.query.threshold) || 10;
      const items = await Item.getLowStockItems(req.user.restaurant_id, threshold);
      res.json(items);
    } catch (error) {
      console.error('Get low stock items error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = menuController;
