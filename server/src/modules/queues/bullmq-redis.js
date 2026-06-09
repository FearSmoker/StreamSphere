// Shared Redis connection logic for BullMQ queue registry and worker instances.

'use strict';

const { default: IORedis } = require('ioredis');
const logger = require('../../logger');

let _workerConn = null;

// Build a fresh ioredis connection config for BullMQ.
const makeBullMQConnectionOpts = () => ({
  host:               process.env.REDIS_SERVER   || 'localhost',
  port:               Number(process.env.REDIS_PORT || 6379),
  password:           process.env.REDIS_PASSWORD  || undefined,
  username:           process.env.REDIS_USERNAME  || undefined,
  maxRetriesPerRequest: null,      // required by BullMQ
  enableReadyCheck:   false,       // suppresses eviction policy warning
  lazyConnect:        false,
});

// Returns the shared ioredis client used by Workers.
const getWorkerConnection = () => {
  if (!_workerConn) {
    _workerConn = new IORedis(makeBullMQConnectionOpts());
    _workerConn.on('error', (err) =>
      logger.warn(`[bullmq-redis] worker connection error: ${err.message}`)
    );
    _workerConn.on('connect', () =>
      logger.info('[bullmq-redis] worker connection established')
    );
  }
  return _workerConn;
};

// Creates a fresh ioredis client for a single Queue or QueueEvents instance.
const makeQueueConnection = () => {
  const conn = new IORedis(makeBullMQConnectionOpts());
  conn.on('error', (err) =>
    logger.warn(`[bullmq-redis] queue connection error: ${err.message}`)
  );
  return conn;
};

module.exports = { getWorkerConnection, makeQueueConnection };
