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
    const width = 300;  // Increased from 200
    const height = 80;  // Increased from 50
    
    // Create a semi-transparent watermark with two-tone colors
    const svgBuffer = Buffer.from(`
        <svg width="${width}" height="${height}">
            <style>
                .blue-text { fill: #0066ff; font-size: 32px; font-family: Arial; opacity: 0.8; }
                .white-text { fill: white; font-size: 32px; font-family: Arial; opacity: 0.8; }
                .id-text { fill: white; font-size: 16px; font-family: Arial; opacity: 0.6; }
            </style>
            <text x="50%" y="40%" text-anchor="middle" dominant-baseline="middle">
                <tspan class="blue-text">Tal</tspan><tspan class="white-text">ynk</tspan>
            </text>
            <text x="50%" y="70%" text-anchor="middle" dominant-baseline="middle" class="id-text">
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
                            x: 'W-w-20', // 20 pixels from right
                            y: 'H-h-20'  // 20 pixels from bottom
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