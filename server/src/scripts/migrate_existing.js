'use strict';

require('dotenv').config();
const { MongoManager } = require('../modules/db/mongo');
const logger = require('../logger');

const runMigration = async () => {
  try {
    logger.info('Starting database migration...');
    const db = await MongoManager.connect();
    
    const videosCol = db.collection('videos');
    
    const result = await videosCol.updateMany(
      { contentType: { $exists: false } },
      {
        $set: {
          contentType: 'movie',
          languages: ['English'],
          language: 'English',
        }
      }
    );
    
    logger.info(`Migration completed: updated ${result.modifiedCount} existing videos.`);
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
