// /src/config/db.js

const mongoose = require('mongoose');
const logger = require('./logger');

const connectDB = async (mongoUri) => {
try {
await mongoose.connect(mongoUri, {
useNewUrlParser: true,
useUnifiedTopology: true,
maxPoolSize: 10,
});
logger.info('Connected to MongoDB');
} catch (err) {
logger.error('MongoDB connection error:', err);
process.exit(1);
}
};

module.exports = connectDB;