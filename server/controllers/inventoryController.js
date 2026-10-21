const Inventory = require('../models/Inventory');
const Activity = require('../models/Activity');

const inventoryController = {
  async getStock(req, res) {
    try {
      const stock = await Inventory.getStock(req.user.restaurant_id);
      res.json(stock);
    } catch (error) {
      console.error('Get stock error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getStockByItem(req, res) {
    try {
      const stock = await Inventory.getStockByItem(req.params.itemId);
      if (!stock) {
        return res.status(404).json({ error: 'Stock record not found' });
      }
      res.json(stock);
    } catch (error) {
      console.error('Get item stock error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async createTransaction(req, res) {
    try {
      const { item_id, txn_type, quantity, notes } = req.body;

      const transaction = await Inventory.createTransaction({
        item_id,
        restaurant_id: req.user.restaurant_id,
        txn_type,
        quantity,
        notes,
        user_id: req.user.id
      });

      await Activity.create({
        user_id: req.user.id,
        restaurant_id: req.user.restaurant_id,
        action: 'Inventory Transaction',
        details: `${txn_type} ${quantity} units for item #${item_id}`
      });

      res.status(201).json(transaction);
    } catch (error) {
      console.error('Create transaction error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getTransactions(req, res) {
    try {
      const filters = {
        restaurant_id: req.user.restaurant_id,
        item_id: req.query.item_id,
        txn_type: req.query.txn_type,
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };
      const transactions = await Inventory.getTransactions(filters);
      res.json(transactions);
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async adjustStock(req, res) {
    try {
      const { item_id, quantity } = req.body;
      const stock = await Inventory.updateStock(item_id, quantity);
      
      await Inventory.createTransaction({
        item_id,
        restaurant_id: req.user.restaurant_id,
        txn_type: 'adjust',
        quantity,
        notes: 'Manual adjustment',
        user_id: req.user.id
      });

      res.json(stock);
    } catch (error) {
      console.error('Adjust stock error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = inventoryController;
