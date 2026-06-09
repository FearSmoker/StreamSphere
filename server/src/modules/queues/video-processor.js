// StreamSphere Video Processor

'use strict';

const ffmpeg = require('fluent-ffmpeg');
const path   = require('path');
const fs     = require('fs');
const logger = require('../../logger');

// Sharp thumbnail compression
let sharp;
try {
  sharp = require('sharp');
  logger.info('[video-processor] sharp loaded — thumbnails will be compressed');
} catch {
  logger.warn('[video-processor] sharp not available — skipping thumbnail compression');
  sharp = null;
}

// Optional custom binary paths
if (process.env.FFMPEG_PATH)  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
if (process.env.FFPROBE_PATH) ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

// Helper to ensure a directory exists
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`[video-processor] Created directory: ${dir}`);
  }
};

// Probe video metadata
const probeVideo = (filePath) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        logger.error('[video-processor] ffprobe error:', err.message);
        return reject(err);
      }

      const format   = metadata.format || {};
      const vStream  = (metadata.streams || []).find((s) => s.codec_type === 'video') || {};

      resolve({
        duration:   Math.round(parseFloat(format.duration || 0)),
        resolution: {
          width:  vStream.coded_width  || vStream.width  || 0,
          height: vStream.coded_height || vStream.height || 0,
        },
      });
    });
  });

// HLS Transcode
// onProgress callback
const transcodeToHls = (filePath, outputDir, { onProgress } = {}) =>
  new Promise((resolve, reject) => {
    ensureDir(outputDir);

    const baseName      = path.parse(filePath).name;
    const m3u8Path      = path.join(outputDir, `${baseName}.m3u8`);
    const segmentPattern = path.join(outputDir, `${baseName}_%03d.ts`);

    logger.info(`[video-processor] Starting HLS transcode: ${filePath} → ${m3u8Path}`);

    let lastEmittedPct = -1;

    ffmpeg(filePath)
      .outputOptions([
        '-profile:v baseline',    // broad device compatibility
        '-level 3.0',
        '-start_number 0',
        '-hls_time 6',            // 6-second segments
        '-hls_list_size 0',       // keep all segments
        '-hls_segment_filename', segmentPattern,
        '-f hls',
      ])
      .output(m3u8Path)
      .on('start', (cmd) => logger.info('[video-processor] ffmpeg cmd:', cmd))
      .on('progress', (p) => {
        const pct = Math.min(100, Math.max(0, Math.round(p.percent || 0)));
        if (pct % 25 === 0) logger.info(`[video-processor] HLS progress: ${pct}%`);
        // Limit progress events
        if (onProgress && pct - lastEmittedPct >= 5) {
          lastEmittedPct = pct;
          // Non-blocking — fire and forget
          onProgress(pct).catch(() => {});
        }
      })
      .on('end', () => {
        logger.info(`[video-processor] HLS transcode complete: ${m3u8Path}`);
        // Emit 100% on completion
        if (onProgress) onProgress(100).catch(() => {});
        resolve(m3u8Path);
      })
      .on('error', (err) => {
        logger.error('[video-processor] HLS transcode error:', err.message);
        reject(err);
      })
      .run();
  });

// Multi-Quality HLS Transcode
const QUALITY_LADDER = [
  { label: '360p',  height: 360,  bandwidth: 800000,  videoBitrate: '700k',  audioBitrate: '96k'  },
  { label: '720p',  height: 720,  bandwidth: 2500000, videoBitrate: '2200k', audioBitrate: '128k' },
  { label: '1080p', height: 1080, bandwidth: 5000000, videoBitrate: '4500k', audioBitrate: '192k' },
  { label: '1440p', height: 1440, bandwidth: 9000000, videoBitrate: '8000k', audioBitrate: '256k' },
  { label: '2160p', height: 2160, bandwidth: 18000000, videoBitrate: '16000k', audioBitrate: '320k' },
  { label: '4320p', height: 4320, bandwidth: 35000000, videoBitrate: '32000k', audioBitrate: '320k' },
];

const transcodeRendition = (filePath, outputDir, quality, { onProgress } = {}) =>
  new Promise((resolve, reject) => {
    ensureDir(outputDir);

    const segPattern = path.join(outputDir, `seg_%03d.ts`);
    const m3u8Path   = path.join(outputDir, 'playlist.m3u8');

    logger.info(`[video-processor] Transcoding ${quality.label}: ${filePath} → ${m3u8Path}`);

    let lastPct = -1;

    ffmpeg(filePath)
      .outputOptions([
        '-profile:v baseline',
        '-level 3.1',
        '-preset fast',
        '-crf 23',
        `-vf`, `scale=-2:${quality.height}`,
        `-b:v`, quality.videoBitrate,
        `-b:a`, quality.audioBitrate,
        '-start_number 0',
        '-hls_time 6',
        '-hls_list_size 0',
        '-hls_segment_filename', segPattern,
        '-f hls',
      ])
      .output(m3u8Path)
      .on('progress', (p) => {
        const pct = Math.min(100, Math.max(0, Math.round(p.percent || 0)));
        if (onProgress && pct - lastPct >= 5) {
          lastPct = pct;
          onProgress(pct).catch(() => {});
        }
      })
      .on('end', () => {
        logger.info(`[video-processor] ${quality.label} transcode complete`);
        if (onProgress) onProgress(100).catch(() => {});
        resolve(m3u8Path);
      })
      .on('error', (err) => {
        logger.error(`[video-processor] ${quality.label} transcode error:`, err.message);
        reject(err);
      })
      .run();
  });

// Transcode video into multiple HLS qualities
const transcodeHLSMultiQuality = async (filePath, outputBaseDir, sourceHeight, { onProgress } = {}) => {
  const baseName  = path.parse(filePath).name;
  const masterDir = path.join(outputBaseDir, baseName);
  ensureDir(masterDir);

  // Skip qualities exceeding source resolution
  const targetRenditions = QUALITY_LADDER.filter(q => q.height <= (sourceHeight || 9999));
  // Always include lowest quality
  const renditions = targetRenditions.length > 0 ? targetRenditions : [QUALITY_LADDER[0]];

  logger.info(`[video-processor] Multi-quality HLS: ${renditions.map(r => r.label).join(', ')}`);

  const qualities = [];
  const totalRenditions = renditions.length;

  for (let i = 0; i < totalRenditions; i++) {
    const q = renditions[i];
    const renditionDir = path.join(masterDir, q.label);

    // Scale progress for overall percent
    const renditionProgress = onProgress
      ? async (pct) => {
          const overall = Math.round(((i + pct / 100) / totalRenditions) * 100);
          await onProgress(overall);
        }
      : undefined;

    const playlistPath = await transcodeRendition(filePath, renditionDir, q, { onProgress: renditionProgress });
    qualities.push({
      label:     q.label,
      path:      playlistPath,
      bandwidth: q.bandwidth,
      height:    q.height,
    });
  }

  // Write master manifest
  const masterPath = path.join(masterDir, 'master.m3u8');
  const masterLines = ['#EXTM3U', '#EXT-X-VERSION:3', ''];
  for (const q of qualities) {
    const relPlaylist = path.relative(masterDir, q.path);
    masterLines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${q.bandwidth},RESOLUTION=${Math.round(q.height * 16 / 9)}x${q.height}`,
      relPlaylist
    );
  }
  fs.writeFileSync(masterPath, masterLines.join('\n'));
  logger.info(`[video-processor] Master manifest written: ${masterPath}`);

  return { masterPath, qualities };
};

// Generate thumbnail
const generateThumbnail = (filePath, outputDir) =>
  new Promise((resolve, reject) => {
    ensureDir(outputDir);

    const baseName    = path.parse(filePath).name;
    const thumbFile   = `${baseName}.jpg`;
    const thumbPath   = path.join(outputDir, thumbFile);

    logger.info(`[video-processor] Generating thumbnail for: ${filePath}`);

    ffmpeg(filePath)
      .screenshots({
        timestamps:  ['5%'],       // 5% into video
        filename:    thumbFile,
        folder:      outputDir,
        size:        '640x?',      // preserve aspect ratio
      })
      .on('end', async () => {
        logger.info(`[video-processor] Thumbnail saved: ${thumbPath}`);

        // Compress thumbnail via Sharp
        if (sharp) {
          try {
            const tmpPath = `${thumbPath}.tmp.jpg`;
            await sharp(thumbPath)
              .resize({ width: 640, withoutEnlargement: true })
              .jpeg({ quality: 82, progressive: true })
              .toFile(tmpPath);
            fs.renameSync(tmpPath, thumbPath);
            logger.info(`[video-processor] Thumbnail compressed via sharp: ${thumbPath}`);
          } catch (sharpErr) {
            logger.warn('[video-processor] sharp compression failed (using original):', sharpErr.message);
          }
        }

        resolve(thumbPath);
      })
      .on('error', (err) => {
        // Non-fatal thumbnail error fallback
        logger.warn('[video-processor] Thumbnail generation warning:', err.message);
        resolve(null);
      });
  });

// Full processing pipeline
const processVideo = async (filePath, { hlsDir, thumbDir, serverUrl, onProgressCallback, customThumbPath }) => {
  logger.info(`[video-processor] processVideo start: ${filePath}`);

  // Probe metadata
  const { duration, resolution } = await probeVideo(filePath);
  logger.info('[video-processor] Probe result:', { duration, resolution });

  // Transcode HLS and generate/use thumbnail
  let masterPath, qualities, thumbPath;
  if (customThumbPath) {
    const transcodeResult = await transcodeHLSMultiQuality(filePath, hlsDir, resolution.height, { onProgress: onProgressCallback });
    masterPath = transcodeResult.masterPath;
    qualities = transcodeResult.qualities;
    thumbPath = customThumbPath;
  } else {
    const [transcodeResult, generatedThumbPath] = await Promise.all([
      transcodeHLSMultiQuality(filePath, hlsDir, resolution.height, { onProgress: onProgressCallback }),
      generateThumbnail(filePath, thumbDir),
    ]);
    masterPath = transcodeResult.masterPath;
    qualities = transcodeResult.qualities;
    thumbPath = generatedThumbPath;
  }

  // Build thumbnail URL
  const thumbFile    = thumbPath ? path.basename(thumbPath) : null;
  const thumbnailUrl = thumbFile ? `${serverUrl}/thumbnails/${thumbFile}` : null;

  return {
    hlsPath:       masterPath,
    thumbnailPath: thumbPath,
    thumbnailUrl,
    duration,
    resolution,
    qualities,
  };
};

// Legacy helper for compatibility
const getVideoDurationAndResolution = (filePath) =>
  probeVideo(filePath).then(({ duration, resolution }) => ({
    videoDuration:    duration,
    videoResolution:  resolution,
  }));

module.exports = {
  processVideo,
  probeVideo,
  transcodeToHls,
  transcodeHLSMultiQuality,
  generateThumbnail,
  getVideoDurationAndResolution,
};
