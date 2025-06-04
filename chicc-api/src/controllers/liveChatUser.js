// File: src/controllers/liveChatUser.js

const GuestUser = require('../models/GuestUser');

exports.createGuest = async (req, res) => {
  try {
    const { fullName, contactInfo } = req.body;

    // Validate inputs
    if (
      !fullName ||
      typeof fullName !== 'string' ||
      !contactInfo ||
      typeof contactInfo !== 'string'
    ) {
      return res
        .status(400)
        .json({ message: 'fullName and contactInfo are required as strings' });
    }

    // Create guest user record
    const guest = await GuestUser.create({ fullName, contactInfo });

    // Respond with the new guest's ID and name
    return res
      .status(201)
      .json({ guestId: guest._id, fullName: guest.fullName });
  } catch (err) {
    console.error('Error creating guest user:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
