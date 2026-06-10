const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { MongoManager } = require('../src/modules/db/mongo');

async function main() {
  try {
    console.log('Connecting to database...');
    await MongoManager.connect();
    console.log('Schemas updated successfully!');
  } catch (error) {
    console.error('Error during schema update:', error);
  } finally {
    process.exit(0);
  }
}

main();
