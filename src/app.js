require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs').promises;
const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const { initRealtime } = require('./lib/realtime');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://putkiapvvlebelkafwbe.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1dGtpYXB2dmxlYmVsa2Fmd2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5OTI5MjQsImV4cCI6MjA2MDU2ODkyNH0.0lkWoaKuYpatk8yyGnFonBOK8qRa-nvspnBYQa0A2dQ';
const supabase = createClient(supabaseUrl, supabaseKey);

// Import routes
const routes = require('./routes');

// Import Prisma client
const prisma = require('./lib/prisma');

const app = express();

// Trust proxy - required when behind reverse proxy (Caddy)
// This ensures Express correctly handles X-Forwarded-* headers
app.set('trust proxy', true);

// Ensure uploads directory exists on startup
async function ensureUploadsDirectory() {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    console.log(`✅ Uploads directory ready: ${uploadsDir}`);
  } catch (error) {
    console.error('Error creating uploads directory:', error.message);
  }
}

// Initialize uploads directory on startup
ensureUploadsDirectory();

// Initialize Supabase bucket check (optional - kept for backward compatibility)
async function checkSupabaseBucket() {
  // Skip Supabase check if using local storage
  if (process.env.USE_LOCAL_STORAGE === 'true') {
    console.log('Using local file storage, skipping Supabase check');
    return;
  }
  
  try {
    const bucketName = process.env.SUPABASE_BUCKET_NAME || 'posts';
    console.log(`Checking Supabase bucket: '${bucketName}'`);
    
    // Check if bucket exists
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error checking Supabase buckets:', error.message);
      return;
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (bucketExists) {
      console.log(`✅ Supabase bucket '${bucketName}' found and ready for use.`);
    } else {
      console.warn(`⚠️ Warning: Bucket '${bucketName}' not found. Please create it manually in the Supabase dashboard.`);
    }
  } catch (error) {
    console.error('Error checking Supabase storage:', error.message);
  }
}

// Check Supabase bucket on startup (optional)
checkSupabaseBucket();

// CORS configuration - must be before other middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 
           'http://127.0.0.1:3001', 'http://192.168.56.1:3001', 
           'https://talynk-user-frontend-git-main-ihirwepatricks-projects.vercel.app', 
           'http://localhost:3000', 'https://talynk-test.vercel.app', 
           'https://talynk-management.vercel.app', 
           'https://talynk-user-frontend-production.up.railway.app', 
           'https://talynk.vercel.app', 'https://talentix.net', 'https://admin.talentix.net'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept', 'Access-Control-Allow-Headers'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Manual CORS headers middleware - runs FIRST to ensure headers are always set
app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    // Debug logging (remove in production)
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[CORS] ${req.method} ${req.path} - Origin: ${origin}`);
    }
    
    // For OPTIONS requests, always set CORS headers
    if (req.method === 'OPTIONS') {
        if (origin && corsOptions.origin.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        res.setHeader('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
        res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
        res.setHeader('Access-Control-Max-Age', '86400');
        
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[CORS] OPTIONS response headers:`, {
                'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
                'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials'),
                'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods')
            });
        }
        
        return res.status(204).end();
    }
    
    // For non-OPTIONS requests, set CORS headers if origin is allowed
    if (origin && corsOptions.origin.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
    
    next();
});

// Apply CORS middleware (as additional layer)
app.use(cors(corsOptions));

// Explicit OPTIONS handler (backup)
app.options('*', (req, res) => {
    const origin = req.headers.origin;
    if (origin && corsOptions.origin.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
});

// Basic middleware - configure helmet to not interfere with CORS
app.use(helmet({
    contentSecurityPolicy: false, // For development only
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false
}));

// Add specific CORS handling for problematic routes (using same config)
app.use('/api/posts/all', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files from uploads directory
app.use('/uploads', (req, res, next) => {
    // Set CORS headers specifically for media files
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    
    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
}, express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use('/api', routes);

// Export Supabase client for use in other files
app.locals.supabase = supabase;

// All routes are now organized in ./routes/index.js

// API root route
app.get('/', (req, res) => {
    res.json({
        status: 'success',
        message: 'Talynk Backend API is running',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            users: '/api/users',
            posts: '/api/posts',
            admin: '/api/admin',
            approver: '/api/approver'
        }
    });
});

// Error Handling Middleware
const notFoundHandler = (req, res) => {
    res.status(404).json({
        status: 'error',
        message: `Route not found - ${req.originalUrl}`
    });
};

const errorHandler = require('./middleware/errorHandler');

app.use(notFoundHandler);
app.use(errorHandler);

// Server setup with port handling
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        const server = http.createServer(app);

        await initRealtime(server, corsOptions.origin);

        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.log(`Port ${PORT} is busy, trying ${PORT + 1}`);
                server.close();
                app.listen(PORT + 1);
            } else {
                console.error('Server error:', error);
            }
        });

        // Handle graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received. Shutting down gracefully...');
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;