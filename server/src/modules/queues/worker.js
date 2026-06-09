// BullMQ Worker Manager

'use strict';

const { Worker, QueueEvents } = require('bullmq');
const { VIDEO_QUEUE_EVENTS, NOTIFY_EVENTS } = require('./constants');
const { QUEUE_EVENT_HANDLERS } = require('./handlers');
const { getWorkerConnection, makeQueueConnection } = require('./bullmq-redis');
const logger = require('../../logger');
const eventEmitter = require('../../event-manager').getInstance();

// Start a single queue listener and worker pair
const listenQueueEvent = (queueName) => {
  // Requires a dedicated connection
  const queueEvents = new QueueEvents(queueName, {
    connection: makeQueueConnection(),
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error(`[worker] Job ${jobId} in "${queueName}" failed: ${failedReason}`);
  });

  queueEvents.on('completed', ({ jobId }) => {
    logger.info(`[worker] Job ${jobId} in "${queueName}" completed`);
  });

  // Forward job progress updates to Socket.io
  queueEvents.on('progress', ({ jobId, data }) => {
    if (data && data.id) {
      logger.info(`[worker] Job ${jobId} progress: ${data.percent}% for video ${data.id}`);
      eventEmitter.emit('socket:emit', { event: 'video:progress', data });
    }
  });

  // Worker setup
  const worker = new Worker(
    queueName,
    async (job) => {
      logger.info(`[worker] Processing job ${job.id} in queue "${queueName}"`);
      const handler = QUEUE_EVENT_HANDLERS[queueName];
      if (!handler) throw new Error(`[worker] No handler registered for queue: ${queueName}`);
      return await handler(job);
    },
    {
      connection: getWorkerConnection(),
      concurrency: 1,
    }
  );

  worker.on('completed', (job) =>
    logger.info(`[worker] ✓ Job ${job.id} completed in "${queueName}"`)
  );

  worker.on('failed', (job, err) =>
    logger.error(`[worker] ✗ Job ${job?.id} failed in "${queueName}": ${err.message}`)
  );

  logger.info(`[worker] Listening on queue: "${queueName}"`);
  return worker;
};

// Boot queue workers and register DB update listeners
const setupAllQueueEvents = () => {
  // Start uploaded queue worker
  listenQueueEvent(VIDEO_QUEUE_EVENTS.VIDEO_UPLOADED);

  // Register DB update listeners
  const { setup: setupVideoHandler } = require('../models/video/handler');
  setupVideoHandler();

  logger.info('[worker] Active video.uploaded queue worker started');
  return true;
};

module.exports = { setupAllQueueEvents, listenQueueEvent };
