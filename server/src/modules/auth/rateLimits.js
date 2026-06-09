'use strict';

// StreamSphere Rate Limiters

const rateLimit = require('express-rate-limit');

// Helper to build a standard limiter
const makeLimit = (windowMinutes, max, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message },
  });

// Registration rate limiter
const registerLimiter = makeLimit(
  15,
  5,
  'Too many registration attempts from this IP. Please try again in 15 minutes.'
);

// Login rate limiter
const loginLimiter = makeLimit(
  15,
  10,
  'Too many login attempts from this IP. Please try again in 15 minutes.'
);

// Google OAuth rate limiter
const googleAuthLimiter = makeLimit(
  60,
  20,
  'Too many Google sign-in requests. Please wait an hour and try again.'
);

// Token refresh rate limiter
const refreshLimiter = makeLimit(
  60,
  30,
  'Too many token refresh requests. Please wait before trying again.'
);

// Global API rate limiter
const globalApiLimiter = makeLimit(
  1,
  200,
  'Too many requests from this IP. Please slow down.'
);

module.exports = {
  registerLimiter,
  loginLimiter,
  googleAuthLimiter,
  refreshLimiter,
  globalApiLimiter,
};
