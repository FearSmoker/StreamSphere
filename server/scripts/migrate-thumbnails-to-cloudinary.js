'use strict';

/**
 * StreamSphere — Cloudinary Thumbnail Migration Script
 *
 * Scans the MongoDB database for any videos still using local thumbnail URLs,
 * uploads their local thumbnail files to Cloudinary, and updates their records.
 *
 * Usage:
 *   node scripts/migrate-thumbnails-to-cloudinary.js
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
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

      const currentThumbUrl = video.thumbnailUrl;
      console.log(`Current thumbnailUrl: "${currentThumbUrl}"`);

      // Check if the thumbnail is already hosted on Cloudinary
      if (currentThumbUrl && (currentThumbUrl.startsWith('https://res.cloudinary.com') || currentThumbUrl.includes('cloudinary'))) {
        console.log(`Skipping: Thumbnail is already hosted on Cloudinary.`);
        continue;
      }

      // If it doesn't have a thumbnail URL at all, we skip it
      if (!currentThumbUrl) {
        console.log(`Skipping: No thumbnail URL is set for this video.`);
        continue;
      }

      // Attempt to resolve the filename from the local URL
      let fileName = null;
      try {
        const urlObj = new URL(currentThumbUrl);
        fileName = path.basename(urlObj.pathname);
      } catch (err) {
        // If not a valid URL, try to extract using path.basename
        fileName = path.basename(currentThumbUrl);
      }

      if (!fileName) {
        console.log(`Skipping: Could not extract filename from URL.`);
        continue;
      }

      const localThumbPath = path.join('uploads/thumbnails', fileName);
      console.log(`Looking for local thumbnail file at: ${localThumbPath}`);

      if (!fs.existsSync(localThumbPath)) {
        console.log(`Warning: Local thumbnail file does not exist at ${localThumbPath}.`);
        continue;
      }

      try {
        console.log(`Uploading thumbnail to Cloudinary...`);
        const thumbUpload = await cloudinary.uploader.upload(localThumbPath, {
          folder: 'streamsphere/thumbnails',
          resource_type: 'image',
        });

        const cloudThumbnailUrl = thumbUpload.secure_url;
        console.log(`Upload success: ${cloudThumbnailUrl}`);

        console.log(`Updating database record...`);
        const updatePayload = {
          $set: {
            thumbnailUrl: cloudThumbnailUrl,
            updatedAt: new Date(),
          }
        };

        // Also unset local thumbnailPath if present to satisfy schemas
        if (video.thumbnailPath) {
          updatePayload.$unset = { thumbnailPath: "" };
        }

        await videosCollection.updateOne(
          { _id: video._id },
          updatePayload
        );

        console.log(`Successfully migrated thumbnail to Cloudinary.`);
        migratedCount++;
      } catch (uploadErr) {
        console.error(`Error uploading thumbnail to Cloudinary:`, uploadErr.message);
      }
    }

    console.log(`\n========================================`);
    console.log(`Thumbnail migration completed. Migrated ${migratedCount} thumbnails to Cloudinary.`);

  } catch (error) {
    console.error('Migration script failed:', error);
  } finally {
    await client.close();
  }
}

main();
