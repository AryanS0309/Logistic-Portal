const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const trackingEventSchema = new mongoose.Schema({
  status: {
    type: String,
    required: true,
    enum: ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled']
  },
  location: {
    city: String,
    state: String,
    country: { type: String, default: 'India' },
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  description: String,
  timestamp: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const shipmentSchema = new mongoose.Schema({
  trackingNumber: {
    type: String,
    unique: true,
    default: () => `LGX-${uuidv4().split('-')[0].toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
  },
  status: {
    type: String,
    enum: ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['standard', 'express', 'urgent'],
    default: 'standard'
  },
  sender: {
    name: { type: String, required: true },
    email: String,
    phone: String,
    address: {
      street: String,
      city: { type: String, required: true },
      state: String,
      pincode: String,
      country: { type: String, default: 'India' }
    }
  },
  recipient: {
    name: { type: String, required: true },
    email: String,
    phone: String,
    address: {
      street: String,
      city: { type: String, required: true },
      state: String,
      pincode: String,
      country: { type: String, default: 'India' }
    }
  },
  package: {
    weight: { type: Number, required: true }, // in kg
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    description: String,
    value: Number,
    fragile: { type: Boolean, default: false }
  },
  assignedDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  estimatedDelivery: Date,
  actualDelivery: Date,
  trackingHistory: [trackingEventSchema],
  notes: String,
  deliveryProof: String,
  currentLocation: {
    city: String,
    state: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  cost: {
    base: Number,
    tax: Number,
    total: Number
  }
}, {
  timestamps: true
});

// Index for faster queries
shipmentSchema.index({ trackingNumber: 1 });
shipmentSchema.index({ status: 1 });
shipmentSchema.index({ 'sender.email': 1 });
shipmentSchema.index({ 'recipient.email': 1 });
shipmentSchema.index({ assignedDriver: 1 });
shipmentSchema.index({ createdAt: -1 });

// Pagination static method
shipmentSchema.statics.paginate = async function(query, options) {
  const page = options.page || 1;
  const limit = options.limit || 10;
  const skip = (page - 1) * limit;
  const sort = options.sort || { createdAt: -1 };

  const [docs, total] = await Promise.all([
    this.find(query).sort(sort).skip(skip).limit(limit).populate('assignedDriver', 'name email phone').populate('createdBy', 'name email'),
    this.countDocuments(query)
  ]);

  return {
    docs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    hasPrevPage: page > 1
  };
};

const Shipment = mongoose.model('Shipment', shipmentSchema);
module.exports = Shipment;
