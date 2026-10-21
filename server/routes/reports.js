const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, checkPermission } = require('../middleware/auth');

router.use(authenticateToken);
router.use(checkPermission('Reports'));

router.get('/dashboard', reportController.getDashboard);
router.get('/daily-sales', reportController.getDailySales);
router.get('/monthly-sales', reportController.getMonthlySales);
router.get('/sales-range', reportController.getSalesRange);
router.get('/item-sales', reportController.getItemSales);
router.get('/category-sales', reportController.getCategorySales);
router.get('/tax-summary', reportController.getTaxSummary);
router.get('/inventory', reportController.getInventoryReport);
router.get('/payment-methods', reportController.getPaymentMethodSummary);

module.exports = router;
