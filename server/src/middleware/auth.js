'use strict';

const { verifyAccessToken } = require('../modules/auth/tokens');
const logger = require('../logger');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.token;
  if (!authHeader) {
    return res.status(401).json({ status: 'error', message: 'Authentication required.' });
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : authHeader;

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    logger.error('[auth-middleware] JWT verification failed:', err.message);
    return res.status(403).json({ status: 'error', message: 'Token is expired or invalid.' });
  }
};

const isAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user && req.user.role === 'admin') {
      return next();
    }
    return res.status(403).json({ status: 'error', message: 'Access denied. Admin role required.' });
  });
};

module.exports = { verifyToken, isAdmin };
