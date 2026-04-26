/**
 * REST API Tests for Logistics Portal
 * Run: npm test
 */
const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('./server');

let adminToken = '';
let driverToken = '';
let shipmentId = '';

beforeAll(async () => {
  process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/logistics_test';
  await mongoose.connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

// ===== AUTH TESTS =====
describe('Auth API', () => {
  test('POST /api/v1/auth/register - Admin', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test Admin', email: 'testadmin@test.com', password: 'admin123', role: 'admin' });
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    adminToken = res.body.token;
  });

  test('POST /api/v1/auth/register - Driver', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test Driver', email: 'testdriver@test.com', password: 'driver123', role: 'driver' });
    expect(res.statusCode).toBe(201);
    driverToken = res.body.token;
  });

  test('POST /api/v1/auth/login - Valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'testadmin@test.com', password: 'admin123' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  test('POST /api/v1/auth/login - Invalid password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'testadmin@test.com', password: 'wrongpass' });
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/v1/auth/login - Missing fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'testadmin@test.com' });
    expect(res.statusCode).toBe(400);
  });

  test('GET /api/v1/auth/me - Authenticated', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.user.email).toBe('testadmin@test.com');
  });

  test('GET /api/v1/auth/me - No token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.statusCode).toBe(401);
  });
});

// ===== SHIPMENT TESTS =====
describe('Shipment API', () => {
  const shipmentPayload = {
    sender: { name: 'Test Sender', email: 'sender@test.com', phone: '9876543210', address: { city: 'Mumbai', pincode: '400001' } },
    recipient: { name: 'Test Recipient', email: 'recipient@test.com', phone: '9876543211', address: { city: 'Delhi', pincode: '110001' } },
    package: { weight: 2.5, description: 'Test Package', value: 1000 },
    priority: 'standard'
  };

  test('POST /api/v1/shipments - Create shipment', async () => {
    const res = await request(app)
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(shipmentPayload);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.shipment.trackingNumber).toMatch(/^LGX-/);
    shipmentId = res.body.shipment._id;
  });

  test('POST /api/v1/shipments - Missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sender: { name: 'Only Name' } });
    expect(res.statusCode).toBe(400);
  });

  test('GET /api/v1/shipments - Get all shipments', async () => {
    const res = await request(app)
      .get('/api/v1/shipments')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.docs).toBeInstanceOf(Array);
    expect(res.body.total).toBeGreaterThan(0);
  });

  test('GET /api/v1/shipments - With pagination', async () => {
    const res = await request(app)
      .get('/api/v1/shipments?page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.docs.length).toBeLessThanOrEqual(5);
    expect(res.body.page).toBe(1);
  });

  test('GET /api/v1/shipments/:id - Get single shipment', async () => {
    const res = await request(app)
      .get(`/api/v1/shipments/${shipmentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.shipment._id).toBe(shipmentId);
  });

  test('GET /api/v1/shipments/:id - Not found', async () => {
    const res = await request(app)
      .get('/api/v1/shipments/64f1234567890abcdef12345')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(404);
  });

  test('PATCH /api/v1/shipments/:id/status - Update status', async () => {
    const res = await request(app)
      .patch(`/api/v1/shipments/${shipmentId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'picked_up', location: { city: 'Mumbai' }, description: 'Package picked up' });
    expect(res.statusCode).toBe(200);
    expect(res.body.shipment.status).toBe('picked_up');
  });

  test('PATCH /api/v1/shipments/:id/status - Driver unauthorized for others', async () => {
    const res = await request(app)
      .patch(`/api/v1/shipments/${shipmentId}/status`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ status: 'in_transit' });
    expect(res.statusCode).toBe(403);
  });

  test('GET /api/v1/shipments/track/:trackingNumber - Public track', async () => {
    const shipRes = await request(app)
      .get(`/api/v1/shipments/${shipmentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const trackingNumber = shipRes.body.shipment.trackingNumber;
    const res = await request(app).get(`/api/v1/shipments/track/${trackingNumber}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.shipment.trackingNumber).toBe(trackingNumber);
  });

  test('GET /api/v1/shipments/track/INVALID - Not found', async () => {
    const res = await request(app).get('/api/v1/shipments/track/LGX-INVALID-000');
    expect(res.statusCode).toBe(404);
  });

  test('GET /api/v1/shipments/dashboard/stats - Admin only', async () => {
    const res = await request(app)
      .get('/api/v1/shipments/dashboard/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.stats).toBeDefined();
  });

  test('GET /api/v1/shipments/dashboard/stats - Driver unauthorized', async () => {
    const res = await request(app)
      .get('/api/v1/shipments/dashboard/stats')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(res.statusCode).toBe(403);
  });

  test('DELETE /api/v1/shipments/:id - Admin delete', async () => {
    const res = await request(app)
      .delete(`/api/v1/shipments/${shipmentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ===== HEALTH CHECK =====
describe('Health Check', () => {
  test('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
