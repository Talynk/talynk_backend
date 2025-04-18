require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://putkiapvvlebelkafwbe.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1dGtpYXB2dmxlYmVsa2Fmd2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5OTI5MjQsImV4cCI6MjA2MDU2ODkyNH0.0lkWoaKuYpatk8yyGnFonBOK8qRa-nvspnBYQa0A2dQ';
const supabase = createClient(supabaseUrl, supabaseKey);

// Import routes
const routes = require('./routes');

// Import database and associations
const dbConnection = require('./config/database');
require('./models/associations');

const app = express();

// Initialize Supabase bucket check
async function checkSupabaseBucket() {
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

// Check Supabase bucket on startup
checkSupabaseBucket();

// Basic middleware
app.use(helmet({
    contentSecurityPolicy: false // For development only
}));
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://127.0.0.1:3001', 'http://192.168.56.1:3001', 'https://talynk-user-frontend-git-main-ihirwepatricks-projects.vercel.app/', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
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

// API Routes
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const approverRoutes = require('./routes/approver.routes');
const postsRoutes = require('./routes/posts.routes');
const postRoutes = require('./routes/post');

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/approver', approverRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/post', postRoutes);

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle SPA routing - send index.html for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
        // Check if port is in use
        const server = app.listen(PORT, () => {
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