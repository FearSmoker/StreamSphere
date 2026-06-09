const { ObjectId } = require('mongodb');
const { User, Video } = require('../../db/collections');
const { getQueueStats } = require('../../queues/queue');
const logger = require('../../../logger');

const getSystemAnalytics = async () => {
  try {
    const totalUsers = await User.countDocuments({ isDeleted: false });
    const totalVideos = await Video.countDocuments({ isDeleted: false });

    // Aggregate total views
    const viewStats = await Video.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, totalViews: { $sum: '$viewCount' } } }
    ]).toArray();
    const totalViews = viewStats.length > 0 ? viewStats[0].totalViews : 0;

    // Get 5 latest uploads
    const latestVideos = await Video.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    // Get BullMQ queue stats
    const queueStats = await getQueueStats();

    // Get category distributions
    const categoryStats = await Video.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]).toArray();


    // Top 5 most watched
    const mostWatchedVideos = await Video.find(
      { isDeleted: false, status: { $in: ['ready', 'published'] } },
      { projection: { title: 1, viewCount: 1, thumbnailUrl: 1, category: 1 } }
    )
      .sort({ viewCount: -1 })
      .limit(5)
      .toArray();

    // Signups last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const signupsPerDay = await User.aggregate([
      { $match: { isDeleted: false, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            year:  { $year:  { date: '$createdAt', timezone: 'Asia/Kolkata' } },
            month: { $month: { date: '$createdAt', timezone: 'Asia/Kolkata' } },
            day:   { $dayOfMonth: { date: '$createdAt', timezone: 'Asia/Kolkata' } },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]).toArray();

    // Signups last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const signupsPerMonth = await User.aggregate([
      { $match: { isDeleted: false, createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: {
            year:  { $year:  { date: '$createdAt', timezone: 'Asia/Kolkata' } },
            month: { $month: { date: '$createdAt', timezone: 'Asia/Kolkata' } },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]).toArray();

    // Daily active users
    const { MongoManager } = require('../../db/mongo');
    let dailyActiveUsers = [];
    try {
      const watchHistoryCol = MongoManager.Instance.collection('watchHistory');
      dailyActiveUsers = await watchHistoryCol.aggregate([
        { $match: { lastWatchedAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: {
              year:  { $year:  { date: '$lastWatchedAt', timezone: 'Asia/Kolkata' } },
              month: { $month: { date: '$lastWatchedAt', timezone: 'Asia/Kolkata' } },
              day:   { $dayOfMonth: { date: '$lastWatchedAt', timezone: 'Asia/Kolkata' } },
            },
            uniqueUsers: { $addToSet: '$userId' },
          },
        },
        { $project: { _id: 1, count: { $size: '$uniqueUsers' } } },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]).toArray();
    } catch (dauErr) {
      logger.warn('[admin] DAU aggregation failed:', dauErr.message);
    }

    // Trending categories
    const trendingCategories = await Video.aggregate([
      { $match: { isDeleted: false, status: { $in: ['ready', 'published'] } } },
      { $group: { _id: '$category', totalViews: { $sum: '$viewCount' }, count: { $sum: 1 } } },
      { $sort: { totalViews: -1 } },
      { $limit: 5 },
    ]).toArray();

    return {
      totalUsers,
      totalVideos,
      totalViews,
      latestVideos,
      queueStats,
      categoryStats,
      mostWatchedVideos,
      signupsPerDay,
      signupsPerMonth,
      dailyActiveUsers,
      trendingCategories,
    };
  } catch (error) {
    logger.error('Error in getSystemAnalytics service:', error);
    throw error;
  }
};

const getUsersList = async ({ page = 1, limit = 10, search = '', sortField = 'createdAt', sortOrder = -1 }) => {
  try {
    const query = { isDeleted: false };
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortField]: sortOrder };

    const users = await User.find(query, { projection: { password: 0 } })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await User.countDocuments(query);

    return {
      users,
      total,
      page,
      limit,
    };
  } catch (error) {
    logger.error('Error in getUsersList service:', error);
    throw error;
  }
};

const updateUserRole = async (userId, role) => {
  try {
    const result = await User.updateOne(
      { _id: new ObjectId(userId), isDeleted: false },
      { $set: { role, updatedAt: new Date() } }
    );
    return result;
  } catch (error) {
    logger.error('Error in updateUserRole service:', error);
    throw error;
  }
};

module.exports = {
  getSystemAnalytics,
  getUsersList,
  updateUserRole,
};
