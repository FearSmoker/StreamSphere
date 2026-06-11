const axios = require('axios');

async function run() {
  try {
    const url = 'https://res.cloudinary.com/desk6uyon/video/upload/sp_full_hd/v1781049756/streamsphere/videos/fpxvoi1qydcdzdbkrnye.m3u8';
    console.log('Fetching:', url);
    const res = await axios.get(url);
    console.log('--- MANIFEST CONTENT ---');
    console.log(res.data);
  } catch (err) {
    console.error(err.message);
  }
}

run();
