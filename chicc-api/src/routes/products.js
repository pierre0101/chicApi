const express = require('express');
const path = require('path');
const fs = require('fs');
const { auth, checkSectionAccess, checkRole } = require('../middleware/auth');
const multer = require('multer');

const router = express.Router();

// Define directories
const dataDir = path.join(__dirname, '../data');
const imagesDir = path.join(__dirname, '../../public');

// 1) Serve static images so /images/<filename> works
router.use(
  '/images',
  express.static(imagesDir)
);

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
      .filter(f =>
        f.endsWith('.json') &&
        !['products.json', 'sales.json', 'coupons.json'].includes(f)
      );
    const types = files.map(f => path.basename(f, '.json'));
    res.json(types);
  } catch (err) {
    res.status(500).json({ message: 'Error loading product types', error: err.message });
  }
});

// 1) All products (all JSON files except products.json)
router.get('/', (req, res) => {
  try {
    const files = fs.readdirSync(dataDir)
      .filter(f => f.endsWith('.json') && f !== 'products.json');
    let allProducts = [];
    let idCounter = 1;

    files.forEach(file => {
      const type = path.basename(file, '.json');
      const items = loadJson(file);
      if (Array.isArray(items)) {
        const itemsWithMeta = items.map(item => ({
          id: item.id || idCounter++,
          type,
          ...item,
          stock: item.quantity
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
    const files = fs.readdirSync(dataDir)
      .filter(f => f.endsWith('.json') && f !== 'products.json');
    for (const file of files) {
      const items = loadJson(file);
      const found = items.find(p => p.id === id);
      if (found) {
        return res.json({ ...found, stock: found.quantity });
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
    const files = fs.readdirSync(dataDir)
      .filter(f => f.endsWith('.json') && f !== 'products.json');
    let allItems = [];
    files.forEach(file => {
      const items = loadJson(file);
      if (Array.isArray(items)) allItems = allItems.concat(items);
    });
    const picked = allItems.sort(() => 0.5 - Math.random()).slice(0, 3);
    res.json(picked);
  } catch (err) {
    res.status(500).json({ message: 'Error loading exclusives', error: err.message });
  }
});

// 5) Admin-only: Add new product to category (with image upload)
router.post(
  '/:type/add',
  auth,
  checkRole('admin'),
  upload.single('image'),
  (req, res) => {
    const { type } = req.params;
    const fileName = `${type}.json`;
    const fullPath = path.join(dataDir, fileName);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'Category not found' });
    }

    try {
      const products = loadJson(fileName);
      const newProd = JSON.parse(req.body.data || '{}');

      if (req.file) {
        newProd.image = req.file.filename;
      }

      newProd.id = products.length > 0
        ? Math.max(...products.map(p => p.id || 0)) + 1
        : 1;

      products.push(newProd);
      saveJson(fileName, products);

      res.status(201).json(newProd);
    } catch (err) {
      res.status(500).json({ message: 'Failed to add product', error: err.message });
    }
  }
);

// 6) Fetch products by category/type (catch-all)
router.get('/categories/:type', (req, res) => {
  const type = req.params.type;
  if (['product', 'exclusives', 'types', 'test-auth'].includes(type)) {
    return res.status(404).json({ message: 'Not found' });
  }

  const fileName = `${type}.json`;
  const fullPath = path.join(dataDir, fileName);

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ message: `Category "${type}" not found` });
  }

  try {
    const data = loadJson(fileName);
    const withStock = data.map(item => ({ ...item, stock: item.quantity }));
    res.json(withStock);
  } catch (err) {
    res.status(500).json({ message: `Error loading "${type}"`, error: err.message });
  }
});

// Search all product JSON files for a product with the given barcode
router.get('/barcode/:code', (req, res) => {
  try {
    const barcode = req.params.code;

    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'sales.json');

    for (const file of files) {
      const items = loadJson(file);
      if (Array.isArray(items)) {
        const found = items.find(item => item.barcode === barcode);
        if (found) {
          return res.json({ ...found, stock: found.quantity });
        }
      }
    }

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

    const productFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'sales.json');

    let allProducts = [];
    for (const file of productFiles) {
      const products = loadJson(file);
      if (Array.isArray(products)) {
        products.forEach(product => {
          allProducts.push({ ...product, _file: file, stock: product.quantity });
        });
      }
    }

    for (const item of items) {
      const product = allProducts.find(p => p.id === item.id);
      if (!product) {
        return res.status(404).json({ message: `Product with ID ${item.id} not found` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for product ${product.brand || product.id}` });
      }
    }

    for (const item of items) {
      const product = allProducts.find(p => p.id === item.id);
      product.stock -= item.quantity;
    }

    const productsByFile = {};
    for (const product of allProducts) {
      if (!productsByFile[product._file]) {
        productsByFile[product._file] = [];
      }
      const { _file, stock, ...productData } = product;
      // write updated stock back into JSON.quantity
      productData.quantity = stock;
      productsByFile[_file].push(productData);
    }

    for (const [file, updatedProducts] of Object.entries(productsByFile)) {
      saveJson(file, updatedProducts);
    }

    const salesFile = 'sales.json';
    let sales = [];
    if (fs.existsSync(path.join(dataDir, salesFile))) {
      sales = loadJson(salesFile);
      if (!Array.isArray(sales)) {
        sales = [];
      }
    }

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

    const newSale = {
      id: sales.length > 0 ? Math.max(...sales.map(s => s.id || 0)) + 1 : 1,
      user: req.user.userId,
      items: saleItems,
      totalAmount,
      createdAt: new Date().toISOString()
    };

    sales.push(newSale);
    saveJson(salesFile, sales);

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
    const raw = fs.readFileSync(path.join(d, file), 'utf8');
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error(`❌  Invalid JSON in ${file}`);
      return [];
    }
  });
}

loadAllProducts();

// PUBLIC Men, Women, Kids section routes (NO auth, NO section check)
router.get('/men', (req, res) => {
  // ...existing code for men section...
});
router.get('/women', (req, res) => {
  // ...existing code for women section...
});
router.get('/kids', (req, res) => {
  // ...existing code for kids section...
});

// GET /products/by-section?section=men|women|kids|sale
router.get('/by-section', (req, res) => {
  const { section } = req.query;

  if (!section || typeof section !== 'string') {
    return res.status(400).json({ message: 'Section is required as a query parameter' });
  }

  try {
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'sales.json');
    let allProducts = [];

    files.forEach(file => {
      const items = loadJson(file);
      if (Array.isArray(items)) {
        allProducts = allProducts.concat(items);
      }
    });

    // Case-insensitive section matching
    const filtered = allProducts.filter(
      (item) => item.section && item.section.toLowerCase() === section.toLowerCase()
    );

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ message: 'Error loading products by section', error: err.message });
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
