const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', restaurantController.getAll);
router.get('/:id', restaurantController.getById);
router.post('/', checkRole('Admin'), restaurantController.create);
router.put('/:id', checkRole('Admin'), restaurantController.update);
router.delete('/:id', checkRole('Admin'), restaurantController.delete);

module.exports = router;
