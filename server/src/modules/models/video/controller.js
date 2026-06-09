const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const path = require('path');

const {
  insert,
  search,
  update,
  updateViewCount,
  deleteById,
  count,
  getById,
  getStatusById,
  getRecommendations,
  autocomplete,
} = require('./service');
const { validate } = require('./request');
const jwt = require('jsonwebtoken');
const { VIDEO_QUEUE_EVENTS: QUEUE_EVENTS } = require('../../queues/constants');
const { VIDEO_STATUS } = require('../../db/constant');
const { addQueueItem } = require('../../queues/queue');
const { getVideoDurationAndResolution } = require('../../queues/video-processor');
const { isAdmin } = require('../../../middleware/auth');
const logger = require('../../../logger');
const eventEmitter = require('../../../event-manager').getInstance();
const { cacheDelPattern, cacheDel, FEED_KEY } = require('../../cache/helpers');

const BASE_URL = `/api/videos`;

const setupRoutes = (app) => {
  logger.info(`Setting up routes for ${BASE_URL}`);

  // return empty response with success message for the base route
  app.get(`${BASE_URL}/`, async (req, res) => {
    logger.info(`GET`, req.params);
    const data = await search({});
    res.send({
      status: 'success',
      message: 'OK',
      timestamp: new Date(),
      data,
    });
  });

  app.get(`${BASE_URL}/detail/:id`, async (req, res) => {
    logger.info(`GET`, req.params);
    const video = await updateViewCount(req.params.id);
    if (video instanceof Error) {
      return res.status(400).json(JSON.parse(video.message));
    }
    res.send(video);
  });

  // TODO: Proper searching with paging and ordering
  app.post(`${BASE_URL}/search`, async (req, res) => {
    logger.info('POST search', req.body);
    const result = await search(req.body);
    res.send(result);
  });

  app.post(`${BASE_URL}/count`, async (req, res) => {
    logger.info('POST count', req.body);
    const result = await count(req.body);
    res.send({ count: result });
  });

  // Phase 7: Recommendations endpoint
  // Takes optional `category` (query param) and optional `userId` (from JWT)
  app.get(`${BASE_URL}/recommendations`, async (req, res) => {
    logger.info('GET recommendations', req.query);
    const category = req.query.category || null;
    let userId = null;

    // Gracefully attempt to decode the token if present
    const authHeader = req.headers.authorization || req.headers.token;
    if (authHeader) {
      const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.id) {
          userId = decoded.id;
        }
      } catch (err) {
        logger.warn('Failed to decode token for recommendations', err);
      }
    }

    const videos = await getRecommendations({ userId, category, limit: 10 });
    res.send(videos);
  });

  // Autocomplete — GET /api/videos/autocomplete?q=<query>
  // Returns up to 8 matching video title+category suggestions, Redis-cached 60s.
  app.get(`${BASE_URL}/autocomplete`, async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    logger.info('GET autocomplete', q);
    const results = await autocomplete(q);
    return res.json(results);
  });

  // Processing status polling endpoint — used by the frontend
  // Uses getStatusById which has a 5-second Redis TTL to avoid hammering MongoDB
  // during active transcoding polls.
  app.get(`${BASE_URL}/status/:id`, async (req, res) => {
    logger.info('GET status', req.params.id);
    const video = await getStatusById(req.params.id);
    if (!video || video instanceof Error) {
      return res.status(404).json({ status: 'error', message: 'Video not found' });
    }
    return res.json({
      id:              video._id,
      status:          video.status,
      hlsPath:         video.hlsPath        || null,
      thumbnailUrl:    video.thumbnailUrl   || null,
      duration:        video.duration       || null,
      resolution:      video.resolution     || null,
      qualities:       video.qualities      || null,
      processingError: video.processingError || null,
    });
  });

  // app.post(`${BASE_URL}/create`, async (req, res) => {
  //   console.log('POST create', req.body);
  //   const validationResult = validate(req.body);
  //   if (!validationResult.error) {
  //     const result = await insert(req.body);
  //     if (result instanceof Error) {
  //       res.status(400).json(JSON.parse(result.message));
  //       return;
  //     }
  //     return res.json(result);
  //   }
  //   return res
  //     .status(400)
  //     .json({ status: 'error', message: validationResult.error });
  // });

  // Admin: flush video cache
  app.post(`${BASE_URL}/cache/flush`, isAdmin, async (req, res) => {
    logger.info('[cache-flush] Admin triggered full video cache flush');
    await Promise.all([
      cacheDel(FEED_KEY),
      cacheDelPattern('video:search:*'),
      cacheDelPattern('video:detail:*'),
      cacheDelPattern('video:status:*'),
      cacheDelPattern('video:count:*'),
    ]);
    return res.json({ status: 'success', message: 'Video cache flushed successfully' });
  });

  app.put(`${BASE_URL}/update/:id`, isAdmin, async (req, res) => {
    const validationResult = validate(req.body);
    if (req.params.id && !validationResult.error) {
      const result = await update({
        _id: req.params.id,
        ...validationResult.value,
      });
      if (result instanceof Error) {
        return res.status(400).json(JSON.parse(result.message));
      }
      return res.json(result);
    }
    return res
      .status(400)
      .json({ status: 'error', message: validationResult.error });
  });

  app.delete(`${BASE_URL}/delete/:id`, isAdmin, async (req, res) => {
    logger.info('DELETE', req.params.id);
    if (req.params.id) {
      const result = await deleteById(req.params.id);
      if (result instanceof Error) {
        res.status(400).json(JSON.parse(result.message));
        return;
      }
      return res.json(result);
    }
    return res.status(400).json({ status: 'error', message: 'Id required' });
  });

  // upload videos handler using multer package routes below.
  const fs = require('fs');
  fs.mkdirSync('uploads/videos', { recursive: true });
  fs.mkdirSync('uploads/thumbnails', { recursive: true });

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      if (file.fieldname === 'thumbnail') {
        cb(null, 'uploads/thumbnails');
      } else {
        cb(null, 'uploads/videos');
      }
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
    },
  });

  const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'thumbnail') {
      if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/webp') {
        cb(null, true);
      } else {
        cb(new multer.MulterError('Thumbnail file type not supported'), false);
      }
    } else if (file.mimetype === 'video/mp4' || file.mimetype === 'video/webm') {
      logger.info('file type supported', file);
      cb(null, true);
    } else {
      logger.info('file type not supported', file);
      cb(new multer.MulterError('File type not supported'), false);
    }
  };

  const upload = multer({
    fileFilter: fileFilter,
    limits: { fileSize: 500000000 },
    storage: storage,
  }).fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]);

  const uploadProcessor = (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        res.status(400).json({ status: 'error', error: err });
        return;
      } else {
        logger.info('upload success', req.files);
        next();
      }
    });
  };

  // Only admins can upload videos. Cache invalidation is handled inside service.insert().
  app.post(`${BASE_URL}/upload`, isAdmin, uploadProcessor, async (req, res) => {
    try {
      const isLocalUpload = true;
      const videoFile = req.files && req.files['video'] ? req.files['video'][0] : null;
      const thumbnailFile = req.files && req.files['thumbnail'] ? req.files['thumbnail'][0] : null;

      if (!videoFile) {
        return res.status(400).json({ status: 'error', message: 'Video file is required' });
      }

      const localFilePath = videoFile.path;
      const parsedFile = path.parse(videoFile.filename || videoFile.originalname);
      const videoLink = localFilePath;

      const dbPayload = {
        ...req.body,
        fileName: parsedFile.name,
        originalName: videoFile.originalname,
        recordingDate: req.body.recordingDate ? new Date(req.body.recordingDate) : new Date(),
        videoLink,
        viewCount: 0,
        duration: 0,
        status: isLocalUpload ? VIDEO_STATUS.PENDING : VIDEO_STATUS.PUBLISHED,
      };

      if (thumbnailFile) {
        const serverUrl = process.env.SERVER_URL || 'http://localhost:4000';
        dbPayload.thumbnailPath = thumbnailFile.path;
        dbPayload.thumbnailUrl = `${serverUrl}/thumbnails/${thumbnailFile.filename}`;
      }

      logger.info('dbPayload', { dbPayload });
      const result = await insert(dbPayload);
      logger.info('result', result);
      const videoId = result.insertedId.toString();

      if (isLocalUpload) {
        const queuePayload = {
          id:           videoId,
          title:        req.body.title,
          originalName: videoFile.originalname,
          filename:     parsedFile.name,
          path:         localFilePath,
        };

        if (thumbnailFile) {
          queuePayload.thumbnailPath = thumbnailFile.path;
        }

        eventEmitter.emit('socket:emit', {
          event: 'video:uploaded',
          data:  { id: videoId, title: req.body.title },
        });

        await addQueueItem(QUEUE_EVENTS.VIDEO_UPLOADED, queuePayload);
      }

      res.status(200).json({
        status:  'success',
        message: isLocalUpload ? 'Upload success. Processing started.' : 'Upload success.',
        id:      videoId,
        ...videoFile,
        ...result,
      });
      return;
    } catch (error) {
      logger.error(error);
      res.status(500).send(error);
    }
  });
};

const setup = (app) => {
  setupRoutes(app);
};

module.exports = { setup };
