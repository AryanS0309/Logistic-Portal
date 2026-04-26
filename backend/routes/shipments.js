const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  createShipment, getShipments, getShipment, trackShipment,
  updateStatus, assignDriver, deleteShipment, getDashboardStats
} = require('../controllers/shipmentController');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

// Public route - track shipment
router.get('/track/:trackingNumber', trackShipment);

// Protected routes
router.use(protect);

// Dashboard stats
router.get('/dashboard/stats', authorize('admin', 'manager'), getDashboardStats);

// GET all shipments / POST create
router.route('/')
  .get(getShipments)
  .post([
    body('sender.name').notEmpty().withMessage('Sender name required'),
    body('recipient.name').notEmpty().withMessage('Recipient name required'),
    body('sender.address.city').notEmpty().withMessage('Sender city required'),
    body('recipient.address.city').notEmpty().withMessage('Recipient city required'),
    body('package.weight').isNumeric().withMessage('Package weight must be a number'),
  ], handleValidation, createShipment);

// GET/DELETE single shipment
router.route('/:id')
  .get(getShipment)
  .delete(authorize('admin'), deleteShipment);

// Update status (driver, admin, manager)
router.patch('/:id/status', authorize('admin', 'manager', 'driver'), updateStatus);

// Assign driver (admin, manager)
router.patch('/:id/assign-driver', authorize('admin', 'manager'), assignDriver);

module.exports = router;
