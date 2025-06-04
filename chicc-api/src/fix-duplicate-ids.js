const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');

// Files to ignore
const ignoreFiles = ['products.json', 'sales.json', 'coupons.json'];

// Load all product files
const productFiles = fs
  .readdirSync(dataDir)
  .filter(
    (f) => f.endsWith('.json') && !ignoreFiles.includes(f)
  );

let allProducts = [];
let idMap = new Map();

console.log('Loading products from files...');

for (const file of productFiles) {
  const fullPath = path.join(dataDir, file);
  const products = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

  if (!Array.isArray(products)) {
    console.warn(`Skipping ${file} because it does not contain an array.`);
    continue;
  }

  products.forEach((p, index) => {
    if (typeof p.id !== 'number') {
      console.warn(`Product in ${file} at index ${index} missing numeric id.`);
      return;
    }
    allProducts.push({ ...p, __file: file, __index: index });
  });
}

// Find duplicate IDs
const idCounts = allProducts.reduce((acc, p) => {
  acc[p.id] = (acc[p.id] || 0) + 1;
  return acc;
}, {});

const duplicates = Object.entries(idCounts).filter(([id, count]) => count > 1);

if (duplicates.length === 0) {
  console.log('No duplicate IDs found.');
  process.exit(0);
}

console.log(`Found ${duplicates.length} duplicated IDs:`);

duplicates.forEach(([id, count]) => {
  console.log(`- ID ${id} occurs ${count} times`);
});

// Fix duplicates by assigning new unique IDs, starting from max ID + 1
const maxId = Math.max(...allProducts.map(p => p.id));
let nextId = maxId + 1;

for (const [dupId] of duplicates) {
  // Get all products with this duplicate id
  const sameIdProds = allProducts.filter(p => p.id === Number(dupId));

  // Keep the first occurrence unchanged, update the rest
  for (let i = 1; i < sameIdProds.length; i++) {
    const p = sameIdProds[i];
    const filePath = path.join(dataDir, p.__file);
    const fileProducts = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    console.log(`Fixing duplicate ID ${dupId} in file ${p.__file} at index ${p.__index} -> new ID: ${nextId}`);

    fileProducts[p.__index].id = nextId;
    fs.writeFileSync(filePath, JSON.stringify(fileProducts, null, 2));

    nextId++;
  }
}

console.log('Duplicate IDs fixed by assigning new unique IDs.');
