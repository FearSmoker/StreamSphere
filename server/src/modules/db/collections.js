// MongoDB Collection Registry with Lazy Proxy fallback

'use strict';

const { ObjectId } = require('mongodb');
const { MongoManager } = require('./mongo');
const { baseDefaults } = require('./schemas/common');
const logger = require('../../logger');

// Low-level helpers

const insertItem = async (collection, item) => {
  try {
    return await MongoManager.Instance.collection(collection).insertOne({
      ...baseDefaults(),
      ...item,
    });
  } catch (error) {
    logger.error(error.errInfo?.details);
    if (error.code && error.code.toString() === '121') {
      logger.info('schemaErrors', JSON.stringify(error.errInfo?.details));
    }
    return error;
  }
};

const updateItem = async (collection, item) => {
  try {
    const { _id, ...properties } = item;
    return await MongoManager.Instance.collection(collection).updateOne(
      { _id: new ObjectId(_id) },
      { $set: { updatedAt: new Date(), ...properties } }
    );
  } catch (error) {
    logger.error(error);
    return null;
  }
};

const getObjectById = async (collectionName, id) => {
  try {
    return await MongoManager.Instance.collection(collectionName).findOne({
      _id: new ObjectId(id),
    });
  } catch (error) {
    logger.error(error);
    return error;
  }
};

const search = async (
  collectionName,
  { filter, projection, sort, pageNumber = 1, limit = 10 }
) => {
  const skip = (pageNumber - 1) * limit;
  logger.info('search', collectionName, filter, projection, sort, pageNumber, limit);

  const cursor = await MongoManager.Instance.collection(collectionName).find(
    filter,
    { projection, sort: sort || { createdAt: -1 }, skip, limit }
  );
  return cursor.toArray();
};

const count = async (collectionName, { filter }) => {
  const col = MongoManager.Instance.collection(collectionName);
  const n = filter
    ? await col.countDocuments(filter)
    : await col.estimatedDocumentCount();
  logger.info('count:', collectionName, filter, n);
  return n;
};

const deleteObjectById = async (collectionName, id) => {
  try {
    return await MongoManager.Instance.collection(collectionName).deleteOne({
      _id: new ObjectId(id),
    });
  } catch (error) {
    logger.error(error);
    return error;
  }
};

// API methods

const common = (collectionName) => ({
  insert:        (item)   => insertItem(collectionName, item),
  update:        (item)   => updateItem(collectionName, item),
  getObjectById: (id)     => getObjectById(collectionName, id),
  search:        (params) => search(collectionName, params),
  deleteById:    (id)     => deleteObjectById(collectionName, id),
  count:         (params) => count(collectionName, params),
});

// Lazy proxy for MongoDB collections

const createCollectionObject = (collectionName) => {
  const methods = common(collectionName);

  return new Proxy(methods, {
    get(target, prop) {
      // Return helper methods
      if (prop in target) return target[prop];

      // Fall through to native Mongo collection
      if (MongoManager.Instance) {
        const liveCol = MongoManager.Instance.collection(collectionName);
        if (liveCol && prop in liveCol) {
          const val = liveCol[prop];
          return typeof val === 'function' ? val.bind(liveCol) : val;
        }
      }

      return undefined;
    },
  });
};


module.exports = {
  Video:        createCollectionObject('videos'),
  Role:         createCollectionObject('roles'),
  User:         createCollectionObject('users'),
  WatchHistory: createCollectionObject('watchHistory'),
  Notification: createCollectionObject('notifications'),
};
