const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { authenticateToken, checkPermission } = require('../middleware/auth');

// 1. PROTECTED ROUTES (Staff Only)
router.post('/categories', authenticateToken, checkPermission('Inventory', 'Create'), menuController.createCategory);
router.put('/categories/:id', authenticateToken, checkPermission('Inventory', 'Edit'), menuController.updateCategory);
router.delete('/categories/:id', authenticateToken, checkPermission('Inventory', 'Delete'), menuController.deleteCategory);

router.get('/items/low-stock', authenticateToken, checkPermission('Inventory', 'View'), menuController.getLowStockItems);
router.post('/items', authenticateToken, checkPermission('Inventory', 'Create'), menuController.createItem);
router.put('/items/:id', authenticateToken, checkPermission('Inventory', 'Edit'), menuController.updateItem);
router.delete('/items/:id', authenticateToken, checkPermission('Inventory', 'Delete'), menuController.deleteItem);

module.exports = router;
