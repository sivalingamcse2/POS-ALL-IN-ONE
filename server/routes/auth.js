const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');
const loginRateLimit = require('../middleware/loginRateLimit');

router.post('/login', loginRateLimit, authController.login);
router.post('/activate', userController.activate);
router.post('/logout', authenticateToken, authController.logout);
router.get('/me', authenticateToken, authController.me);
router.post('/change-password', authenticateToken, authController.changePassword);

module.exports = router;
