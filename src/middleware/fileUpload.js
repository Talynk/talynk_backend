const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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
    
    // Upload file to Supabase
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file.buffer, {
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