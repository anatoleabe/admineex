const { BonusInstance } = require('../../../app/models/bonus/instance');
const { mapInstanceStatus, getSnapshotDate } = require('./utils');

function deriveInstanceDates({ normalizedStatus, referencePeriod }) {
    const baseDate = getSnapshotDate(referencePeriod) || new Date();

    const dates = {
        generationDate: baseDate
    };

    if (normalizedStatus === 'approved' || normalizedStatus === 'paid') {
        dates.approvalDate = baseDate;
    }
    if (normalizedStatus === 'paid') {
        dates.paymentDate = baseDate;
    }
    return dates;
}

async function findOrCreateInstance({ template, referencePeriod, status, filePath }) {
    const normalizedStatus = mapInstanceStatus(status);
    const dates = deriveInstanceDates({ normalizedStatus, referencePeriod });
    let instance = await BonusInstance.findOne({
        templateId: template._id,
        referencePeriod,
        source: 'excel_migration'
    });
    if (instance) {
        const updates = {};

        if (normalizedStatus && instance.status !== normalizedStatus) {
            updates.status = normalizedStatus;
        }

        if (!instance.generationDate && dates.generationDate) updates.generationDate = dates.generationDate;
        if (!instance.approvalDate && dates.approvalDate) updates.approvalDate = dates.approvalDate;
        if (!instance.paymentDate && dates.paymentDate) updates.paymentDate = dates.paymentDate;

        // Keep workflow consistent for imported historical data
        if (normalizedStatus === 'paid' && instance.wizardStep !== 'completed') {
            updates.wizardStep = 'completed';
        } else if ((normalizedStatus === 'approved' || normalizedStatus === 'under_review') && !instance.wizardStep) {
            updates.wizardStep = 'export';
        }

        if (Object.keys(updates).length) {
            updates.updatedAt = new Date();
            instance = await BonusInstance.findByIdAndUpdate(instance._id, updates, { new: true });
        }
        return instance;
    }

    instance = await BonusInstance.create({
        templateId: template._id,
        referencePeriod,
        taxName: template && template.taxConfig ? template.taxConfig.taxName : undefined,
        taxPercentage: template && template.taxConfig ? template.taxConfig.taxPercentage : undefined,
        status: normalizedStatus,
        wizardStep: normalizedStatus === 'paid' ? 'completed' : 'export',
        generationDate: dates.generationDate,
        approvalDate: dates.approvalDate,
        paymentDate: dates.paymentDate,
        source: 'excel_migration',
        originalFilePath: filePath
    });

    return instance;
}

module.exports = {
    findOrCreateInstance
};
