require('dotenv').config();
const { MongoManager } = require('../src/modules/db/mongo');

async function run() {
  try {
    await MongoManager.connect();
    const shows = await MongoManager.Instance.collection('shows').find({}).toArray();
    console.log('--- SHOWS ---');
    console.log(JSON.stringify(shows, null, 2));
    
    const videos = await MongoManager.Instance.collection('videos').find({}).toArray();
    console.log('--- VIDEOS ---');
    console.log(JSON.stringify(videos, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
