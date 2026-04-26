require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB Connected for seeding');
};

const User = require('./models/User');
const Shipment = require('./models/Shipment');

const users = [
  { name: 'Admin User', email: 'admin@swiftroute.com', password: 'admin123', role: 'admin', company: 'SwiftRoute HQ' },
  { name: 'Manager Singh', email: 'manager@swiftroute.com', password: 'manager123', role: 'manager', company: 'SwiftRoute Ops' },
  { name: 'Ravi Driver', email: 'driver@swiftroute.com', password: 'driver123', role: 'driver', phone: '+91 98765 43210' },
  { name: 'Priya Customer', email: 'customer@swiftroute.com', password: 'customer123', role: 'customer', company: 'ABC Enterprises' },
  { name: 'Amit Sharma', email: 'amit@example.com', password: 'customer123', role: 'customer' },
  { name: 'Neha Driver', email: 'neha@swiftroute.com', password: 'driver123', role: 'driver', phone: '+91 91234 56789' },
];

const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Surat'];
const statuses = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'delivered', 'delivered'];
const priorities = ['standard', 'standard', 'express', 'urgent'];
const descriptions = ['Electronics', 'Clothing & Apparel', 'Books & Stationery', 'Food Products', 'Medical Supplies', 'Automotive Parts', 'Furniture', 'Jewelry'];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomNum(min, max) { return Math.round((Math.random() * (max - min) + min) * 10) / 10; }

async function seed() {
  try {
    await connectDB();

    // Clear existing
    await User.deleteMany({});
    await Shipment.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create users
    const createdUsers = await User.create(users);
    console.log(`👥 Created ${createdUsers.length} users`);

    const adminUser = createdUsers.find(u => u.role === 'admin');
    const drivers = createdUsers.filter(u => u.role === 'driver');

    // Create shipments
    const shipments = [];
    const senderNames = ['Raj Enterprises', 'Global Traders', 'City Stores', 'Quick Supply Co.', 'Metro Distributors'];
    const recipientNames = ['Priya Sharma', 'Amit Kumar', 'Sneha Patel', 'Rohit Verma', 'Kavita Singh', 'Arjun Mehta'];

    for (let i = 0; i < 40; i++) {
      const fromCity = randomFrom(cities);
      const toCity = cities.filter(c => c !== fromCity)[Math.floor(Math.random() * (cities.length - 1))];
      const status = randomFrom(statuses);
      const priority = randomFrom(priorities);
      const weight = randomNum(0.5, 20);
      const multiplier = { standard: 1, express: 1.5, urgent: 2.5 };
      const base = Math.round(weight * 50 * multiplier[priority]);
      const tax = Math.round(base * 0.18);
      const daysAgo = Math.floor(Math.random() * 90);
      const createdAt = new Date(Date.now() - daysAgo * 86400000);
      const estDays = { standard: 5, express: 2, urgent: 1 };
      const estimatedDelivery = new Date(createdAt.getTime() + estDays[priority] * 86400000);

      const trackingHistory = [
        {
          status: 'pending',
          description: 'Shipment created and awaiting pickup',
          location: { city: fromCity, country: 'India' },
          timestamp: createdAt
        }
      ];

      if (['picked_up', 'in_transit', 'out_for_delivery', 'delivered'].includes(status)) {
        trackingHistory.push({
          status: 'picked_up',
          description: 'Package picked up from sender',
          location: { city: fromCity, country: 'India' },
          timestamp: new Date(createdAt.getTime() + 3600000)
        });
      }
      if (['in_transit', 'out_for_delivery', 'delivered'].includes(status)) {
        trackingHistory.push({
          status: 'in_transit',
          description: 'Package in transit to destination',
          location: { city: randomFrom(cities), country: 'India' },
          timestamp: new Date(createdAt.getTime() + 86400000)
        });
      }
      if (['out_for_delivery', 'delivered'].includes(status)) {
        trackingHistory.push({
          status: 'out_for_delivery',
          description: 'Package out for final delivery',
          location: { city: toCity, country: 'India' },
          timestamp: new Date(createdAt.getTime() + 2 * 86400000)
        });
      }
      if (status === 'delivered') {
        trackingHistory.push({
          status: 'delivered',
          description: 'Package delivered successfully',
          location: { city: toCity, country: 'India' },
          timestamp: estimatedDelivery
        });
      }

      shipments.push({
        status,
        priority,
        sender: {
          name: randomFrom(senderNames),
          email: 'sender@example.com',
          phone: `+91 ${Math.floor(9000000000 + Math.random() * 999999999)}`,
          address: { street: `${Math.floor(100 + Math.random() * 900)} Main Road`, city: fromCity, state: fromCity, pincode: `${Math.floor(100000 + Math.random() * 899999)}`, country: 'India' }
        },
        recipient: {
          name: randomFrom(recipientNames),
          email: 'customer@swiftroute.com',
          phone: `+91 ${Math.floor(9000000000 + Math.random() * 999999999)}`,
          address: { street: `${Math.floor(100 + Math.random() * 900)} Park Avenue`, city: toCity, state: toCity, pincode: `${Math.floor(100000 + Math.random() * 899999)}`, country: 'India' }
        },
        package: {
          weight,
          dimensions: { length: randomNum(10, 60), width: randomNum(10, 50), height: randomNum(5, 40) },
          description: randomFrom(descriptions),
          value: Math.round(randomNum(500, 50000)),
          fragile: Math.random() > 0.7
        },
        assignedDriver: Math.random() > 0.3 ? randomFrom(drivers)._id : null,
        createdBy: adminUser._id,
        estimatedDelivery,
        actualDelivery: status === 'delivered' ? estimatedDelivery : null,
        trackingHistory,
        currentLocation: { city: toCity },
        cost: { base, tax, total: base + tax },
        createdAt,
        updatedAt: new Date()
      });
    }

    await Shipment.create(shipments);
    console.log(`📦 Created ${shipments.length} shipments`);

    console.log('\n✅ Seeding complete!');
    console.log('\n📋 Demo Accounts:');
    console.log('  Admin:    admin@swiftroute.com    / admin123');
    console.log('  Manager:  manager@swiftroute.com  / manager123');
    console.log('  Driver:   driver@swiftroute.com   / driver123');
    console.log('  Customer: customer@swiftroute.com / customer123');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
