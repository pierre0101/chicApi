// /src/routes/wishlist.js

const express = require('express');
const Wishlist = require('../models/Wishlist');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/v1/wishlist
// @desc    Add a product to wishlist
router.post('/', auth, async (req, res, next) => {
  const { productId } = req.body;
  try {
    const item = new Wishlist({ userId: req.userId, productId });
    await item.save();
    res.status(201).json({ message: 'Added to wishlist' });
  } catch (err) {
    // Duplicate key (already in wishlist)
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Already in wishlist' });
    }
    next(err);
  }
});

// @route   GET /api/v1/wishlist
// @desc    Get user wishlist with pagination, filtering, and populated product details
router.get('/', auth, async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page,  10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { brand, type } = req.query;

    // Base filter on the current user
    const filter = { userId: req.userId };

    // If filtering by product brand/type, add to the query
    if (brand) filter['product.brand'] = brand;
    if (type)  filter['product.type']  = type;

    const skip = (page - 1) * limit;

    // Pull in product details from the Products collection
    const items = await Wishlist.find({ userId: req.userId })
      .populate({
        path: 'productId',
        select: 'name type brand image price'
      })
      .skip(skip)
      .limit(limit);

    const total = await Wishlist.countDocuments({ userId: req.userId });

    // Send back just the product objects in an envelope
    res.json({
      page,
      limit,
      total,
      items: items.map(doc => doc.productId)
    });
  } catch (err) {
    next(err);
  }
});

// @route   DELETE /api/v1/wishlist/:productId
// @desc    Remove a product from wishlist
router.delete('/:productId', auth, async (req, res, next) => {
  try {
    const { productId } = req.params;
    const deleted = await Wishlist.findOneAndDelete({
      userId: req.userId,
      productId
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Item not found in wishlist' });
    }

    res.json({ message: 'Removed from wishlist' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
