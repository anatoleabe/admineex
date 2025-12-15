const { BonusInstance } = require('../../../app/models/bonus/instance');
const { mapInstanceStatus } = require('./utils');

async function findOrCreateInstance({ template, referencePeriod, status, filePath }) {
    const normalizedStatus = mapInstanceStatus(status);
    let instance = await BonusInstance.findOne({
        templateId: template._id,
        referencePeriod,
        source: 'excel_migration'
    });
    if (instance) return instance;

    instance = await BonusInstance.create({
        templateId: template._id,
        referencePeriod,
        taxName: template.taxConfig?.taxName,
        taxPercentage: template.taxConfig?.taxPercentage,
        status: normalizedStatus,
        wizardStep: 'export',
        generationDate: new Date(),
        source: 'excel_migration',
        originalFilePath: filePath
    });

    return instance;
}

module.exports = {
    findOrCreateInstance
};
