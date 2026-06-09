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

const logger = require('./logger');
const { MongoManager } = require('./modules/db/mongo');

const { setupAllQueueEvents } = require('./modules/queues/worker');
const eventEmitter = require('./event-manager').getInstance();
const { publishEvent } = require('./modules/cache/pubsub');

const setup = async () => {
  await MongoManager.connect();  
  const status = setupAllQueueEvents();
  logger.info('setupAllQueueEvents: ', status);

  // Forward socket:emit events to Redis Pub/Sub
  eventEmitter.on('socket:emit', ({ event, data }) => {
    logger.info(`[queue-bridge] Forwarding event "${event}" to Redis Pub/Sub`, { id: data?.id });
    publishEvent(event, data);
  });
};

setup();
