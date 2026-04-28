import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { KitchenState } from './models/KitchenState.js';
import { messagesRouter } from './routes/messages.js';
import { kitchenRouter } from './routes/kitchen.js';
import { usersRouter } from './routes/users.js';
import { recipesRouter } from './routes/recipes.js';
import { dealsRouter } from './routes/deals.js';
import { shopkeepersRouter } from './routes/shopkeepers.js';
import { authRouter } from './routes/auth.js';
import { commerceRouter } from './routes/commerce.js';
import { insightsRouter } from './routes/insights.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartkitchen';
const frontendDir = path.join(__dirname, '../../frontend');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.static(frontendDir));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mongo: mongoose.connection.readyState === 1 });
});

app.use('/api/auth', authRouter);
app.use('/api/commerce', commerceRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/users', usersRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/deals', dealsRouter);
app.use('/api/shopkeepers', shopkeepersRouter);
app.use('/api', kitchenRouter);

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

async function migrateLegacyKitchenState() {
  try {
    await KitchenState.updateMany(
      {
        key: 'default',
        $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }],
      },
      { $set: { userId: 'default' } }
    );
  } catch (e) {
    console.warn('KitchenState migration skipped:', e.message);
  }
}

async function main() {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
  });
  console.log('MongoDB connected');
  await migrateLegacyKitchenState();
  app.listen(PORT, () => {
    console.log(`SmartKitchen server: http://localhost:${PORT}`);
    console.log('API: /api/auth, /api/commerce, /api/insights, /api/messages, /api/data, /api/users, /api/recipes, /api/deals');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
