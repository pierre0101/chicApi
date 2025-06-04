// /models/ChatSession.js
const mongoose = require('mongoose');

const ChatSessionSchema = new mongoose.Schema({
  userName: String, // could be null if anonymous
  userEmail: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // optional
  customerServiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['active', 'ended'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('ChatSession', ChatSessionSchema);
