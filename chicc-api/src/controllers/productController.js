const { getAllProducts, filterProducts } = require('./productService');

exports.getFilteredProducts = (req, res) => {
  const filtered = filterProducts(req.query);
  res.json(filtered);
};

exports.getProductById = (req, res) => {
  const all = getAllProducts();
  const product = all.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ msg: 'Product not found' });
  res.json(product);
};
