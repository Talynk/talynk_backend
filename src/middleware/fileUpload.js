const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const sharp = require('sharp');
const os = require('os');
const fs = require('fs').promises;

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Configure multer to use memory storage
const storage = multer.memoryStorage();

// Filter function for file types
const fileFilter = (req, file, cb) => {
  // Accept images and videos
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed!'), false);
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: fileFilter
});

// Function to add watermark to video
async function addWatermarkToVideo(inputBuffer, videoId) {
    const watermarkText = 'Talynk';
    const width = 200;
    const height = 50;
    
    // Create watermark SVG
    const svgBuffer = Buffer.from(`
        <svg width="${width}" height="${height}">
            <style>
                .watermark { fill: white; font-size: 24px; font-family: Arial; opacity: 0.7; }
            </style>
            <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="watermark">
                ${watermarkText}
            </text>
        </svg>
    `);

    // Create temporary directory
    const tempDir = path.join(os.tmpdir(), 'talynk-watermark');
    await fs.mkdir(tempDir, { recursive: true });

    const tempInputPath = path.join(tempDir, 'input.mp4');
    const watermarkPath = path.join(tempDir, 'watermark.png');
    const outputPath = path.join(tempDir, 'output.mp4');

    try {
        // Save input buffer to temp file
        await fs.writeFile(tempInputPath, inputBuffer);
        
        // Convert SVG to PNG
        await sharp(svgBuffer).png().toFile(watermarkPath);
        
        // Process video with watermark
        await new Promise((resolve, reject) => {
            ffmpeg(tempInputPath)
                .input(watermarkPath)
                .complexFilter([
                    {
                        filter: 'overlay',
                        options: {
                            x: 'W-w-10', // 10 pixels from right
                            y: 'H-h-10'  // 10 pixels from bottom
                        }
                    }
                ])
                .output(outputPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });
        
        // Read the processed video
        const processedBuffer = await fs.readFile(outputPath);
        
        // Cleanup
        await Promise.all([
            fs.unlink(tempInputPath),
            fs.unlink(watermarkPath),
            fs.unlink(outputPath)
        ]);
        
        return processedBuffer;
    } catch (error) {
        console.error('Watermarking failed:', error);
        return inputBuffer; // Return original buffer if watermarking fails
    }
}

// Middleware to handle file upload to Supabase
const handleSupabaseUpload = async (req, res, next) => {
  try {
    // Skip if no file uploaded
    if (!req.file) {
      return next();
    }

    // Get supabase instance from app.locals
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
      console.error('Supabase client not available');
      return res.status(500).json({
        status: 'error',
        message: 'Storage service unavailable'
      });
    }

    const file = req.file;
    const bucketName = process.env.SUPABASE_BUCKET_NAME || 'posts';
    
    // Generate unique file path
    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}-${uuidv4()}${fileExt}`;
    const filePath = `uploads/${fileName}`;

    let fileBuffer = file.buffer;
    
    // If it's a video, add watermark
    if (file.mimetype.startsWith('video/')) {
      console.log('Processing video with watermark...');
      const videoId = uuidv4(); // Generate a unique ID for the video
      fileBuffer = await addWatermarkToVideo(file.buffer, videoId);
      console.log('Watermark processing completed');
    }
    
    // Upload file to Supabase
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error uploading file to storage',
        details: error.message
      });
    }

    // Get public URL 
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
      
    console.log('File uploaded successfully to Supabase:', urlData.publicUrl);
    
    // Add file info to request
    req.file.filename = fileName;
    req.file.path = filePath;
    req.file.supabaseUrl = urlData.publicUrl;
    
    next();
  } catch (error) {
    console.error('File upload error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'File upload failed',
      details: error.message
    });
  }
};

// Middleware that combines multer and Supabase upload
const uploadMiddleware = {
  single: (fieldName) => [upload.single(fieldName), handleSupabaseUpload],
  array: (fieldName, maxCount) => [upload.array(fieldName, maxCount), handleSupabaseUpload],
  fields: (fields) => [upload.fields(fields), handleSupabaseUpload]
};

module.exports = uploadMiddleware; 