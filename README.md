# 🌿 SmartKitchen – Your Kitchen, Reimagined

Welcome to **SmartKitchen**, an AI-powered platform designed to make your household more sustainable, efficient, and cost-effective. By tracking inventory, predicting consumption patterns, and optimizing grocery shopping, SmartKitchen helps you reduce food waste and minimize your carbon footprint.

---

## 🚀 Key Features

### 🥫 Smart Inventory Management (Pantry)
Track every item in your kitchen with ease. Our system monitors expiry dates and quantities, sending you **Urgent Alerts** when items are about to run out or expire.

### 🧠 AI consumption Forecasting
Our machine learning models learn your household's usage patterns to predict exactly when you'll run out of essentials. This ensures you never over-buy or run out of what you need.

### 🛒 Shopping Optimizer
Auto-generate optimized shopping lists based on your current inventory, predicted needs, and sustainability goals.

### 📊 Carbon & Sustainability Dashboard
Track your positive impact on the planet! View real-time metrics on:
- **Food Waste Reduced** (kg)
- **Plastic Items Avoided** (via refill stations)
- **CO₂ Footprint Reduction** (kg)

### 🏠 Household Collaboration
Manage your kitchen as a team. Add family members or roommates with specific roles (Admin/Member) to collaborate on shopping lists and inventory updates.

### 🏷️ Near-Expiry Deals
Save money while saving the planet. Discover discounted items from local grocery stores that are nearing their expiry date.

### 🧾 Receipt Scanner
Upload a **JPG or PNG** photo of a grocery receipt; **Tesseract.js** runs in the browser (no receipt images are sent to the server). The app parses line items with rupee amounts, cleans noisy OCR (invoice footers, HSN codes, “Grand total” rows), and shows **Total (line items)** plus **Grand total (receipt)** when the footer amount is detected. Use **Add All to Pantry** to append scanned items to your local pantry. **PDF** uploads are not supported in this flow—use an image export or photo instead.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS, and vanilla JavaScript in the `frontend/` folder.
- **Receipt OCR**: [Tesseract.js](https://github.com/naptha/tesseract.js) loaded on `receipt-scanner.html`; parsing logic lives in `receipt-scanner.js`.
- **Client persistence**: `localStorage` via `storage.js` for pantry and app state in the browser.
- **Backend**: Node.js and Express in `backend/`, with **MongoDB** (Mongoose) for API data.

---

## 📂 Project structure

```
SmartKitchen-main/
├── frontend/                 # Static site (HTML, CSS, JS)
│   ├── index.html            # Landing page (includes Contact form → API)
│   ├── contact-api.js        # Submits form & loads messages from the API
│   ├── receipt-scanner.html  # Receipt upload + OCR → pantry import
│   ├── receipt-scanner.js    # Tesseract OCR + receipt line parsing
│   ├── auth.html, dashboard.html, pantry.html, …
│   ├── storage.js            # localStorage persistence for the app
│   └── …
├── backend/
│   ├── package.json
│   ├── .env.example          # Copy to .env and set MONGODB_URI
│   └── src/
│       ├── index.js          # Express app + static files + MongoDB
│       ├── models/           # Mongoose models
│       └── routes/           # API route modules
└── README.md
```

---

## 🔌 API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check (`ok`, MongoDB connection state) |
| `GET` | `/api/messages` | List stored contact messages (`?limit=50`, max 100) |
| `POST` | `/api/messages` | Create a message body: `{ name, email, message }` |
| `GET` | `/api/data` | Load kitchen snapshot (same shape as legacy `db.json`) |
| `POST` | `/api/data` | Replace kitchen snapshot (full body) |

The Express server serves `frontend/` at the site root, so pages load at `http://localhost:3000/dashboard.html`, etc.

---

## ▶️ Run locally

### 1. MongoDB

You need a MongoDB 4.4+ instance. Pick one:

- **Local**: [Install MongoDB Community](https://www.mongodb.com/docs/manual/installation/) and start `mongod`, or run Docker:  
  `docker run -d --name smartkitchen-mongo -p 27017:27017 mongo:7`
- **Atlas**: Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas), get a connection string, and use it as `MONGODB_URI`.

### 2. Backend configuration

```bash
cd backend
cp .env.example .env
# Edit .env: set MONGODB_URI (default local URI is mongodb://127.0.0.1:27017/smartkitchen)
npm install
npm run dev
```

The server listens on port **3000** by default (`PORT` in `.env`).

### 3. Open the app

In the browser: **http://localhost:3000**

Use the **Contact** section on the home page to submit a message; it is stored in MongoDB and shown under **Recent messages**. If MongoDB is not running, the server will exit on startup or the contact list will show an error until the database is available.

---


## 🌱 Our Mission
At SmartKitchen, we believe that sustainability starts at home. Our mission is to empower every household with the data and tools they need to make smarter, greener choices Every. Single. Day.

**SmartKitchen – Making kitchens smarter and greener, one meal at a time.**

