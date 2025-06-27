const fs = require('fs');
const path = require('path');

// read all products from the JSON file
function getAllProducts() {
  const filePath = path.join(__dirname, '../data/products.json');
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

// optional filtered query
function filterProducts(filters) {
  const all = getAllProducts();
  return all.filter(p =>
    (!filters.section  || p.section  === filters.section) &&
    (!filters.category || p.category === filters.category) &&
    (!filters.brand    || p.brand    === filters.brand) &&
    (!filters.color    || p.color    === filters.color) &&
    (!filters.size     || p.size     === filters.size));
}

module.exports = { getAllProducts, filterProducts };
