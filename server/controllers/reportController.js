const Report = require('../models/Report');

const reportController = {
  async getDashboard(req, res) {
    try {
      const stats = await Report.getDashboardStats(req.user.restaurant_id);
      res.json(stats);
    } catch (error) {
      console.error('Get dashboard error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getDailySales(req, res) {
    try {
      const date = req.query.date || new Date().toISOString().split('T')[0];
      const sales = await Report.getDailySales(req.user.restaurant_id, date);
      res.json(sales);
    } catch (error) {
      console.error('Get daily sales error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getMonthlySales(req, res) {
    try {
      const now = new Date();
      const year = parseInt(req.query.year) || now.getFullYear();
      const month = parseInt(req.query.month) || now.getMonth() + 1;
      const sales = await Report.getMonthlySales(req.user.restaurant_id, year, month);
      res.json(sales);
    } catch (error) {
      console.error('Get monthly sales error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getSalesRange(req, res) {
    try {
      const { start_date, end_date } = req.query;
      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
      }
      const sales = await Report.getSalesRange(req.user.restaurant_id, start_date, end_date);
      res.json(sales);
    } catch (error) {
      console.error('Get sales range error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getItemSales(req, res) {
    try {
      const { start_date, end_date } = req.query;
      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
      }
      const sales = await Report.getItemSales(req.user.restaurant_id, start_date, end_date);
      res.json(sales);
    } catch (error) {
      console.error('Get item sales error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getCategorySales(req, res) {
    try {
      const { start_date, end_date } = req.query;
      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
      }
      const sales = await Report.getCategorySales(req.user.restaurant_id, start_date, end_date);
      res.json(sales);
    } catch (error) {
      console.error('Get category sales error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getTaxSummary(req, res) {
    try {
      const { start_date, end_date } = req.query;
      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
      }
      const summary = await Report.getTaxSummary(req.user.restaurant_id, start_date, end_date);
      res.json(summary);
    } catch (error) {
      console.error('Get tax summary error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getInventoryReport(req, res) {
    try {
      const report = await Report.getInventoryReport(req.user.restaurant_id);
      res.json(report);
    } catch (error) {
      console.error('Get inventory report error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getPaymentMethodSummary(req, res) {
    try {
      const { start_date, end_date } = req.query;
      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
      }
      const summary = await Report.getPaymentMethodSummary(req.user.restaurant_id, start_date, end_date);
      res.json(summary);
    } catch (error) {
      console.error('Get payment method summary error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = reportController;
