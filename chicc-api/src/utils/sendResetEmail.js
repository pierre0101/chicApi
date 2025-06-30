const nodemailer = require('nodemailer');

async function sendResetEmail(toEmail, token) {
    const resetLink = `https://your-frontend-domain.com/reset-password?token=${token}`;

    // Configure transporter
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    // Email options
    const mailOptions = {
        from: `"CHIC Support" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: 'Password Reset Request',
        html: `
      <p>Hello,</p>
      <p>You requested to reset your password. Click the link below to reset it:</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>If you did not request this, please ignore this email.</p>
      <p>Thanks,<br/>CHIC Security Team</p>
    `,
    };

    // Send email
    await transporter.sendMail(mailOptions);
}

module.exports = sendResetEmail;
