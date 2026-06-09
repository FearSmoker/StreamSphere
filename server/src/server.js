// StreamSphere API Server

'use strict';

require('dotenv').config();

// Increase EventEmitter max listeners
require('events').EventEmitter.defaultMaxListeners = 30;

// Silence eviction policy warnings for hosted Redis
const _EVICTION_SUBSTR = 'Eviction policy is';
const _origConsoleWarn = console.warn.bind(console);
console.warn = (...args) => {
  if (args.length > 0 && typeof args[0] === 'string' && args[0].includes(_EVICTION_SUBSTR)) return;
  _origConsoleWarn(...args);
};
const _origStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = (chunk, ...args) => {
  if (typeof chunk === 'string' && chunk.includes(_EVICTION_SUBSTR)) return true;
  return _origStderrWrite(chunk, ...args);
};
const _origStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, ...args) => {
  if (typeof chunk === 'string' && chunk.includes(_EVICTION_SUBSTR)) return true;
  return _origStdoutWrite(chunk, ...args);
};

const http = require('http');
const { Server } = require('socket.io');

const app    = require('./app');
const logger = require('./logger');
const { MongoManager } = require('./modules/db/mongo');
const { getClient: getCacheClient } = require('./modules/cache/redis');
const { NOTIFY_EVENTS } = require('./modules/queues/constants');
const eventEmitter = require('./event-manager').getInstance();

const PORT = process.env.PORT || 4000;

// HTTP and Socket.io setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  logger.info(`[socket.io] Client connected: ${socket.id}`);

  // Watch Party video rooms
  socket.on('join:video-room', ({ videoId } = {}) => {
    if (!videoId) return;

    // Leave previous video room
    if (socket._currentVideoRoom && socket._currentVideoRoom !== videoId) {
      socket.leave(socket._currentVideoRoom);
      const prevRoom = io.sockets.adapter.rooms.get(socket._currentVideoRoom);
      const prevCount = prevRoom ? prevRoom.size : 0;
      io.to(socket._currentVideoRoom).emit('room:count', { videoId: socket._currentVideoRoom, count: prevCount });
      logger.info(`[socket.io] ${socket.id} left video-room:${socket._currentVideoRoom} (now ${prevCount} viewers)`);
    }

    socket.join(videoId);
    socket._currentVideoRoom = videoId;
    const room = io.sockets.adapter.rooms.get(videoId);
    const count = room ? room.size : 1;
    io.to(videoId).emit('room:count', { videoId, count });
    logger.info(`[socket.io] ${socket.id} joined video-room:${videoId} (${count} viewers)`);
  });

  socket.on('leave:video-room', ({ videoId } = {}) => {
    if (!videoId) return;
    socket.leave(videoId);
    socket._currentVideoRoom = null;
    const room = io.sockets.adapter.rooms.get(videoId);
    const count = room ? room.size : 0;
    io.to(videoId).emit('room:count', { videoId, count });
    logger.info(`[socket.io] ${socket.id} left video-room:${videoId} (${count} viewers)`);
  });

  socket.on('disconnect', () => {
    logger.info(`[socket.io] Client disconnected: ${socket.id}`);
    // Update viewer count for video room
    if (socket._currentVideoRoom) {
      const videoId = socket._currentVideoRoom;
      const room = io.sockets.adapter.rooms.get(videoId);
      const count = room ? room.size : 0;
      io.to(videoId).emit('room:count', { videoId, count });
      logger.info(`[socket.io] Disconnect: video-room:${videoId} now has ${count} viewers`);
    }
  });
});

// Forward socket:emit events to clients
eventEmitter.on('socket:emit', async ({ event, data }) => {
  logger.info(`[socket.io] Broadcasting "${event}"`, { id: data?.id });
  io.emit(event, data);

  // Auto-persist admin video processing notifications in db
  if (['video:uploaded', 'video:processing', 'video:ready', 'video:failed'].includes(event)) {
    try {
      const { insertNotification } = require('./modules/models/notification/service');
      let type, title, description;
      if (event === 'video:uploaded') {
        type = 'video_uploaded';
        title = `"${data.title || 'Video'}" uploaded`;
        description = 'Processing will begin shortly…';
      } else if (event === 'video:processing') {
        type = 'video_processing';
        title = `"${data.title || 'Video'}" is transcoding`;
        description = 'Converting to HLS format…';
      } else if (event === 'video:ready') {
        type = 'video_ready';
        title = `"${data.title || 'Video'}" is ready!`;
        description = 'Your video is now live and streamable';
      } else if (event === 'video:failed') {
        type = 'video_failed';
        title = `Processing failed`;
        description = data.error || `"${data.title || 'Video'}" could not be processed`;
      }
      await insertNotification({
        userId: null,
        type,
        title,
        description,
      });
    } catch (err) {
      logger.error('[socket-notification-save] Failed to save admin notification:', err);
    }
  }
});

// Redis Pub/Sub bridge
const { subscribeToEvents } = require('./modules/cache/pubsub');
subscribeToEvents((event, data) => {
  logger.info(`[socket.io-pubsub] Broadcasting "${event}" from Redis PubSub`, { id: data?.id });
  io.emit(event, data);
});

// Legacy HLS converted event bridge
eventEmitter.on(NOTIFY_EVENTS.NOTIFY_VIDEO_HLS_CONVERTED, (data) => {
  logger.info('[socket.io] Legacy NOTIFY_VIDEO_HLS_CONVERTED → video:ready');
  io.emit('video:ready', data);
});

// Application setup
const setup = async () => {
  // Register controllers
  const { setup: setupVideoModule } = require('./modules/models/video/controller');
  setupVideoModule(app);

  const { setup: setupRoleModule } = require('./modules/models/role/controller');
  setupRoleModule(app);

  const { setup: setupUserModule } = require('./modules/models/user/controller');
  setupUserModule(app);

  const { setup: setupWatchHistoryModule } = require('./modules/models/watchHistory/controller');
  setupWatchHistoryModule(app);

  const { setup: setupAdminModule } = require('./modules/models/admin/controller');
  setupAdminModule(app);

  const { setup: setupNotificationModule } = require('./modules/models/notification/controller');
  setupNotificationModule(app);
};

// Server Boot
server.listen(PORT, async () => {
  logger.info(`[server] Listening on port ${PORT}`);
  await MongoManager.connect();

  // Connect to Redis
  await getCacheClient();

  await setup();
  logger.info('[server] Application setup completed');

  // Start background queue worker in the same process for single-instance environments
  try {
    const { setupAllQueueEvents } = require('./modules/queues/worker');
    const workerStatus = setupAllQueueEvents();
    logger.info(`[server] Background queue worker initialized: ${workerStatus}`);
  } catch (workerErr) {
    logger.error('[server] Failed to start background queue worker:', workerErr);
  }

  // Catch-all fallback route
  app.use('/', (req, res) => {
    res.send(`StreamSphere API — ${new Date().toISOString()}`);
  });

  logger.info('[server] StreamSphere API server ready', new Date().toTimeString());
});

