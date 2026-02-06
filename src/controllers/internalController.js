const prisma = require('../lib/prisma');
const { clearCacheByPattern } = require('../utils/cache');

/**
 * Internal Video Processing Callback Controller
 * Receives status updates from the remote video processor VPS
 */

/**
 * Handle video processing callback
 * POST /api/internal/video-callback
 * 
 * Body:
 * {
 *   postId: string,
 *   status: 'processing' | 'completed' | 'failed',
 *   hlsUrl?: string,
 *   videoDuration?: number,
 *   videoWidth?: number,
 *   videoHeight?: number,
 *   error?: string
 * }
 */
exports.videoProcessingCallback = async (req, res) => {
    try {
        const { postId, status, hlsUrl, videoDuration, videoWidth, videoHeight, error } = req.body;

        console.log('[VideoCallback] Received callback', { postId, status });

        // Validate required fields
        if (!postId || !status) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: postId and status',
            });
        }

        // Validate status value
        if (!['processing', 'completed', 'failed'].includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid status value. Must be: processing, completed, or failed',
            });
        }

        // Check if post exists
        const post = await prisma.post.findUnique({
            where: { id: postId },
        });

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found',
                postId,
            });
        }

        // Update post based on status
        const updateData = {
            processing_status: status,
        };

        if (status === 'completed') {
            // Processing completed successfully
            updateData.hls_url = hlsUrl;
            updateData.video_duration = videoDuration;
            updateData.video_width = videoWidth;
            updateData.video_height = videoHeight;
            updateData.processing_error = null;

            console.log('[VideoCallback] Processing completed', { postId, hlsUrl });
        } else if (status === 'failed') {
            // Processing failed
            updateData.processing_error = error || 'Video processing failed';

            console.error('[VideoCallback] Processing failed', { postId, error });
        } else if (status === 'processing') {
            // Processing started
            console.log('[VideoCallback] Processing started', { postId });
        }

        // Update the post
        await prisma.post.update({
            where: { id: postId },
            data: updateData,
        });

        // Clear caches so fresh data with HLS URLs is served
        if (status === 'completed') {
            try {
                await clearCacheByPattern('all_posts');
                await clearCacheByPattern('single_post');
                await clearCacheByPattern('search_posts');
                await clearCacheByPattern('following_posts');
                console.log('[VideoCallback] Caches cleared after video processing');
            } catch (cacheErr) {
                console.warn('[VideoCallback] Failed to clear cache:', cacheErr.message);
            }
        }

        res.json({
            status: 'success',
            message: 'Video processing status updated',
            postId,
            processingStatus: status,
        });
    } catch (error) {
        console.error('[VideoCallback] Error handling callback:', error);

        res.status(500).json({
            status: 'error',
            message: 'Error processing callback',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};
