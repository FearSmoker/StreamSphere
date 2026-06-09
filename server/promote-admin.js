'use strict';

/**
 * StreamSphere — User Promotion Script
 *
 * Promotes a user registered in MongoDB to the 'admin' role,
 * allowing them to access the video-upload dashboard and upload videos.
 *
 * Usage:
 *   node promote-admin.js <email>
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Error: Please provide the email of the user to promote.');
    console.log('Usage: node promote-admin.js <email>');
    process.exit(1);
  }

  const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB_NAME || 'streamsphere';

  console.log(`Connecting to MongoDB...`);
  const client = new MongoClient(mongoUrl, { useNewUrlParser: true });

  try {
    await client.connect();
    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    // Find user
    const user = await usersCollection.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      console.error(`Error: User with email "${email}" not found in database.`);
      console.log('Registered users:');
      const allUsers = await usersCollection.find({}, { projection: { email: 1, username: 1, role: 1 } }).toArray();
      if (allUsers.length === 0) {
        console.log('  (No users registered yet. Register on the website first!)');
      } else {
        allUsers.forEach(u => {
          console.log(`  - ${u.email} (${u.username}) [Role: ${u.role}]`);
        });
      }
      process.exit(1);
    }

    if (user.role === 'admin') {
      console.log(`User "${email}" is already an admin!`);
      process.exit(0);
    }

    // Update role
    const result = await usersCollection.updateOne(
      { _id: user._id },
      { $set: { role: 'admin', updatedAt: new Date() } }
    );

    if (result.modifiedCount > 0) {
      console.log(`Success! User "${email}" has been successfully promoted to "admin".`);
    } else {
      console.log('No modifications made.');
    }
  } catch (error) {
    console.error('Failed to promote user:', error);
  } finally {
    await client.close();
  }
}

main();
