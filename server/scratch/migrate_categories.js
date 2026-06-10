require('dotenv').config();
const { MongoManager } = require('../src/modules/db/mongo');

const MOVIE_CATEGORIES = [
  'Action',
  'Comedy',
  'Drama',
  'Romance',
  'Horror',
  'Thriller & Mystery',
  'Sci-Fi & Fantasy',
  'Others'
];

async function run() {
  try {
    await MongoManager.connect();
    const db = MongoManager.Instance;
    const videosCol = db.collection('videos');
    
    const allVideos = await videosCol.find({}).toArray();
    console.log(`Found ${allVideos.length} total videos in database.`);
    
    let episodeCount = 0;
    let movieCount = 0;
    
    for (const video of allVideos) {
      if (video.contentType === 'episode' || video.showId) {
        // TV Show episode -> set category to 'Documentary'
        await videosCol.updateOne(
          { _id: video._id },
          { $set: { category: 'Documentary', updatedAt: new Date() } }
        );
        episodeCount++;
      } else {
        // Standalone movie -> randomly assign one of the movie categories
        const randomCat = MOVIE_CATEGORIES[Math.floor(Math.random() * MOVIE_CATEGORIES.length)];
        await videosCol.updateOne(
          { _id: video._id },
          { $set: { category: randomCat, updatedAt: new Date() } }
        );
        movieCount++;
      }
    }
    
    console.log(`Successfully migrated categories:`);
    console.log(`- TV Show episodes set to 'Documentary': ${episodeCount}`);
    console.log(`- Movies set to random categories: ${movieCount}`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}

run();
