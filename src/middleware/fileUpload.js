const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const os = require('os');

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
(async () => {
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    console.log('[UPLOAD] Uploads directory ready:', uploadsDir);
  } catch (error) {
    console.error('[UPLOAD] Failed to create uploads directory:', error);
  }
})();

// Configure multer to use disk storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}-${uuidv4()}${fileExt}`;
    cb(null, fileName);
  }
});

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

// Middleware to handle local file upload
const handleLocalUpload = async (req, res, next) => {
  try {
    // Skip if no file uploaded
    if (!req.file) {
      console.log('[UPLOAD] No file uploaded, skipping processing');
      return next();
    }

    console.log(`[UPLOAD] Processing file: ${req.file.originalname}`);
    console.log(`[UPLOAD] File size: ${req.file.size} bytes`);
    console.log(`[UPLOAD] File mimetype: ${req.file.mimetype}`);
    console.log(`[UPLOAD] File saved to: ${req.file.path}`);

    // Generate local URL (relative to server root)
    const fileName = req.file.filename;
    const localUrl = `/uploads/${fileName}`;
    
    console.log('[UPLOAD] File uploaded successfully to local storage:', localUrl);
    
    // Add file info to request (maintain compatibility with existing code)
    req.file.filename = fileName;
    req.file.path = `uploads/${fileName}`;
    req.file.localUrl = localUrl;
    req.file.supabaseUrl = localUrl; // Keep for backward compatibility
    
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

// Middleware that combines multer and local file upload
const uploadMiddleware = {
  single: (fieldName) => [upload.single(fieldName), handleLocalUpload],
  array: (fieldName, maxCount) => [upload.array(fieldName, maxCount), handleLocalUpload],
  fields: (fields) => [upload.fields(fields), handleLocalUpload]
};

module.exports = uploadMiddleware; 