const express = require('express');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const router = express.Router();

const dataDir = path.join(__dirname, '..', 'data');

// Load products.json separately (you still need this)
let products = [];
try {
  const productsData = fs.readFileSync(path.join(dataDir, 'products.json'), 'utf-8');
  products = JSON.parse(productsData);
} catch (err) {
  console.error('Failed to load products.json:', err);
}

// Load all other JSON files except products.json
function readAllJsonExceptProducts() {
  const allFiles = fs.readdirSync(dataDir);
  const jsonFiles = allFiles.filter(file => file.endsWith('.json') && file !== 'products.json');

  const data = {};
  for (const file of jsonFiles) {
    try {
      const fileContent = fs.readFileSync(path.join(dataDir, file), 'utf-8');
      data[path.basename(file, '.json')] = JSON.parse(fileContent);
    } catch (err) {
      console.error(`Error reading JSON file ${file}:`, err);
    }
  }
  return data;
}

const otherData = readAllJsonExceptProducts();

// Helper to find product by id
function findProductById(id) {
  return products.find(p => p._id === id);
}

// Example of usage: you can access otherData.sales or otherData.users if those JSON files exist

router.post('/checkout', auth, (req, res, next) => {
  const { items } = req.body;
  const userId = req.user.userId;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'No items provided for checkout' });
  }

  try {
    let totalAmount = 0;
    const saleItems = [];

    for (const item of items) {
      const product = findProductById(item.id);
      if (!product) {
        return res.status(404).json({ message: `Product with ID ${item.id} not found` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for product ${product.brand}` });
      }

      product.stock -= item.quantity;

      const amount = product.price * item.quantity;
      totalAmount += amount;

      saleItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price,
        amount,
      });
    }

    // Mock sale record (since no DB)
    const sale = {
      id: `sale_${Date.now()}`,
      user: userId,
      items: saleItems,
      totalAmount,
      createdAt: new Date(),
    };

    res.status(201).json({ message: 'Checkout successful', saleId: sale.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
