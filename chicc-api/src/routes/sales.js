const express = require('express');
const fs = require('fs');
const path = require('path');
const { auth } = require('../middleware/auth');   // <─ CHANGED: grab the function
const router = express.Router();

const dataDir = path.join(__dirname, '..', 'data');

/* ────────── load product data ────────── */
let products = [];
try {
  const data = fs.readFileSync(path.join(dataDir, 'products.json'), 'utf-8');
  products = JSON.parse(data);
} catch (err) {
  console.error('Failed to load products.json:', err);
}

/* load every *.json except products.json */
function readAllJsonExceptProducts() {
  const files = fs.readdirSync(dataDir);
  const jsons = files.filter(f => f.endsWith('.json') && f !== 'products.json');
  const result = {};
  for (const file of jsons) {
    try {
      result[path.basename(file, '.json')] = JSON.parse(
        fs.readFileSync(path.join(dataDir, file), 'utf-8')
      );
    } catch (err) {
      console.error(`Error reading ${file}:`, err);
    }
  }
  return result;
}
const otherData = readAllJsonExceptProducts();

/* helper */
const findProductById = id => products.find(p => p._id === id);

/* ────────── /checkout route ────────── */
router.post('/checkout', auth, (req, res, next) => {   // <─ uses the function
  const { items } = req.body;
  const userId = req.user.userId;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'No items provided for checkout' });
  }

  try {
    let totalAmount = 0;
    const saleItems = [];

    for (const item of items) {
      const product = findProductById(item.id);
      if (!product) {
        return res.status(404).json({ message: `Product ${item.id} not found` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for product ${product.brand}`
        });
      }

      product.stock -= item.quantity;
      const amount = product.price * item.quantity;
      totalAmount += amount;

      saleItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price,
        amount
      });
    }

    const sale = {
      id: `sale_${Date.now()}`,
      user: userId,
      items: saleItems,
      totalAmount,
      createdAt: new Date()
    };

    res.status(201).json({ message: 'Checkout successful', saleId: sale.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
