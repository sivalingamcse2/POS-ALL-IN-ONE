const express = require('express');
const router = express.Router();
const posController = require('../controllers/posController');
const { authenticateToken, checkPermission } = require('../middleware/auth');

// 1. PROTECTED ROUTES (Staff Only)
router.post('/tables', authenticateToken, checkPermission('POS', 'Create'), posController.createTable);
router.put('/tables/:id', authenticateToken, checkPermission('POS', 'Edit'), posController.updateTable);
router.delete('/tables/:id', authenticateToken, checkPermission('POS', 'Delete'), posController.deleteTable);

// Orders
router.get('/orders', authenticateToken, checkPermission('POS', 'View'), posController.getAllOrders);
router.get('/orders/:id', authenticateToken, checkPermission('POS', 'View'), posController.getOrderById);
router.post('/orders', authenticateToken, checkPermission('POS', 'Create'), posController.createOrder);
router.put('/orders/:id', authenticateToken, checkPermission('POS', 'Edit'), posController.updateOrder);
router.patch('/orders/:id/status', authenticateToken, checkPermission('POS', 'Approve'), posController.updateOrderStatus);
router.delete('/orders/:id', authenticateToken, checkPermission('POS', 'Delete'), posController.deleteOrder);

// Order Items
router.post('/orders/:id/items', authenticateToken, checkPermission('POS', 'Edit'), posController.addOrderItem);
router.put('/orders/:id/items/:itemId', authenticateToken, checkPermission('POS', 'Edit'), posController.updateOrderItem);
router.delete('/orders/:id/items/:itemId', authenticateToken, checkPermission('POS', 'Edit'), posController.removeOrderItem);

module.exports = router;
