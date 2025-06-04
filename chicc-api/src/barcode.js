const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const ignoreFiles = ['products.json', 'sales.json', 'coupons.json'];

function generateBarcode(type, id) {
  const rand = Math.floor(100000 + Math.random() * 900000); // 6-digit random
  return `${type.toLowerCase()}-${id}-${rand}`;
}

const productFiles = fs
  .readdirSync(dataDir)
  .filter(f => f.endsWith('.json') && !ignoreFiles.includes(f));

for (const file of productFiles) {
  const fullPath = path.join(dataDir, file);
  const products = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

  let changed = false;
  const type = path.basename(file, '.json');

  for (const prod of products) {
    if (!prod.barcode) {
      prod.barcode = generateBarcode(prod.type || type, prod.id || '');
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(fullPath, JSON.stringify(products, null, 2));
    console.log(`Updated barcodes in ${file}`);
  } else {
    console.log(`No changes needed for ${file}`);
  }
}

console.log('Barcode update complete.');