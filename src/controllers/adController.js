const Ad = require('../models/Ad.js');
const Admin = require('../models/Admin.js');

exports.getActiveAds = async (req, res) => {
    try {
        const ads = await Ad.findAll({
            where: { status: 'active' },
            order: [['upload_date', 'DESC']],
            include: [{
                model: Admin,
                attributes: ['username']
            }]
        });

        res.json({
            status: 'success',
            data: { ads }
        });
    } catch (error) {
        console.error('Ads fetch error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching ads'
        });
    }
};

exports.deleteAd = async (req, res) => {
    try {
        const { adId } = req.params;
        const adminUsername = req.user.username;

        const admin = await Admin.findByPk(adminUsername);
        if (!admin.ads_management) {
            return res.status(403).json({
                status: 'error',
                message: 'Not authorized to manage ads'
            });
        }

        await Ad.update(
            { status: 'deleted' },
            { where: { adID: adId } }
        );

        res.json({
            status: 'success',
            message: 'Ad deleted successfully'
        });
    } catch (error) {
        console.error('Ad deletion error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error deleting ad'
        });
    }
}; 