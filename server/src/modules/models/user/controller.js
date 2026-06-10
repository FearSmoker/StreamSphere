'use strict';

// User & Auth Controller

const bcrypt = require('bcrypt');
const { MongoManager } = require('../../db/mongo');
const { ObjectId } = require('mongodb');

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

const recordUserActivity = async (userId) => {
  if (!userId) return;
  try {
    const kolkataDateStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
    const activityCol = MongoManager.Instance.collection('userActivity');
    
    const existing = await activityCol.findOne({
      userId: new ObjectId(userId),
      dateStr: kolkataDateStr,
    });
    
    if (!existing) {
      await activityCol.insertOne({
        userId: new ObjectId(userId),
        dateStr: kolkataDateStr,
        timestamp: new Date(),
      });
      logger.info(`[activity] Recorded unique activity for user ${userId} on date ${kolkataDateStr}`);
    }
  } catch (error) {
    logger.error('[activity] Error recording user activity:', error);
  }
};

// Route setup
const setupRoutes = (app) => {
  logger.info(`[user-controller] Registering routes: ${AUTH_URL}  ${USER_URL}`);

  // POST /api/auth/check-email
  app.post(`${AUTH_URL}/check-email`, async (req, res) => {
    logger.info('[auth] POST /check-email', req.body?.email);
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ status: 'error', message: 'Email is required.' });
    }
    const user = await getUserByEmail(email);
    const exists = !!(user && !(user instanceof Error));
    return res.status(200).json({ status: 'success', exists });
  });

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

    // Record user activity asynchronously
    recordUserActivity(user._id).catch(err => logger.error('[activity] async record error:', err));

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

    // Record user activity asynchronously
    recordUserActivity(user._id).catch(err => logger.error('[activity] async record error:', err));

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

    // Record user activity asynchronously
    recordUserActivity(req.user.id).catch(err => logger.error('[activity] async record error:', err));

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
    const { videoId, showId } = req.body;
    logger.info('[user] POST /watchlist', req.user.id, { videoId, showId });

    const idToAdd = videoId || showId;
    if (!idToAdd) {
      return res.status(400).json({ status: 'error', message: 'videoId or showId is required.' });
    }

    const result = await addToWatchlist(req.user.id, idToAdd);
    if (result instanceof Error) {
      return res.status(400).json({ status: 'error', message: result.message });
    }

    // Save watchlist addition notification in DB
    try {
      const { insertNotification } = require('../notification/service');
      if (videoId) {
        const { getById: getVideoById } = require('../video/service');
        const video = await getVideoById(videoId);
        if (video && !(video instanceof Error)) {
          await insertNotification({
            userId: req.user.id,
            type: 'watchlist_added',
            title: `"${video.title}" added`,
            description: 'successfully added to your watchlist',
          });
        }
      } else if (showId) {
        const { getById: getShowById } = require('../show/service');
        const show = await getShowById(showId);
        if (show && !(show instanceof Error)) {
          await insertNotification({
            userId: req.user.id,
            type: 'watchlist_added',
            title: `"${show.title}" added`,
            description: 'successfully added to your watchlist',
          });
        }
      }
    } catch (err) {
      logger.error('[watchlist-notification-add] Failed to save watchlist notification:', err);
    }

    return res.status(200).json({ status: 'success', message: 'Added to watchlist.' });
  });

  // DELETE /api/users/watchlist/:id
  app.delete(`${USER_URL}/watchlist/:id`, verifyToken, async (req, res) => {
    const { id } = req.params;
    logger.info('[user] DELETE /watchlist', req.user.id, id);

    const result = await removeFromWatchlist(req.user.id, id);
    if (result instanceof Error) {
      return res.status(400).json({ status: 'error', message: result.message });
    }

    // Save watchlist removal notification in DB
    try {
      const { insertNotification } = require('../notification/service');
      const { getById: getVideoById } = require('../video/service');
      const video = await getVideoById(id);
      if (video && !(video instanceof Error)) {
        await insertNotification({
          userId: req.user.id,
          type: 'watchlist_removed',
          title: `"${video.title}" removed`,
          description: 'successfully removed from your watchlist',
        });
      } else {
        const { getById: getShowById } = require('../show/service');
        const show = await getShowById(id);
        if (show && !(show instanceof Error)) {
          await insertNotification({
            userId: req.user.id,
            type: 'watchlist_removed',
            title: `"${show.title}" removed`,
            description: 'successfully removed from your watchlist',
          });
        }
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
