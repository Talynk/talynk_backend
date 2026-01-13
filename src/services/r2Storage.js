const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;

// R2 Configuration from environment variables
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'talentix';
const R2_ENDPOINT = process.env.R2_ENDPOINT || 'https://59d4da31782ae0bffa374a8824a15d6e.r2.cloudflarestorage.com';
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || 'https://media.talentix.net';
const USE_R2 = process.env.USE_R2 === 'true' || process.env.USE_R2 === '1';

// Initialize S3 client for R2 (R2 is S3-compatible)
let s3Client = null;

if (USE_R2 && R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({
    region: 'auto', // R2 uses 'auto' for region
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true, // Required for R2
  });
  console.log('[R2] R2 storage client initialized');
} else {
  console.warn('[R2] R2 storage not configured. Set USE_R2=true and provide R2 credentials.');
}

/**
 * Upload a file to R2 bucket
 * @param {Buffer|Stream} fileBuffer - File buffer or stream
 * @param {string} originalFileName - Original file name
 * @param {string} mimetype - File MIME type
 * @param {string} folder - Optional folder path in bucket (e.g., 'posts', 'profiles')
 * @returns {Promise<{url: string, key: string}>}
 */
async function uploadToR2(fileBuffer, originalFileName, mimetype, folder = 'media') {
  if (!USE_R2 || !s3Client) {
    throw new Error('R2 storage is not configured. Please set USE_R2=true and provide R2 credentials.');
  }

  try {
    // Generate unique file name
    const fileExt = path.extname(originalFileName);
    const fileName = `${Date.now()}-${uuidv4()}${fileExt}`;
    const key = folder ? `${folder}/${fileName}` : fileName;

    // Determine content type
    const contentType = mimetype || 'application/octet-stream';

    // Upload file to R2
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        // Make file publicly accessible (if bucket is public)
        // ACL: 'public-read', // R2 doesn't use ACL, uses bucket policies instead
      },
    });

    await upload.done();

    // Generate public URL using custom domain
    const publicUrl = `${R2_PUBLIC_DOMAIN}/${key}`;

    console.log(`[R2] File uploaded successfully: ${key}`);
    console.log(`[R2] Public URL: ${publicUrl}`);

    return {
      url: publicUrl,
      key: key,
      bucket: R2_BUCKET_NAME,
    };
  } catch (error) {
    console.error('[R2] Upload error:', error);
    throw new Error(`Failed to upload file to R2: ${error.message}`);
  }
}

/**
 * Upload a file from local path to R2
 * @param {string|Buffer} filePathOrBuffer - Local file path or file buffer
 * @param {string} originalFileName - Original file name
 * @param {string} mimetype - File MIME type
 * @param {string} folder - Optional folder path in bucket
 * @returns {Promise<{url: string, key: string}>}
 */
async function uploadFileToR2(filePathOrBuffer, originalFileName, mimetype, folder = 'media') {
  try {
    let fileBuffer;
    
    // Check if it's a buffer or a file path
    if (Buffer.isBuffer(filePathOrBuffer)) {
      fileBuffer = filePathOrBuffer;
    } else {
      // Read file from local path
      fileBuffer = await fs.readFile(filePathOrBuffer);
    }
    
    return await uploadToR2(fileBuffer, originalFileName, mimetype, folder);
  } catch (error) {
    console.error('[R2] Error processing file:', error);
    throw new Error(`Failed to process file: ${error.message}`);
  }
}

/**
 * Delete a file from R2 bucket
 * @param {string} key - File key in R2 bucket
 * @returns {Promise<void>}
 */
async function deleteFromR2(key) {
  if (!USE_R2 || !s3Client) {
    throw new Error('R2 storage is not configured.');
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    console.log(`[R2] File deleted successfully: ${key}`);
  } catch (error) {
    console.error('[R2] Delete error:', error);
    throw new Error(`Failed to delete file from R2: ${error.message}`);
  }
}

/**
 * Extract key from R2 URL
 * @param {string} url - R2 public URL
 * @returns {string|null} - File key or null if not a valid R2 URL
 */
function extractKeyFromUrl(url) {
  if (!url) return null;
  
  // Check if URL contains the public domain
  if (url.includes(R2_PUBLIC_DOMAIN)) {
    const parts = url.split(R2_PUBLIC_DOMAIN + '/');
    return parts.length > 1 ? parts[1] : null;
  }
  
  // Check if URL contains the bucket name (for direct R2 URLs)
  if (url.includes(R2_BUCKET_NAME)) {
    const parts = url.split(R2_BUCKET_NAME + '/');
    return parts.length > 1 ? parts[1] : null;
  }
  
  return null;
}

/**
 * Check if R2 is configured and available
 * @returns {boolean}
 */
function isR2Configured() {
  return USE_R2 && s3Client !== null;
}

module.exports = {
  uploadToR2,
  uploadFileToR2,
  deleteFromR2,
  extractKeyFromUrl,
  isR2Configured,
  R2_PUBLIC_DOMAIN,
  R2_BUCKET_NAME,
};
