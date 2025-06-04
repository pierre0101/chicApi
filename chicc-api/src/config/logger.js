// /src/config/logger.js

const { createLogger, format, transports } = require('winston');

const logger = createLogger({
level: 'info',
format: format.combine(
format.timestamp(),
format.errors({ stack: true }),
format.json()
),
transports: [
new transports.Console(),
],
});

module.exports = logger;