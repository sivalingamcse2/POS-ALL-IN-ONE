const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, checkPermission } = require('../middleware/auth');

router.use(authenticateToken);

// Specific paths must precede /:id so names such as "roles" are not treated as user IDs.
router.get('/roles/list', checkPermission('UserMgmt', 'View'), userController.getAllRoles);
router.get('/roles/:id', checkPermission('UserMgmt', 'View'), userController.getRoleById);
router.post('/roles', checkPermission('UserMgmt', 'Create'), userController.createRole);
router.put('/roles/:id', checkPermission('UserMgmt', 'Edit'), userController.updateRole);
router.delete('/roles/:id', checkPermission('UserMgmt', 'Delete'), userController.deleteRole);
router.get('/activities/list', checkPermission('UserMgmt', 'View'), userController.getActivities);

router.get('/', checkPermission('UserMgmt', 'View'), userController.getAll);
router.get('/:id', checkPermission('UserMgmt', 'View'), userController.getById);
router.post('/', checkPermission('UserMgmt', 'Create'), userController.create);
router.put('/:id', checkPermission('UserMgmt', 'Edit'), userController.update);
router.post('/:id/reset-password', checkPermission('UserMgmt', 'Edit'), userController.resetPassword);
router.delete('/:id', checkPermission('UserMgmt', 'Delete'), userController.delete);

module.exports = router;
