// /src/routes/liveChatUser.js

const express = require('express');
const ChatRequest = require('../models/ChatRequest');

const router = express.Router();

// Get all pending chat requests for a specific agent
router.get('/requests', async (req, res) => {
  const { agentId } = req.query;
  if (!agentId) return res.status(400).json({ message: 'agentId required' });

  try {
    const requests = await ChatRequest.find({
      agentId,
      status: 'pending'
    }).select('guestId guestName guestContact');

    // Format for frontend
    const formatted = requests.map(r => ({
      guestId: r.guestId,
      userName: r.guestName,
      contactInfo: r.guestContact,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch requests' });
  }
});

module.exports = router;
