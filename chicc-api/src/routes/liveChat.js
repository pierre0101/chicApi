const express = require('express');
const ChatRequest = require('../models/ChatRequest');
const router = express.Router();

// Create new chat request
router.post('/start', async (req, res) => {
  const { guestName, guestContact } = req.body;
  const chatReq = new ChatRequest({ guestName, guestContact });
  await chatReq.save();
  res.json({ requestId: chatReq.requestId, guestName, guestContact });
});

// Get all pending requests
router.get('/requests', async (req, res) => {
  const requests = await ChatRequest.find({ status: 'pending' });
  res.json(requests);
});

// Accept a request (agent joining)
router.post('/accept/:requestId', async (req, res) => {
  const { requestId } = req.params;
  const { agentId } = req.body;
  const chatReq = await ChatRequest.findOneAndUpdate(
    { requestId, status: 'pending' },
    { status: 'accepted', agentId },
    { new: true }
  );
  if (!chatReq) return res.status(404).json({ message: 'Request not found or already accepted.' });
  res.json(chatReq);
});

module.exports = router;
