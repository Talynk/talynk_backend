/**
 * Background Media Processing Worker
 * Handles watermarking and TikTok optimization for videos/images
 * Works with R2 storage - downloads, processes, re-uploads
 */

const { processVideo, processImage, getVideoMetadata } = require('./mediaProcessor');
const { uploadFileToR2, downloadFromR2, isR2Configured, extractKeyFromUrl } = require('./r2Storage');
const path = require('path');
const fs = require('fs').promises;
const prisma = require('../lib/prisma');

const TMP_DOWNLOADS_DIR = path.join(process.cwd(), 'tmp', 'downloads');
const TMP_PROCESSED_DIR = path.join(process.cwd(), 'tmp', 'processed');

// Ensure temp directories exist
(async () => {
  try {
    await fs.mkdir(TMP_DOWNLOADS_DIR, { recursive: true });
    await fs.mkdir(TMP_PROCESSED_DIR, { recursive: true });
  } catch (error) {
    console.error('[MEDIA_WORKER] Failed to create temp directories:', error);
  }
})();

// Simple in-memory job queue (can be replaced with Redis/BullMQ for production)
const jobQueue = [];
let isProcessing = false;
const MAX_CONCURRENT_JOBS = 2; // Process 2 jobs at a time
let activeJobs = 0;

/**
 * Add a media processing job to the queue
 * @param {string} postId - Post ID
 * @param {string} mediaUrl - R2 URL or local path
 * @param {string} mimetype - File MIME type
 * @param {boolean} isFromR2 - Whether file is from R2
 */
function queueMediaProcessing(postId, mediaUrl, mimetype, isFromR2 = false) {
  const job = {
    id: `${postId}-${Date.now()}`,
    postId,
    mediaUrl,
    mimetype,
    isFromR2,
    createdAt: new Date(),
    status: 'queued'
  };
  
  jobQueue.push(job);
  console.log(`[MEDIA_WORKER] Job queued: ${job.id} for Post ID: ${postId}`);
  
  // Start processing if not already running
  processQueue();
  
  return job.id;
}

/**
 * Process the job queue
 */
async function processQueue() {
  if (isProcessing || activeJobs >= MAX_CONCURRENT_JOBS) {
    return;
  }
  
  if (jobQueue.length === 0) {
    return;
  }
  
  isProcessing = true;
  
  while (jobQueue.length > 0 && activeJobs < MAX_CONCURRENT_JOBS) {
    const job = jobQueue.shift();
    activeJobs++;
    
    // Process job asynchronously (don't await)
    processJob(job)
      .finally(() => {
        activeJobs--;
        // Continue processing queue
        setImmediate(() => processQueue());
      });
  }
  
  isProcessing = false;
}

/**
 * Process a single media processing job
 * @param {Object} job - Job object
 */
async function processJob(job) {
  const { postId, mediaUrl, mimetype, isFromR2 } = job;
  
  try {
    console.log(`[MEDIA_WORKER] Processing job ${job.id} for Post ID: ${postId}`);
    job.status = 'processing';
    
    let localInputPath;
    
    // Step 1: Determine input path
    // If mediaUrl is already a local temp file path, use it directly
    // Otherwise, download from R2 if needed
    if (path.isAbsolute(mediaUrl) || (!mediaUrl.startsWith('http') && !mediaUrl.startsWith('/'))) {
      // It's a local file path (temp file from upload)
      localInputPath = path.isAbsolute(mediaUrl) 
        ? mediaUrl 
        : path.join(process.cwd(), mediaUrl);
      console.log(`[MEDIA_WORKER] Using local temp file: ${localInputPath}`);
    } else if (isFromR2 && isR2Configured()) {
      // Download from R2
      console.log(`[MEDIA_WORKER] Downloading from R2: ${mediaUrl}`);
      const key = extractKeyFromUrl(mediaUrl);
      if (!key) {
        throw new Error(`Could not extract key from R2 URL: ${mediaUrl}`);
      }
      
      const downloadPath = path.join(TMP_DOWNLOADS_DIR, `${postId}_${path.basename(key)}`);
      await downloadFromR2(key, downloadPath);
      localInputPath = downloadPath;
      console.log(`[MEDIA_WORKER] Downloaded to: ${localInputPath}`);
    } else {
      // Local file path (relative)
      localInputPath = path.isAbsolute(mediaUrl) 
        ? mediaUrl 
        : path.join(process.cwd(), mediaUrl);
      console.log(`[MEDIA_WORKER] Using local file: ${localInputPath}`);
    }
    
    // Verify file exists
    try {
      await fs.access(localInputPath);
    } catch (error) {
      throw new Error(`Input file not found: ${localInputPath}`);
    }
    
    // Step 2: Determine if it's video or image
    const isVideo = mimetype.startsWith('video/');
    const isImage = mimetype.startsWith('image/');
    
    if (!isVideo && !isImage) {
      throw new Error(`Unsupported media type: ${mimetype}`);
    }
    
    // Step 3: Process media (watermark + TikTok optimization)
    const outputExt = isVideo ? '.mp4' : '.webp';
    const outputFilename = `${postId}_processed${outputExt}`;
    const outputPath = path.join(TMP_PROCESSED_DIR, outputFilename);
    
    console.log(`[MEDIA_WORKER] Processing ${isVideo ? 'video' : 'image'} for Post ID: ${postId}`);
    
    if (isVideo) {
      await processVideo(localInputPath, postId, outputPath);
    } else {
      await processImage(localInputPath, postId, outputPath);
    }
    
    console.log(`[MEDIA_WORKER] Processing complete, uploading to R2...`);
    
    // Step 4: Upload processed file to R2
    let finalUrl;
    if (isR2Configured()) {
      const result = await uploadFileToR2(
        outputPath,
        outputFilename,
        isVideo ? 'video/mp4' : 'image/webp',
        'media'
      );
      finalUrl = result.url;
      console.log(`[MEDIA_WORKER] Uploaded to R2: ${finalUrl}`);
    } else {
      // Fallback to local storage
      const uploadsPath = path.join(process.cwd(), 'uploads', outputFilename);
      await fs.copyFile(outputPath, uploadsPath);
      finalUrl = `/uploads/${outputFilename}`;
    }
    
    // Step 5: Update post with watermarked URL
    await prisma.post.update({
      where: { id: postId },
      data: { video_url: finalUrl }
    });
    
    console.log(`[MEDIA_WORKER] ✅ Job ${job.id} completed. Post ${postId} updated with watermarked media: ${finalUrl}`);
    job.status = 'completed';
    
    // Step 6: Cleanup temporary files
    try {
      // Clean up input file if it's in temp directories
      if (localInputPath.startsWith(TMP_DOWNLOADS_DIR) || localInputPath.includes('tmp')) {
        await fs.unlink(localInputPath);
        console.log(`[MEDIA_WORKER] Cleaned up input file: ${localInputPath}`);
      }
      // Clean up processed output file
      await fs.unlink(outputPath);
      console.log(`[MEDIA_WORKER] Cleaned up processed file: ${outputPath}`);
    } catch (error) {
      console.warn(`[MEDIA_WORKER] Could not clean up temp files:`, error.message);
    }
    
  } catch (error) {
    console.error(`[MEDIA_WORKER] ❌ Job ${job.id} failed for Post ID ${postId}:`, error);
    job.status = 'failed';
    job.error = error.message;
    
    // Don't throw - allow post to remain with original video
    // Optionally, you could retry the job here
  }
}

/**
 * Get job status
 * @param {string} jobId - Job ID
 * @returns {Object|null} - Job status or null if not found
 */
function getJobStatus(jobId) {
  // Check active jobs
  const activeJob = jobQueue.find(j => j.id === jobId);
  if (activeJob) {
    return {
      id: activeJob.id,
      status: activeJob.status,
      postId: activeJob.postId,
      error: activeJob.error
    };
  }
  return null;
}

module.exports = {
  queueMediaProcessing,
  getJobStatus,
  processQueue
};
