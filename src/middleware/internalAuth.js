/**
 * Internal API Middleware
 * Authenticates requests using an internal API key
 */

exports.authenticateInternalAPI = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            status: 'error',
            message: 'Missing Authorization header',
        });
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader;

    const internalApiKey = process.env.INTERNAL_API_KEY;

    if (!internalApiKey) {
        console.error('[InternalAuth] INTERNAL_API_KEY not configured');
        return res.status(500).json({
            status: 'error',
            message: 'Internal API key not configured',
        });
    }

    if (token !== internalApiKey) {
        console.warn('[InternalAuth] Invalid API key attempt');
        return res.status(403).json({
            status: 'error',
            message: 'Invalid API key',
        });
    }

    // Authentication successful
    next();
};
