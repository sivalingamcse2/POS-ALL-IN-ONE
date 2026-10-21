const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken, checkRole('Admin'));

router.get('/security-policy', settingsController.getSecurityPolicy);
router.put('/security-policy', settingsController.saveSecurityPolicy);
router.get('/menu-assignment/:restaurantId', settingsController.getMenuAssignment);
router.put('/menu-assignment/:restaurantId', settingsController.saveMenuAssignment);
router.get('/audit-log', settingsController.getAuditLog);

module.exports = router;
