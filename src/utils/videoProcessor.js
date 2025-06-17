const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Create watermark image
async function createWatermarkImage(videoId) {
    const watermarkText = 'Talynk';
    const width = 500;  // Increased from 400 to add padding
    const height = 120;
    const padding = 50; // Padding on each side
    
    // Create a semi-transparent watermark with two-tone colors and background
    const svgBuffer = Buffer.from(`
        <svg width="${width}" height="${height}">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:rgba(0,0,0,0.7);stop-opacity:1" />
                    <stop offset="100%" style="stop-color:rgba(0,0,0,0.8);stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="url(#bg)" rx="10" ry="10"/>
            <style>
                .blue-text { fill: #0066ff; font-size: 42px; font-family: Arial; opacity: 1; font-weight: bold; }
                .white-text { fill: white; font-size: 42px; font-family: Arial; opacity: 1; font-weight: bold; }
                .id-text { fill: white; font-size: 24px; font-family: Arial; opacity: 1; }
            </style>
            <text x="50%" y="40%" text-anchor="middle" dominant-baseline="middle">
                <tspan class="blue-text">Tal</tspan><tspan class="white-text">ynk</tspan>
            </text>
            <text x="50%" y="75%" text-anchor="middle" dominant-baseline="middle" class="id-text">
                ID: ${videoId}
            </text>
        </svg>
    `);

    const watermarkPath = path.join(__dirname, '../../uploads/watermark.png');
    
    // Convert SVG to PNG
    await sharp(svgBuffer)
        .png()
        .toFile(watermarkPath);
    
    return watermarkPath;
}

// Add watermark to video
async function addWatermarkToVideo(inputBuffer, outputPath, videoId) {
    try {
        // Create watermark image with video ID
        const watermarkPath = await createWatermarkImage(videoId);
        
        // Create temporary input file
        const tempInputPath = path.join(__dirname, '../../uploads/temp_input.mp4');
        await fs.writeFile(tempInputPath, inputBuffer);
        
        return new Promise((resolve, reject) => {
            ffmpeg(tempInputPath)
                .input(watermarkPath)
                .complexFilter([
                    {
                        filter: 'overlay',
                        options: {
                            x: 'W-w-30', // 30 pixels from right
                            y: 'H-h-30',  // 30 pixels from bottom
                            format: 'rgb'  // Ensure proper color handling
                        }
                    }
                ])
                .output(outputPath)
                .on('end', async () => {
                    // Clean up temporary files
                    try {
                        await fs.unlink(tempInputPath);
                        await fs.unlink(watermarkPath);
                        resolve(outputPath);
                    } catch (error) {
                        console.error('Error cleaning up temporary files:', error);
                        resolve(outputPath); // Still resolve even if cleanup fails
                    }
                })
                .on('error', (err) => {
                    reject(err);
                })
                .run();
        });
    } catch (error) {
        throw new Error(`Error adding watermark to video: ${error.message}`);
    }
}

module.exports = {
    addWatermarkToVideo
}; 