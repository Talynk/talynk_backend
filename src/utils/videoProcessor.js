const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Set ffmpeg and ffprobe paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);
console.log('[WATERMARK] Using ffprobe path:', ffprobeInstaller.path);

// Get video dimensions with fallback
async function getVideoDimensions(videoPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                console.error(`[WATERMARK] Error getting video dimensions:`, err);
                reject(err);
                return;
            }
            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            if (!videoStream) {
                reject(new Error('No video stream found'));
                return;
            }
            const width = videoStream.width;
            const height = videoStream.height;
            resolve({ width, height });
        });
    });
}

// Create dynamic watermark image based on video dimensions
async function createWatermarkImage(videoId, videoWidth, videoHeight) {
    // Calculate watermark size based on video dimensions
    const baseWidth = Math.max(300, Math.floor(videoWidth * 0.15)); // 15% of video width, minimum 300px
    const baseHeight = Math.max(80, Math.floor(baseWidth * 0.25)); // 25% of watermark width, minimum 80px
    const maxWidth = Math.floor(videoWidth * 0.4); // Maximum 40% of video width
    const maxHeight = Math.floor(videoHeight * 0.2); // Maximum 20% of video height
    const watermarkWidth = Math.min(baseWidth, maxWidth);
    const watermarkHeight = Math.min(baseHeight, maxHeight);
    const mainFontSize = Math.max(24, Math.floor(watermarkHeight * 0.3));
    const idFontSize = Math.max(14, Math.floor(watermarkHeight * 0.16));
    try {
        const svgBuffer = Buffer.from(`
            <svg width="${watermarkWidth}" height="${watermarkHeight}">
                <defs>
                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="black" flood-opacity="0.8"/>
                    </filter>
                    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:rgba(0,0,0,0.98);stop-opacity:1" />
                        <stop offset="100%" style="stop-color:rgba(0,0,0,1);stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill="url(#bg)" rx="8" ry="8"/>
                <style>
                    .blue-text { fill: #0066ff; font-size: ${mainFontSize}px; font-family: Arial; opacity: 1; font-weight: bold; filter: url(#shadow); }
                    .white-text { fill: white; font-size: ${mainFontSize}px; font-family: Arial; opacity: 1; font-weight: bold; filter: url(#shadow); }
                    .id-text { fill: white; font-size: ${idFontSize}px; font-family: Arial; opacity: 1; filter: url(#shadow); }
                </style>
                <text x="50%" y="40%" text-anchor="middle" dominant-baseline="middle">
                    <tspan class="white-text">Tal</tspan><tspan class="blue-text">ynk</tspan>
                </text>
                <text x="50%" y="75%" text-anchor="middle" dominant-baseline="middle" class="id-text">
                    ID: ${videoId}
                </text>
            </svg>
        `);
        const watermarkPath = path.join(__dirname, '../../uploads/watermark.png');
        await sharp(svgBuffer).png().toFile(watermarkPath);
        return watermarkPath;
    } catch (error) {
        console.error('[WATERMARK] Error creating dynamic watermark, using static fallback.', error);
        // Fallback: use a static PNG watermark (ensure you have this file in your project)
        return path.join(__dirname, 'fallback-watermark.png');
    }
}

// Add watermark to video with robust fallback
async function addWatermarkToVideo(inputBuffer, outputPath, videoId) {
    console.log(`[WATERMARK] Starting watermark process for video ID: ${videoId}`);
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '../../uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    const tempInputPath = path.join(uploadsDir, 'temp_input.mp4');
    await fs.writeFile(tempInputPath, inputBuffer);
    let videoWidth = 1920, videoHeight = 1080;
    try {
        const dims = await getVideoDimensions(tempInputPath);
        videoWidth = dims.width;
        videoHeight = dims.height;
    } catch (err) {
        console.warn('[WATERMARK] Could not get video dimensions, using default 1920x1080');
    }
    let watermarkPath;
    try {
        watermarkPath = await createWatermarkImage(videoId, videoWidth, videoHeight);
    } catch (err) {
        console.warn('[WATERMARK] Could not create dynamic watermark, using static fallback.');
        watermarkPath = path.join(__dirname, 'fallback-watermark.png');
    }
    const paddingX = Math.max(20, Math.floor(videoWidth * 0.02));
    const paddingY = Math.max(20, Math.floor(videoHeight * 0.02));
    return new Promise((resolve, reject) => {
        const ffmpegCommand = ffmpeg(tempInputPath)
            .input(watermarkPath)
            .complexFilter([
                {
                    filter: 'overlay',
                    options: {
                        x: `W-w-${paddingX}`,
                        y: `H-h-${paddingY}`,
                        eof_action: 'repeat'
                    }
                }
            ])
            .outputOptions('-c:v libx264')
            .outputOptions('-preset medium')
            .outputOptions('-crf 18')
            .outputOptions('-pix_fmt yuv420p')
            .outputOptions('-movflags +faststart')
            .output(outputPath);
        ffmpegCommand
            .on('end', async () => {
                try {
                    await Promise.all([
                        fs.unlink(tempInputPath),
                        fs.unlink(watermarkPath)
                    ]);
                } catch {}
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error(`[WATERMARK] FFmpeg error:`, err);
                reject(err);
            })
            .run();
    });
}

module.exports = {
    addWatermarkToVideo
}; 