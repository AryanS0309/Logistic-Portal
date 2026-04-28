const User = require('../models/User');

const demoUsers = [
  { name: 'Admin User', email: 'admin@swiftroute.com', password: 'admin123', role: 'admin', company: 'SwiftRoute HQ' },
  { name: 'Manager Singh', email: 'manager@swiftroute.com', password: 'manager123', role: 'manager', company: 'SwiftRoute Ops' },
  { name: 'Ravi Driver', email: 'driver@swiftroute.com', password: 'driver123', role: 'driver', phone: '+91 98765 43210' },
  { name: 'Priya Customer', email: 'customer@swiftroute.com', password: 'customer123', role: 'customer', company: 'ABC Enterprises' },
];

const ensureDemoUsers = async () => {
  const count = await User.countDocuments();
  if (count > 0) {
    return false;
  }

  await User.create(demoUsers);
  console.log('\n✅ Demo user accounts created:');
  console.log('  Admin:    admin@swiftroute.com / admin123');
  console.log('  Manager:  manager@swiftroute.com / manager123');
  console.log('  Driver:   driver@swiftroute.com  / driver123');
  console.log('  Customer: customer@swiftroute.com / customer123\n');
  return true;
};

module.exports = { ensureDemoUsers };