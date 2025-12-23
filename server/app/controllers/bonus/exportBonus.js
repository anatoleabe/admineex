const { exportPersonnelBonusToPdf } = require('../../services/exportService');
const httpStatus = require('http-status');
const { PersonnelSnapshot } = require('../../models/bonus/personnelSnapshot');
const { getActorStructureTokens, isSnapshotInStructures } = require('../../utils/structureScope');
const { forbidden } = require('../../utils/ApiError');

/**
 * Export bonus history for a personnel to PDF
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.exportPersonnelBonusHistory = async (req, res) => {
    try {
        // Get params from query string instead of path params
        const personnelId = req.query.personnelId || req.params.personnelId;
        const fromDate = req.query.fromDate || req.params.fromDate;
        const toDate = req.query.toDate || req.params.toDate;
        const format = req.query.format;

        if (!personnelId) {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: 'Personnel ID is required'
            });
        }

        if (req.actor && String(req.actor.role) === '2') {
            const tokens = getActorStructureTokens(req.actor);
            if (!tokens.size) {
                throw forbidden('Forbidden');
            }
            const latestSnapshot = await PersonnelSnapshot.findOne({ personnelId })
                .sort({ snapshotDate: -1 })
                .select('_id data')
                .lean();
            if (!latestSnapshot || !isSnapshotInStructures(latestSnapshot, tokens)) {
                throw forbidden('Forbidden');
            }
        }

        // If format is excel, handle differently
        if (format === 'excel') {
            // Not implemented yet
            return res.status(httpStatus.NOT_IMPLEMENTED).json({
                message: 'Excel export not implemented yet'
            });
        }

        // Call the export service to generate the PDF - using exportBonusPersonnelPDF instead of exportPersonnelBonusToPdf
        const pdfBuffer = await exportPersonnelBonusToPdf(personnelId, fromDate, toDate, { actor: req.actor });

        // Set the appropriate headers for PDF download
        const filename = `bonus_history_${personnelId}_${new Date().toISOString().split('T')[0]}.pdf`;

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': pdfBuffer.length
        });

        // Send the PDF buffer
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error exporting bonus history to PDF:', error);
        res.status(500).json({
            message: error.message || 'Failed to export bonus history to PDF'
        });
    }
};
