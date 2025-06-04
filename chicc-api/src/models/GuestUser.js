// models/GuestUser.js
const mongoose = require('mongoose');

const guestUserSchema = new mongoose.Schema({
  fullName: String,
  contactInfo: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('GuestUser', guestUserSchema);
