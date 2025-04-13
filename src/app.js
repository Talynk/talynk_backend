require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

// Import routes
const routes = require('./routes');

// Import database and associations
const dbConnection = require('./config/database');
require('./models/associations');

const app = express();

// Basic middleware
app.use(helmet({
    contentSecurityPolicy: false // For development only
}));
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://127.0.0.1:3001'],
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
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use('/api', routes);

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