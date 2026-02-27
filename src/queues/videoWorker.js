/**
 * Video Worker - Dedicated process for HLS transcoding
 * 
 * Run this as a separate process: node src/queues/videoWorker.js
 * 
 * This worker processes video transcoding jobs from the BullMQ queue.
 * It runs FFmpeg in a controlled manner with:
 * - Concurrency limit of 2 (optimized for 6-core server)
 * - Automatic retry on failure
 * - Progress reporting
 */

require('dotenv').config();

const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { processVideoInBackground } = require('../services/videoProcessingService');
const prisma = require('../lib/prisma');

// Redis connection
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

// Concurrency: 3 jobs at a time for 12-core server with 48GB RAM
// Each FFmpeg process uses ~1-2 CPU cores and 500MB-1GB RAM
const CONCURRENCY = 3;

console.log('[VideoWorker] Starting video processing worker...');
console.log(`[VideoWorker] Redis URL: ${REDIS_URL}`);
console.log(`[VideoWorker] Concurrency: ${CONCURRENCY}`);

// Create worker
const worker = new Worker(
    'video-processing',
    async (job) => {
        const { postId, inputPath } = job.data;

        console.log(`[VideoWorker] Processing job ${job.id} for post ${postId}`);
        console.log(`[VideoWorker] Input: ${inputPath}`);

        try {
            // Update job progress
            await job.updateProgress(10);

            // Update post status to 'processing'
            await prisma.post.update({
                where: { id: postId },
                data: { processing_status: 'processing' }
            });

            await job.updateProgress(20);

            // Process video (this is the heavy FFmpeg work)
            await processVideoInBackground(inputPath, postId, prisma);

            await job.updateProgress(100);

            console.log(`[VideoWorker] Job ${job.id} completed successfully`);

            return { success: true, postId };
        } catch (error) {
            console.error(`[VideoWorker] Job ${job.id} failed:`, error.message);

            // Update post with error status
            try {
                await prisma.post.update({
                    where: { id: postId },
                    data: {
                        processing_status: 'failed',
                        processing_error: error.message
                    }
                });
            } catch (updateError) {
                console.error('[VideoWorker] Failed to update post status:', updateError.message);
            }

            throw error; // Re-throw to trigger retry
        }
    },
    {
        connection,
        concurrency: CONCURRENCY,
        // Limit resources per job
        limiter: {
            max: CONCURRENCY,
            duration: 1000, // Per second
        },
    }
);

// Worker event handlers
worker.on('completed', (job) => {
    console.log(`[VideoWorker] Job ${job.id} has completed`);
});

worker.on('failed', (job, err) => {
    console.error(`[VideoWorker] Job ${job?.id} has failed with ${err.message}`);
});

worker.on('error', (err) => {
    console.error('[VideoWorker] Worker error:', err);
});

worker.on('ready', () => {
    console.log('[VideoWorker] Worker is ready and waiting for jobs');
});

// Graceful shutdown
async function shutdown() {
    console.log('[VideoWorker] Shutting down...');

    await worker.close();
    await connection.quit();
    await prisma.$disconnect();

    console.log('[VideoWorker] Shutdown complete');
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    console.error('[VideoWorker] Uncaught exception:', err);
    shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[VideoWorker] Unhandled rejection at:', promise, 'reason:', reason);
});

console.log('[VideoWorker] Video worker started successfully');
