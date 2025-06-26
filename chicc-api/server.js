// server.js
require('dotenv').config();

const express      = require('express');
const http         = require('http');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const helmet       = require('helmet');
const path         = require('path');
const createError  = require('http-errors');

const logger       = require('./src/config/logger');
const connectDB    = require('./src/config/db');
const errorHandler = require('./src/middleware/errorHandler');

/* ─────────── helper: always hand Express a function ─────────── */
function asRouter(mod, label) {
  if (typeof mod === 'function') return mod;                   // Router()
  if (mod && typeof mod.router === 'function') return mod.router;

  logger.warn(`${label} is not a router – substituted empty middleware`);
  return (req, res, next) => next();
}

/* ─────────── route imports (all via helper) ─────────── */
const authRoutes         = asRouter(require('./src/routes/auth'),         'authRoutes');
const productRoutes      = asRouter(require('./src/routes/products'),     'productRoutes');
const wishlistRoutes     = asRouter(require('./src/routes/wishlist'),     'wishlistRoutes');
const usersRouter        = asRouter(require('./src/routes/users'),        'usersRouter');
const adminRoutes        = asRouter(require('./src/routes/admin'),        'adminRoutes');
const salesRouter        = asRouter(require('./src/routes/sales'),        'salesRouter');
const supportRouter      = asRouter(require('./src/routes/support'),      'supportRouter');
const liveChatUserRouter = asRouter(require('./src/routes/liveChatUser'), 'liveChatUserRouter');

/* ─────────── WebSocket attach ─────────── */
const { setupWebSocket } = require('./src/websocket');

const app    = express();
const server = http.createServer(app);
setupWebSocket(server);

/* ─────────── DB connect ─────────── */
connectDB(process.env.MONGODB_URI);

/* ─────────── security & parsers ─────── */
// Disable Helmet’s default CORP so we can override
app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ─────────── CORS ─────────── */
const allowedOrigins = [
  'https://chicapi.onrender.com',
  'http://localhost:3000',
  'http://192.168.93.19:3000'
];
const subnetRegex    = /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        subnetRegex.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
  })
);

/* ─────────── static images ─────────── */
// Serve everything in /public/images under /api/v1/products/images
// with CORS and Cross-Origin-Resource-Policy headers
app.use(
  '/api/v1/products/images',
  // 1) Allow cross-site XHR/fetch
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  // 2) Permit browsers to embed the resource cross-origin
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  // 3) Serve the static file
  express.static(path.join(__dirname, 'public', 'images'))
);

/* ─────────── routes & error handling ─────────── */
app.use('/api/v1/auth',         authRoutes);
app.use('/api/v1/products',     productRoutes);
app.use('/api/v1/wishlist',     wishlistRoutes);
app.use('/api/v1/users',        usersRouter);
app.use('/api/v1/admin',        adminRoutes);
app.use('/api/v1/sales',        salesRouter);
app.use('/api/v1/support',      supportRouter);
app.use('/api/v1/liveChatUser', liveChatUserRouter);

// single-page app fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// final error handler
app.use(errorHandler);

/* ─────────── listen ─────────── */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(
    `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
  );
});
