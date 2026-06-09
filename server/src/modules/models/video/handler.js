// Video Model Event Handler

'use strict';

const path = require('path');
const { VIDEO_QUEUE_EVENTS } = require('../../queues/constants');
const {
  updateHistory,
  update,
  setProcessing,
  setReady,
  setFailed,
} = require('./service');
const { VIDEO_STATUS } = require('../../db/constant');
const eventEmitter = require('../../../event-manager').getInstance();
const logger = require('../../../logger');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';

const setup = () => {
  Object.values(VIDEO_QUEUE_EVENTS).forEach((eventName) => {
    eventEmitter.on(eventName, async (data) => {
      if (!data || !data.id) return;
      logger.info(`[video-handler] ${eventName} → id=${data.id}`);

      try {
        switch (eventName) {
          // Stage: uploaded
          case VIDEO_QUEUE_EVENTS.VIDEO_UPLOADED:
            await updateHistory(data.id, {
              history: { status: 'uploaded', createdAt: new Date() },
            });
            break;

          // Stage: processing
          case VIDEO_QUEUE_EVENTS.VIDEO_PROCESSING:
            await setProcessing(data.id);
            await updateHistory(data.id, {
              history: { status: 'processing', createdAt: new Date() },
            });
            break;

          // Stage: processed (legacy)
          case VIDEO_QUEUE_EVENTS.VIDEO_PROCESSED:
            await updateHistory(data.id, {
              history: { status: 'processed', createdAt: new Date() },
              processedPath: data.path,
            });
            break;

          // Stage: thumbnail generated
          case VIDEO_QUEUE_EVENTS.VIDEO_THUMBNAIL_GENERATED: {
            const thumbName   = path.parse(data.filename || data.path || '').name;
            const thumbnailUrl = `${SERVER_URL}/thumbnails/${thumbName}.png`;
            await updateHistory(data.id, {
              history: {
                status:       'thumbnail_generated',
                createdAt:    new Date(),
              },
              thumbnailPath: data.path,
              thumbnailUrl,
            });
            break;
          }

          // Stage: HLS converted
          case VIDEO_QUEUE_EVENTS.VIDEO_HLS_CONVERTED:
            await setReady(data.id, {
              hlsPath:       data.path       || data.hlsPath,
              thumbnailUrl:  data.thumbnailUrl,
              thumbnailPath: data.thumbnailPath,
              duration:      data.duration,
              resolution:    data.resolution,
            });
            await updateHistory(data.id, {
              history: {
                status:    'ready',
                hlsPath:   data.path || data.hlsPath,
                createdAt: new Date(),
              },
            });
            break;

          // Stage: HLS converting
          case VIDEO_QUEUE_EVENTS.VIDEO_HLS_CONVERTING:
            await updateHistory(data.id, {
              history: { status: 'hls_converting', createdAt: new Date() },
            });
            break;

          default:
            await updateHistory(data.id, {
              history: { status: eventName, createdAt: new Date() },
            });
        }
      } catch (err) {
        logger.error(`[video-handler] Error handling ${eventName} for id=${data.id}:`, err.message);
      }
    });
  });
};

module.exports = { setup };
