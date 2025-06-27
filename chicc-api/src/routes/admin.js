// /src/routes/admin.js

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { auth, checkRole, checkSectionAccess } = require('../middleware/auth'); // <-- fix import

const router = express.Router();
const dataDir = path.join(__dirname, '../data');
const imagesDir = path.join(__dirname, '../public/images');
const salesFile = path.join(dataDir, 'sales.json');

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, imagesDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Utility to load JSON
function loadJson(file) {
  const filePath = path.join(dataDir, file);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Utility to write JSON
function writeJson(file, data) {
  const filePath = path.join(dataDir, file);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// 1) Add a new product to a category with image upload
// POST /api/v1/products/:type/add
router.post(
  '/products/:type/add',
  auth,
  checkRole('admin'),
  upload.single('image'),
  (req, res) => {
    const { type } = req.params;
    const fileName = `${type}.json`;
    const filePath = path.join(dataDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ message: `Category '${type}' not found` });
    }

    try {
      const products = loadJson(fileName);
      const { brand, price, description, quantity } = req.body;

      // Create new product with required fields and auto-increment id
      const newProduct = {
        id: products.length > 0 ? products[products.length - 1].id + 1 : 1,
        type,
        brand,
        price: Number(price),
        quantity: Number(quantity),
        description,
        image: req.file ? `/images/${req.file.filename}` : '',
      };

      products.push(newProduct);
      writeJson(fileName, products);

      res.json({ message: 'Product added', product: newProduct });
    } catch (err) {
      res.status(500).json({ message: 'Error adding product', error: err.message });
    }
  }
);

// 2) Stock summary: total items per category and overall count
// GET /api/v1/admin/stock
router.get('/stock', auth, checkRole('admin'), (req, res) => {
  try {
    const files = fs
      .readdirSync(dataDir)
      .filter(
        f =>
          f.endsWith('.json') &&
          !['products.json', 'sales.json', 'coupons.json'].includes(f)
      );

    const stock = files.map(f => {
      const items = loadJson(f);
      return {
        category: f.replace('.json', ''),
        count: Array.isArray(items) ? items.length : 0
      };
    });
    const total = stock.reduce((sum, c) => sum + c.count, 0);
    res.json({ stock, total });
  } catch (err) {
    res.status(500).json({ message: 'Error computing stock', error: err.message });
  }
});

// ** NEW ROUTE **
// 3) Get all products across all categories with full details
// GET /api/v1/admin/products
router.get('/products', auth, checkRole('admin'), (req, res) => {
  try {
    const files = fs
      .readdirSync(dataDir)
      .filter(
        f =>
          f.endsWith('.json') &&
          !['products.json', 'sales.json', 'coupons.json'].includes(f)
      );

    let allProducts = [];
    for (const file of files) {
      const products = loadJson(file);
      if (Array.isArray(products)) {
        allProducts = allProducts.concat(products);
      }
    }
    res.json(allProducts);
  } catch (err) {
    res.status(500).json({ message: 'Error loading products', error: err.message });
  }
});

// 4) Sales summary: daily, weekly, monthly totals
// GET /api/v1/admin/sales-summary
router.get('/sales-summary', auth, checkRole('admin'), (req, res) => {
  try {
    if (!fs.existsSync(salesFile)) writeJson('sales.json', []);
    const sales = loadJson('sales.json');
    const now = new Date();
    const toDate = d => new Date(d).toISOString().slice(0, 10);

    const today = toDate(now);
    const daily = sales
      .filter(s => toDate(s.date) === today)
      .reduce((sum, s) => sum + s.amount, 0);

    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 6);
    const weekly = sales
      .filter(s => new Date(s.date) >= weekAgo)
      .reduce((sum, s) => sum + s.amount, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthly = sales
      .filter(s => new Date(s.date) >= monthStart)
      .reduce((sum, s) => sum + s.amount, 0);

    res.json({ daily, weekly, monthly });
  } catch (err) {
    res.status(500).json({ message: 'Error computing sales summary', error: err.message });
  }
});

// GET /api/v1/admin/retailers
router.get('/retailers', auth, checkRole('admin'), (req, res) => {
  try {
    const filePath = path.join(dataDir, 'retailers.json');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Retailers file not found' });
    }

    const retailers = loadJson('retailers.json');
    if (!Array.isArray(retailers)) {
      return res.status(500).json({ message: 'Retailers data is malformed' });
    }

    res.json(retailers);
  } catch (err) {
    res.status(500).json({ message: 'Error loading retailers', error: err.message });
  }
});

// POST /api/v1/admin/retailers/add
router.post('/retailers/add', auth, checkRole('admin'), (req, res) => {
  const filePath = path.join(dataDir, 'retailers.json');

  try {
    const { name, email, phone } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const retailers = fs.existsSync(filePath) ? loadJson('retailers.json') : [];

    const newRetailer = {
      id: retailers.length > 0 ? retailers[retailers.length - 1].id + 1 : 1,
      name,
      email,
      phone
    };

    retailers.push(newRetailer);
    writeJson('retailers.json', retailers);

    res.status(201).json({ message: 'Retailer added successfully', retailer: newRetailer });
  } catch (err) {
    res.status(500).json({ message: 'Error adding retailer', error: err.message });
  }
});

// 5) Stripe webhook to log each successful payment into sales.json
// POST /api/v1/admin/stripe-webhook
router.post(
  '/stripe-webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = require('stripe')(process.env.STRIPE_SECRET_KEY)
        .webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
      console.error('⚠️ Webhook signature verification failed.', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const record = {
        id: pi.id,
        amount: pi.amount_received / 100,
        date: new Date(pi.created * 1000).toISOString(),
        metadata: pi.metadata || {}
      };
      const sales = fs.existsSync(salesFile)
        ? loadJson('sales.json')
        : [];
      sales.push(record);
      writeJson('sales.json', sales);
    }

    res.json({ received: true });
  }
);

module.exports = router;