const { Approver } = require('../models');

exports.isApprover = async (req, res, next) => {
    try {
        const approver = await Approver.findByPk(req.user.username);
        
        if (!approver) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. Approver privileges required.'
            });
        }
                req.approver = approver;
        next();
    } catch (error) {
        console.error('Approver check error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error checking approver privileges'
        });
    }
}; 