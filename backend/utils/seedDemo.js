const User = require('../models/User');

const demoUsers = [
  { name: 'Admin User', email: 'admin@swiftroute.com', password: 'admin123', role: 'admin', company: 'SwiftRoute HQ' },
  { name: 'Manager Singh', email: 'manager@swiftroute.com', password: 'manager123', role: 'manager', company: 'SwiftRoute Ops' },
  { name: 'Ravi Driver', email: 'driver@swiftroute.com', password: 'driver123', role: 'driver', phone: '+91 98765 43210' },
  { name: 'Priya Customer', email: 'customer@swiftroute.com', password: 'customer123', role: 'customer', company: 'ABC Enterprises' },
];

const ensureDemoUsers = async () => {
  let changed = false;

  for (const userData of demoUsers) {
    const existingUser = await User.findOne({ email: userData.email });

    if (!existingUser) {
      await User.create({
        ...userData,
        isActive: true
      });
      changed = true;
      continue;
    }

    existingUser.name = userData.name;
    existingUser.role = userData.role;
    existingUser.company = userData.company || existingUser.company;
    existingUser.phone = userData.phone || existingUser.phone;
    existingUser.isActive = true;
    existingUser.password = userData.password;
    await existingUser.save();
    changed = true;
  }

  if (changed) {
    console.log('\n✅ Demo user accounts created or updated:');
    console.log('  Admin:    admin@swiftroute.com / admin123');
    console.log('  Manager:  manager@swiftroute.com / manager123');
    console.log('  Driver:   driver@swiftroute.com / driver123');
    console.log('  Customer: customer@swiftroute.com / customer123\n');
  }

  return changed;
};

module.exports = { ensureDemoUsers };