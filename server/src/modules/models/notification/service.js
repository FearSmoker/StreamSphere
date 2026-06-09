'use strict';

const { ObjectId } = require('mongodb');
const { Notification } = require('../../db/collections');
const logger = require('../../../logger');

const insertNotification = async ({ userId, type, title, description }) => {
  try {
    const doc = {
      userId: userId ? new ObjectId(userId) : null,
      type,
      title,
      description,
      isUnRead: true,
    };
    return await Notification.insert(doc);
  } catch (error) {
    logger.error('Error in insertNotification:', error);
    return error;
  }
};

const getNotifications = async ({ userId, role }) => {
  try {
    // If admin: returns notifications with userId: null OR userId: req.user.id
    // If user: returns notifications with userId: req.user.id
    const filter = role === 'admin'
      ? {
          userId: { $in: [null, new ObjectId(userId)] },
          isDeleted: false,
        }
      : {
          userId: new ObjectId(userId),
          isDeleted: false,
        };

    const list = await Notification.search({
      filter,
      sort: { createdAt: -1 },
      limit: 100, // retrieve up to 100 items
    });
    return list;
  } catch (error) {
    logger.error('Error in getNotifications:', error);
    return error;
  }
};

const markAllAsRead = async ({ userId, role }) => {
  try {
    const filter = role === 'admin'
      ? {
          userId: { $in: [null, new ObjectId(userId)] },
          isDeleted: false,
        }
      : {
          userId: new ObjectId(userId),
          isDeleted: false,
        };

    // Use native collection updateMany to update multiple records
    return await Notification.updateMany(filter, { $set: { isUnRead: false, updatedAt: new Date() } });
  } catch (error) {
    logger.error('Error in markAllAsRead:', error);
    return error;
  }
};

const clearAllNotifications = async ({ userId, role }) => {
  try {
    const filter = role === 'admin'
      ? {
          userId: { $in: [null, new ObjectId(userId)] },
        }
      : {
          userId: new ObjectId(userId),
        };

    // Mark isDeleted: true instead of raw deletion so we don't interfere with database indexes unexpectedly
    return await Notification.updateMany(filter, { $set: { isDeleted: true, updatedAt: new Date() } });
  } catch (error) {
    logger.error('Error in clearAllNotifications:', error);
    return error;
  }
};

module.exports = {
  insertNotification,
  getNotifications,
  markAllAsRead,
  clearAllNotifications,
};
