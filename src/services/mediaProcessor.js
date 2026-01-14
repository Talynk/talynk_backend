/**
 * Lightweight TikTok-Optimized Media Processing Pipeline
 * Based on MEDIA_PIPELINE.md specifications
 * 
 * Features:
 * - Logo watermark (bottom-right)
 * - Post ID text below logo
 * - TikTok-optimized (9:16, 1080x1920, 30fps)
 * - Non-blocking FFmpeg processing
 * - Cloudflare R2 upload support
 */

const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const path = require('path');
const fs = require('fs').promises;
const { uploadFileToR2, isR2Configured } = require('./r2Storage');

// Set FFmpeg paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

// Paths
const LOGO_PATH = path.join(process.cwd(), 'assets', 'logo.png');
const TMP_UPLOADS_DIR = path.join(process.cwd(), 'tmp', 'uploads');
const TMP_PROCESSED_DIR = path.join(process.cwd(), 'tmp', 'processed');

// Ensure temp directories exist
(async () => {
  try {
    await fs.mkdir(TMP_UPLOADS_DIR, { recursive: true });
    await fs.mkdir(TMP_PROCESSED_DIR, { recursive: true });
  } catch (error) {
    console.error('[MEDIA] Failed to create temp directories:', error);
  }
})();

/**
 * Get video metadata using ffprobe
 * @param {string} videoPath - Path to video file
 * @returns {Promise<{width: number, height: number, fps: string, codec: string}>}
 */
async function getVideoMetadata(videoPath) {
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
      
      // Parse FPS (can be in format like "30/1" or "29.97")
      const fps = videoStream.r_frame_rate || '30/1';
      const [num, den] = fps.split('/').map(Number);
      const fpsValue = den ? (num / den).toFixed(2) : fps;
      
      resolve({
        width: videoStream.width,
        height: videoStream.height,
        fps: fpsValue,
        codec: videoStream.codec_name,
        duration: metadata.format.duration
      });
    });
  });
}

/**
 * Process video with TikTok optimization and watermark
 * @param {string} inputPath - Path to input video
 * @param {string} postId - Post ID for watermark
 * @param {string} outputPath - Path to save processed video
 * @returns {Promise<string>} - Path to processed video
 */
async function processVideo(inputPath, postId, outputPath) {
  const startTime = Date.now();
  console.log(`[MEDIA] Processing video for Post ID: ${postId}`);
  
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });
  
  // Verify logo exists
  try {
    await fs.access(LOGO_PATH);
    const logoStats = await fs.stat(LOGO_PATH);
    console.log(`[MEDIA] Logo found at ${LOGO_PATH} (${logoStats.size} bytes)`);
  } catch (error) {
    console.error(`[MEDIA] ❌ Logo not found at ${LOGO_PATH}`);
    throw new Error(`Logo not found at ${LOGO_PATH}. Please ensure assets/logo.png exists.`);
  }
  
  // Get video metadata
  let metadata;
  try {
    metadata = await getVideoMetadata(inputPath);
    console.log(`[MEDIA] Video metadata: ${metadata.width}x${metadata.height}, ${metadata.fps}fps, ${metadata.codec}`);
  } catch (error) {
    console.warn(`[MEDIA] Could not get video metadata, using defaults:`, error.message);
    metadata = { width: 1080, height: 1920, fps: '30' };
  }
  
  // Calculate logo size (responsive, max 10% of video height)
  const logoHeight = Math.min(120, Math.floor(metadata.height * 0.1));
  const logoWidth = logoHeight; // Assuming square logo, adjust if needed
  
  // Calculate positions (bottom-right corner with padding)
  // After scaling, video will be 1080x1920
  const targetWidth = 1080;
  const targetHeight = 1920;
  const padding = 24;
  const textSpacing = 8; // Space between logo and text
  const textFontSize = 28;
  
  // Logo position (bottom-right) - using FFmpeg expressions
  // W = width (1080), w = logo width, H = height (1920), h = logo height
  const logoX = `W-w-${padding}`; // Right edge minus logo width minus padding
  const logoY = `H-h-${padding}`; // Bottom edge minus logo height minus padding
  
  // Post ID text position (below logo, right-aligned with logo)
  // Since we can't reference logo height (h) in drawtext, we use a calculated pixel value
  // Logo bottom: targetHeight - logoHeight - padding
  // Text top: Logo bottom + spacing = targetHeight - logoHeight - padding + spacing
  // But we need to account for text height, so we position from bottom:
  // textY (top of text) = targetHeight - logoHeight - padding - spacing - estimatedTextHeight
  // Estimated text height for fontsize 28 is approximately 35-40 pixels
  const estimatedTextHeight = 35;
  const textYPixel = targetHeight - logoHeight - padding - textSpacing - estimatedTextHeight;
  // Use pixel value for text Y position
  const textY = textYPixel.toString();
  // Text X: right-aligned with logo (same right edge)
  const textX = `W-tw-${padding}`; // Right edge minus text width minus padding
  
  // Escape Post ID for FFmpeg
  const postIdEscaped = postId.replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/"/g, '\\"');
  
  // Build complex filter chain
  // Using FFmpeg expressions for dynamic positioning
  const filterChain = [
    // Scale and pad video to TikTok format (9:16, 1080x1920)
    `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30[video]`,
    // Scale logo to appropriate size (maintain aspect ratio)
    `[1:v]scale=${logoWidth}:-1[logo]`,
    // Overlay logo on video (bottom-right corner)
    // W = output width (1080), w = logo width, H = output height (1920), h = logo height
    `[video][logo]overlay=${logoX}:${logoY}[vlogo]`,
    // Draw Post ID text on top of logo overlay (below logo, right-aligned)
    // tw = text width, th = text height
    `[vlogo]drawtext=text='Post ID\\: ${postIdEscaped}':fontcolor=white:fontsize=${textFontSize}:box=1:boxcolor=black@0.45:x=${textX}:y=${textY}`
  ];
  
  return new Promise((resolve, reject) => {
    const ffmpegCommand = ffmpeg(inputPath)
      .input(LOGO_PATH)
      .inputOptions(['-loop', '1']) // Loop logo for entire video duration
      .complexFilter(filterChain)
      .videoCodec('libx264')
      .outputOptions([
        '-preset veryfast',        // Fast encoding (as per MEDIA_PIPELINE.md)
        '-crf 27',                 // Quality vs size balance
        '-profile:v high',         // H.264 high profile
        '-level 4.1',              // H.264 level 4.1
        '-pix_fmt yuv420p',        // Compatible pixel format
        '-movflags +faststart',    // Web-optimized (streaming ready)
        '-threads 0'               // Use all CPU cores
      ])
      .audioCodec('aac')
      .audioBitrate('128k')
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log(`[MEDIA] FFmpeg command started for Post ID: ${postId}`);
        console.log(`[MEDIA] FFmpeg command: ${commandLine}`);
        console.log(`[MEDIA] Logo path: ${LOGO_PATH}`);
        console.log(`[MEDIA] Logo size: ${logoWidth}x${logoHeight}`);
        console.log(`[MEDIA] Logo position: (${logoX}, ${logoY})`);
        console.log(`[MEDIA] Text position: (${textX}, ${textY})`);
        console.log(`[MEDIA] Filter chain: ${filterChain.join('; ')}`);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`[MEDIA] Progress: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', async () => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[MEDIA] ✅ Video processed in ${duration}s for Post ID: ${postId}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`[MEDIA] ❌ FFmpeg error for Post ID ${postId}:`, err.message);
        reject(err);
      });
    
    ffmpegCommand.run();
  });
}

/**
 * Process image with watermark
 * @param {string} inputPath - Path to input image
 * @param {string} postId - Post ID for watermark
 * @param {string} outputPath - Path to save processed image
 * @returns {Promise<string>} - Path to processed image
 */
async function processImage(inputPath, postId, outputPath) {
  const startTime = Date.now();
  console.log(`[MEDIA] Processing image for Post ID: ${postId}`);
  
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });
  
  // Verify logo exists
  try {
    await fs.access(LOGO_PATH);
  } catch (error) {
    throw new Error(`Logo not found at ${LOGO_PATH}. Please ensure assets/logo.png exists.`);
  }
  
  // Escape Post ID for FFmpeg
  const postIdEscaped = postId.replace(/:/g, '\\:').replace(/'/g, "\\'");
  
  // Calculate logo and text positions
  const padding = 20;
  const logoSize = 80; // Fixed logo size for images
  const textSpacing = 8; // Space between logo and text
  
  return new Promise((resolve, reject) => {
    const ffmpegCommand = ffmpeg(inputPath)
      .input(LOGO_PATH)
      .complexFilter([
        // Scale image (max width 1080px, maintain aspect ratio)
        `[0:v]scale='min(1080,iw)':-2[scaled]`,
        // Scale logo
        `[1:v]scale=${logoSize}:-1[logo]`,
        // Overlay logo (bottom-right)
        `[scaled][logo]overlay=W-w-${padding}:H-h-${padding}[vlogo]`,
        // Draw Post ID text (below logo, right-aligned)
        `[vlogo]drawtext=text='Post ID\\: ${postIdEscaped}':fontcolor=white:fontsize=22:box=1:boxcolor=black@0.45:x=W-tw-${padding}:y=H-th-${padding + logoSize + textSpacing}`
      ])
      .outputOptions([
        '-quality 80',             // WebP quality (as per MEDIA_PIPELINE.md)
        '-compression_level 6'
      ])
      .format('webp')
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log(`[MEDIA] FFmpeg command started for image Post ID: ${postId}`);
      })
      .on('end', async () => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[MEDIA] ✅ Image processed in ${duration}s for Post ID: ${postId}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`[MEDIA] ❌ FFmpeg error for image Post ID ${postId}:`, err.message);
        reject(err);
      });
    
    ffmpegCommand.run();
  });
}

/**
 * Process media file (video or image) with watermark and upload to R2
 * @param {string} inputPath - Path to input file (local or R2 URL)
 * @param {string} postId - Post ID
 * @param {string} mimetype - File MIME type
 * @param {boolean} isFromR2 - Whether file is from R2 (needs download first)
 * @returns {Promise<{url: string, key: string}>} - R2 URL and key
 */
async function processAndUploadMedia(inputPath, postId, mimetype, isFromR2 = false) {
  try {
    let localInputPath = inputPath;
    
    // If file is from R2, we need to download it first for processing
    // Note: For R2 files, we'd need to implement download functionality
    // For now, we'll skip processing if file is already in R2
    if (isFromR2) {
      console.log(`[MEDIA] Skipping processing for R2 file (requires download implementation)`);
      // Return original R2 URL
      return { url: inputPath, key: null };
    }
    
    // Determine if it's video or image
    const isVideo = mimetype.startsWith('video/');
    const isImage = mimetype.startsWith('image/');
    
    if (!isVideo && !isImage) {
      throw new Error(`Unsupported media type: ${mimetype}`);
    }
    
    // Generate output path
    const inputExt = path.extname(inputPath);
    const outputExt = isVideo ? '.mp4' : '.webp';
    const outputFilename = `${postId}_processed${outputExt}`;
    const outputPath = path.join(TMP_PROCESSED_DIR, outputFilename);
    
    // Process media
    if (isVideo) {
      await processVideo(localInputPath, postId, outputPath);
    } else {
      await processImage(localInputPath, postId, outputPath);
    }
    
    // Upload to R2
    if (isR2Configured()) {
      const result = await uploadFileToR2(
        outputPath,
        outputFilename,
        isVideo ? 'video/mp4' : 'image/webp',
        'media'
      );
      
      // Clean up temporary processed file
      try {
        await fs.unlink(outputPath);
        console.log(`[MEDIA] Cleaned up temporary file: ${outputPath}`);
      } catch (error) {
        console.warn(`[MEDIA] Could not delete temporary file:`, error.message);
      }
      
      return result;
    } else {
      // Fallback to local storage
      const localUrl = `/uploads/${outputFilename}`;
      // Move file to uploads directory
      const uploadsPath = path.join(process.cwd(), 'uploads', outputFilename);
      await fs.copyFile(outputPath, uploadsPath);
      await fs.unlink(outputPath);
      
      return { url: localUrl, key: null };
    }
    
  } catch (error) {
    console.error(`[MEDIA] ❌ Failed to process media for Post ID ${postId}:`, error);
    throw error;
  }
}

module.exports = {
  processVideo,
  processImage,
  processAndUploadMedia,
  getVideoMetadata
};
