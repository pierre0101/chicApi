// /src/routes/users.js

const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const { auth, checkRole } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

// Data directory and sales file for recent orders
const dataDir = path.join(__dirname, '../data');
const salesFile = path.join(dataDir, 'sales.json');

router.get('/available-agent', async (req, res, next) => {
  try {
    const agent = await User.findOne({ role: 'customer-service', status: 'online' })
      .select('_id firstName lastName email status');
    if (!agent) {
      return res.status(404).json({ message: 'No user found' });
    }

    res.json({
      agentId: agent._id,
      name: `${agent.firstName} ${agent.lastName}`.trim(),
      email: agent.email,
      status: agent.status,
    });
  } catch (err) {
    next(err);
  }
});

// Return all users with a defined role
router.get('/', async (req, res) => {
  try {
    const usersWithRoles = await User.find({
      role: { $exists: true, $ne: null, $ne: '' }
    }).select('-password');

    res.json(usersWithRoles);
  } catch (err) {
    console.error('Error fetching users with roles:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/v1/users/search?query=...
router.get(
  '/search',
  auth,
  checkRole('customer-service'),
  async (req, res, next) => {
    try {
      const q = (req.query.query || '').toString().trim();
      if (!q) return res.status(400).json({ message: 'Query param is required' });

      const regex = new RegExp(q, 'i');
      const user = await User.findOne({
        $or: [
          { username: regex },
          { firstName: regex },
          { lastName: regex },
          { email: regex }
        ]
      }).select('-password');

      if (!user) return res.status(404).json({ message: 'User not found' });

      let sales = [];
      if (fs.existsSync(salesFile)) {
        sales = JSON.parse(fs.readFileSync(salesFile, 'utf-8'));
      }
      const recentOrders = sales
        .filter(s => s.metadata?.userId === user._id.toString() || s.user === user._id.toString())
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5)
        .map(s => ({ _id: s.id, date: s.date, total: s.amount }));

      res.json({
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        recentOrders
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/users/:username
// PATCH /api/v1/users/:username
router.patch('/:username', async (req, res) => {
  try {
    const identifier = req.params.username; // updated local variable name
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Updated to find user by username OR email
    const user = await User.findOneAndUpdate(
      {
        $or: [
          { username: identifier },
          { email: identifier.toLowerCase() }
        ]
      },
      { password: hashedPassword },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Error updating password:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

router.get('/:username/avatar', async (req, res) => {
  try {
    const username = req.params.username;
    const publicDir = path.join(__dirname, '../../public');
    const files = fs.readdirSync(publicDir);
    const userImage = files.find(f => f.startsWith(username + '_'));

    if (!userImage) {
      return res.sendStatus(404);
    }

    const imagePath = path.join(publicDir, userImage);
    console.log('Serving avatar from:', imagePath);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.sendFile(imagePath);
  } catch (err) {
    console.error('Error fetching user avatar:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// POST /api/v1/users
// Create a new employee record (multipart/form-data)
router.post('/', upload.single('picture'), async (req, res) => {
  try {
    const { firstName, lastName, email, phone, address, bankAccount, password, role } = req.body;
    if (!firstName || !lastName || !email || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const base = email.split('@')[0];
    let username = base;
    let count = 0;
    while (await User.exists({ username })) {
      count += 1;
      username = `${base}${count}`;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userData = {
      username,
      firstName,
      lastName,
      email,
      phone,
      address,
      bankAccount,
      password: hashedPassword,
      role,
      // picture field removed, no DB save
    };

    const newUser = new User(userData);
    await newUser.save();

    res.status(201).json(newUser);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/v1/users/upload-avatar
// Upload user avatar and save it as /public/<userId>.<ext>
router.post('/upload-avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    const imageUrl = `/${req.file.filename}`; // accessible via static serving
    res.json({ message: 'Avatar uploaded successfully', imageUrl });
  } catch (err) {
    console.error('Error uploading avatar:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/v1/users/:username
router.delete('/:username', auth, checkRole('admin'), async (req, res) => {
  try {
    const username = req.params.username;
    const deleted = await User.findOneAndDelete({ username });
    if (!deleted) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/test', (req, res) => {
  res.send('Users route test working');
});


module.exports = router;
