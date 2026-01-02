const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const path = require('path');
const fs = require('fs').promises;

// Set ffmpeg and ffprobe paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

// App name from environment or default
const APP_NAME = process.env.APP_NAME || 'Talynk';

/**
 * Ultra-fast video watermarking using FFmpeg text overlay
 * This is faster than image overlay because it doesn't require creating an image file
 * 
 * @param {string} inputPath - Path to input video file
 * @param {string} outputPath - Path to save watermarked video
 * @param {string} postId - Post ID to include in watermark
 * @returns {Promise<string>} - Path to watermarked video
 */
async function addWatermarkToVideo(inputPath, outputPath, postId) {
    const startTime = Date.now();
    console.log(`[WATERMARK] Starting fast watermarking for Post ID: ${postId}`);
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Get video dimensions for responsive watermark sizing
    let videoWidth = 1920;
    let videoHeight = 1080;
    
    try {
        const dimensions = await getVideoDimensions(inputPath);
        videoWidth = dimensions.width;
        videoHeight = dimensions.height;
    } catch (err) {
        console.warn(`[WATERMARK] Could not get video dimensions, using defaults:`, err.message);
    }

    // Calculate responsive font size (20-28px based on video height)
    const baseFontSize = Math.max(20, Math.min(28, Math.floor(videoHeight * 0.025)));
    
    // Calculate position (bottom-right with padding)
    const paddingX = Math.max(20, Math.floor(videoWidth * 0.02));
    const paddingY = Math.max(20, Math.floor(videoHeight * 0.02));
    
    // Watermark text: "Talynk • Post ID: <post_id>"
    const watermarkText = `${APP_NAME} • Post ID: ${postId}`;
    
    // FFmpeg filter for text overlay with shadow for visibility
    // Using drawtext filter which is faster than image overlay
    const textFilter = `drawtext=text='${watermarkText}':fontcolor=white@0.4:fontsize=${baseFontSize}:x=w-tw-${paddingX}:y=h-th-${paddingY}:shadowcolor=black@0.8:shadowx=2:shadowy=2`;

    return new Promise((resolve, reject) => {
        const ffmpegCommand = ffmpeg(inputPath)
            .videoFilters(textFilter)
            // Ultra-fast encoding settings for speed
            .videoCodec('libx264')
            .outputOptions([
                '-preset ultrafast',        // Fastest encoding preset
                '-tune zerolatency',        // Zero latency tuning
                '-crf 23',                  // Good quality with fast encoding
                '-pix_fmt yuv420p',         // Compatible pixel format
                '-movflags +faststart',     // Web-optimized
                '-threads 0',               // Use all CPU cores
                '-vsync 0',                 // Disable frame sync for speed
                '-async 1'                  // Audio sync
            ])
            .audioCodec('copy')             // Copy audio (no re-encoding = faster)
            .output(outputPath)
            .on('start', (commandLine) => {
                console.log(`[WATERMARK] FFmpeg command: ${commandLine}`);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log(`[WATERMARK] Progress: ${Math.round(progress.percent)}%`);
                }
            })
            .on('end', async () => {
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`[WATERMARK] ✅ Completed in ${duration}s for Post ID: ${postId}`);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error(`[WATERMARK] ❌ FFmpeg error for Post ID ${postId}:`, err.message);
                reject(err);
            });

        ffmpegCommand.run();
    });
}

/**
 * Get video dimensions using ffprobe
 * @param {string} videoPath - Path to video file
 * @returns {Promise<{width: number, height: number}>}
 */
async function getVideoDimensions(videoPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }
            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            if (!videoStream) {
                reject(new Error('No video stream found'));
                return;
            }
            resolve({
                width: videoStream.width,
                height: videoStream.height
            });
        });
    });
}

/**
 * Process video watermarking asynchronously (non-blocking)
 * This allows the post to be created immediately while watermarking happens in background
 * 
 * @param {string} inputPath - Path to original video
 * @param {string} postId - Post ID
 * @param {Function} updateCallback - Callback to update post video_url after watermarking
 */
async function processWatermarkAsync(inputPath, postId, updateCallback) {
    try {
        // Generate output path with watermark
        const inputDir = path.dirname(inputPath);
        const inputExt = path.extname(inputPath);
        const inputName = path.basename(inputPath, inputExt);
        const outputPath = path.join(inputDir, `${inputName}_watermarked${inputExt}`);
        
        // Apply watermark
        await addWatermarkToVideo(inputPath, outputPath, postId);
        
        // Generate new URL for watermarked video
        const watermarkedUrl = `/uploads/${path.basename(outputPath)}`;
        
        // Update post with watermarked video URL
        if (updateCallback) {
            await updateCallback(watermarkedUrl);
        }
        
        // Optionally remove original file to save space
        // Uncomment if you want to delete original after watermarking
        // try {
        //     await fs.unlink(inputPath);
        //     console.log(`[WATERMARK] Removed original file: ${inputPath}`);
        // } catch (err) {
        //     console.warn(`[WATERMARK] Could not remove original file:`, err.message);
        // }
        
    } catch (error) {
        console.error(`[WATERMARK] ❌ Failed to watermark video for Post ID ${postId}:`, error);
        // Don't throw - allow post to remain with original video
    }
}

module.exports = {
    addWatermarkToVideo,
    processWatermarkAsync,
    getVideoDimensions
};
