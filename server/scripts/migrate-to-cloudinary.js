'use strict';

/**
 * StreamSphere — Cloudinary Migration Script
 *
 * Uploads all locally stored videos and thumbnails to Cloudinary,
 * and updates their links in the MongoDB database to stream from Cloudinary.
 *
 * Usage:
 *   node scripts/migrate-to-cloudinary.js
 */

require('dotenv').config();
const { MongoClient, ObjectId, Int32 } = require('mongodb');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function main() {
  const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB_NAME || 'streamsphere';

  console.log('Connecting to MongoDB...');
  const client = new MongoClient(mongoUrl, { useNewUrlParser: true });

  try {
    await client.connect();
    const db = client.db(dbName);
    const videosCollection = db.collection('videos');

    const videos = await videosCollection.find({}).toArray();
    console.log(`Found ${videos.length} videos in database.`);

    let migratedCount = 0;

    for (const video of videos) {
      console.log(`\n----------------------------------------`);
      console.log(`Processing video: "${video.title}" (ID: ${video._id})`);

      // Check if already on Cloudinary
      if (video.hlsPath && (video.hlsPath.startsWith('http://') || video.hlsPath.startsWith('https://'))) {
        console.log(`Skipping: Already hosted on Cloudinary.`);
        continue;
      }

      // Locate local video file
      let videoFilePath = video.videoLink;
      if (!videoFilePath || !fs.existsSync(videoFilePath)) {
        // Fallback checks
        const fallbackPaths = [
          path.join('uploads/videos', `${video.fileName || video.title}.mp4`),
          path.join('uploads/videos', `${video.fileName || video.title}.webm`),
        ];
        
        if (video.originalName) {
          fallbackPaths.unshift(path.join('uploads/videos', video.originalName));
        }
        if (video.fileName) {
          try {
            const files = fs.readdirSync('uploads/videos');
            const matchedFile = files.find(f => f.startsWith(video.fileName));
            if (matchedFile) {
              fallbackPaths.unshift(path.join('uploads/videos', matchedFile));
            }
          } catch (_) {}
        }

        const foundPath = fallbackPaths.find(p => fs.existsSync(p));
        if (foundPath) {
          videoFilePath = foundPath;
        } else {
          console.error(`Error: Could not locate local video file for "${video.title}".`);
          console.error(`Paths checked: ${[video.videoLink, ...fallbackPaths].filter(Boolean).join(', ')}`);
          continue;
        }
      }

      console.log(`Local video file found at: ${videoFilePath}`);

      // Locate local thumbnail file
      let thumbFilePath = video.thumbnailPath;
      let cloudThumbnailUrl = null;

      if (thumbFilePath && fs.existsSync(thumbFilePath)) {
        console.log(`Local thumbnail found at: ${thumbFilePath}`);
        try {
          console.log(`Uploading thumbnail to Cloudinary...`);
          const thumbUpload = await cloudinary.uploader.upload(thumbFilePath, {
            folder: 'streamsphere/thumbnails',
            resource_type: 'image',
          });
          cloudThumbnailUrl = thumbUpload.secure_url;
          console.log(`Thumbnail upload success: ${cloudThumbnailUrl}`);
        } catch (err) {
          console.error(`Warning: Thumbnail upload failed: ${err.message}. Will use auto-generated thumbnail.`);
        }
      }

      // Upload video to Cloudinary
      try {
        console.log(`Uploading video to Cloudinary (this might take a minute)...`);
        const videoUpload = await cloudinary.uploader.upload(videoFilePath, {
          folder: 'streamsphere/videos',
          resource_type: 'video',
          eager: [
            { streaming_profile: 'full_hd', format: 'm3u8' }
          ],
          eager_async: true,
        });

        console.log(`Video upload success: ${videoUpload.secure_url}`);

        // Resolve HLS URL
        let cloudHlsPath = null;
        if (videoUpload.eager && videoUpload.eager.length > 0) {
          const eagerHls = videoUpload.eager.find(
            e => e.format === 'm3u8' || e.secure_url.endsWith('.m3u8')
          );
          if (eagerHls) {
            cloudHlsPath = eagerHls.secure_url;
          }
        }

        if (!cloudHlsPath) {
          const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
          const publicId = videoUpload.public_id;
          cloudHlsPath = `https://res.cloudinary.com/${cloudName}/video/upload/sp_full_hd/${publicId}.m3u8`;
        }

        // Resolve thumbnail
        if (!cloudThumbnailUrl) {
          cloudThumbnailUrl = videoUpload.secure_url.replace(/\.[^/.]+$/, '.jpg');
        }

        const durationVal = Math.round(videoUpload.duration || video.duration || 0);
        const resWidth = Math.round(videoUpload.width || (video.resolution && video.resolution.width) || 0);
        const resHeight = Math.round(videoUpload.height || (video.resolution && video.resolution.height) || 0);

        // Update DB record
        console.log(`Updating database record...`);
        const updatePayload = {
          $set: {
            hlsPath: cloudHlsPath,
            thumbnailUrl: cloudThumbnailUrl,
            videoLink: videoUpload.secure_url,
            duration: new Int32(durationVal),
            resolution: {
              width: new Int32(resWidth),
              height: new Int32(resHeight),
            },
            status: 'ready',
            updatedAt: new Date(),
          }
        };

        // If video record has local thumbnailPath, unset it to avoid validation failure
        if (video.thumbnailPath) {
          updatePayload.$unset = { thumbnailPath: "" };
        }

        await videosCollection.updateOne(
          { _id: video._id },
          updatePayload
        );

        console.log(`Successfully migrated video: "${video.title}"`);
        migratedCount++;
      } catch (uploadErr) {
        console.error(`Error: Failed to migrate video "${video.title}":`, uploadErr);
      }
    }

    console.log(`\n========================================`);
    console.log(`Migration completed. Migrated ${migratedCount} videos to Cloudinary.`);

  } catch (error) {
    console.error('Migration script failed:', error);
  } finally {
    await client.close();
  }
}

main();
