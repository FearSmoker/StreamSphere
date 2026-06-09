require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const port = process.env.VIDEO_PORT || 4001;
const publicDirectory = './uploads/hls';

const requestHandler = (req, res) => {
  const filePath = path.join(publicDirectory, req.url);
  logger.info('filePath', filePath);

  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end(`File not found: ${filePath}`);
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.end(`Error reading file: ${err}`);
      return;
    }
    if (filePath.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    }
    if (filePath.endsWith('.ts')) {
      res.setHeader('Content-Type', 'video/mp2t');
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
    res.setHeader('Access-Control-Max-Age', 2592000); // 30 days
    res.end(data);
  });
};

const server = http.createServer(requestHandler);

server.listen(port, (err) => {
  if (err) {
    logger.error(`Error starting server: ${err}`);
    return;
  }

  logger.info(`Video server started on port ${port}`);
});
