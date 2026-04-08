/**
 * Seed MongoDB with demo users, shopkeeper, deals, recipes, and contact messages.
 *
 * Usage:
 *   npm run seed
 *
 * Re-run and replace demo deals/messages/recipes (keeps same user emails):
 *   SEED_FORCE=1 npm run seed
 *
 * Requires MONGODB_URI (see backend/.env)
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { Shopkeeper } from '../src/models/Shopkeeper.js';
import { Deal } from '../src/models/Deal.js';
import { Recipe } from '../src/models/Recipe.js';
import { Message } from '../src/models/Message.js';
import { hashPassword } from '../src/utils/password.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartkitchen';
const FORCE = process.env.SEED_FORCE === '1' || process.env.SEED_FORCE === 'true';

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d;
}

/** Demo login password for seeded household accounts (change in production). */
const DEMO_MEMBER_PASSWORD = process.env.DEMO_MEMBER_PASSWORD || 'demo12345';

const DEMO_USERS = [
  { name: 'Nandini Singh', email: 'nandini@smartkitchen.demo', role: 'Member' },
  { name: 'Arjun Mehta', email: 'arjun@smartkitchen.demo', role: 'Member' },
  { name: 'Priya Sharma', email: 'priya@smartkitchen.demo', role: 'Member' },
];

const DEMO_MESSAGES = [
  {
    name: 'Rahul Verma',
    email: 'rahul.verma@example.com',
    message:
      'Love the sustainability score! Could you add export to PDF for the pantry list?',
  },
  {
    name: 'Sneha Kulkarni',
    email: 'sneha.k@example.com',
    message: 'Near-expiry deals saved me twice this week. Please add more stores in Pune.',
  },
  {
    name: 'Vikram Desai',
    email: 'vikram.d@example.com',
    message: 'The AI shopping suggestions are spot on. Great work on SmartKitchen!',
  },
];

async function seedUsers() {
  const hashed = hashPassword(DEMO_MEMBER_PASSWORD);
  for (const u of DEMO_USERS) {
    await User.findOneAndUpdate(
      { email: u.email },
      { $set: { name: u.name, email: u.email, role: u.role, password: hashed } },
      { upsert: true, new: true }
    );
  }
  console.log(`Users: ensured ${DEMO_USERS.length} demo accounts (password: ${DEMO_MEMBER_PASSWORD})`);
}

async function seedShopkeeper() {
  const email = 'shopkeeper@smartkitchen.demo';
  const existing = await Shopkeeper.findOne({ email }).lean();
  if (existing && !FORCE) {
    console.log('Shopkeeper: already exists (use SEED_FORCE=1 to recreate)');
    return existing._id;
  }
  if (existing && FORCE) {
    await Shopkeeper.deleteOne({ _id: existing._id });
  }
  const doc = await Shopkeeper.create({
    name: 'Aprajita Store Owner',
    email,
    password: hashPassword('demo12345'),
    shopName: 'Aprajita fruits',
    shopAddress: 'Adarsh nagar, near metro station',
    phone: '+91 98765 43210',
    licenseOrGst: '',
  });
  console.log('Shopkeeper: created shopkeeper@smartkitchen.demo / password: demo12345');
  return doc._id;
}

async function seedDeals(shopkeeperId) {
  if (FORCE) {
    await Deal.deleteMany({});
  } else if ((await Deal.countDocuments()) > 0) {
    console.log('Deals: skipped (collection not empty). Use SEED_FORCE=1 to replace.');
    return;
  }

  const rows = [
    {
      productName: 'mango',
      quantity: '12 pcs',
      expiryDate: daysFromNow(16),
      discountPrice: 500,
      originalPrice: 700,
      shopName: 'Aprajita fruits',
      location: 'aadarsh nagar , near metro station',
      shopkeeperId,
    },
    {
      productName: 'milk',
      quantity: '1L',
      expiryDate: daysFromNow(1),
      discountPrice: 40,
      originalPrice: 55,
      shopName: 'Aprajita fruits',
      location: 'Adarsh nagar',
      shopkeeperId,
    },
    {
      productName: 'Penne pasta 500g',
      quantity: '500 g',
      expiryDate: daysFromNow(5),
      discountPrice: 89,
      originalPrice: 140,
      shopName: 'Aprajita fruits',
      location: 'Adarsh nagar',
      shopkeeperId,
    },
    {
      productName: 'Organic whole wheat bread',
      quantity: '1 loaf',
      expiryDate: daysFromNow(2),
      discountPrice: 35,
      originalPrice: 55,
      shopName: 'Green Basket',
      location: 'Sector 12 market',
      shopkeeperId: null,
    },
    {
      productName: 'Bananas',
      quantity: '6 pcs',
      expiryDate: daysFromNow(3),
      discountPrice: 25,
      originalPrice: 40,
      shopName: 'Green Basket',
      location: 'Sector 12 market',
      shopkeeperId: null,
    },
    {
      productName: 'Fresh spinach',
      quantity: '250 g',
      expiryDate: daysFromNow(1),
      discountPrice: 15,
      originalPrice: 28,
      shopName: 'Fresh Mart',
      location: 'MG Road',
      shopkeeperId: null,
    },
    {
      productName: 'Greek yogurt',
      quantity: '400 g',
      expiryDate: daysFromNow(4),
      discountPrice: 72,
      originalPrice: 110,
      shopName: 'Fresh Mart',
      location: 'MG Road',
      shopkeeperId: null,
    },
    {
      productName: 'Free-range eggs',
      quantity: '6 pcs',
      expiryDate: daysFromNow(7),
      discountPrice: 48,
      originalPrice: 65,
      shopName: 'Daily Dairy Co.',
      location: 'Indiranagar',
      shopkeeperId: null,
    },
  ];

  await Deal.insertMany(rows);
  console.log(`Deals: inserted ${rows.length} listings`);
}

async function seedRecipes(mainUserId) {
  if (FORCE) {
    await Recipe.deleteMany({ userId: mainUserId });
  } else if ((await Recipe.countDocuments({ userId: mainUserId })) > 0) {
    console.log('Recipes: skipped for demo user (already present). Use SEED_FORCE=1 to replace.');
    return;
  }

  const list = [
    {
      title: 'Spinach & paneer stir-fry',
      description: 'Quick weeknight dinner using wilting spinach from the fridge.',
      ingredients: ['Spinach 200g', 'Paneer 150g', 'Onion 1', 'Garlic 2 cloves', 'Oil 1 tbsp', 'Salt & spices'],
      steps: ['Sauté onion and garlic', 'Add spinach until wilted', 'Stir in cubed paneer', 'Season and serve hot'],
      prepTime: '20 min',
      servings: 2,
      difficulty: 'Easy',
      tag: 'Leftover hero',
      imageUrl: '',
      userId: mainUserId,
    },
    {
      title: 'Banana oat smoothie',
      description: 'Use ripe bananas before they turn.',
      ingredients: ['Banana 2', 'Oats 3 tbsp', 'Milk 200ml', 'Honey 1 tsp'],
      steps: ['Blend all ingredients until smooth', 'Serve chilled'],
      prepTime: '5 min',
      servings: 2,
      difficulty: 'Easy',
      tag: 'Breakfast',
      imageUrl: '',
      userId: mainUserId,
    },
    {
      title: 'Tomato rice (thakkali sadam)',
      description: 'South Indian one-pot using extra tomatoes.',
      ingredients: ['Rice 1 cup', 'Tomatoes 3', 'Onion 1', 'Oil, mustard, curry leaves', 'Salt'],
      steps: ['Cook rice', 'Make tomato masala', 'Mix and simmer 5 minutes'],
      prepTime: '35 min',
      servings: 3,
      difficulty: 'Medium',
      tag: 'Comfort',
      imageUrl: '',
      userId: mainUserId,
    },
  ];

  await Recipe.insertMany(list);
  console.log(`Recipes: inserted ${list.length} for demo user`);
}

async function seedMessages() {
  if (FORCE) {
    await Message.deleteMany({});
  } else if ((await Message.countDocuments()) > 0) {
    console.log('Messages: skipped (collection not empty). Use SEED_FORCE=1 to replace.');
    return;
  }
  await Message.insertMany(DEMO_MESSAGES);
  console.log(`Messages: inserted ${DEMO_MESSAGES.length} contact messages`);
}

async function main() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  console.log('MongoDB connected');
  console.log(FORCE ? 'SEED_FORCE: replacing demo deals/messages/recipes where applicable\n' : '');

  await seedUsers();
  const skId = await seedShopkeeper();

  const nandini = await User.findOne({ email: 'nandini@smartkitchen.demo' }).lean();
  if (!nandini?._id) throw new Error('Demo user not found');

  await seedDeals(skId);
  await seedRecipes(nandini._id);
  await seedMessages();

  console.log('\nDone. Demo login hints:');
  console.log('  Shopkeeper portal: shopkeeper@smartkitchen.demo / demo12345');
  console.log('  Admin users list: GET /api/users');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
