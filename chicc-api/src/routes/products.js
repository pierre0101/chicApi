const express = require('express');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const { checkRole } = require('../middleware/roles');
const multer = require('multer');

const router = express.Router();

// Define directories
const dataDir = path.join(__dirname, '../data');
const imagesDir = path.join(__dirname, '../../public');

// Ensure images directory exists (for image uploads)
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, imagesDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

// Helper: Load JSON from data directory
function loadJson(filename) {
  const fullPath = path.join(dataDir, filename);
  const fileContent = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(fileContent);
}

// Helper: Save JSON to data directory
function saveJson(filename, data) {
  const fullPath = path.join(dataDir, filename);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
}

// --- Existing routes ---

// 0) Test auth route
router.get('/test-auth', auth, (req, res) => {
  res.json({ message: 'Authorized!', user: req.user });
});

// Get all product types (JSON file names without extensions, excluding some files)
router.get('/types', (req, res) => {
  try {
    const files = fs.readdirSync(dataDir)
      .filter(f => f.endsWith('.json') && !['products.json', 'sales.json', 'coupons.json'].includes(f));
    const types = files.map(f => path.basename(f, '.json'));
    res.json(types);
  } catch (err) {
    res.status(500).json({ message: 'Error loading product types', error: err.message });
  }
});

// 1) All products (all JSON files except products.json)
router.get('/', (req, res) => {
  try {
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'products.json');
    let allProducts = [];
    let idCounter = 1;

    files.forEach(file => {
      const type = path.basename(file, '.json');
      const items = loadJson(file);

      if (Array.isArray(items)) {
        const itemsWithMeta = items.map(item => ({
          id: item.id || idCounter++, // preserve id or assign new one
          type,
          ...item
        }));
        allProducts = allProducts.concat(itemsWithMeta);
      }
    });

    res.json(allProducts);
  } catch (err) {
    res.status(500).json({ message: 'Error loading product data', error: err.message });
  }
});

// 2) Single product by ID
router.get('/product/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'products.json');
    for (const file of files) {
      const items = loadJson(file);
      const found = items.find(p => p.id === id);
      if (found) {
        return res.json(found);
      }
    }
    res.status(404).json({ message: 'Product not found' });
  } catch (err) {
    res.status(500).json({ message: 'Error loading product', error: err.message });
  }
});

// 3) 3 random products from products.json (categories)
router.get('/categories', (req, res) => {
  try {
    const products = loadJson('products.json');
    const picked = products.sort(() => 0.5 - Math.random()).slice(0, 3);
    res.json(picked);
  } catch (err) {
    res.status(500).json({ message: 'Error loading categories', error: err.message });
  }
});

// 4) 3 random exclusives from all category files
router.get('/exclusives', (req, res) => {
  try {
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'products.json');
    let allItems = [];
    files.forEach(file => {
      const items = loadJson(file);
      if (Array.isArray(items)) {
        allItems = allItems.concat(items);
      }
    });
    const picked = allItems.sort(() => 0.5 - Math.random()).slice(0, 3);
    res.json(picked);
  } catch (err) {
    res.status(500).json({ message: 'Error loading exclusives', error: err.message });
  }
});

// 5) Admin-only: Add new product to category (with image upload)
router.post('/:type/add', auth, checkRole('admin'), upload.single('image'), (req, res) => {
  const { type } = req.params;
  const file = `${type}.json`;
  const fullPath = path.join(dataDir, file);

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ message: 'Category not found' });
  }

  try {
    const products = loadJson(file);
    const newProd = JSON.parse(req.body.data || '{}');

    if (req.file) {
      newProd.image = `/${req.file.filename}`;
    }

    newProd.id = products.length > 0 ? Math.max(...products.map(p => p.id || 0)) + 1 : 1;

    products.push(newProd);
    saveJson(file, products);

    res.status(201).json(newProd);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add product', error: err.message });
  }
});

// 6) Fetch products by category/type (catch-all)
router.get('/:type', (req, res) => {
  const type = req.params.type;

  // Avoid conflicts with other endpoints
  if (['product', 'categories', 'exclusives', 'types', 'test-auth'].includes(type)) {
    return res.status(404).json({ message: 'Not found' });
  }

  const file = `${type}.json`;
  const fullPath = path.join(dataDir, file);

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ message: `Category "${type}" not found` });
  }

  try {
    const data = loadJson(file);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: `Error loading "${type}"`, error: err.message });
  }
});

// Search all product JSON files for a product with the given barcode
router.get('/barcode/:code', (req, res) => {
  try {
    const barcode = req.params.code;

    // Get all JSON files except sales.json (products data)
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'sales.json');

    for (const file of files) {
      const items = loadJson(file);
      if (Array.isArray(items)) {
        const found = items.find(item => item.barcode === barcode);
        if (found) {
          return res.json(found);
        }
      }
    }

    // If no product found
    return res.status(404).json({ message: 'Product not found by barcode' });
  } catch (err) {
    return res.status(500).json({ message: 'Error searching product by barcode', error: err.message });
  }
});

// Checkout endpoint: receives items, verifies stock, deducts stock, saves sale record
router.post('/sales/checkout', auth, (req, res) => {
  try {
    const { items } = req.body; // expected: [{ id: number, quantity: number }, ...]

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No items provided for checkout' });
    }

    // Load all product JSON files except sales.json
    const productFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'sales.json');

    // Flatten all products with reference to source file
    let allProducts = [];
    for (const file of productFiles) {
      const products = loadJson(file);
      if (Array.isArray(products)) {
        products.forEach(product => {
          allProducts.push({ ...product, _file: file });
        });
      }
    }

    // Check stock availability for each item
    for (const item of items) {
      const product = allProducts.find(p => p.id === item.id);
      if (!product) {
        return res.status(404).json({ message: `Product with ID ${item.id} not found` });
      }
      const availableStock = product.stock || 0;
      if (availableStock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for product ${product.brand || product.id}` });
      }
    }

    // Deduct stock quantities
    for (const item of items) {
      const product = allProducts.find(p => p.id === item.id);
      product.stock = (product.stock || 0) - item.quantity;
    }

    // Group updated products by file for saving
    const productsByFile = {};
    for (const product of allProducts) {
      if (!productsByFile[product._file]) {
        productsByFile[product._file] = [];
      }
      // Exclude the helper _file property when saving
      const { _file, ...productData } = product;
      productsByFile[product._file].push(productData);
    }

    // Save updated products to their respective files
    for (const [file, updatedProducts] of Object.entries(productsByFile)) {
      saveJson(file, updatedProducts);
    }

    // Load existing sales records or start empty array
    const salesFile = 'sales.json';
    let sales = [];
    if (fs.existsSync(path.join(dataDir, salesFile))) {
      sales = loadJson(salesFile);
      if (!Array.isArray(sales)) {
        sales = [];
      }
    }

    // Calculate total amount and prepare sale items detail
    let totalAmount = 0;
    const saleItems = items.map(item => {
      const product = allProducts.find(p => p.id === item.id);
      const price = product.price || 0;
      const amount = price * item.quantity;
      totalAmount += amount;
      return {
        id: product.id,
        brand: product.brand || '',
        quantity: item.quantity,
        price,
        amount
      };
    });

    // Prepare new sale record
    const newSale = {
      id: sales.length > 0 ? Math.max(...sales.map(s => s.id || 0)) + 1 : 1,
      user: req.user.userId, // assuming auth middleware adds userId to req.user
      items: saleItems,
      totalAmount,
      createdAt: new Date().toISOString()
    };

    // Save sale
    sales.push(newSale);
    saveJson(salesFile, sales);

    // Return success with sale details
    res.status(201).json({ message: 'Checkout successful', sale: newSale });
  } catch (err) {
    res.status(500).json({ message: 'Checkout failed', error: err.message });
  }
});

/** Utility: load and cache every category JSON once at boot */
let PRODUCTS = [];

function loadAllProducts() {
  const dataDir = path.join(__dirname, '..', 'data');
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));

  PRODUCTS = files.flatMap((file) => {
    const raw = fs.readFileSync(path.join(dataDir, file), 'utf8');
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error(`❌  Invalid JSON in ${file}`);
      return [];
    }
  });
}

loadAllProducts();

/* ─────────────  GET /api/v1/products/barcode/:code  ───────────── */
router.get('/barcode/:code', (req, res) => {
  try {
    const barcode = req.params.code;
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'sales.json');

    for (const file of files) {
      const items = loadJson(file);
      const found = items.find(item => item.barcode === barcode);
      if (found) {
        return res.json(found);
      }
    }

    return res.status(404).json({ message: 'Product not found by barcode' });
  } catch (err) {
    return res.status(500).json({ message: 'Error searching product by barcode', error: err.message });
  }
});

function loadAllProductsFlat() {
  const files = fs.readdirSync(dataDir)
    .filter(f => f.endsWith('.json') && !['products.json', 'sales.json', 'coupons.json'].includes(f));
  let all = [];
  files.forEach(file => {
    try {
      const items = loadJson(file);
      if (Array.isArray(items)) all = all.concat(items);
    } catch { }
  });
  return all;
}

router.get('/section/:section', (req, res) => {
  try {
    const { section } = req.params;
    const allProducts = loadAllProductsFlat();
    const matched = allProducts.filter(
      p => p.section && p.section.toLowerCase() === section.toLowerCase()
    );
    res.json(matched);
  } catch (err) {
    res.status(500).json({ message: 'Error loading products by section', error: err.message });
  }
});


module.exports = router;
