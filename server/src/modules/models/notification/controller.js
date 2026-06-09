'use strict';

const { verifyToken } = require('../../../middleware/auth');
const {
  getNotifications,
  markAllAsRead,
  clearAllNotifications,
} = require('./service');
const logger = require('../../../logger');

const BASE_URL = '/api/notifications';

const setupRoutes = (app) => {
  logger.info(`Setting up routes for ${BASE_URL}`);

  app.get(`${BASE_URL}`, verifyToken, async (req, res) => {
    logger.info('GET /api/notifications', req.user.id);
    const result = await getNotifications({ userId: req.user.id, role: req.user.role });
    if (result instanceof Error) {
      return res.status(500).json({ status: 'error', message: result.message });
    }
    return res.status(200).json(result);
  });

  app.put(`${BASE_URL}/mark-read`, verifyToken, async (req, res) => {
    logger.info('PUT /api/notifications/mark-read', req.user.id);
    const result = await markAllAsRead({ userId: req.user.id, role: req.user.role });
    if (result instanceof Error) {
      return res.status(500).json({ status: 'error', message: result.message });
    }
    return res.status(200).json({ status: 'success', message: 'All notifications marked as read.' });
  });

  app.delete(`${BASE_URL}/clear`, verifyToken, async (req, res) => {
    logger.info('DELETE /api/notifications/clear', req.user.id);
    const result = await clearAllNotifications({ userId: req.user.id, role: req.user.role });
    if (result instanceof Error) {
      return res.status(500).json({ status: 'error', message: result.message });
    }
    return res.status(200).json({ status: 'success', message: 'Notifications cleared.' });
  });
};

const setup = (app) => {
  setupRoutes(app);
};

module.exports = { setup };
