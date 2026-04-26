const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['shipment_update', 'delivery', 'alert', 'info', 'success', 'warning'],
    default: 'info'
  },
  shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', default: null },
  read: { type: Boolean, default: false },
  readAt: Date
}, { timestamps: true });

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
