// Redis Pub/Sub Bridge

'use strict';

const { createClient } = require('redis');
const logger = require('../../logger');

const CHANNEL = 'streamsphere:events';

let _publisher  = null;
let _subscriber = null;

const makeRedisUrl = () => {
  const host     = process.env.REDIS_SERVER   || 'localhost';
  const port     = Number(process.env.REDIS_PORT || 6379);
  const username = process.env.REDIS_USERNAME  || '';
  const password = process.env.REDIS_PASSWORD  || '';

  let url = 'redis://';
  if (password) url += `${username || 'default'}:${password}@`;
  url += `${host}:${port}`;
  return url;
};

// Publisher (used by video-processor)

const getPublisher = async () => {
  if (_publisher) return _publisher;
  _publisher = createClient({ url: makeRedisUrl() });
  _publisher.on('error', (err) => logger.warn(`[pubsub] publisher error: ${err.message}`));
  try {
    await _publisher.connect();
    logger.info('[pubsub] publisher connected');
  } catch (err) {
    logger.warn(`[pubsub] publisher connect failed — progress events disabled: ${err.message}`);
    _publisher = null;
  }
  return _publisher;
};

// Publish event
const publishEvent = async (event, data) => {
  const pub = await getPublisher();
  if (!pub) return;
  try {
    await pub.publish(CHANNEL, JSON.stringify({ event, data }));
  } catch (err) {
    logger.warn(`[pubsub] publish error: ${err.message}`);
  }
};

// Subscriber (used by web server)

// Subscribe to channel
const subscribeToEvents = async (onMessage) => {
  _subscriber = createClient({ url: makeRedisUrl() });
  _subscriber.on('error', (err) => logger.warn(`[pubsub] subscriber error: ${err.message}`));
  try {
    await _subscriber.connect();
    logger.info('[pubsub] subscriber connected — listening on channel: ' + CHANNEL);
    await _subscriber.subscribe(CHANNEL, (message) => {
      try {
        const { event, data } = JSON.parse(message);
        onMessage(event, data);
      } catch (parseErr) {
        logger.warn(`[pubsub] message parse error: ${parseErr.message}`);
      }
    });
  } catch (err) {
    logger.warn(`[pubsub] subscriber connect failed — real-time progress events disabled: ${err.message}`);
  }
};

module.exports = { publishEvent, subscribeToEvents, CHANNEL };
