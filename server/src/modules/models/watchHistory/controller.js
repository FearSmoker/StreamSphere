const { saveProgress, getWatchHistory } = require('./service');
const { verifyToken } = require('../../../middleware/auth');
const logger = require('../../../logger');

const BASE_URL = `/api/watch-history`;

const setupRoutes = (app) => {
  logger.info(`Setting up watch history routes for ${BASE_URL}`);

  // Update watch history progress
  app.post(`${BASE_URL}/update`, verifyToken, async (req, res) => {
    logger.info('POST /api/watch-history/update', req.user.id, req.body);
    const { videoId, progressSeconds, durationSeconds } = req.body;

    if (!videoId) {
      return res.status(400).json({ status: 'error', message: 'Video ID is required' });
    }

    const result = await saveProgress(
      req.user.id,
      videoId,
      progressSeconds,
      durationSeconds
    );

    if (result instanceof Error) {
      return res.status(500).json({ status: 'error', message: result.message });
    }

    return res.status(200).json({ status: 'success', message: 'Progress updated successfully' });
  });

  // Get active (incomplete) watch history to "Continue Watching"
  app.get(`${BASE_URL}/continue`, verifyToken, async (req, res) => {
    logger.info('GET /api/watch-history/continue', req.user.id);
    const result = await getWatchHistory(req.user.id, false); // completed: false

    if (result instanceof Error) {
      return res.status(500).json({ status: 'error', message: result.message });
    }

    return res.status(200).json({ status: 'success', data: result });
  });
};

const setup = (app) => {
  setupRoutes(app);
};

module.exports = { setup };
