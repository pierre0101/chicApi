const express = require('express');
const router = express.Router();
const ChatRequest = require('../models/ChatRequest');
const User = require('../models/User');
const { clients } = require('../websocket');

router.post('/request-chat', async (req, res, next) => {
  try {
    const { guestId, guestName, guestContact } = req.body;
    if (!guestId || !guestName || !guestContact) {
      return res.status(400).json({ message: 'Missing guest information' });
    }

    const agent = await User.findOne({ role: 'customer-service', status: 'online' });
    if (!agent) {
      return res.status(503).json({ message: 'No agents available' });
    }

    const chatReq = await ChatRequest.create({
      guestId,
      guestName,
      guestContact,
      agentId: agent._id,
      status: 'pending',
    });

    if (clients && clients.get) {
      const agentSock = clients.get(agent._id.toString());
      if (agentSock && agentSock.readyState === 1) {
        agentSock.send(JSON.stringify({ type: 'chatRequest', request: chatReq }));
      }
    }

    res.status(201).json({ requestId: chatReq._id, agentId: agent._id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
