const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
// const { addWatermarkToVideo } = require('../utils/videoProcessor'); // No longer used here
const os = require('os');
const fs = require('fs').promises;

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

// Middleware to handle file upload to Supabase (no watermarking)
const handleSupabaseUpload = async (req, res, next) => {
  try {
    // Skip if no file uploaded
    if (!req.file) {
      console.log('[UPLOAD] No file uploaded, skipping processing');
      return next();
    }

    console.log(`[UPLOAD] Processing file: ${req.file.originalname}`);
    console.log(`[UPLOAD] File size: ${req.file.size} bytes`);
    console.log(`[UPLOAD] File mimetype: ${req.file.mimetype}`);

    // Get supabase instance from app.locals
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
      console.error('[UPLOAD] Supabase client not available');
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
    // No watermarking here!
    
    console.log(`[UPLOAD] Uploading to Supabase bucket: ${bucketName}`);
    console.log(`[UPLOAD] File path: ${filePath}`);
    
    // Upload file to Supabase with retry logic
    let uploadAttempts = 0;
    const maxAttempts = 3;
    let uploadError = null;
    
    while (uploadAttempts < maxAttempts) {
      try {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .upload(filePath, fileBuffer, {
            contentType: file.mimetype,
            upsert: false
          });

        if (error) {
          uploadError = error;
          uploadAttempts++;
          console.log(`[UPLOAD] Attempt ${uploadAttempts} failed:`, error.message);
          
          if (uploadAttempts < maxAttempts) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * uploadAttempts));
            continue;
          }
        } else {
          uploadError = null;
          break;
        }
      } catch (err) {
        uploadError = err;
        uploadAttempts++;
        console.log(`[UPLOAD] Attempt ${uploadAttempts} failed with exception:`, err.message);
        
        if (uploadAttempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * uploadAttempts));
          continue;
        }
      }
    }

    if (uploadError) {
      console.error('[UPLOAD] All upload attempts failed:', uploadError);
      return res.status(500).json({
        status: 'error',
        message: 'Error uploading file to storage after multiple attempts',
        details: uploadError.message
      });
    }

    // Get public URL 
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
      
    console.log('[UPLOAD] File uploaded successfully to Supabase:', urlData.publicUrl);
    
    // Add file info to request
    req.file.filename = fileName;
    req.file.path = filePath;
    req.file.supabaseUrl = urlData.publicUrl;
    
    console.log('[UPLOAD] File processing completed successfully');
    next();
  } catch (error) {
    console.error('[UPLOAD] File upload error:', error);
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