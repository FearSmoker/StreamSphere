// BullMQ Queue Handlers

'use strict';

const path   = require('path');
const fs     = require('fs');
const { VIDEO_QUEUE_EVENTS: QUEUE_EVENTS } = require('./constants');
const { processVideo } = require('./video-processor');
const { setProcessing, setReady, setFailed, updateHistory } = require('../models/video/service');
const logger = require('../../logger');
const eventEmitter = require('../../event-manager').getInstance();

// Primary handler triggered for VIDEO_UPLOADED jobs
const uploadedHandler = async (job) => {
  const { id, title, path: filePath, filename, thumbnailPath: customThumbPath } = job.data;
  logger.info(`[handler] uploadedHandler start → id=${id} title="${title}"`);

  const hlsDir   = './uploads/hls';
  const thumbDir = './uploads/thumbnails';
  const serverUrl = process.env.SERVER_URL || 'http://localhost:4000';

  // Stage 1: Mark processing
  try {
    await setProcessing(id);
    await updateHistory(id, { history: { status: 'processing', createdAt: new Date() } });
  } catch (dbErr) {
    logger.warn('[handler] Could not update DB to processing:', dbErr.message);
  }

  // Emit video:processing
  eventEmitter.emit('socket:emit', { event: 'video:processing', data: { id, title } });
  logger.info(`[handler] Emitted video:processing for id=${id}`);

  // Stage 2: Run ffmpeg pipeline
  let result;
  try {
    const baseName  = path.parse(filePath).name;
    const m3u8Path  = path.join(hlsDir, `${baseName}.m3u8`);
    const thumbPath = customThumbPath || path.join(thumbDir, `${baseName}.jpg`);
    const hlsAlreadyExists = fs.existsSync(m3u8Path);

    if (hlsAlreadyExists) {
      // Job is being retried but ffmpeg already succeeded — reconstruct result
      logger.info(`[handler] HLS already exists for id=${id}, skipping transcode (retry path)`);
      const { probeVideo } = require('./video-processor');
      let duration = 0, resolution = { width: 0, height: 0 };
      if (fs.existsSync(filePath)) {
        try { ({ duration, resolution } = await probeVideo(filePath)); } catch (_) {}
      }
      const thumbnailUrl = fs.existsSync(thumbPath)
        ? `${serverUrl}/thumbnails/${path.basename(thumbPath)}`
        : null;
      result = { hlsPath: m3u8Path, thumbnailUrl, thumbnailPath: thumbPath, duration, resolution };
    } else {
      // Pass job.updateProgress as callback
      const onProgressCallback = async (percent) => {
        await job.updateProgress({ id, title, percent });
      };

      if (process.env.UPLOAD_STORAGE === 'cloudinary') {
        const cloudinary = require('cloudinary').v2;
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        logger.info(`[handler] Uploading video to Cloudinary for id=${id}`);
        await onProgressCallback(20);

        let thumbnailUrl = null;
        let thumbnailPath = customThumbPath || null;
        if (thumbnailPath && fs.existsSync(thumbnailPath)) {
          logger.info(`[handler] Uploading custom thumbnail to Cloudinary: ${thumbnailPath}`);
          const thumbUpload = await cloudinary.uploader.upload(thumbnailPath, {
            folder: 'streamsphere/thumbnails',
            resource_type: 'image',
          });
          thumbnailUrl = thumbUpload.secure_url;
        }

        await onProgressCallback(50);

        const videoUpload = await cloudinary.uploader.upload(filePath, {
          folder: 'streamsphere/videos',
          resource_type: 'video',
          eager: [
            { streaming_profile: 'full_hd', format: 'm3u8' }
          ],
          eager_async: true,
        });

        logger.info(`[handler] Cloudinary video upload success for id=${id}`, {
          public_id: videoUpload.public_id,
          secure_url: videoUpload.secure_url,
        });

        await onProgressCallback(90);

        let hlsPath = null;
        if (videoUpload.eager && videoUpload.eager.length > 0) {
          const eagerHls = videoUpload.eager.find(
            (e) => e.format === 'm3u8' || e.secure_url.endsWith('.m3u8')
          );
          if (eagerHls) {
            hlsPath = eagerHls.secure_url;
          }
        }

        if (!hlsPath) {
          const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
          const publicId = videoUpload.public_id;
          hlsPath = `https://res.cloudinary.com/${cloudName}/video/upload/sp_full_hd/${publicId}.m3u8`;
        }

        if (!thumbnailUrl) {
          thumbnailUrl = videoUpload.secure_url.replace(/\.[^/.]+$/, '.jpg');
        }

        const duration = Math.round(videoUpload.duration || 0);
        const resolution = {
          width: videoUpload.width || 0,
          height: videoUpload.height || 0,
        };

        const targetRenditions = [
          { label: '360p',  height: 360,  name: 'hls_360p',  bandwidth: 800000 },
          { label: '480p',  height: 480,  name: 'hls_480p',  bandwidth: 1400000 },
          { label: '720p',  height: 720,  name: 'hls_720p',  bandwidth: 2500000 },
          { label: '1080p', height: 1080, name: 'hls_1080p', bandwidth: 5000000 },
        ].filter(q => q.height <= resolution.height);

        const qualities = targetRenditions.map(q => ({
          label: q.label,
          path: hlsPath ? hlsPath.replace('/sp_full_hd/', `/sp_full_hd/${q.name}/`) : '',
          bandwidth: q.bandwidth,
          height: q.height,
        }));

        result = {
          hlsPath,
          thumbnailUrl,
          thumbnailPath: null,
          duration,
          resolution,
          qualities,
        };

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info(`[handler] Deleted temporary local video file: ${filePath}`);
        }
        if (customThumbPath && fs.existsSync(customThumbPath)) {
          fs.unlinkSync(customThumbPath);
          logger.info(`[handler] Deleted custom thumbnail file: ${customThumbPath}`);
        }

        await onProgressCallback(100);
      } else {
        result = await processVideo(filePath, { hlsDir, thumbDir, serverUrl, onProgressCallback, customThumbPath });
        logger.info(`[handler] processVideo completed for id=${id}`, result);
      }
    }
  } catch (procErr) {
    logger.error(`[handler] processVideo failed for id=${id}:`, procErr.message);

    // Mark failed in DB
    try {
      await setFailed(id, procErr.message);
      await updateHistory(id, {
        history: { status: 'failed', reason: procErr.message, createdAt: new Date() },
      });
    } catch (dbErr2) {
      logger.warn('[handler] Could not update DB to failed:', dbErr2.message);
    }

    // Emit video:failed
    eventEmitter.emit('socket:emit', {
      event: 'video:failed',
      data: { id, title, error: procErr.message },
    });

    throw procErr; // Let BullMQ mark the job as failed
  }

  // Stage 3: Mark ready
  const { hlsPath, thumbnailUrl, thumbnailPath, duration, resolution, qualities } = result;

  // Propagate DB errors
  await setReady(id, { hlsPath, thumbnailUrl, thumbnailPath, duration, resolution, qualities });
  await updateHistory(id, {
    history: {
      status: 'ready',
      hlsPath,
      thumbnailUrl,
      duration,
      resolution,
      createdAt: new Date(),
    },
  });
  logger.info(`[handler] DB updated to ready for id=${id}`);

  // Emit video:ready
  eventEmitter.emit('socket:emit', {
    event: 'video:ready',
    data: { id, title, hlsPath, thumbnailUrl, duration, resolution, qualities },
  });
  logger.info(`[handler] Emitted video:ready for id=${id}`);

  return { id, status: 'ready' };
};

// Pass-through handlers for legacy multi-queue setup
const processingHandler = async (job) => {
  logger.info('[handler] processingHandler (no-op — handled inside uploadedHandler)', job.data.id);
};

const processedHandler = async (job) => {
  logger.info('[handler] processedHandler (no-op)', job.data.id);
};

const hlsConvertingHandler = async (job) => {
  logger.info('[handler] hlsConvertingHandler (no-op)', job.data.id);
};

const hlsConvertedHandler = async (job) => {
  logger.info('[handler] hlsConvertedHandler (no-op)', job.data.id);
};

const notifyVideoHlsConvertedHandler = async (job) => {
  logger.info('[handler] notifyVideoHlsConvertedHandler (no-op)', job.data.id);
  eventEmitter.emit('notify.video.hls.converted', job.data);
};


const QUEUE_EVENT_HANDLERS = {
  [QUEUE_EVENTS.VIDEO_UPLOADED]:     uploadedHandler,
  [QUEUE_EVENTS.VIDEO_PROCESSING]:   processingHandler,
  [QUEUE_EVENTS.VIDEO_PROCESSED]:    processedHandler,
  [QUEUE_EVENTS.VIDEO_HLS_CONVERTING]: hlsConvertingHandler,
  [QUEUE_EVENTS.VIDEO_HLS_CONVERTED]:  hlsConvertedHandler,
  ['notify.video.hls.converted']:    notifyVideoHlsConvertedHandler,
};

module.exports = { QUEUE_EVENT_HANDLERS };
