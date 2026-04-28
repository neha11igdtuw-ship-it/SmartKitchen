# SmartKitchen – Your Kitchen, Reimagined

**SmartKitchen** is a web app for tracking kitchen inventory, sustainability metrics, and near-expiry deals. The **frontend** uses HTML, CSS, and vanilla JavaScript with **localStorage** for most UI state. The **backend** (Express + MongoDB) powers contact messages, optional cloud sync of kitchen snapshots, users, recipes, shopkeepers, and deals.

---

## Key features

### Pantry & alerts
Track items with expiry and quantities; urgent-style alerts when stock is low or items are expiring soon.

### AI Insights
**Run-out estimates** are computed in the browser from pantry data (e.g. quantity and days until expiry), not from a separate trained ML service. See `ai-insights.html` for the exact heuristics.

### Shopping list & sustainability
Shopping lists and sustainability metrics are driven by the client-side app state (and sync where configured).

### Near-expiry deals & shopkeepers
Shopkeepers can register and list deals; listings are stored in MongoDB and surfaced in the deals UI.

### Receipt scanner
Upload a **JPG or PNG** receipt; **Tesseract.js** runs **in the browser** (images are not sent to the server). Parsed line items can be added to the local pantry. **PDF** is not supported in this flow.

---

## Tech stack

| Layer | Details |
|--------|---------|
| Frontend | HTML, CSS, vanilla JS in `frontend/` |
| Client storage | `localStorage` via `storage.js`; optional API sync via `/api/data` |
| Receipt OCR | [Tesseract.js](https://github.com/naptha/tesseract.js) on `receipt-scanner.html` / `receipt-scanner.js` |
| Backend | Node.js 18+, Express, Mongoose in `backend/` |
| Database | MongoDB 4.4+ (local, Docker, or [Atlas](https://www.mongodb.com/cloud/atlas)) |

---

## Project structure

```
SmartKitchen/
├── frontend/                 # Static UI (served by Express in dev)
│   ├── index.html            # Landing (contact form → API)
│   ├── dashboard.html, pantry.html, ai-insights.html, …
│   ├── admin-data.html       # Admin-style CRUD for users/recipes (via API)
│   ├── contact-api.js        # Contact messages API client
│   ├── kitchen-sync.js       # Optional /api/data sync
│   ├── storage.js            # localStorage persistence
│   └── …
├── backend/
│   ├── package.json
│   ├── .env.example          # Copy to .env — not committed
│   ├── scripts/seed.js       # Demo data: npm run seed
│   └── src/
│       ├── index.js          # Express + static frontend + MongoDB
│       ├── models/
│       ├── routes/
│       └── controllers/
└── README.md
```

---

## API overview

Base URL is the same origin as the app (e.g. `http://localhost:5000`). All paths below are prefixed with `/api`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | `{ ok, mongo }` — MongoDB connection state |
| `GET` | `/messages` | List contact messages. Query: `limit` (default 50, max 100) |
| `POST` | `/messages` | Body: `{ name, email, message }` |
| `GET` | `/data` | Kitchen snapshot for `userId` (query or body; default `default`). Creates empty state if missing |
| `POST` | `/data` | Partial update of allowed kitchen fields + `userId` |
| `POST` | `/data/migrate` | Legacy migration helper |
| `GET` | `/users` | List users. Query: `limit` (default 100, max 500) |
| `GET` | `/users/:id` | Get one user |
| `POST` | `/users` | Body: `{ name, email, role? }` |
| `PUT` | `/users/:id` | Update user |
| `DELETE` | `/users/:id` | Delete user |
| `GET` | `/recipes` | List recipes. Query: `limit`, optional `userId` |
| `GET` | `/recipes/:id` | Get one recipe |
| `POST` | `/recipes` | Create recipe |
| `PUT` | `/recipes/:id` | Update recipe |
| `DELETE` | `/recipes/:id` | Delete recipe |
| `GET` | `/deals` | List deals. Query: `limit`, `skip`, `shopName`, `expiringBefore`, `shopkeeperId` |
| `POST` | `/deals` | Create deal |
| `POST` | `/deals/:id/claim` | Claim a deal |
| `POST` | `/shopkeepers/register` | Shopkeeper registration |
| `POST` | `/shopkeepers/login` | Shopkeeper login |

The Express app serves `frontend/` at the site root (e.g. `http://localhost:5000/pantry.html`).

---

## Run locally

### 1. MongoDB

- **Local:** [MongoDB Community](https://www.mongodb.com/docs/manual/installation/) or Docker:  
  `docker run -d --name smartkitchen-mongo -p 27017:27017 mongo:7`
- **Atlas:** Create a cluster and set `MONGODB_URI` in `.env`.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Set MONGODB_URI (default: mongodb://127.0.0.1:27017/smartkitchen)
npm install
npm run dev
```

- **`npm run dev`** — server with file watch  
- **`npm start`** — production-style run (`node src/index.js`)  
- **`npm run seed`** — optional demo users, shopkeeper, deals, recipes, messages (`SEED_FORCE=1 npm run seed` to reset some demo data — see script header)

Default port is **5000** (`PORT` in `.env`).

### 3. Open the app

**http://localhost:5000**

If MongoDB is unreachable, the process exits on startup. Fix the URI or start MongoDB, then retry.

---

 

## License / mission

SmartKitchen is built around reducing waste and smarter kitchen habits at home.

**SmartKitchen — making kitchens smarter and greener, one meal at a time.**
