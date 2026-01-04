const { BonusAllocation } = require('../../../app/models/bonus/allocation');
const { Personnel } = require('../../../app/models/personnel');
const { createOrReuseSnapshot } = require('./snapshot');
const { buildComment } = require('./utils');
const fs = require('fs');
const path = require('path');
const Excel = require('exceljs');

function normalizeIdentifier(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[^A-Za-z0-9]/g, '').trim().toUpperCase();
}

function getCellText(cell) {
    if (!cell) return '';
    if (cell.text !== undefined && cell.text !== null) return String(cell.text);
    const v = cell.value;
    if (v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, 'result')) return String(v.result);
    if (v === null || v === undefined) return '';
    return String(v);
}

async function loadPersonnelCorrectionsFile(filePath) {
    if (!filePath) return null;
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) return null;

    const ext = path.extname(resolved).toLowerCase();
    const map = new Map();

    if (ext === '.xlsx' || ext === '.xlsm') {
        const workbook = new Excel.Workbook();
        await workbook.xlsx.readFile(resolved);
        const sheet = workbook.worksheets[0];
        if (!sheet) return map;

        let headerRow = 1;
        const maxScan = Math.min(sheet.rowCount || 0, 50);
        for (let r = 1; r <= maxScan; r++) {
            const row = sheet.getRow(r);
            const colA = getCellText(row.getCell(1)).toUpperCase();
            const colC = getCellText(row.getCell(3)).toUpperCase();
            const looksLikeHeaderA = colA.includes('MATRICULE') && (colA.includes('ACTUEL') || colA.includes('ACTUELS') || colA.includes('ACTUELLE'));
            const looksLikeHeaderC = colC.includes('MATRICULE') && (colC.includes('CORRIG') || colC.includes('CORRIGE'));
            if (looksLikeHeaderA || looksLikeHeaderC) {
                headerRow = r;
                break;
            }
        }

        for (let r = headerRow + 1; r <= (sheet.rowCount || 0); r++) {
            const row = sheet.getRow(r);
            const current = normalizeIdentifier(getCellText(row.getCell(1)));
            const corrected = normalizeIdentifier(getCellText(row.getCell(3)));
            if (!current || !corrected) continue;
            map.set(current, corrected);
        }
        return map;
    }

    if (ext === '.csv' || ext === '.txt') {
        const raw = fs.readFileSync(resolved, 'utf8');
        const lines = raw.split(/\r?\n/).filter(Boolean);
        if (!lines.length) return map;

        const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(delimiter);
            const current = normalizeIdentifier(cols[0]);
            const corrected = normalizeIdentifier(cols[2]);
            if (!current || !corrected) continue;
            map.set(current, corrected);
        }
        return map;
    }

    return null;
}

async function importAllocations(rows, {
    template,
    instance,
    referencePeriod,
    filePath,
    isIFT,
    isWithParts,
    useProvidedTaxNet = false,
    personnelCorrectionsFile,
    dryRun = false
}) {
    const taxConfig = template && template.taxConfig ? template.taxConfig : null;
    const taxPercentage = taxConfig && taxConfig.taxPercentage !== undefined && taxConfig.taxPercentage !== null ? taxConfig.taxPercentage : 0;
    const taxRate = isIFT ? 0 : ((Number(taxPercentage) || 0) / 100);
    let created = 0;
    let skippedExisting = 0;
    let missingPersonnel = 0;
    let invalidRows = 0;
    let correctedPersonnel = 0;
    const missingDetails = [];

    const correctionMap = await loadPersonnelCorrectionsFile(personnelCorrectionsFile);

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

        const originalIdentifier = String(identifier);
        let personnel = await Personnel.findOne({ identifier: originalIdentifier });
        let correctedIdentifier = null;

        if (!personnel && correctionMap && correctionMap.size) {
            const normalized = normalizeIdentifier(originalIdentifier);
            correctedIdentifier = normalized ? correctionMap.get(normalized) : null;
            if (correctedIdentifier) {
                personnel = await Personnel.findOne({ identifier: correctedIdentifier });
                if (personnel) correctedPersonnel += 1;
            }
        }
        if (!personnel) {
            missingPersonnel += 1;
            missingDetails.push({
                identifier: originalIdentifier,
                correctedIdentifier,
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
            migrationRow: rowIndex,
            sourceIdentifier: originalIdentifier,
            correctedIdentifier
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

    return { created, skippedExisting, missingPersonnel, correctedPersonnel, missingDetails, invalidRows };
}

module.exports = {
    importAllocations
};
