'use strict';

/**
 * StreamSphere — Upload Preset Avatars to Cloudinary
 *
 * Uploads all 6 preset avatars (local avatar_1.jpg + 5 Dicebear SVGs) to Cloudinary,
 * and migrates existing database users' avatar fields to their new Cloudinary URLs.
 *
 * Usage:
 *   node scripts/upload-avatars-to-cloudinary.js
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

const PRESET_SOURCES = [
  {
    id: 'avatar_1',
    source: path.join(__dirname, '../../client/public/assets/images/avatars/avatar_1.jpg'),
    isLocal: true,
  },
  {
    id: 'Felix',
    source: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
    isLocal: false,
  },
  {
    id: 'Aneka',
    source: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka',
    isLocal: false,
  },
  {
    id: 'Jack',
    source: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Jack',
    isLocal: false,
  },
  {
    id: 'Buster',
    source: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Buster',
    isLocal: false,
  },
  {
    id: 'Luna',
    source: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Luna',
    isLocal: false,
  },
];

async function main() {
  const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB_NAME || 'streamsphere';

  console.log('Connecting to MongoDB...');
  const client = new MongoClient(mongoUrl, { useNewUrlParser: true });

  try {
    await client.connect();
    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    // 1. Upload all 6 avatars to Cloudinary
    console.log('\nUploading preset avatars to Cloudinary...');
    const cloudinaryUrls = {};

    for (const item of PRESET_SOURCES) {
      console.log(`Uploading ${item.id}...`);
      if (item.isLocal && !fs.existsSync(item.source)) {
        console.error(`Error: Local file not found at ${item.source}`);
        continue;
      }

      try {
        const uploadResult = await cloudinary.uploader.upload(item.source, {
          folder: 'streamsphere/avatars',
          public_id: item.id,
          overwrite: true,
          resource_type: 'image',
        });
        cloudinaryUrls[item.id] = uploadResult.secure_url;
        console.log(`Success! ${item.id} -> ${uploadResult.secure_url}`);
      } catch (err) {
        console.error(`Failed to upload ${item.id}:`, err.message);
      }
    }

    console.log('\nUploaded URLs Map:');
    console.log(JSON.stringify(cloudinaryUrls, null, 2));

    const defaultAvatarUrl = cloudinaryUrls['avatar_1'];
    if (!defaultAvatarUrl) {
      throw new Error('Default avatar (avatar_1) failed to upload. Cannot proceed with migration.');
    }

    // 2. Scan and update all users in MongoDB
    console.log('\nScanning users for avatar updates...');
    const users = await usersCollection.find({}).toArray();
    let updatedCount = 0;

    for (const user of users) {
      let targetAvatar = user.avatar;
      let needsUpdate = false;

      // Check if avatar is empty, missing, or local path
      if (!targetAvatar || targetAvatar === '/assets/images/avatars/avatar_1.jpg') {
        targetAvatar = defaultAvatarUrl;
        needsUpdate = true;
      } else {
        // Check if it matches any of the old Dicebear sources
        for (const item of PRESET_SOURCES) {
          if (!item.isLocal && targetAvatar === item.source) {
            targetAvatar = cloudinaryUrls[item.id];
            needsUpdate = true;
            break;
          }
        }
      }

      if (needsUpdate) {
        console.log(`Updating avatar for user "${user.username}" (ID: ${user._id}) to: ${targetAvatar}`);
        await usersCollection.updateOne(
          { _id: user._id },
          { $set: { avatar: targetAvatar, updatedAt: new Date() } }
        );
        updatedCount++;
      }
    }

    console.log(`\n========================================`);
    console.log(`Avatar migration complete. Updated ${updatedCount} users.`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.close();
  }
}

main();
