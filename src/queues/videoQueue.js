/**
 * BullMQ Video Processing Queue
 * Producer for adding video watermarking jobs
 */

const { Queue } = require('bullmq');
const { getClient } = require('../lib/redis');

// Get Redis connection from existing Redis client
const redisClient = getClient();

// Create Redis connection config for BullMQ
const connection = redisClient 
  ? {
      // Use existing ioredis client if available
      // BullMQ can work with ioredis instances
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    }
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    };

// Create video processing queue
const videoQueue = new Queue('video-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 second delay
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 24 * 3600, // Keep failed jobs for 24 hours
    },
    // Video processing can take a long time, so set a longer lock duration
    lockDuration: 10 * 60 * 1000, // 10 minutes (videos can take 5-10 minutes to process)
  },
});

/**
 * Add a video watermarking job to the queue
 * @param {string} postId - Post ID
 * @param {string} videoPath - Local path to video file
 * @param {string} mimetype - Video MIME type
 * @param {string} logoPath - Path to logo file
 * @returns {Promise<Job>} - BullMQ job instance
 */
async function queueWatermarkJob(postId, videoPath, mimetype, logoPath) {
  const job = await videoQueue.add(
    'watermark',
    {
      postId,
      videoPath,
      mimetype,
      logoPath,
    },
    {
      jobId: `watermark-${postId}-${Date.now()}`, // Unique job ID
      priority: 1, // Normal priority
      // Set longer lock duration for video processing (can take 5-10 minutes)
      lockDuration: 10 * 60 * 1000, // 10 minutes
    }
  );

  console.log(`[VIDEO_QUEUE] Job queued: ${job.id} for Post ID: ${postId}`);
  return job;
}

/**
 * Get job status
 * @param {string} jobId - Job ID
 * @returns {Promise<Job|null>} - Job instance or null
 */
async function getJobStatus(jobId) {
  const job = await videoQueue.getJob(jobId);
  return job;
}

/**
 * Get job state
 * @param {string} jobId - Job ID
 * @returns {Promise<string>} - Job state (completed, active, waiting, failed, etc.)
 */
async function getJobState(jobId) {
  const job = await videoQueue.getJob(jobId);
  if (!job) return null;
  
  const state = await job.getState();
  return state;
}

/**
 * Close queue connection (for graceful shutdown)
 */
async function closeQueue() {
  await videoQueue.close();
  console.log('[VIDEO_QUEUE] Queue closed');
}

module.exports = {
  videoQueue,
  queueWatermarkJob,
  getJobStatus,
  getJobState,
  closeQueue,
};
