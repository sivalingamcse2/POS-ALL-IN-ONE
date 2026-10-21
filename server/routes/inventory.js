const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticateToken, checkPermission } = require('../middleware/auth');

router.use(authenticateToken);
router.get('/stock', checkPermission('Inventory', 'View'), inventoryController.getStock);
router.get('/stock/:itemId', checkPermission('Inventory', 'View'), inventoryController.getStockByItem);
router.post('/transaction', checkPermission('Inventory', 'Create'), inventoryController.createTransaction);
router.get('/transactions', checkPermission('Inventory', 'View'), inventoryController.getTransactions);
router.post('/adjust', checkPermission('Inventory', 'Approve'), inventoryController.adjustStock);

module.exports = router;
