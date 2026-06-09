'use strict';

/**
 * StreamSphere — Resolution Tag Migration Script
 *
 * This script updates all existing videos in MongoDB with a tag indicating their max resolution:
 *   - < 720: SD
 *   - 720: HD
 *   - 1080: Full HD
 *   - 1440: 2K
 *   - 2160: 4K
 *   - 4320: 8K
 *
 * It also invalidates the Redis cache for each updated video.
 *
 * Usage:
 *   node scripts/update-resolution-tags.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { MongoClient, ObjectId } = require('mongodb');
const { getClient: getRedisClient } = require('../src/modules/cache/redis');
const { cacheDel, cacheDelPattern, FEED_KEY, buildDetailKey, buildStatusKey } = require('../src/modules/cache/helpers');

const MONGO_URL = process.env.MONGODB_URL;
const DB_NAME = process.env.MONGODB_DB_NAME;

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

async function main() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  const videosCollection = db.collection('videos');
  console.log('✓ MongoDB connected.');

  let redisClient = null;
  try {
    console.log('Connecting to Redis...');
    redisClient = await getRedisClient();
    console.log('✓ Redis connected.');
  } catch (err) {
    console.warn('⚠️ Redis not connected — cache invalidation will be skipped.');
  }

  const videos = await videosCollection.find({ isDeleted: false, status: 'ready' }).toArray();
  console.log(`Found ${videos.length} video(s) to check.`);

  let updatedCount = 0;

  for (const video of videos) {
    const id = video._id.toString();
    const height = video.resolution && video.resolution.height ? video.resolution.height : 0;
    const tag = getResolutionTag(height);

    console.log(`\nVideo: "${video.title}" (Height: ${height}p)`);
    console.log(`  Calculated Tag: ${tag}`);

    // Update tags in MongoDB
    const existingTags = Array.isArray(video.tags) ? video.tags : [];
    if (!existingTags.includes(tag)) {
      const newTags = [...existingTags, tag];
      await videosCollection.updateOne(
        { _id: video._id },
        { $set: { tags: newTags, updatedAt: new Date() } }
      );
      console.log(`  ✓ MongoDB updated with tags: ${JSON.stringify(newTags)}`);
      updatedCount++;

      // Invalidate cache
      if (redisClient) {
        await Promise.all([
          cacheDel(FEED_KEY),
          cacheDel(buildDetailKey(id)),
          cacheDel(buildStatusKey(id)),
          cacheDelPattern('video:search:*'),
          cacheDelPattern('video:recommend:*'),
          cacheDelPattern('video:autocomplete:*')
        ]);
        console.log('  ✓ Redis cache invalidated.');
      }
    } else {
      console.log(`  ✓ Video already has tag "${tag}". No change.`);
    }
  }

  console.log(`\nMigration completed. Updated ${updatedCount} video(s).`);
  await client.close();
  if (redisClient) await redisClient.quit();
}

main().catch(console.error);
