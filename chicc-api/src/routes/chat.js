// /routes/chat.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ChatSession = require('../models/ChatSession');
const { isAnyAgentAvailable } = require('../websocket');

router.post('/start', async (req, res) => {
  const { userName, userEmail } = req.body;

  try {
    const availableStaff = await User.findOne({ role: 'customer-service' });

    if (!availableStaff) {
      return res.status(503).json({ message: 'No customer service agent available at the moment.' });
    }

    const session = new ChatSession({
      userName,
      userEmail,
      customerServiceId: availableStaff._id
    });

    await session.save();
    res.status(201).json({ message: 'Chat started', sessionId: session._id });
  } catch (err) {
    console.error('Error starting chat:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/agent-available', (req, res) => {
  res.json({ online: isAnyAgentAvailable() });
});

module.exports = router;
