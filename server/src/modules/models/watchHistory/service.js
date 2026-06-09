const { ObjectId } = require('mongodb');
const { WatchHistory } = require('../../db/collections');
const logger = require('../../../logger');

const saveProgress = async (userId, videoId, progressSeconds, durationSeconds) => {
  try {
    const progress = parseFloat(progressSeconds) || 0;
    const duration = parseFloat(durationSeconds) || 0;

    // A video is marked completed if watched 95% or more
    const completed = duration > 0 ? (progress / duration) >= 0.95 : false;

    const query = {
      userId: new ObjectId(userId),
      videoId: new ObjectId(videoId),
    };

    const update = {
      $set: {
        progressSeconds: progress,
        durationSeconds: duration,
        completed,
        lastWatchedAt: new Date(),
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
        isDeleted: false,
      },
    };

    const result = await WatchHistory.updateOne(query, update, { upsert: true });
    return result;
  } catch (error) {
    logger.error('Error in saveProgress service:', error);
    return error;
  }
};

const getWatchHistory = async (userId, completedFilter = false) => {
  try {
    const pipeline = [
      {
        $match: {
          userId: new ObjectId(userId),
          completed: completedFilter,
        },
      },
      {
        $sort: { lastWatchedAt: -1 },
      },
      {
        $lookup: {
          from: 'videos',
          localField: 'videoId',
          foreignField: '_id',
          pipeline: [
            { $project: { title: 1, description: 1, category: 1, thumbnailUrl: 1, duration: 1 } }
          ],
          as: 'videoDetails',
        },
      },
      {
        $unwind: {
          path: '$videoDetails',
          preserveNullAndEmptyArrays: false, // Only return histories with valid videos
        },
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          videoId: 1,
          progressSeconds: 1,
          durationSeconds: 1,
          completed: 1,
          lastWatchedAt: 1,
          video: {
            _id: '$videoDetails._id',
            title: '$videoDetails.title',
            description: '$videoDetails.description',
            category: '$videoDetails.category',
            thumbnailUrl: '$videoDetails.thumbnailUrl',
            duration: '$videoDetails.duration',
          },
        },
      },
    ];

    const results = await WatchHistory.aggregate(pipeline).toArray();
    return results;
  } catch (error) {
    logger.error('Error in getWatchHistory service:', error);
    return error;
  }
};

module.exports = {
  saveProgress,
  getWatchHistory,
};
