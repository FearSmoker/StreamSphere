const { isAdmin } = require('../../../middleware/auth');
const { getSystemAnalytics, getUsersList, updateUserRole } = require('./service');
const logger = require('../../../logger');

const BASE_URL = `/api/admin`;

const setupRoutes = (app) => {
  logger.info(`Setting up admin routes for ${BASE_URL}`);

  // Get system analytics (Admin only)
  app.get(`${BASE_URL}/analytics`, isAdmin, async (req, res) => {
    logger.info('GET /api/admin/analytics');
    try {
      const analytics = await getSystemAnalytics();
      return res.status(200).json({
        status: 'success',
        data: analytics,
      });
    } catch (error) {
      logger.error('Error fetching admin analytics:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error while fetching analytics',
      });
    }
  });

  // Get paginated users (Admin only)
  app.get(`${BASE_URL}/users`, isAdmin, async (req, res) => {
    logger.info('GET /api/admin/users', req.query);
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 10, 10);
      const search = req.query.search || '';
      const sortField = req.query.sortField || 'createdAt';
      const sortOrder = parseInt(req.query.sortOrder || -1, 10);

      const result = await getUsersList({ page, limit, search, sortField, sortOrder });
      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      logger.error('Error fetching user list:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error while fetching users',
      });
    }
  });

  // Update user role (Admin only)
  app.put(`${BASE_URL}/users/:id/role`, isAdmin, async (req, res) => {
    logger.info(`PUT /api/admin/users/${req.params.id}/role`, req.body);
    try {
      const { role } = req.body;
      if (!role || (role !== 'admin' && role !== 'user')) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid role parameter. Must be "admin" or "user".',
        });
      }

      const result = await updateUserRole(req.params.id, role);
      if (result.matchedCount === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found or already deleted.',
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'User role updated successfully.',
      });
    } catch (error) {
      logger.error('Error updating user role:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error while updating role',
      });
    }
  });
};

const setup = (app) => {
  setupRoutes(app);
};

module.exports = { setup };
