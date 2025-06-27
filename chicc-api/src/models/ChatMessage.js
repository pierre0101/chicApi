// /src/models/ChatMessage.js

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    chatSessionId: { type: String }, // Optional: if you plan to group messages
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
