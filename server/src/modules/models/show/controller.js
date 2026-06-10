'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  insert,
  update,
  search,
  getById,
  addEpisode,
} = require('./service');

const { isAdmin } = require('../../../middleware/auth');
const logger = require('../../../logger');

const BASE_URL = `/api/shows`;

// Setup multer upload directory
fs.mkdirSync('uploads/thumbnails', { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/thumbnails');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/webp') {
    cb(null, true);
  } else {
    cb(new multer.MulterError('Thumbnail or Cover file type not supported'), false);
  }
};

const upload = multer({
  fileFilter: fileFilter,
  limits: { fileSize: 5000000 }, // Max 5MB images
  storage: storage,
}).fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]);

const uploadProcessor = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      res.status(400).json({ status: 'error', error: err.message || err });
      return;
    }
    next();
  });
};

const setupRoutes = (app) => {
  logger.info(`Setting up routes for ${BASE_URL}`);

  // GET /api/shows
  app.get(`${BASE_URL}/`, async (req, res) => {
    logger.info('GET Shows list');
    const shows = await search({});
    res.json({
      status: 'success',
      data: shows,
    });
  });

  // GET /api/shows/detail/:id
  app.get(`${BASE_URL}/detail/:id`, async (req, res) => {
    logger.info(`GET Show detail: ${req.params.id}`);
    const show = await getById(req.params.id);
    if (!show) {
      return res.status(404).json({ status: 'error', message: 'TV Show not found.' });
    }
    res.json(show);
  });

  // POST /api/shows/search
  app.post(`${BASE_URL}/search`, async (req, res) => {
    logger.info('POST Shows search', req.body);
    const shows = await search(req.body);
    res.json(shows);
  });

  // POST /api/shows/create (Admin only)
  app.post(`${BASE_URL}/create`, isAdmin, uploadProcessor, async (req, res) => {
    try {
      const showImagesType = req.body.showImagesType || 'upload';
      const thumbnailFile = req.files && req.files['thumbnail'] ? req.files['thumbnail'][0] : null;
      const coverFile = req.files && req.files['cover'] ? req.files['cover'][0] : null;

      if (showImagesType === 'upload' && (!thumbnailFile || !coverFile)) {
        return res.status(400).json({ status: 'error', message: 'Thumbnail and Cover images are required.' });
      }

      const serverUrl = process.env.SERVER_URL || 'http://localhost:4000';
      const thumbnailUrl = showImagesType === 'upload' && thumbnailFile
        ? `${serverUrl}/thumbnails/${thumbnailFile.filename}`
        : `${serverUrl}/thumbnails/default_thumbnail.png`;
      const coverUrl = showImagesType === 'upload' && coverFile
        ? `${serverUrl}/thumbnails/${coverFile.filename}`
        : `${serverUrl}/thumbnails/default_cover.jpg`;

      const showPayload = {
        title: req.body.title,
        description: req.body.description,
        launchYear: parseInt(req.body.launchYear, 10),
        languages: req.body.languages ? JSON.parse(req.body.languages) : ['English'],
        thumbnailUrl,
        coverUrl,
        seasons: [],
      };

      const result = await insert(showPayload);
      if (result instanceof Error) {
        return res.status(400).json({ status: 'error', message: result.message });
      }

      res.status(201).json({
        status: 'success',
        message: 'TV Show created successfully.',
        id: result.insertedId,
      });
    } catch (err) {
      logger.error('Error creating TV Show:', err);
      res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
  });

  // POST /api/shows/update/:id (Admin only)
  app.post(`${BASE_URL}/update/:id`, isAdmin, uploadProcessor, async (req, res) => {
    try {
      const updatePayload = { ...req.body };
      const thumbnailFile = req.files && req.files['thumbnail'] ? req.files['thumbnail'][0] : null;
      const coverFile = req.files && req.files['cover'] ? req.files['cover'][0] : null;
      const serverUrl = process.env.SERVER_URL || 'http://localhost:4000';

      if (thumbnailFile) {
        updatePayload.thumbnailUrl = `${serverUrl}/thumbnails/${thumbnailFile.filename}`;
      }
      if (coverFile) {
        updatePayload.coverUrl = `${serverUrl}/thumbnails/${coverFile.filename}`;
      }
      if (req.body.languages) {
        updatePayload.languages = JSON.parse(req.body.languages);
      }

      const result = await update(req.params.id, updatePayload);
      if (result instanceof Error) {
        return res.status(400).json({ status: 'error', message: result.message });
      }

      res.json({ status: 'success', message: 'TV Show updated successfully.' });
    } catch (err) {
      logger.error('Error updating TV Show:', err);
      res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
  });

  // DELETE /api/shows/delete/:id (Admin only)
  app.delete(`${BASE_URL}/delete/:id`, isAdmin, async (req, res) => {
    try {
      const result = await update(req.params.id, { isDeleted: true });
      if (result instanceof Error) {
        return res.status(400).json({ status: 'error', message: result.message });
      }
      res.json({ status: 'success', message: 'TV Show deleted successfully.' });
    } catch (err) {
      logger.error('Error deleting TV Show:', err);
      res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
  });
};

const setup = (app) => {
  setupRoutes(app);
};

module.exports = { setup };
