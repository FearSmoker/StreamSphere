// BullMQ queue registry managing background video processing jobs.

'use strict';

const { Queue } = require('bullmq');
const { VIDEO_QUEUE_EVENTS } = require('./constants');
const makeQueueConnection = require('./bullmq-redis').makeQueueConnection;
const logger = require('../../logger');
const eventEmitter = require('../../event-manager').getInstance();

const QUEUE_NAME = VIDEO_QUEUE_EVENTS.VIDEO_UPLOADED;

// Build a registry containing only the active upload queue to conserve Redis connections
const queues = [
  {
    name: QUEUE_NAME,
    queueObj: new Queue(QUEUE_NAME, {
      connection: makeQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: false,         // keep failed jobs so we can inspect them
      },
    }),
  }
];

const addQueueItem = async (queueName, item) => {
  logger.info('[queue] addQueueItem', queueName, { id: item.id });

  const queue = queues.find((q) => q.name === queueName);
  if (!queue) {
    throw new Error(`[queue] Queue not found: ${queueName}`);
  }

  // Notify any in-process listeners immediately (used by server.js event bridge)
  eventEmitter.emit(queueName, item);

  await queue.queueObj.add(queueName, item);
};

const getQueueStats = async () => {
  const stats = {};
  for (const q of queues) {
    try {
      const counts = await q.queueObj.getJobCounts('active', 'waiting', 'completed', 'failed', 'delayed');
      stats[q.name] = counts;
    } catch (err) {
      logger.error(`Failed to get job counts for queue ${q.name}:`, err);
      stats[q.name] = { active: 0, waiting: 0, completed: 0, failed: 0, delayed: 0 };
    }
  }
  return stats;
};

module.exports = { addQueueItem, getQueueStats };
