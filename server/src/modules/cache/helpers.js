// Cache Helpers (Cache-Aside Pattern)

'use strict';

const { getClient, ready } = require('./redis');
const logger = require('../../logger');

// Default TTLs (seconds)
const TTL = {
  FEED:    Number(process.env.CACHE_TTL_FEED   || 300),   // 5 min
  SEARCH:  Number(process.env.CACHE_TTL_SEARCH || 180),   // 3 min
  DETAIL:  Number(process.env.CACHE_TTL_DETAIL || 120),   // 2 min
  COUNT:   Number(process.env.CACHE_TTL_COUNT  || 300),   // 5 min
  STATUS:  Number(process.env.CACHE_TTL_STATUS ||   5),   // 5 sec
};

// Get cached value
const cacheGet = async (key) => {
  if (!ready()) return null;
  try {
    const client = await getClient();
    const raw = await client.get(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch (err) {
    logger.warn(`[cache] GET error for "${key}": ${err.message}`);
    return null;
  }
};

// Set cache value
const cacheSet = async (key, value, ttlSeconds = TTL.FEED) => {
  if (!ready()) return;
  try {
    const client = await getClient();
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    logger.info(`[cache] SET "${key}" (TTL ${ttlSeconds}s)`);
  } catch (err) {
    logger.warn(`[cache] SET error for "${key}": ${err.message}`);
  }
};

// Delete cached keys
const cacheDel = async (...keys) => {
  if (!ready() || keys.length === 0) return;
  try {
    const client = await getClient();
    await client.del(keys);
    logger.info(`[cache] DEL keys: ${keys.join(', ')}`);
  } catch (err) {
    logger.warn(`[cache] DEL error: ${err.message}`);
  }
};

// Delete cached keys matching pattern
const cacheDelPattern = async (pattern) => {
  if (!ready()) return;
  try {
    const client = await getClient();
    const keys = [];

    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }

    if (keys.length > 0) {
      await client.del(keys);
      logger.info(`[cache] DEL pattern "${pattern}" → removed ${keys.length} key(s)`);
    } else {
      logger.info(`[cache] DEL pattern "${pattern}" → no keys found`);
    }
  } catch (err) {
    logger.warn(`[cache] DEL pattern error for "${pattern}": ${err.message}`);
  }
};

// Build search cache key
const buildSearchKey = (params) => {
  const stable = JSON.stringify(
    Object.keys(params).sort().reduce((acc, k) => { acc[k] = params[k]; return acc; }, {})
  );
  return `video:search:${stable}`;
};

// Detail cache key
const buildDetailKey = (id) => `video:detail:${id}`;

// Feed cache key
const FEED_KEY = 'video:feed:all';

// Status cache key
const buildStatusKey = (id) => `video:status:${id}`;

// Recommendation cache key
const buildRecommendKey = ({ userId, category }) => {
  const stable = JSON.stringify({ userId: userId || null, category: category || null });
  return `video:recommend:${stable}`;
};

// Autocomplete cache key
const buildAutocompleteKey = (query) => `video:autocomplete:${query.toLowerCase().trim()}`;

module.exports = {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  buildSearchKey,
  buildDetailKey,
  buildStatusKey,
  buildRecommendKey,
  buildAutocompleteKey,
  FEED_KEY,
  TTL,
};
