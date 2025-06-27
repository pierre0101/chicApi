// /src/models/ChatRequest.js

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ChatRequestSchema = new mongoose.Schema({
  requestId: { type: String, unique: true, default: uuidv4 },
  guestName: { type: String, required: true },
  guestContact: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'closed'], default: 'pending' },
  agentId: { type: String }, // set when accepted
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChatRequest', ChatRequestSchema);
