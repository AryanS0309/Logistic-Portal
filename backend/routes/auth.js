const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  register, login, getMe, updateProfile, getAllUsers, getDrivers
} = require('../controllers/authController');

// Validation middleware
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// @POST /api/v1/auth/register
router.post('/register', [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], handleValidation, register);

// @POST /api/v1/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').notEmpty().withMessage('Password is required'),
], handleValidation, login);

// @GET /api/v1/auth/me (protected)
router.get('/me', protect, getMe);

// @PUT /api/v1/auth/update-profile (protected)
router.put('/update-profile', protect, updateProfile);

// @GET /api/v1/auth/users (admin only)
router.get('/users', protect, authorize('admin'), getAllUsers);

// @GET /api/v1/auth/drivers (admin/manager)
router.get('/drivers', protect, authorize('admin', 'manager'), getDrivers);

module.exports = router;
