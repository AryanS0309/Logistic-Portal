require('dotenv').config();
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const cookieSession = require('cookie-session');
const rateLimit = require('express-rate-limit');
const path = require('path');
const EventEmitter = require('events');

const connectDB = require('./config/database');
const { requestLogger } = require('./middleware/logger');
const { errorHandler, notFound } = require('./middleware/error');

// Routes
const authRoutes = require('./routes/auth');
const shipmentRoutes = require('./routes/shipments');
const notificationRoutes = require('./routes/notifications');

// Initialize app
const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Custom EventEmitter for internal events
class LogisticsEventEmitter extends EventEmitter {}
const logisticsEvents = new LogisticsEventEmitter();

// Connect to DB
connectDB();

// Trust proxy
app.set('trust proxy', 1);

// Share io with routes
app.set('io', io);

// ===== MIDDLEWARE =====

// Security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Compression
app.use(compression());

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Cookie session
app.use(cookieSession({
  name: 'logistics_session',
  secret: process.env.SESSION_SECRET,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production'
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

// Request logger
app.use(requestLogger);

// Static files
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ===== ROUTES =====
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/shipments', shipmentRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Logistics Portal API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ===== SOCKET.IO =====
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('user:join', (userId) => {
    socket.join(`user_${userId}`);
    connectedUsers.set(socket.id, userId);
    io.emit('users:online', connectedUsers.size);
    logisticsEvents.emit('user:connected', { userId, socketId: socket.id });
  });

  socket.on('shipment:subscribe', (shipmentId) => {
    socket.join(`shipment_${shipmentId}`);
    socket.emit('shipment:subscribed', { shipmentId });
  });

  socket.on('shipment:unsubscribe', (shipmentId) => {
    socket.leave(`shipment_${shipmentId}`);
  });

  socket.on('location:update', (data) => {
    io.to(`shipment_${data.shipmentId}`).emit('location:updated', data);
    logisticsEvents.emit('location:updated', data);
  });

  socket.on('chat:message', (data) => {
    io.emit('chat:message', { ...data, timestamp: new Date() });
  });

  socket.on('disconnect', () => {
    connectedUsers.delete(socket.id);
    io.emit('users:online', connectedUsers.size);
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Internal event listeners (EventEmitter demo)
logisticsEvents.on('user:connected', ({ userId }) => {
  console.log(`📡 User ${userId} connected via EventEmitter`);
});

logisticsEvents.on('location:updated', ({ shipmentId, location }) => {
  console.log(`📍 Location updated for shipment ${shipmentId}: ${JSON.stringify(location)}`);
});

// ===== ERROR HANDLING =====
app.use(notFound);
app.use(errorHandler);

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Logistics Portal Server running on port ${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api/v1\n`);
});

module.exports = { app, server, io };
