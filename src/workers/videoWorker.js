/**
 * BullMQ Video Processing Worker
 * Watermarks video with logo + Post ID
 * SAFE: no infinite streams, no 100% hang
 */

require('dotenv').config(); // Load environment variables
const { Worker } = require('bullmq');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const path = require('path');
const fs = require('fs').promises;
const { uploadFileToR2, isR2Configured } = require('../services/r2Storage');
const prisma = require('../lib/prisma');
const { getClient } = require('../lib/redis');

/* ===================== FFmpeg Setup ===================== */
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

/* ===================== Paths ===================== */
const TMP_PROCESSED_DIR = path.join(process.cwd(), 'tmp', 'processed');

(async () => {
  await fs.mkdir(TMP_PROCESSED_DIR, { recursive: true });
})();

/* ===================== Redis ===================== */
const redisClient = getClient();
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

/* ===================== Video Processor ===================== */
async function processVideoWithWatermark(videoPath, postId, logoPath, job) {
  const outputFilename = `${postId}_processed_${Date.now()}.mp4`;
  const outputPath = path.join(TMP_PROCESSED_DIR, outputFilename);

  await fs.access(videoPath);
  await fs.access(logoPath);

  return new Promise((resolve, reject) => {
    const postIdEscaped = postId
      .replace(/:/g, '\\:')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');

    let lastPercent = -1;
    let killTimer = null;

    const filters = [
      `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30[base]`,
      `[1:v]scale=-1:min(ih*0.1\\,120)[logo]`,
      `[base][logo]overlay=10:10[wm]`,
      `[wm]drawtext=text='Post ID\\: ${postIdEscaped}':fontsize=h/20:fontcolor=white:shadowcolor=black:shadowx=2:shadowy=2:x=w-text_w-10:y=h-text_h-10:box=1:boxcolor=black@0.45[outv]`
    ];

    const ffmpegCommand = ffmpeg(videoPath)
      .input(logoPath)
      .inputOptions(['-loop', '1'])        // loop logo
      .complexFilter(filters, 'outv')
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioBitrate('128k')
      .outputOptions([
        '-map 0:v',
        '-map 0:a?',
        '-shortest',                       // 🔥 CRITICAL FIX
        '-preset veryfast',
        '-crf 27',
        '-profile:v high',
        '-level 4.1',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
        '-threads 0',
        '-y'
      ])
      .output(outputPath)
      .on('start', cmd => {
        console.log('[FFMPEG START]', cmd);
      })
      .on('progress', p => {
        if (!p.percent) return;
        const percent = Math.min(100, Math.round(p.percent));
        if (percent !== lastPercent) {
          lastPercent = percent;
          job.updateProgress(percent);
          if (percent % 10 === 0 || percent === 100) {
            console.log(`[VIDEO] ${percent}%`);
          }
        }
      })
       .on('stderr', line => {
         // Ignore progress spam to avoid blocking event loop
         // Filter out frame progress, fps, bitrate, and other verbose output
         if (line.includes('frame=') || 
             line.includes('fps=') || 
             line.includes('bitrate=') ||
             line.includes('size=') ||
             line.includes('time=') ||
             line.includes('speed=') ||
             line.includes('q=') ||
             line.includes('dup=') ||
             line.includes('drop=') ||
             line.includes('[libx264') ||
             line.includes('mb I') ||
             line.includes('mb P') ||
             line.includes('mb B') ||
             line.includes('i16') ||
             line.includes('i8') ||
             line.includes('i4') ||
             line.includes('i8c') ||
             line.includes('Weighted') ||
             line.includes('kb/s:') ||
             line.includes('Qavg:') ||
             line.includes('consecutive') ||
             line.includes('transform') ||
             line.includes('coded y,uv') ||
             line.includes('Fontconfig error: Cannot load default config file')) {
           return; // Ignore all verbose/progress output
         }
         // Only log actual warnings/errors (not fontconfig warnings)
         if (line.toLowerCase().includes('error') && !line.includes('Fontconfig')) {
           console.log('[FFMPEG ERROR]', line);
         } else if (line.toLowerCase().includes('warning')) {
           console.log('[FFMPEG WARN]', line);
         }
       })
       .on('end', async () => {
         // Clear timeout on successful completion
         if (killTimer) clearTimeout(killTimer);
         
         try {
           let finalUrl;

          if (isR2Configured()) {
            console.log(`[VIDEO_WORKER] Uploading to R2: ${outputFilename}`);
            const result = await uploadFileToR2(
              outputPath,
              outputFilename,
              'video/mp4',
              'media'
            );
            finalUrl = result.url;
            console.log(`[VIDEO_WORKER] ✅ Uploaded to R2: ${finalUrl}`);
          } else {
            console.log(`[VIDEO_WORKER] ⚠️ R2 not configured, using local storage fallback`);
            console.log(`[VIDEO_WORKER] USE_R2=${process.env.USE_R2}, isR2Configured=${isR2Configured()}`);
            const uploads = path.join(process.cwd(), 'uploads', outputFilename);
            await fs.mkdir(path.dirname(uploads), { recursive: true });
            await fs.copyFile(outputPath, uploads);
            finalUrl = `/uploads/${outputFilename}`;
            console.log(`[VIDEO_WORKER] Saved to local storage: ${finalUrl}`);
          }

           await prisma.post.update({
             where: { id: postId },
             data: { video_url: finalUrl }
           });

           await fs.unlink(outputPath);

           resolve({ finalUrl });
         } catch (err) {
           reject(err);
         }
       })
       .on('error', err => {
         // Clear timeout on error
         if (killTimer) clearTimeout(killTimer);
         console.error('[FFMPEG ERROR]', err);
         reject(err);
       })
       .run();

    // Hard timeout kill for FFmpeg (25 minutes - before 30 min lock expires)
    killTimer = setTimeout(() => {
      console.error('[FFMPEG] Force killed (timeout after 25 minutes)');
      try {
        ffmpegCommand.kill('SIGKILL');
      } catch (killErr) {
        console.error('[FFMPEG] Failed to kill process:', killErr);
      }
      reject(new Error('FFmpeg processing timeout (25 minutes exceeded)'));
    }, 25 * 60 * 1000); // 25 minutes
  });
}

/* ===================== Worker ===================== */
const worker = new Worker(
  'video-processing',
  async job => {
    const { postId, videoPath, logoPath } = job.data;
    return processVideoWithWatermark(videoPath, postId, logoPath, job);
  },
  {
    connection,
    concurrency: 1,
    
    // 🔥 CRITICAL FIXES for long-running video jobs
    lockDuration: 30 * 60 * 1000,     // 30 minutes (videos can take 10-20 min)
    lockRenewTime: 10 * 60 * 1000,    // Renew lock every 10 minutes (before expiration)
    maxStalledCount: 3,               // Allow 3 missed renewals before marking as stalled
    stalledInterval: 60 * 1000,      // Check for stalled jobs every 1 minute
    
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 24 * 3600, // Keep failed jobs for 24 hours
    },
  }
);

/* ===================== Events ===================== */
worker.on('completed', job => {
  console.log(`[JOB DONE] ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`[JOB FAILED] ${job?.id}`, err.message);
});

process.on('SIGINT', async () => {
  await worker.close();
  process.exit(0);
});

console.log('[VIDEO_WORKER] Ready');

module.exports = worker;
