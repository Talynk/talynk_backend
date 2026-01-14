const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const path = require('path');
const fs = require('fs').promises;
const { processAndUploadMedia } = require('../services/mediaProcessor');

// Set ffmpeg and ffprobe paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

// App name from environment or default
const APP_NAME = process.env.APP_NAME || 'Talynk';

// Logo path for watermark
const LOGO_PATH = path.join(process.cwd(), 'assets', 'logo.png');

/**
 * Add watermark to video using logo and Post ID
 * Uses logo from assets/logo.png and Post ID text below it
 * 
 * @param {string} inputPath - Path to input video file
 * @param {string} outputPath - Path to save watermarked video
 * @param {string} postId - Post ID to include in watermark
 * @returns {Promise<string>} - Path to watermarked video
 */
async function addWatermarkToVideo(inputPath, outputPath, postId) {
    const startTime = Date.now();
    console.log(`[WATERMARK] Starting watermarking with logo for Post ID: ${postId}`);
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });
    
    // Verify logo exists
    try {
        await fs.access(LOGO_PATH);
    } catch (error) {
        throw new Error(`Logo not found at ${LOGO_PATH}. Please ensure assets/logo.png exists.`);
    }

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

    // Calculate logo size (responsive, max 10% of video height, min 80px)
    const logoSize = Math.max(80, Math.min(120, Math.floor(videoHeight * 0.1)));
    
    // Calculate positions (bottom-right for logo and Post ID)
    const padding = 24;
    const logoX = `W-w-${padding}`; // Right edge minus logo width minus padding
    const logoY = `H-h-${padding}`; // Bottom edge minus logo height minus padding
    
    // Post ID text position (below logo, right-aligned with logo)
    const textSpacing = 8; // Space between logo and text
    const textY = `H-th-${padding + logoSize + textSpacing}`; // Below logo
    const textX = `W-tw-${padding}`; // Right-aligned with logo
    
    // Escape Post ID for FFmpeg
    const postIdEscaped = postId.replace(/:/g, '\\:').replace(/'/g, "\\'");
    
    // Calculate font size based on video height
    const fontSize = Math.max(22, Math.min(28, Math.floor(videoHeight * 0.015)));

    return new Promise((resolve, reject) => {
        const ffmpegCommand = ffmpeg(inputPath)
            .input(LOGO_PATH)
            .complexFilter([
                // Scale logo to appropriate size
                `[1:v]scale=${logoSize}:-1[logo]`,
                // Overlay logo (bottom-right)
                `[0:v][logo]overlay=${logoX}:${logoY}[vlogo]`,
                // Draw Post ID text (bottom-left)
                `[vlogo]drawtext=text='Post ID\\: ${postIdEscaped}':fontcolor=white:fontsize=${fontSize}:box=1:boxcolor=black@0.45:x=${textX}:y=${textY}`
            ])
            // Ultra-fast encoding settings for speed
            .videoCodec('libx264')
            .outputOptions([
                '-preset veryfast',        // Fast encoding (as per MEDIA_PIPELINE.md)
                '-crf 27',                 // Quality vs size balance
                '-profile:v high',         // H.264 high profile
                '-level 4.1',              // H.264 level 4.1
                '-pix_fmt yuv420p',        // Compatible pixel format
                '-movflags +faststart',    // Web-optimized
                '-threads 0'               // Use all CPU cores
            ])
            .audioCodec('aac')
            .audioBitrate('128k')
            .output(outputPath)
            .on('start', (commandLine) => {
                console.log(`[WATERMARK] FFmpeg command started for Post ID: ${postId}`);
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
