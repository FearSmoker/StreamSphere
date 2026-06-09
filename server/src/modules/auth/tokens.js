'use strict';

const jwt = require('jsonwebtoken');

const ACCESS_SECRET  = () => process.env.ACCESS_TOKEN_SECRET  || process.env.JWT_SECRET || 'streamsphere_access_secret';
const REFRESH_SECRET = () => process.env.REFRESH_TOKEN_SECRET || 'streamsphere_refresh_secret';
const ACCESS_EXPIRY  = () => process.env.ACCESS_TOKEN_EXPIRY  || '1d';
const REFRESH_EXPIRY = () => process.env.REFRESH_TOKEN_EXPIRY || '5d';

// Generate token pair
const generateTokenPair = (user) => {
  const payload = { id: user._id.toString(), role: user.role };

  const accessToken = jwt.sign(payload, ACCESS_SECRET(), { expiresIn: ACCESS_EXPIRY() });
  const refreshToken = jwt.sign(
    { id: user._id.toString() },
    REFRESH_SECRET(),
    { expiresIn: REFRESH_EXPIRY() }
  );

  return { accessToken, refreshToken };
};

// Verify access token
const verifyAccessToken = (token) => jwt.verify(token, ACCESS_SECRET());

// Verify refresh token
const verifyRefreshToken = (token) => jwt.verify(token, REFRESH_SECRET());

module.exports = {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
};
