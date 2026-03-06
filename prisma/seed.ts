import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Read credentials from env — never hardcode in production
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@qrdine.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const kitchenPin = process.env.SEED_KITCHEN_PIN;

  if (!adminPassword || !kitchenPin) {
    console.error('❌ SEED_ADMIN_PASSWORD and SEED_KITCHEN_PIN environment variables are required.');
    console.error('   Example: SEED_ADMIN_PASSWORD=mySecurePass123 SEED_KITCHEN_PIN=123456 npx prisma db seed');
    process.exit(1);
  }

  if (kitchenPin.length < 6 || !/^\d+$/.test(kitchenPin)) {
    console.error('❌ SEED_KITCHEN_PIN must be at least 6 digits.');
    process.exit(1);
  }

  // Check if restaurant already exists
  const existingRestaurant = await prisma.restaurant.findFirst();
  if (existingRestaurant) {
    console.log('Database already seeded. Skipping...');
    return;
  }

  // Create restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'QR-Dine Demo Restaurant',
      taxPercent: 5.0,
      currency: 'INR',
    },
  });
  console.log(`✅ Restaurant: ${restaurant.name}`);

  // Create admin user
  const hashedPassword = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.staff.create({
    data: {
      name: 'Admin',
      email: adminEmail,
      passwordHash: hashedPassword,
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin: ${admin.email}`);

  // Create kitchen staff (PIN is bcrypt-hashed)
  const hashedPin = await bcrypt.hash(kitchenPin, 10);
  const kitchenStaff = await prisma.staff.create({
    data: {
      name: 'Kitchen 1',
      pin: hashedPin,
      role: 'KITCHEN',
    },
  });
  console.log(`✅ Kitchen staff: ${kitchenStaff.name}`);

  // Create tables
  const tables = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      prisma.table.create({
        data: {
          number: i + 1,
          label: i < 4 ? 'Window' : i < 7 ? 'Center' : 'Patio',
          capacity: i < 4 ? 2 : i < 8 ? 4 : 6,
          status: 'AVAILABLE',
        },
      })
    )
  );
  console.log(`✅ ${tables.length} tables created`);

  // Create categories
  const starters = await prisma.category.create({
    data: { name: 'Starters', sortOrder: 1 },
  });
  const mains = await prisma.category.create({
    data: { name: 'Main Course', sortOrder: 2 },
  });
  const breads = await prisma.category.create({
    data: { name: 'Breads', sortOrder: 3 },
  });
  const beverages = await prisma.category.create({
    data: { name: 'Beverages', sortOrder: 4 },
  });
  const desserts = await prisma.category.create({
    data: { name: 'Desserts', sortOrder: 5 },
  });
  console.log('✅ 5 categories created');

  // Create menu items
  const menuItems = [
    // Starters
    { name: 'Paneer Tikka', description: 'Grilled cottage cheese with spices', price: 249, isVeg: true, categoryId: starters.id },
    { name: 'Chicken 65', description: 'Spicy deep-fried chicken', price: 299, isVeg: false, categoryId: starters.id },
    { name: 'Veg Spring Rolls', description: 'Crispy rolls with mixed vegetables', price: 199, isVeg: true, categoryId: starters.id },
    { name: 'Fish Fingers', description: 'Golden fried fish strips', price: 349, isVeg: false, categoryId: starters.id },
    // Mains
    { name: 'Dal Makhani', description: 'Creamy black lentil curry', price: 279, isVeg: true, categoryId: mains.id },
    { name: 'Butter Chicken', description: 'Tandoori chicken in rich tomato gravy', price: 399, isVeg: false, categoryId: mains.id },
    { name: 'Palak Paneer', description: 'Spinach with cottage cheese', price: 269, isVeg: true, categoryId: mains.id },
    { name: 'Biryani (Veg)', description: 'Fragrant basmati rice with vegetables', price: 299, isVeg: true, categoryId: mains.id },
    { name: 'Biryani (Chicken)', description: 'Fragrant basmati rice with chicken', price: 369, isVeg: false, categoryId: mains.id },
    // Breads
    { name: 'Butter Naan', description: 'Soft naan with butter', price: 59, isVeg: true, categoryId: breads.id },
    { name: 'Garlic Naan', description: 'Naan with garlic and herbs', price: 69, isVeg: true, categoryId: breads.id },
    { name: 'Roti', description: 'Whole wheat flatbread', price: 39, isVeg: true, categoryId: breads.id },
    // Beverages
    { name: 'Mango Lassi', description: 'Sweet mango yogurt drink', price: 129, isVeg: true, categoryId: beverages.id },
    { name: 'Masala Chai', description: 'Spiced Indian tea', price: 59, isVeg: true, categoryId: beverages.id },
    { name: 'Fresh Lime Soda', description: 'Sweet or salted', price: 79, isVeg: true, categoryId: beverages.id },
    // Desserts
    { name: 'Gulab Jamun', description: 'Sweet milk dumplings in syrup', price: 129, isVeg: true, categoryId: desserts.id },
    { name: 'Rasmalai', description: 'Cottage cheese in sweet milk', price: 149, isVeg: true, categoryId: desserts.id },
    { name: 'Kulfi', description: 'Indian ice cream', price: 99, isVeg: true, categoryId: desserts.id },
  ];

  // Create menu items sequentially to avoid exhausting Supabase connection pool
  for (const item of menuItems) {
    await prisma.menuItem.create({
      data: {
        ...item,
        isAvailable: true,
      },
    });
  }
  console.log(`✅ ${menuItems.length} menu items created`);

  console.log('\n🎉 Seed complete!');
  console.log('---');
  console.log('Admin login: admin@qrdine.com / admin123');
  console.log('Kitchen PIN: 1234');
  console.log(`Tables: 1–${tables.length}`);
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
