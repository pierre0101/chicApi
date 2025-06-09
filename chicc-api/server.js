// /server.js

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const path = require('path');

const logger = require('./src/config/logger');
const connectDB = require('./src/config/db');
const errorHandler = require('./src/middleware/errorHandler');

// Express routes
const authRoutes         = require('./src/routes/auth');
const productRoutes      = require('./src/routes/products');
const wishlistRoutes     = require('./src/routes/wishlist');
const usersRouter        = require('./src/routes/users');
const adminRoutes        = require('./src/routes/admin');
const salesRouter        = require('./src/routes/sales');
const supportRouter      = require('./src/routes/support');
const liveChatUserRouter = require('./src/routes/liveChatUser');

// WebSocket setup
const { setupWebSocket } = require('./src/websocket');

const app = express();
const server = http.createServer(app);

// Attach WebSocket server
setupWebSocket(server);

// Connect to MongoDB
connectDB(process.env.MONGODB_URI);

// Security and parsing middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS configuration
const allowedOrigins = ['https://chic-lhtw.onrender.com'];
// const subnetRegex = /^http?:\/\/192\.168\.212\.\d{1,3}(:\d+)?$/;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || subnetRegex.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
}));

// Serve static files (e.g., images)
app.use('/images', express.static(path.join(__dirname, 'public'), { maxAge: '30d' }));

// API routes
app.use('/api/v1/auth',     authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/admin',    adminRoutes);
app.use('/api/v1/users',    usersRouter);
app.use('/api/v1/sales',    salesRouter);
app.use('/api/v1/support',  supportRouter);
app.use('/api/livechat',    liveChatUserRouter);

// Error handling middleware
app.use(errorHandler);

// Start HTTP server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
