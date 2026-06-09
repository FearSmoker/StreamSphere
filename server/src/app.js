require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const logger = require('./logger');
const { globalApiLimiter } = require('./modules/auth/rateLimits');

// Core middleware
app.use(express.json());
app.use(compression());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// Global rate limiter
app.use(globalApiLimiter);

// HTTP request logger
const morganMiddleware = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  }
);
app.use(morganMiddleware);

// Static assets
// Serve thumbnails
app.use('/thumbnails', express.static('./uploads/thumbnails'));

module.exports = app;
