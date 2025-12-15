const { BonusAllocation } = require('../../../app/models/bonus/allocation');
const { Personnel } = require('../../../app/models/personnel');
const { createOrReuseSnapshot } = require('./snapshot');
const { buildComment } = require('./utils');

async function importAllocations(rows, {
    template,
    instance,
    referencePeriod,
    filePath,
    isIFT,
    isWithParts,
    useProvidedTaxNet = false,
    dryRun = false
}) {
    const taxRate = isIFT ? 0 : ((template.taxConfig?.taxPercentage || 0) / 100);
    let created = 0;
    let skippedExisting = 0;
    let missingPersonnel = 0;
    let invalidRows = 0;
    const missingDetails = [];

    for (const row of rows) {
        const { identifier, gross, rowIndex } = row;
        if (!identifier || !Number.isFinite(gross)) {
            invalidRows += 1;
            continue;
        }
        if (isWithParts) {
            if (!Number.isFinite(row.parts) || row.parts <= 0) {
                invalidRows += 1;
                continue;
            }
        }

        const personnel = await Personnel.findOne({ identifier });
        if (!personnel) {
            missingPersonnel += 1;
            missingDetails.push({
                identifier,
                name: row.name || '',
                rowIndex
            });
            continue;
        }

        const existingAllocation = await BonusAllocation.findOne({
            instanceId: instance._id,
            personnelId: personnel._id
        });
        if (existingAllocation) {
            skippedExisting += 1;
            continue;
        }

        const snapshot = await createOrReuseSnapshot(personnel._id, referencePeriod);

        const parts = isWithParts ? (Number.isFinite(row.parts) ? Number(row.parts) : 0) : 1;
        const effectiveParts = isWithParts ? (parts > 0 ? parts : 0) : 1;

        let grossAmount = Number(gross) || 0;
        let taxAmount = Math.round(grossAmount * taxRate);
        let netAmount = grossAmount - taxAmount;
        if (useProvidedTaxNet) {
            const providedTax = Number.isFinite(row.tax) ? Number(row.tax) : null;
            const providedNet = Number.isFinite(row.net) ? Number(row.net) : null;
            if (Number.isFinite(providedTax)) taxAmount = providedTax;
            if (Number.isFinite(providedNet)) netAmount = providedNet;
            if (!Number.isFinite(providedNet) && Number.isFinite(providedTax)) netAmount = grossAmount - taxAmount;
            if (!Number.isFinite(providedTax) && Number.isFinite(providedNet)) taxAmount = grossAmount - netAmount;
        }
        if (isIFT) {
            taxAmount = 0;
            netAmount = grossAmount;
        }

        const calcInputs = {
            parts: effectiveParts,
            comment: buildComment(
                row.functionGrade,
                row.indiceCategory ? `Indice/Cat: ${row.indiceCategory}` : null,
                Number.isFinite(row.rate) ? `Taux: ${row.rate}` : null,
                row.observations
            ),
            migrationSource: 'excel',
            migrationFile: filePath,
            migrationRow: rowIndex
        };

         console.log({
            instanceId: instance._id,
            personnelId: personnel._id,
            personnelSnapshotId: snapshot._id,
            templateId: template._id,
            calculationInputs: calcInputs,
            calculatedAmount: grossAmount,
            finalAmount: grossAmount,
            grossAmount,
            taxAmount,
            netAmount,
            taxRate,
            status: 'eligible',
            createdAt: new Date()
        })

        if (dryRun) {
            created += 1;
            continue;
        }

        await BonusAllocation.create({
            instanceId: instance._id,
            personnelId: personnel._id,
            personnelSnapshotId: snapshot._id,
            templateId: template._id,
            calculationInputs: calcInputs,
            calculatedAmount: grossAmount,
            finalAmount: grossAmount,
            grossAmount,
            taxAmount,
            netAmount,
            taxRate,
            status: 'eligible',
            createdAt: new Date()
        });
       

        created += 1;
    }

    return { created, skippedExisting, missingPersonnel, missingDetails, invalidRows };
}

module.exports = {
    importAllocations
};
