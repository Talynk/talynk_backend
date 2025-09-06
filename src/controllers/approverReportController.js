const prisma = require('../lib/prisma');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

exports.generateReport = async (req, res) => {
    try {
        const { reportType, format, metrics, startDate, endDate } = req.body;
        const approverUsername = req.user.username;

        // Get date range
        const dateRange = getDateRange(reportType, startDate, endDate);

        // Gather report data
        const reportData = await gatherReportData(approverUsername, dateRange, metrics);

        // Generate report in requested format
        switch (format) {
            case 'pdf':
                await generatePDFReport(res, reportData, reportType);
                break;
            case 'csv':
                await generateCSVReport(res, reportData, reportType);
                break;
            case 'excel':
                await generateExcelReport(res, reportData, reportType);
                break;
            default:
                throw new Error('Unsupported format');
        }
    } catch (error) {
        console.error('Report generation error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error generating report'
        });
    }
};

async function gatherReportData(approverUsername, dateRange, metrics) {
    const data = {
        approver: await Approver.findUnique({ where: { id: approverUsername),
        period: {
            start: dateRange.startDate,
            end: dateRange.endDate
        },
        metrics: {}
    };

    const baseQuery = {
        where: {
            approverID: approverUsername,
            updatedAt: {
                { gte: : [dateRange.startDate, dateRange.endDate]
            }
        }
    };

    // Gather requested metrics
    for (const metric of metrics) {
        switch (metric) {
            case 'approvals':
                data.metrics.approvals = await Post.count({
                    ...baseQuery,
                    where: {
                        ...baseQuery.where,
                        post_status: 'approved'
                    }
                });
                break;
            case 'rejections':
                data.metrics.rejections = await Post.count({
                    ...baseQuery,
                    where: {
                        ...baseQuery.where,
                        post_status: 'rejected'
                    }
                });
                break;
            case 'response_time':
                const posts = await Post.findMany({
                    ...baseQuery,
                    select: { 'uploadDate', 'approvedDate', 'rejectedDate' }
                });
                data.metrics.response_time = calculateAverageResponseTime(posts);
                break;
        }
    }

    return data;
}

// Helper functions for report generation... 