'use strict';

const { createClient } = require('redis');
const logger = require('../../logger');

let client = null;
let isReady = false;

// Get shared Redis client
const getClient = async () => {
  if (client) return client;

  const host     = process.env.REDIS_SERVER || 'localhost';
  const port     = Number(process.env.REDIS_PORT || 6379);
  const username = process.env.REDIS_USERNAME || '';
  const password = process.env.REDIS_PASSWORD || '';

  let url = `redis://`;
  if (password) {
    url += `${username ? username : 'default'}:${password}@`;
  }
  url += `${host}:${port}`;

  client = createClient({ url });

  client.on('error',   (err) => logger.warn(`[cache] Redis client error: ${err.message}`));
  client.on('ready',   ()    => { isReady = true;  logger.info('[cache] Redis client ready'); });
  client.on('end',     ()    => { isReady = false; logger.warn('[cache] Redis connection closed'); });
  client.on('reconnecting', () => logger.info('[cache] Redis reconnecting…'));

  try {
    await client.connect();
  } catch (err) {
    logger.warn(`[cache] Redis initial connect failed — caching disabled: ${err.message}`);
  }

  return client;
};

// Check if ready
const ready = () => isReady;

module.exports = { getClient, ready };
