const { exportBonusToExcel } = require('../../services/exportService');
const { BonusInstance } = require('../../models/bonus/instance');

exports.handleExcelExport = async (req, res) => {
    try {
        const instance = await BonusInstance.findById(req.params.id);
        if (!instance) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        const workbook = await exportBonusToExcel(instance);

        // Set headers for Excel download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="bonus-instance-${instance.referencePeriod}.xlsx"`);
        res.setHeader('Cache-Control', 'no-cache');

        // Stream the workbook directly to the response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ message: 'Export failed', error: error.message });
    }
};
