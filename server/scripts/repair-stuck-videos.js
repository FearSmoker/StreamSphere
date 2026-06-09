/**
 * repair-stuck-videos.js
 *
 * Finds all videos stuck in "processing" or "pending" state and checks
 * if their HLS files were actually generated on disk. If so, marks them
 * as "ready" in MongoDB.
 *
 * Run with:  node scripts/repair-stuck-videos.js
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const fs   = require('fs');
const { MongoClient, ObjectId } = require('mongodb');
const ffmpeg = require('fluent-ffmpeg');

const MONGO_URL  = process.env.MONGODB_URL;
const DB_NAME    = process.env.MONGODB_DB_NAME;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';

const HLS_DIR   = path.join(__dirname, '../uploads/hls');
const THUMB_DIR = path.join(__dirname, '../uploads/thumbnails');

const probeVideo = (filePath) =>
  new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return resolve({ duration: 0, resolution: { width: 0, height: 0 } });
      const format  = metadata.format || {};
      const vStream = (metadata.streams || []).find((s) => s.codec_type === 'video') || {};
      resolve({
        duration:   Math.round(parseFloat(format.duration || 0)),
        resolution: {
          width:  vStream.coded_width  || vStream.width  || 0,
          height: vStream.coded_height || vStream.height || 0,
        },
      });
    });
  });

const main = async () => {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db      = client.db(DB_NAME);
  const videos  = db.collection('videos');

  // Find all stuck videos
  const stuck = await videos.find({
    status: { $in: ['processing', 'pending'] },
    isDeleted: false,
  }).toArray();

  console.log(`Found ${stuck.length} stuck video(s).`);

  for (const video of stuck) {
    const id       = video._id.toString();
    const fileName = video.fileName;

    if (!fileName) {
      console.log(`  [SKIP] ${id} — no fileName in DB`);
      continue;
    }

    const m3u8Path   = path.join(HLS_DIR,   `${fileName}.m3u8`);
    const thumbPath  = path.join(THUMB_DIR, `${fileName}.jpg`);
    const hlsExists  = fs.existsSync(m3u8Path);
    const thumbExists = fs.existsSync(thumbPath);

    console.log(`\n  Video: "${video.title}" (${id})`);
    console.log(`    HLS:       ${hlsExists ? '✓ EXISTS' : '✗ MISSING'} → ${m3u8Path}`);
    console.log(`    Thumbnail: ${thumbExists ? '✓ EXISTS' : '✗ MISSING'} → ${thumbPath}`);

    if (!hlsExists) {
      console.log(`    → Cannot repair (HLS not generated). Marking as "failed".`);
      await videos.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'failed', processingError: 'HLS files missing. Re-upload required.', updatedAt: new Date() } }
      );
      continue;
    }

    // Probe original video for metadata
    const videoFilePath = video.videoLink;
    const absVideoPath  = path.isAbsolute(videoFilePath)
      ? videoFilePath
      : path.join(__dirname, '..', videoFilePath);

    let duration   = video.duration || 0;
    let resolution = video.resolution || { width: 0, height: 0 };

    if (fs.existsSync(absVideoPath) && duration === 0) {
      console.log(`    Probing video for metadata...`);
      const probe = await probeVideo(absVideoPath);
      duration   = probe.duration;
      resolution = probe.resolution;
      console.log(`    Duration: ${duration}s, Resolution: ${resolution.width}x${resolution.height}`);
    }

    const thumbnailUrl = thumbExists
      ? `${SERVER_URL}/thumbnails/${path.basename(thumbPath)}`
      : null;

    const $setFields = {
      status:      'ready',
      hlsPath:     m3u8Path,
      publishedAt: new Date(),
      updatedAt:   new Date(),
    };
    if (thumbnailUrl)  $setFields.thumbnailUrl  = thumbnailUrl;
    if (thumbExists)   $setFields.thumbnailPath = thumbPath;
    if (resolution)    $setFields.resolution    = resolution;
    if (duration)      $setFields.duration      = duration;

    await videos.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: $setFields,
        $push: {
          history: { status: 'ready', repairedAt: new Date(), note: 'Repaired by repair script' },
        },
      }
    );
    console.log(`    ✓ Marked as "ready".`);
  }

  console.log('\nRepair complete. Closing connection.');
  await client.close();
};

main().catch((err) => {
  console.error('Repair failed:', err);
  process.exit(1);
});
