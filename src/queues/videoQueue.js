const { Queue, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');

// Redis connection for queue (must match video processor server REDIS_URL for jobs to be consumed)
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
});

const redisHostForLog = REDIS_URL.replace(/\/\/([^:@]+)(:[^@]+)?@/, '//$1****@');
connection.on('connect', () => {
    console.log('[VideoQueue] Redis connected', { host: redisHostForLog });
});
connection.on('error', (err) => {
    console.error('[VideoQueue] Redis error', { message: err?.message });
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
 * @param {string} inputPath - R2 URL of the video (or local path for legacy flow)
 * @param {number} videoDuration - Optional video duration in seconds (for priority)
 * @returns {Promise<Job>} The created job
 */
async function addVideoJob(postId, inputPath, videoDuration = 30) {
    if (!postId || !inputPath) {
        const err = new Error('addVideoJob requires postId and inputPath (video URL)');
        console.error('[VideoQueue] Invalid args', { postId: !!postId, inputPath: !!inputPath });
        throw err;
    }

    const priority = Math.max(1, Math.ceil(videoDuration / 10));
    const jobId = `video-${postId}-${Date.now()}`;

    const job = await videoQueue.add(
        'transcode-hls',
        {
            postId,
            inputPath,
            createdAt: new Date().toISOString(),
        },
        {
            priority,
            jobId,
        }
    );

    console.log('[VideoQueue] Job enqueued', {
        jobId: job.id,
        postId,
        priority,
        inputPathPrefix: typeof inputPath === 'string' ? inputPath.slice(0, 60) : '(invalid)',
    });
    return job;
}

/**
 * Get job status by post ID (finds most recent job for this post)
 * @param {string} postId - Post ID
 * @returns {Promise<Object|null>} Job status or null if not found
 */
async function getJobStatus(postId) {
    const [waiting, active, completed, failed] = await Promise.all([
        videoQueue.getJobs(['waiting'], 0, 100),
        videoQueue.getJobs(['active'], 0, 100),
        videoQueue.getJobs(['completed'], 0, 50),
        videoQueue.getJobs(['failed'], 0, 50),
    ]);
    const byPostId = (j) => j.data && j.data.postId === postId;
    const job =
        active.find(byPostId) ||
        waiting.find(byPostId) ||
        failed.find(byPostId) ||
        completed.find(byPostId);
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
