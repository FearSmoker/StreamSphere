'use strict';

/**
 * StreamSphere — Multi-Quality HLS Migration Script
 *
 * This script migrates all existing processed videos to support multi-quality (360p/720p/1080p) HLS.
 * It does this by:
 *   1. Connecting to MongoDB and Redis.
 *   2. Querying all active videos that have status 'ready' or 'published' but do not have the 'qualities' field yet.
 *   3. Verifying that the original source MP4 video file exists on disk.
 *   4. Calling the transcodeHLSMultiQuality() pipeline to generate multi-quality directories and playlist manifests.
 *   5. Updating the MongoDB video document with the new hlsPath (to master.m3u8) and the qualities list.
 *   6. Invalidating the Redis cache (feed, detail, autocomplete, search, recommendations) so changes reflect immediately.
 *
 * Usage:
 *   node scripts/migrate-hls-quality.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const fs = require('fs');
const { MongoClient, ObjectId } = require('mongodb');
const { getClient: getRedisClient } = require('../src/modules/cache/redis');
const { cacheDel, cacheDelPattern, FEED_KEY, buildDetailKey, buildStatusKey } = require('../src/modules/cache/helpers');
const { transcodeHLSMultiQuality } = require('../src/modules/queues/video-processor');

const MONGO_URL = process.env.MONGODB_URL;
const DB_NAME = process.env.MONGODB_DB_NAME;

const HLS_DIR = path.resolve(__dirname, '../uploads/hls');

async function main() {
  console.log('============================================================');
  console.log('StreamSphere Multi-Quality HLS Migration Script Started');
  console.log('============================================================');

  // 1. Connect to MongoDB
  console.log(`Connecting to MongoDB at: ${MONGO_URL.replace(/:([^@:]+)@/, ':****@')}`);
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  const videosCollection = db.collection('videos');
  console.log('✓ MongoDB connected.');

  // 2. Connect to Redis (for cache invalidation)
  let redisClient = null;
  try {
    console.log('Connecting to Redis for cache invalidation...');
    redisClient = await getRedisClient();
    console.log('✓ Redis connected.');
  } catch (redisErr) {
    console.warn('⚠️ Warning: Failed to connect to Redis. Cache invalidation will be skipped.', redisErr.message);
  }

  // 3. Find videos to migrate
  const query = {
    isDeleted: false,
    status: { $in: ['ready', 'published'] },
    qualities: { $exists: false }
  };

  const videosToMigrate = await videosCollection.find(query).toArray();
  console.log(`\nFound ${videosToMigrate.length} video(s) requiring multi-quality migration.`);

  if (videosToMigrate.length === 0) {
    console.log('No videos require migration. Exiting.');
    await client.close();
    if (redisClient) await redisClient.quit();
    return;
  }

  let successCount = 0;
  let failureCount = 0;

  // 4. Process each video sequentially
  for (let i = 0; i < videosToMigrate.length; i++) {
    const video = videosToMigrate[i];
    const id = video._id.toString();
    console.log(`\n[${i + 1}/${videosToMigrate.length}] Processing video: "${video.title}" (ID: ${id})`);

    const videoLink = video.videoLink;
    if (!videoLink) {
      console.warn(`  ❌ Skip: videoLink is missing in DB.`);
      failureCount++;
      continue;
    }

    // Resolve absolute path to source video
    const absVideoPath = path.isAbsolute(videoLink)
      ? videoLink
      : path.resolve(__dirname, '../', videoLink);

    if (!fs.existsSync(absVideoPath)) {
      console.warn(`  ❌ Skip: Original video file not found on disk at: ${absVideoPath}`);
      failureCount++;
      continue;
    }

    const height = video.resolution && video.resolution.height ? video.resolution.height : 720;
    console.log(`  Source video: ${absVideoPath}`);
    console.log(`  Source resolution height: ${height}p`);

    try {
      // Run multi-quality transcoder
      console.log('  Transcoding renditions...');
      const onProgress = (percent) => {
        process.stdout.write(`\r  > Transcoding progress: ${percent}%`);
      };

      const result = await transcodeHLSMultiQuality(absVideoPath, HLS_DIR, height, { onProgress });
      process.stdout.write('\n'); // New line after progress complete
      console.log(`  ✓ Transcoding completed.`);
      console.log(`  Master manifest path: ${result.masterPath}`);
      console.log(`  Generated qualities: ${result.qualities.map(q => q.label).join(', ')}`);

      // Update database document
      console.log('  Updating MongoDB document...');
      await videosCollection.updateOne(
        { _id: video._id },
        {
          $set: {
            hlsPath: result.masterPath,
            qualities: result.qualities,
            updatedAt: new Date()
          },
          $push: {
            history: {
              status: 'ready',
              note: 'Migrated to multi-quality HLS streams',
              createdAt: new Date()
            }
          }
        }
      );
      console.log('  ✓ MongoDB document updated.');

      // Invalidate Redis cache
      if (redisClient) {
        console.log('  Invalidating Redis cache...');
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

      successCount++;
    } catch (err) {
      console.error(`  ❌ Failed to migrate video "${video.title}":`, err.message);
      failureCount++;
    }
  }

  // 5. Cleanup connections and log summary
  console.log('\n============================================================');
  console.log('Migration Completed Summary:');
  console.log(`  - Total processed: ${videosToMigrate.length}`);
  console.log(`  - Successfully migrated: ${successCount}`);
  console.log(`  - Failed / Skipped: ${failureCount}`);
  console.log('============================================================');

  await client.close();
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (_) {}
  }
  console.log('Connections closed. Exit.');
}

main().catch(async (err) => {
  console.error('Migration crashed:', err);
  process.exit(1);
});
