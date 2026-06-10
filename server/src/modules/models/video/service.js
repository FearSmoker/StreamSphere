// Video service handling database operations with Redis cache-aside caching.

'use strict';

const { ObjectId } = require('mongodb');
const { Video, WatchHistory } = require('../../db/collections');
const { VIDEO_STATUS } = require('../../db/constant');
const logger = require('../../../logger');
const {
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
} = require('../../cache/helpers');

// Helper functions

// Get resolution tag
const getResolutionTag = (height) => {
  if (!height) return 'SD';
  const h = Number(height);
  if (h < 720) return 'SD';
  if (h === 720) return 'HD';
  if (h === 1080) return 'Full HD';
  if (h === 1440) return '2K';
  if (h === 2160) return '4K';
  if (h === 4320) return '8K';
  // Fallbacks in case height is slightly off
  if (h < 1080) return 'HD';
  if (h < 1440) return 'Full HD';
  if (h < 2160) return '2K';
  if (h < 4320) return '4K';
  return '8K';
};


// Invalidate feed cache
const invalidateFeedCache = async () => {
  await Promise.all([
    cacheDel(FEED_KEY),
    cacheDelPattern('video:search:*'),
    cacheDelPattern('video:recommend:*'),
  ]);
};

// Invalidate video cache
const invalidateVideoCache = async (id) => {
  await Promise.all([
    cacheDel(buildDetailKey(id)),
    cacheDel(buildStatusKey(id)),
  ]);
};

// Write operations

const insert = async (document) => {
  try {
    const result = await Video.insert({ status: VIDEO_STATUS.PENDING, ...document });
    // A new video in PENDING state won't appear in feeds (status filter), but
    // invalidate anyway so counts stay fresh.
    await invalidateFeedCache();
    return result;
  } catch (error) {
    return error;
  }
};

const update = async (document) => {
  try {
    const result = await Video.update(document);
    await invalidateFeedCache();
    if (document._id) await invalidateVideoCache(document._id.toString());
    return result;
  } catch (error) {
    return error;
  }
};

// Read operations

// Paginated video search with cache-aside
const search = async (searchObject) => {
  logger.info('[videoService] search', searchObject);

  const cacheKey = Object.keys(searchObject).length === 0
    ? FEED_KEY
    : buildSearchKey(searchObject);

  // Cache hit
  const cached = await cacheGet(cacheKey);
  if (cached !== null) {
    logger.info(`[videoService] cache HIT: ${cacheKey}`);
    return cached;
  }

  // Cache miss — query MongoDB
  const filter = searchObject.filterKey
    ? {
        [searchObject.filterKey]: new RegExp(searchObject.filterValue, 'i'),
        isDeleted: false,
        status: { $in: [VIDEO_STATUS.PUBLISHED, VIDEO_STATUS.READY] },
      }
    : {
        isDeleted: false,
        status: { $in: [VIDEO_STATUS.PUBLISHED, VIDEO_STATUS.READY] },
      };

  const projection = {
    title: 1,
    description: 1,
    category: 1,
    duration: 1,
    viewCount: 1,
    status: 1,
    recordingDate: 1,
    thumbnailUrl: 1,
    hlsPath: 1,
    contentType: 1,
    showId: 1,
    seasonNumber: 1,
    episodeNumber: 1,
    languages: 1,
    language: 1,
  };

  const sort = searchObject.sortKey
    ? { [searchObject.sortKey]: searchObject.sortValue ?? 1 }
    : { _id: -1 };
  const pageNumber = searchObject.pageNumber || 1;
  const limit      = searchObject.limit      || 10;

  const videos = await Video.search({ filter, projection, sort, pageNumber, limit });

  // Populate cache
  const ttl = Object.keys(searchObject).length === 0 ? TTL.FEED : TTL.SEARCH;
  await cacheSet(cacheKey, videos, ttl);

  return videos;
};

const count = async (searchObject) => {
  logger.info('[videoService] count', searchObject);

  const cacheKey = `video:count:${JSON.stringify(searchObject)}`;

  const cached = await cacheGet(cacheKey);
  if (cached !== null) {
    logger.info(`[videoService] cache HIT: ${cacheKey}`);
    return cached;
  }

  const filter = searchObject.filterKey
    ? {
        [searchObject.filterKey]: new RegExp(searchObject.filterValue, 'i'),
        isDeleted: false,
        status: { $in: [VIDEO_STATUS.PUBLISHED, VIDEO_STATUS.READY] },
      }
    : {
        isDeleted: false,
        status: { $in: [VIDEO_STATUS.PUBLISHED, VIDEO_STATUS.READY] },
      };

  const result = await Video.count({ filter });
  await cacheSet(cacheKey, result, TTL.COUNT);
  return result;
};

// Fetch a single video by ID with cache-aside.
const getById = async (id) => {
  logger.info('[videoService] getById', id);

  const cacheKey = buildDetailKey(id);

  const cached = await cacheGet(cacheKey);
  if (cached !== null) {
    logger.info(`[videoService] cache HIT: ${cacheKey}`);
    return cached;
  }

  const video = await Video.getObjectById(id);
  if (video && !(video instanceof Error)) {
    await cacheSet(cacheKey, video, TTL.DETAIL);
  }
  return video;
};

// Recommendation engine suggesting content based on context or user history.
const getRecommendations = async ({ userId, category, limit = 10 }) => {
  logger.info('[videoService] getRecommendations', { userId, category, limit });

  const cacheKey = buildRecommendKey({ userId, category });

  // Cache hit
  const cached = await cacheGet(cacheKey);
  if (cached !== null) {
    logger.info(`[videoService] cache HIT: ${cacheKey}`);
    return cached;
  }

  let recommendedVideos = [];

  // 1. Contextual matching: If on a Watch Page, recommend same-category videos
  if (category) {
    const filter = {
      category,
      isDeleted: false,
      status: { $in: [VIDEO_STATUS.PUBLISHED, VIDEO_STATUS.READY] },
    };
    recommendedVideos = await Video.search({ filter, limit });
  } 
  // 2. Personalized matching: User watch history aggregation
  else if (userId) {
    try {
      const topCategories = await WatchHistory.aggregate([
        { $match: { userId: new ObjectId(userId) } },
        { $sort: { lastWatchedAt: -1 } },
        { $limit: 100 },
        {
          $lookup: {
            from: 'videos',
            localField: 'videoId',
            foreignField: '_id',
            as: 'videoDetails',
          },
        },
        { $unwind: '$videoDetails' },
        {
          $group: {
            _id: '$videoDetails.category',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 3 }, // Take top 3 categories
      ]).toArray();

      if (topCategories.length > 0) {
        const categoryNames = topCategories.map(c => c._id);
        const filter = {
          category: { $in: categoryNames },
          isDeleted: false,
          status: { $in: [VIDEO_STATUS.PUBLISHED, VIDEO_STATUS.READY] },
        };
        // Sort by viewCount to show trending within their favorite categories
        recommendedVideos = await Video.search({ filter, sort: { viewCount: -1 }, limit });
      }
    } catch (err) {
      logger.error('[videoService] Recommendation aggregation failed', err);
    }
  }

  // 3. Fallback: Trending videos (highest global view count)
  if (recommendedVideos.length === 0) {
    const filter = {
      isDeleted: false,
      status: { $in: [VIDEO_STATUS.PUBLISHED, VIDEO_STATUS.READY] },
    };
    recommendedVideos = await Video.search({ filter, sort: { viewCount: -1 }, limit });
  }

  // Populate cache
  await cacheSet(cacheKey, recommendedVideos, TTL.FEED);

  return recommendedVideos;
};

// Autocomplete suggestions
// Return matching video suggestions
const autocomplete = async (query) => {
  if (!query || query.trim().length === 0) return [];

  const q = query.trim();
  const cacheKey = buildAutocompleteKey(q);

  const cached = await cacheGet(cacheKey);
  if (cached !== null) {
    logger.info(`[videoService] autocomplete cache HIT: ${cacheKey}`);
    return cached;
  }

  const regex = new RegExp(q, 'i');
  const filter = {
    isDeleted: false,
    status: { $in: [VIDEO_STATUS.PUBLISHED, VIDEO_STATUS.READY] },
    $or: [{ title: regex }, { category: regex }],
  };

  const results = await Video.search({
    filter,
    projection: { title: 1, category: 1, thumbnailUrl: 1, viewCount: 1 },
    sort: { viewCount: -1 },
    pageNumber: 1,
    limit: 8,
  });

  await cacheSet(cacheKey, results, 60); // 60-second TTL for autocomplete
  return results;
};

// Update view count
const updateViewCount = async (id) => {
  try {
    const updatedDoc = await Video.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $inc: { viewCount: 1 } }
    );
    // Invalidate cache on view increment
    await invalidateVideoCache(id);
    return updatedDoc.value;
  } catch (error) {
    return error;
  }
};

// Status cache
// Get processing status
const getStatusById = async (id) => {
  const cacheKey = buildStatusKey(id);

  const cached = await cacheGet(cacheKey);
  if (cached !== null) {
    logger.info(`[videoService] status cache HIT: ${cacheKey}`);
    return cached;
  }

  const video = await Video.getObjectById(id);
  if (video && !(video instanceof Error)) {
    // Cache status
    await cacheSet(cacheKey, video, TTL.STATUS);
  }
  return video;
};

// Worker mutations

const updateHistory = async (id, { history, ...rest }) => {
  try {
    const updatedDoc = await Video.updateOne(
      { _id: new ObjectId(id) },
      { $push: { history }, $set: { ...rest } }
    );
    return updatedDoc;
  } catch (error) {
    logger.error(error);
    return error;
  }
};

const setProcessing = async (id) => {
  try {
    const result = await Video.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'processing', updatedAt: new Date() } }
    );
    await invalidateVideoCache(id);
    return result;
  } catch (error) {
    logger.error('setProcessing error:', error);
    return error;
  }
};

const setReady = async (id, { hlsPath, thumbnailUrl, thumbnailPath, processedPath, duration, resolution, qualities }) => {
  try {
    // Build $set with defined fields to prevent validation failure
    const $setFields = {
      status:      'ready',
      publishedAt: new Date(),
      updatedAt:   new Date(),
    };
    if (hlsPath)       $setFields.hlsPath       = hlsPath;
    if (thumbnailUrl)  $setFields.thumbnailUrl  = thumbnailUrl;
    if (thumbnailPath) $setFields.thumbnailPath = thumbnailPath;
    if (processedPath) $setFields.processedPath = processedPath;
    if (resolution)    $setFields.resolution    = resolution;
    if (qualities && Array.isArray(qualities) && qualities.length > 0) {
      $setFields.qualities = qualities;
    }
    // Duration must be an int; skip if falsy
    if (duration)      $setFields.duration      = parseInt(duration, 10);

    // Resolve and append the resolution tag based on max height
    if (resolution && resolution.height) {
      const tag = getResolutionTag(resolution.height);
      const existing = await Video.findOne({ _id: new ObjectId(id) }, { projection: { tags: 1 } });
      const currentTags = existing && Array.isArray(existing.tags) ? existing.tags : [];
      if (!currentTags.includes(tag)) {
        $setFields.tags = [...currentTags, tag];
      }
    }

    const result = await Video.updateOne(
      { _id: new ObjectId(id) },
      { $set: $setFields }
    );

    // Update show cover and thumbnail if it was set to default
    try {
      const { MongoManager } = require('../../db/mongo');
      const videoDoc = await MongoManager.Instance.collection('videos').findOne({ _id: new ObjectId(id) });
      if (videoDoc && videoDoc.contentType === 'episode' && videoDoc.showId) {
        const showCol = MongoManager.Instance.collection('shows');
        const show = await showCol.findOne({ _id: new ObjectId(videoDoc.showId) });
        if (show) {
          const hasDefaultThumb = !show.thumbnailUrl || show.thumbnailUrl.includes('default_thumbnail.png');
          const hasDefaultCover = !show.coverUrl || show.coverUrl.includes('default_cover.jpg');
          if (hasDefaultThumb || hasDefaultCover) {
            const $setShowFields = {};
            if (hasDefaultThumb && thumbnailUrl) {
              $setShowFields.thumbnailUrl = thumbnailUrl;
            }
            if (hasDefaultCover && thumbnailUrl) {
              $setShowFields.coverUrl = thumbnailUrl;
            }
            if (Object.keys($setShowFields).length > 0) {
              await showCol.updateOne(
                { _id: new ObjectId(videoDoc.showId) },
                { $set: $setShowFields }
              );
              // Invalidate show cache
              await cacheDel(`show:detail:${videoDoc.showId.toString()}`);
              await cacheDel('show:feed:all');
              logger.info(`Updated TV Show ${videoDoc.showId.toString()} auto-generated images from episode`);
            }
          }
        }
      }
    } catch (showErr) {
      logger.error('Failed to update TV Show auto-generated images:', showErr);
    }

    // Video is now visible in feeds — purge stale list + detail caches
    await invalidateFeedCache();
    await invalidateVideoCache(id);
    return result;
  } catch (error) {
    logger.error('setReady error:', error);
    throw error; // propagate so BullMQ retries instead of silently completing
  }
};

const setFailed = async (id, errorMessage) => {
  try {
    const result = await Video.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status:          'failed',
          processingError: errorMessage || 'Unknown error',
          updatedAt:       new Date(),
        },
      }
    );
    await invalidateVideoCache(id);
    return result;
  } catch (error) {
    logger.error('setFailed error:', error);
    return error;
  }
};

const deleteById = async (id) => {
  const result = await Video.deleteById(id);
  await invalidateFeedCache();
  await invalidateVideoCache(id);
  return result;
};

module.exports = {
  insert,
  search,
  getById,
  getStatusById,
  getRecommendations,
  autocomplete,
  update,
  updateHistory,
  updateViewCount,
  deleteById,
  count,
  setProcessing,
  setReady,
  setFailed,
};
