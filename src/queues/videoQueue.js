const { Queue, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');

// Redis connection for queue
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
});

// Create video processing queue
const videoQueue = new Queue('video-processing', {
    connection,
    defaultJobOptions: {
        removeOnComplete: {
            age: 3600, // Remove completed jobs after 1 hour
            count: 100, // Keep max 100 completed jobs
        },
        removeOnFail: {
            age: 86400, // Remove failed jobs after 24 hours
        },
        attempts: 3, // Retry failed jobs 3 times
        backoff: {
            type: 'exponential',
            delay: 5000, // 5 seconds initial delay
        },
    },
});

// Queue events for monitoring (optional)
const queueEvents = new QueueEvents('video-processing', { connection });

queueEvents.on('completed', ({ jobId, returnvalue }) => {
    console.log(`[VideoQueue] Job ${jobId} completed successfully`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`[VideoQueue] Job ${jobId} failed: ${failedReason}`);
});

queueEvents.on('progress', ({ jobId, data }) => {
    console.log(`[VideoQueue] Job ${jobId} progress: ${data}%`);
});

/**
 * Add a video processing job to the queue
 * @param {string} postId - Post ID to update after processing
 * @param {string} inputPath - Path to the video file to process
 * @param {number} videoDuration - Optional video duration in seconds (for priority)
 * @returns {Promise<Job>} The created job
 */
async function addVideoJob(postId, inputPath, videoDuration = 30) {
    // Priority: shorter videos get higher priority (lower number = higher priority)
    // 1-10 sec = priority 1, 11-20 sec = priority 2, etc.
    const priority = Math.max(1, Math.ceil(videoDuration / 10));

    const job = await videoQueue.add(
        'transcode-hls',
        {
            postId,
            inputPath,
            createdAt: new Date().toISOString(),
        },
        {
            priority,
            jobId: `video-${postId}`, // Use postId as job ID to prevent duplicates
        }
    );

    console.log(`[VideoQueue] Added job ${job.id} for post ${postId} with priority ${priority}`);
    return job;
}

/**
 * Get job status by post ID
 * @param {string} postId - Post ID
 * @returns {Promise<Object|null>} Job status or null if not found
 */
async function getJobStatus(postId) {
    const job = await videoQueue.getJob(`video-${postId}`);
    if (!job) return null;

    const state = await job.getState();
    const progress = job.progress || 0;

    return {
        id: job.id,
        state,
        progress,
        data: job.data,
        failedReason: job.failedReason,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
    };
}

/**
 * Get queue statistics
 * @returns {Promise<Object>} Queue stats
 */
async function getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
        videoQueue.getWaitingCount(),
        videoQueue.getActiveCount(),
        videoQueue.getCompletedCount(),
        videoQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
}

/**
 * Clean up resources (call on shutdown)
 */
async function closeQueue() {
    await queueEvents.close();
    await videoQueue.close();
    await connection.quit();
    console.log('[VideoQueue] Queue connections closed');
}

module.exports = {
    videoQueue,
    addVideoJob,
    getJobStatus,
    getQueueStats,
    closeQueue,
};
