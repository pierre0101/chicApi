// /server.js
require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const path = require('path');
const createError = require('http-errors');

const logger = require('./src/config/logger');
const connectDB = require('./src/config/db');
const errorHandler = require('./src/middleware/errorHandler');

// ─── Express routes ──────────────────────────────────────────────────────────
const authRoutes = require('./src/routes/auth');
const productRoutes = require('./src/routes/products');
const wishlistRoutes = require('./src/routes/wishlist');
const usersRouter = require('./src/routes/users');
const adminRoutes = require('./src/routes/admin');
const salesRouter = require('./src/routes/sales');
const supportRouter = require('./src/routes/support');
const liveChatUserRouter = require('./src/routes/liveChatUser');
const resetPasswordRouter = require('./src/routes/resetPassword');
const updatePasswordRouter = require('./src/routes/updatePassword');
const chatbotRouter = require('./src/routes/chatbot');

// WebSocket
const { setupWebSocket } = require('./src/websocket');

const app = express();
const server = http.createServer(app);

// Attach WebSocket server
setupWebSocket(server);

// ─── MongoDB ─────────────────────────────────────────────────────────────────
connectDB(process.env.MONGODB_URI);

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const allowedOrigins = [
  'http://localhost:3000',
  'http://192.168.16.110:3000',
  'https://chic-lhtw.onrender.com',
  'https://chic-wheat.vercel.app',
  'http://192.168.1.42:3000'
];

// Accept a whole 192.168.16.* subnet during development
const lanRegex = /^http:\/\/192\.168\.16\.\d+:3000$/;

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);               // non-browser tools
      if (allowedOrigins.includes(origin) || lanRegex.test(origin)) {
        return cb(null, true);
      }
      logger.error(`CORS blocked: ${origin}`);
      cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,                                  // enable cookies / auth
  })
);

// ─── Static images ───────────────────────────────────────────────────────────
app.use(
  '/images',
  express.static(path.join(__dirname, 'public'), {
    maxAge: '30d',
    setHeaders(res) {
      // Allow any site to embed product images (optional: tighten if needed)
      res.setHeader('Access-Control-Allow-Origin', '*');
    },
  })
);

// ─── API routes ──────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/sales', salesRouter);
app.use('/api/v1/support', supportRouter);
app.use('/api/livechat', liveChatUserRouter);
app.use('/api/reset-password', resetPasswordRouter);
app.use('/api/update-password', updatePasswordRouter);
app.use('/api/chatbot', chatbotRouter);

// ─── Error handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(
    `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
  );
});
