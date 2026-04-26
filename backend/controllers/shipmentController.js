const Shipment = require('../models/Shipment');
const Notification = require('../models/Notification');
const { AppError } = require('../middleware/error');

// Create shipment
exports.createShipment = async (req, res, next) => {
  try {
    const shipmentData = { ...req.body, createdBy: req.user.id };
    
    // Calculate cost
    const weight = shipmentData.package?.weight || 1;
    const priorityMultiplier = { standard: 1, express: 1.5, urgent: 2.5 };
    const base = weight * 50 * (priorityMultiplier[shipmentData.priority] || 1);
    const tax = base * 0.18;
    shipmentData.cost = { base: Math.round(base), tax: Math.round(tax), total: Math.round(base + tax) };

    // Estimated delivery
    const days = { standard: 5, express: 2, urgent: 1 };
    const est = new Date();
    est.setDate(est.getDate() + (days[shipmentData.priority] || 5));
    shipmentData.estimatedDelivery = est;

    // Initial tracking event
    shipmentData.trackingHistory = [{
      status: 'pending',
      description: 'Shipment created and awaiting pickup',
      location: { city: shipmentData.sender.address.city, country: 'India' }
    }];

    const shipment = await Shipment.create(shipmentData);

    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('shipment:new', { shipment });
    }

    res.status(201).json({ success: true, message: 'Shipment created successfully', shipment });
  } catch (error) {
    next(error);
  }
};

// Get all shipments (with pagination and filters)
exports.getShipments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, priority, search } = req.query;
    
    let query = {};
    
    // Role-based filtering
    if (req.user.role === 'driver') {
      query.assignedDriver = req.user.id;
    } else if (req.user.role === 'customer') {
      query.$or = [
        { 'sender.email': req.user.email },
        { 'recipient.email': req.user.email }
      ];
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (search) {
      query.$or = [
        ...(query.$or || []),
        { trackingNumber: { $regex: search, $options: 'i' } },
        { 'sender.name': { $regex: search, $options: 'i' } },
        { 'recipient.name': { $regex: search, $options: 'i' } }
      ];
    }

    const result = await Shipment.paginate(query, { page: parseInt(page), limit: parseInt(limit) });

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// Get single shipment
exports.getShipment = async (req, res, next) => {
  try {
    const shipment = await Shipment.findOne({
      $or: [{ _id: req.params.id }, { trackingNumber: req.params.id }]
    }).populate('assignedDriver', 'name email phone').populate('createdBy', 'name email');

    if (!shipment) return next(new AppError('Shipment not found', 404));

    res.status(200).json({ success: true, shipment });
  } catch (error) {
    next(error);
  }
};

// Track shipment publicly
exports.trackShipment = async (req, res, next) => {
  try {
    const shipment = await Shipment.findOne({ trackingNumber: req.params.trackingNumber })
      .select('trackingNumber status trackingHistory estimatedDelivery currentLocation sender recipient package priority')
      .populate('assignedDriver', 'name phone');

    if (!shipment) return next(new AppError('Tracking number not found', 404));

    res.status(200).json({ success: true, shipment });
  } catch (error) {
    next(error);
  }
};

// Update shipment status
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, location, description } = req.body;
    
    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) return next(new AppError('Shipment not found', 404));

    // Check driver can only update their own assigned shipments
    if (req.user.role === 'driver' && shipment.assignedDriver?.toString() !== req.user.id) {
      return next(new AppError('Not authorized to update this shipment', 403));
    }

    shipment.status = status;
    shipment.currentLocation = location;
    
    shipment.trackingHistory.push({
      status,
      location,
      description: description || `Status updated to ${status}`,
      updatedBy: req.user.id
    });

    if (status === 'delivered') {
      shipment.actualDelivery = new Date();
    }

    await shipment.save();

    // Emit real-time update
    if (req.app.get('io')) {
      req.app.get('io').emit('shipment:updated', {
        trackingNumber: shipment.trackingNumber,
        status,
        location,
        timestamp: new Date()
      });
      req.app.get('io').to(`shipment_${shipment._id}`).emit('tracking:update', {
        status, location, description, timestamp: new Date()
      });
    }

    // Create notification
    await Notification.create({
      user: shipment.createdBy,
      title: 'Shipment Status Updated',
      message: `Your shipment ${shipment.trackingNumber} is now ${status.replace(/_/g, ' ')}`,
      type: status === 'delivered' ? 'success' : 'shipment_update',
      shipment: shipment._id
    });

    res.status(200).json({ success: true, message: 'Status updated', shipment });
  } catch (error) {
    next(error);
  }
};

// Assign driver
exports.assignDriver = async (req, res, next) => {
  try {
    const { driverId } = req.body;
    const shipment = await Shipment.findByIdAndUpdate(
      req.params.id,
      { assignedDriver: driverId },
      { new: true }
    ).populate('assignedDriver', 'name email phone');

    if (!shipment) return next(new AppError('Shipment not found', 404));

    if (req.app.get('io')) {
      req.app.get('io').to(`user_${driverId}`).emit('driver:assigned', { shipment });
    }

    res.status(200).json({ success: true, message: 'Driver assigned', shipment });
  } catch (error) {
    next(error);
  }
};

// Delete shipment
exports.deleteShipment = async (req, res, next) => {
  try {
    const shipment = await Shipment.findByIdAndDelete(req.params.id);
    if (!shipment) return next(new AppError('Shipment not found', 404));
    res.status(200).json({ success: true, message: 'Shipment deleted' });
  } catch (error) {
    next(error);
  }
};

// Dashboard stats
exports.getDashboardStats = async (req, res, next) => {
  try {
    const [total, pending, inTransit, delivered, failed] = await Promise.all([
      Shipment.countDocuments(),
      Shipment.countDocuments({ status: 'pending' }),
      Shipment.countDocuments({ status: 'in_transit' }),
      Shipment.countDocuments({ status: 'delivered' }),
      Shipment.countDocuments({ status: 'failed' })
    ]);

    const recentShipments = await Shipment.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('assignedDriver', 'name');

    const monthlyData = await Shipment.aggregate([
      {
        $group: {
          _id: { $month: '$createdAt' },
          count: { $sum: 1 },
          revenue: { $sum: '$cost.total' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.status(200).json({
      success: true,
      stats: { total, pending, inTransit, delivered, failed },
      recentShipments,
      monthlyData
    });
  } catch (error) {
    next(error);
  }
};
