const path = require('path');

// Inline version of parseReferencePeriod to avoid importing utils.js which pulls in mongoose
function parseReferencePeriod(ref) {
    if (!ref) throw new Error('referencePeriod is required (YYYY-Qn or YYYY-MM)');
    const trimmed = ref.trim();
    if (/^\d{4}-Q[1-4]$/.test(trimmed)) return trimmed;
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) return trimmed;
    throw new Error('Invalid referencePeriod format: ' + ref + ' (expected YYYY-Qn or YYYY-MM)');
}

/**
 * Import bonus data from an uploaded Excel file.
 *
 * Migration helpers are loaded lazily so that mongoose is already connected
 * by the time they are required (avoids TextEncoder issues on Node 10).
 */
async function importBonusData({
    filePath,
    templateCode,
    templateName,
    category,
    periodicity = 'quarterly',
    referencePeriod,
    status = 'validated'
}) {
    // ---- Validate inputs ----
    if (!filePath) throw new Error('filePath is required');
    if (!templateCode) throw new Error('templateCode is required');
    if (!templateName) throw new Error('templateName is required');
    if (!category) throw new Error('category is required');
    if (!referencePeriod) throw new Error('referencePeriod is required');

    // Validate reference period format
    const validatedPeriod = parseReferencePeriod(referencePeriod);

    // ---- Lazy-load migration helpers (mongoose must be connected already) ----
    const { readRows } = require('../../scripts/migration/helpers/excel');
    const { findOrCreateHistoricalTemplate } = require('../../scripts/migration/helpers/template');
    const { findOrCreateInstance } = require('../../scripts/migration/helpers/instance');
    const { importAllocations } = require('../../scripts/migration/helpers/allocation');

    // Determine flags based on category
    const isIFT = category === 'ift';
    const isWithParts = category === 'with_parts';

    // ---- Read Excel ----
    console.log('[BonusImport] Reading file ' + filePath);
    const expectParts = isWithParts;
    const layout = isIFT ? 'ift' : (category === 'without_parts' ? 'remise_sur_salaire' : undefined);
    const readOpts = { expectParts: expectParts };
    if (layout) readOpts.layout = layout;
    const rows = await readRows(filePath, readOpts);

    if (!rows || rows.length === 0) {
        throw new Error('No valid data rows found in the Excel file. Please check the file format: column C must contain MATRICULE and column B must contain NOM(S).');
    }

    console.log('[BonusImport] Found ' + rows.length + ' valid rows');

    // ---- Create / reuse template ----
    const templateOpts = {
        code: templateCode,
        name: templateName,
        category: isIFT ? 'without_parts' : category,
        periodicity: periodicity,
        taxConfig: isIFT
            ? { taxName: 'N/A', taxPercentage: 0 }
            : { taxName: 'IRPP', taxPercentage: 5.28 }
    };
    if (isWithParts) {
        templateOpts.calculationOverrides = { partsConfig: { defaultParts: 1 } };
    }
    if (isIFT) {
        templateOpts.calculationOverrides = { subType: 'ift' };
    }

    const template = await findOrCreateHistoricalTemplate(templateOpts);

    // ---- Create / reuse instance ----
    const instance = await findOrCreateInstance({
        template: template,
        referencePeriod: validatedPeriod,
        status: status,
        filePath: path.resolve(filePath)
    });

    // ---- Import allocations ----
    const summary = await importAllocations(rows, {
        template: template,
        instance: instance,
        referencePeriod: validatedPeriod,
        filePath: path.resolve(filePath),
        isIFT: isIFT,
        isWithParts: isWithParts,
        useProvidedTaxNet: category === 'without_parts',
        personnelCorrectionsFile: null,
        dryRun: false
    });

    console.log('[BonusImport] Done. created=' + summary.created + ' skippedExisting=' + summary.skippedExisting + ' missingPersonnel=' + summary.missingPersonnel + ' invalidRows=' + summary.invalidRows);

    return {
        created: summary.created,
        skippedExisting: summary.skippedExisting,
        missingPersonnel: summary.missingPersonnel,
        correctedPersonnel: summary.correctedPersonnel || 0,
        invalidRows: summary.invalidRows,
        totalRowsRead: rows.length,
        missingDetails: (summary.missingDetails || []).map(function (d) {
            return {
                identifier: d.identifier,
                name: d.name,
                rowIndex: d.rowIndex
            };
        }),
        templateId: template._id,
        instanceId: instance._id
    };
}

module.exports = {
    importBonusData: importBonusData
};
