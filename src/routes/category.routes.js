const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', categoryController.getAllCategories);
router.post('/', authenticate, requireRole('admin'), categoryController.createCategory);

module.exports = router; 
