// /routes/resetPassword.js

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sendResetEmail = require('../utils/sendResetEmail.js');

const JWT_SECRET = process.env.JWT_SECRET;

function generateResetToken(user) {
    return jwt.sign(
        { username: user.username },
        JWT_SECRET,
        { expiresIn: '15m' }
    );
}

router.post('/', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    try {
        const user = await User.findOne({ email });

        if (user) {
            const token = generateResetToken(user);
            await sendResetEmail(user.email, token);
        }

        return res.json({
            message:
                'If an account with that email exists, a reset link has been sent.'
        });
    } catch (err) {
        console.error('[ERROR] Reset password error:', err);
        return res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = router;
