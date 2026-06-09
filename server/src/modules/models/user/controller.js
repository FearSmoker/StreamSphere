'use strict';

// User & Auth Controller

const bcrypt = require('bcrypt');

const {
  createUser,
  getUserByEmail,
  getUserById,
  updateUser,
  addToWatchlist,
  removeFromWatchlist,
  upsertGoogleUser,
} = require('./service');

const {
  validateRegister,
  validateLogin,
  validateUpdate,
} = require('./request');

const { verifyToken } = require('../../../middleware/auth');
const { generateTokenPair, verifyRefreshToken } = require('../../auth/tokens');
const { getGoogleAuthUrl, getGoogleProfile } = require('../../auth/google');
const {
  registerLimiter,
  loginLimiter,
  googleAuthLimiter,
  refreshLimiter,
} = require('../../auth/rateLimits');
const logger = require('../../../logger');

const AUTH_URL = '/api/auth';
const USER_URL = '/api/users';

// Response helpers
const safeUser = (user) => {
  const { password, ...rest } = user;
  return rest;
};

// Route setup
const setupRoutes = (app) => {
  logger.info(`[user-controller] Registering routes: ${AUTH_URL}  ${USER_URL}`);

  // POST /api/auth/register
  app.post(`${AUTH_URL}/register`, registerLimiter, async (req, res) => {
    logger.info('[auth] POST /register', req.body?.email);

    const { error } = validateRegister(req.body);
    if (error) {
      return res.status(400).json({ status: 'error', message: error.details[0].message });
    }

    const existing = await getUserByEmail(req.body.email);
    if (existing && !(existing instanceof Error)) {
      return res.status(400).json({ status: 'error', message: 'An account with this email already exists.' });
    }

    const result = await createUser({ ...req.body, authProvider: 'local' });
    if (result instanceof Error) {
      return res.status(400).json({ status: 'error', message: result.message });
    }

    return res.status(201).json({
      status: 'success',
      message: 'Account created. Please sign in.',
      data: { id: result.insertedId },
    });
  });

  // POST /api/auth/login
  app.post(`${AUTH_URL}/login`, loginLimiter, async (req, res) => {
    logger.info('[auth] POST /login', req.body?.email);

    const { error } = validateLogin(req.body);
    if (error) {
      return res.status(400).json({ status: 'error', message: error.details[0].message });
    }

    const user = await getUserByEmail(req.body.email);
    if (!user || user instanceof Error || !user.password) {

      return res.status(401).json({ status: 'error', message: 'User does not exist.' });
    }

    const match = await bcrypt.compare(req.body.password, user.password);
    if (!match) {
      return res.status(401).json({ status: 'error', message: 'Incorrect password.' });
    }

    const { accessToken, refreshToken } = generateTokenPair(user);

    return res.status(200).json({
      status: 'success',
      token: accessToken,
      refreshToken,
      user: safeUser(user),
    });
  });

  // POST /api/auth/refresh
  app.post(`${AUTH_URL}/refresh`, refreshLimiter, async (req, res) => {
    logger.info('[auth] POST /refresh');

    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ status: 'error', message: 'Refresh token is required.' });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      logger.error('[auth] Refresh token invalid:', err.message);
      return res.status(403).json({ status: 'error', message: 'Refresh token is expired or invalid.' });
    }

    const user = await getUserById(decoded.id);
    if (!user || user instanceof Error) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    const { accessToken } = generateTokenPair(user);

    return res.status(200).json({ status: 'success', token: accessToken });
  });

  // GET /api/auth/google
  app.get(`${AUTH_URL}/google`, googleAuthLimiter, (req, res) => {
    logger.info('[auth] GET /google — redirecting to Google consent screen');
    const url = getGoogleAuthUrl();
    return res.redirect(url);
  });

  // GET /api/auth/google/callback
  // Google callback handler
  app.get(`${AUTH_URL}/google/callback`, googleAuthLimiter, async (req, res) => {
    logger.info('[auth] GET /google/callback', { code: req.query.code ? '***' : 'MISSING' });

    const { code } = req.query;
    if (!code) {
      logger.error('[auth] Google callback missing code parameter');
      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`
      );
    }

    let profile;
    try {
      profile = await getGoogleProfile(code);
    } catch (err) {
      logger.error('[auth] Google profile fetch failed:', err.message);
      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`
      );
    }

    const user = await upsertGoogleUser(profile);
    if (!user || user instanceof Error) {
      logger.error('[auth] upsertGoogleUser failed');
      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=account_error`
      );
    }

    const { accessToken, refreshToken } = generateTokenPair(user);

    // Redirect to frontend landing page with tokens
    const redirectUrl = new URL(
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/oauth/callback`
    );
    redirectUrl.searchParams.set('token', accessToken);
    redirectUrl.searchParams.set('refreshToken', refreshToken);

    logger.info(`[auth] Google OAuth success → redirecting user ${user.email}`);
    return res.redirect(redirectUrl.toString());
  });

  // GET /api/users/profile
  app.get(`${USER_URL}/profile`, verifyToken, async (req, res) => {
    logger.info('[user] GET /profile', req.user.id);

    const user = await getUserById(req.user.id);
    if (!user || user instanceof Error) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    return res.status(200).json({ status: 'success', user: safeUser(user) });
  });

  // PUT /api/users/profile
  app.put(`${USER_URL}/profile`, verifyToken, async (req, res) => {
    logger.info('[user] PUT /profile', req.user.id);

    const { error } = validateUpdate(req.body);
    if (error) {
      return res.status(400).json({ status: 'error', message: error.details[0].message });
    }

    const result = await updateUser(req.user.id, req.body);
    if (result instanceof Error) {
      return res.status(400).json({ status: 'error', message: result.message });
    }

    const updated = await getUserById(req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully.',
      user: safeUser(updated),
    });
  });

  // POST /api/users/watchlist
  app.post(`${USER_URL}/watchlist`, verifyToken, async (req, res) => {
    logger.info('[user] POST /watchlist', req.user.id, req.body.videoId);

    if (!req.body.videoId) {
      return res.status(400).json({ status: 'error', message: 'videoId is required.' });
    }

    const result = await addToWatchlist(req.user.id, req.body.videoId);
    if (result instanceof Error) {
      return res.status(400).json({ status: 'error', message: result.message });
    }

    // Save watchlist addition notification in DB
    try {
      const { getById: getVideoById } = require('../video/service');
      const video = await getVideoById(req.body.videoId);
      if (video && !(video instanceof Error)) {
        const { insertNotification } = require('../notification/service');
        await insertNotification({
          userId: req.user.id,
          type: 'watchlist_added',
          title: `"${video.title}" added`,
          description: 'successfully added to your watchlist',
        });
      }
    } catch (err) {
      logger.error('[watchlist-notification-add] Failed to save watchlist notification:', err);
    }

    return res.status(200).json({ status: 'success', message: 'Added to watchlist.' });
  });

  // DELETE /api/users/watchlist/:videoId
  app.delete(`${USER_URL}/watchlist/:videoId`, verifyToken, async (req, res) => {
    logger.info('[user] DELETE /watchlist', req.user.id, req.params.videoId);

    const result = await removeFromWatchlist(req.user.id, req.params.videoId);
    if (result instanceof Error) {
      return res.status(400).json({ status: 'error', message: result.message });
    }

    // Save watchlist removal notification in DB
    try {
      const { getById: getVideoById } = require('../video/service');
      const video = await getVideoById(req.params.videoId);
      if (video && !(video instanceof Error)) {
        const { insertNotification } = require('../notification/service');
        await insertNotification({
          userId: req.user.id,
          type: 'watchlist_removed',
          title: `"${video.title}" removed`,
          description: 'successfully removed from your watchlist',
        });
      }
    } catch (err) {
      logger.error('[watchlist-notification-remove] Failed to save watchlist notification:', err);
    }

    return res.status(200).json({ status: 'success', message: 'Removed from watchlist.' });
  });
};

const setup = (app) => {
  setupRoutes(app);
};

module.exports = { setup };
