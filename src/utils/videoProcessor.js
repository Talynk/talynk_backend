const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Create watermark image
async function createWatermarkImage(videoId) {
    console.log(`[WATERMARK] Creating watermark for video ID: ${videoId}`);
    
    const watermarkText = 'Talynk';
    const width = 600;
    const height = 150;
    const padding = 100;
    
    try {
        // Create a watermark with solid background and enhanced colors
        const svgBuffer = Buffer.from(`
            <svg width="${width}" height="${height}">
                <defs>
                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="black" flood-opacity="0.8"/>
                    </filter>
                    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:rgba(0,0,0,0.98);stop-opacity:1" />
                        <stop offset="100%" style="stop-color:rgba(0,0,0,1);stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill="url(#bg)" rx="10" ry="10"/>
                <style>
                    .blue-text { fill: #0066ff; font-size: 42px; font-family: Arial; opacity: 1; font-weight: bold; filter: url(#shadow); }
                    .white-text { fill: white; font-size: 42px; font-family: Arial; opacity: 1; font-weight: bold; filter: url(#shadow); }
                    .id-text { fill: white; font-size: 24px; font-family: Arial; opacity: 1; filter: url(#shadow); }
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
        
        // Convert SVG to PNG with enhanced settings for better color preservation
        await sharp(svgBuffer)
            .png()
            .toFile(watermarkPath);
        
        console.log(`[WATERMARK] Watermark image created successfully at: ${watermarkPath}`);
        return watermarkPath;
    } catch (error) {
        console.error(`[WATERMARK] Error creating watermark image:`, error);
        throw error;
    }
}

// Add watermark to video
async function addWatermarkToVideo(inputBuffer, outputPath, videoId) {
    console.log(`[WATERMARK] Starting watermark process for video ID: ${videoId}`);
    console.log(`[WATERMARK] Input buffer size: ${inputBuffer.length} bytes`);
    console.log(`[WATERMARK] Output path: ${outputPath}`);
    
    try {
        // Create watermark image with video ID
        const watermarkPath = await createWatermarkImage(videoId);
        
        // Create temporary input file
        const tempInputPath = path.join(__dirname, '../../uploads/temp_input.mp4');
        console.log(`[WATERMARK] Writing input buffer to temp file: ${tempInputPath}`);
        await fs.writeFile(tempInputPath, inputBuffer);
        
        // Check if temp file was created successfully
        const tempFileStats = await fs.stat(tempInputPath);
        console.log(`[WATERMARK] Temp input file size: ${tempFileStats.size} bytes`);
        
        return new Promise((resolve, reject) => {
            console.log(`[WATERMARK] Starting ffmpeg processing...`);
            
            const ffmpegCommand = ffmpeg(tempInputPath)
                .input(watermarkPath)
                .complexFilter([
                    {
                        filter: 'overlay',
                        options: {
                            x: 'W-w-30',
                            y: 'H-h-30',
                            eof_action: 'repeat'  // Repeat watermark throughout the video
                        }
                    }
                ])
                .outputOptions('-c:v libx264')  // Ensure proper video codec
                .outputOptions('-preset medium')  // Better quality encoding
                .outputOptions('-crf 18')       // Higher quality
                .outputOptions('-pix_fmt yuv420p')  // Ensure compatibility
                .outputOptions('-movflags +faststart')  // Optimize for streaming
                .output(outputPath);
            
            ffmpegCommand
                .on('start', (commandLine) => {
                    console.log(`[WATERMARK] FFmpeg command: ${commandLine}`);
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        console.log(`[WATERMARK] Processing progress: ${progress.percent.toFixed(1)}% done`);
                    }
                })
                .on('end', async () => {
                    console.log(`[WATERMARK] FFmpeg processing completed successfully`);
                    
                    // Verify output file was created
                    try {
                        const outputStats = await fs.stat(outputPath);
                        console.log(`[WATERMARK] Output file size: ${outputStats.size} bytes`);
                        
                        // Clean up temporary files
                        await Promise.all([
                            fs.unlink(tempInputPath),
                            fs.unlink(watermarkPath)
                        ]);
                        console.log(`[WATERMARK] Temporary files cleaned up`);
                        
                        resolve(outputPath);
                    } catch (error) {
                        console.error(`[WATERMARK] Error verifying output or cleanup:`, error);
                        resolve(outputPath); // Still resolve even if cleanup fails
                    }
                })
                .on('error', (err) => {
                    console.error(`[WATERMARK] FFmpeg error:`, err);
                    console.error(`[WATERMARK] FFmpeg stderr:`, err.stderr);
                    reject(err);
                })
                .run();
        });
    } catch (error) {
        console.error(`[WATERMARK] Error in addWatermarkToVideo:`, error);
        throw new Error(`Error adding watermark to video: ${error.message}`);
    }
}

module.exports = {
    addWatermarkToVideo
}; 