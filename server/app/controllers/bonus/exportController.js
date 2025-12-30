const { exportBonusToExcel } = require('../../services/exportService');
const { BonusInstance } = require('../../models/bonus/instance');
const audit = require('../../utils/audit-log');

function getActorId(req) {
    if (req && req.actor && req.actor.id) return req.actor.id;
    if (req && req.user && req.user.id) return req.user.id;
    if (req && req.user && req.user._id) return req.user._id;
    return '[anonymous]';
}

exports.handleExcelExport = async (req, res) => {
    try {
        const instance = await BonusInstance.findById(req.params.id);
        if (!instance) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        const workbook = await exportBonusToExcel(instance, { actor: req.actor });
        audit.logEvent(getActorId(req), 'bonus/exportController', 'export_excel', 'BonusInstance', req.params.id, 'succeed', `Exported bonus instance to Excel. referencePeriod=${instance.referencePeriod || ''}`);

        // Set headers for Excel download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="bonus-instance-${instance.referencePeriod}.xlsx"`);
        res.setHeader('Cache-Control', 'no-cache');

        // Stream the workbook directly to the response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export error:', error);
        audit.logEvent(getActorId(req), 'bonus/exportController', 'export_excel', 'BonusInstance', req.params.id, 'failed', error && error.message ? error.message : String(error));
        res.status(500).json({ message: 'Export failed', error: error.message });
    }
};
