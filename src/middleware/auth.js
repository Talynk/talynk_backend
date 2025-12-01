const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        console.log(authHeader)
        
        // Check if header exists and has correct format
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                status: 'error',
                message: 'No token provided or invalid token format'
            });
        }

        // Get token from Bearer string
        const token = authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                status: 'error',
                message: 'No token provided'
            });
        }

        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Check if account is frozen
            if (decoded.status === 'frozen') {
                return res.status(403).json({
                    status: 'error',
                    message: 'Your account has been frozen. Please contact support for assistance.'
                });
            }
            
            // Add user info to request
            req.user = decoded;
            
            next();
        } catch (jwtError) {
            console.log("error verifying ", jwtError);
            
            return res.status(401).json({
                status: 'error',
                message: 'Invalid or expired token'
            });
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error during authentication'
        });
    }
};

const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }
        next();
    };
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                user: req.user,
                status: 'error',
                message: 'Authentication required'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Not authorized to access this route'
            });
        }

        next();
    };
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            status: 'error',
            message: 'Access denied. Admin privileges required.'
        });
    }
    next();
};

const isApprover = (req, res, next) => {
    if (!req.user || req.user.role !== 'approver') {
        return res.status(403).json({
            status: 'error',
            message: 'Approver access required'

        });
    }
    next();
};

/**
 * Optional authentication middleware
 * Sets req.user if token is valid, but doesn't fail if token is missing or invalid
 * Used for endpoints that should work for both authenticated and unauthenticated users
 */
const optionalAuthenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        // If no auth header, continue without setting req.user
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            req.user = undefined;
            return next();
        }

        const token = authHeader.split(' ')[1];
        
        if (!token) {
            req.user = undefined;
            return next();
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Check if account is frozen - this should still fail
            if (decoded.status === 'frozen') {
                return res.status(403).json({
                    status: 'error',
                    message: 'Your account has been frozen. Please contact support for assistance.'
                });
            }
            
            req.user = decoded;
            next();
        } catch (jwtError) {
            // Token invalid or expired - continue without authentication
            req.user = undefined;
            next();
        }
    } catch (error) {
        // On any error, continue without authentication
        req.user = undefined;
        next();
    }
};

module.exports = {
    authenticate,
    requireRole,
    authorize,
    isAdmin,
    isApprover,
    optionalAuthenticate
}; 