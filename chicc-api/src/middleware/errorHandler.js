// /src/middleware/errorHandler.js

const logger = require('../config/logger');

module.exports = function errorHandler(err, req, res, next) {
logger.error(err.message, { stack: err.stack });
res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
};