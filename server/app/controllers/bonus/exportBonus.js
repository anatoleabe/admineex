const { exportPersonnelBonusToPdf } = require('../../services/exportService');
const httpStatus = require('http-status');
const { PersonnelSnapshot } = require('../../models/bonus/personnelSnapshot');
const { getActorStructureTokens, isSnapshotInStructures } = require('../../utils/structureScope');
const { forbidden } = require('../../utils/ApiError');
const audit = require('../../utils/audit-log');
const dictionary = require('../../utils/dictionary');

function getActorId(req) {
    if (req && req.actor && req.actor.id) return req.actor.id;
    if (req && req.user && req.user.id) return req.user.id;
    if (req && req.user && req.user._id) return req.user._id;
    return '[anonymous]';
}

function t(req, msgid) {
    const language = (req && req.actor && req.actor.language) || (req && req.user && req.user.language) || '';
    return dictionary.translator(language).gettext(msgid);
}

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
                message: t(req, 'Personnel ID is required')
            });
        }

        if (req.actor && String(req.actor.role) === '2') {
            const tokens = getActorStructureTokens(req.actor);
            if (!tokens.size) {
                throw forbidden(t(req, 'Forbidden'));
            }
            const latestSnapshot = await PersonnelSnapshot.findOne({ personnelId })
                .sort({ snapshotDate: -1 })
                .select('_id data')
                .lean();
            if (!latestSnapshot || !isSnapshotInStructures(latestSnapshot, tokens)) {
                throw forbidden(t(req, 'Forbidden'));
            }
        }

        // If format is excel, handle differently
        if (format === 'excel') {
            // Not implemented yet
            return res.status(httpStatus.NOT_IMPLEMENTED).json({
                message: t(req, 'Excel export not implemented yet')
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

        audit.logEvent(getActorId(req), 'bonus/exportBonus', 'export_pdf', 'PersonnelBonusHistory', personnelId, 'succeed', `Exported personnel bonus history. from=${fromDate || ''}; to=${toDate || ''}`);
        // Send the PDF buffer
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error exporting bonus history to PDF:', error);
        audit.logEvent(getActorId(req), 'bonus/exportBonus', 'export_pdf', 'PersonnelBonusHistory', (req.query && req.query.personnelId) || (req.params && req.params.personnelId) || '', 'failed', error && error.message ? error.message : String(error));
        res.status(500).json({
            message: (error && error.message) ? error.message : t(req, 'Failed to export bonus history to PDF')
        });
    }
};
