const Excel = require('exceljs');
const path = require('path');
const { parseNumber } = require('./utils');

function getCellValue(cell) {
    if (!cell) return null;
    const v = cell.value;
    if (v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, 'result')) {
        return v.result;
    }
    return v;
}

function getNormalizedCellString(row, col) {
    const v = getCellValue(row.getCell(col));
    if (v === null || v === undefined) return '';
    return String(v).replace(/\s+/g, ' ').trim();
}

function findHeaderRow(sheet) {
    const maxScan = Math.min(sheet.rowCount || 0, 250);
    for (let r = 1; r <= maxScan; r++) {
        const row = sheet.getRow(r);
        const c3 = getNormalizedCellString(row, 3).toUpperCase();
        const c2 = getNormalizedCellString(row, 2).toUpperCase();
        if (c3.includes('MATRICULE') && (c2.includes('NOMS') || c2.includes('NOM'))) {
            return r;
        }
    }
    return 1;
}

function detectLayout(sheet, headerRowNumber) {
    const row = sheet.getRow(headerRowNumber);
    const c6 = getNormalizedCellString(row, 6).toUpperCase();
    const c7 = getNormalizedCellString(row, 7).toUpperCase();
    const c8 = getNormalizedCellString(row, 8).toUpperCase();
    const c4 = getNormalizedCellString(row, 4).toUpperCase();
    const c5 = getNormalizedCellString(row, 5).toUpperCase();
    // "Remise sur salaire" format: TAUX at col 6, Montant Brut at col 7, Taxes at col 8
    if (c6.includes('TAUX') && (c7.includes('MONTANT') || c7.includes('BRUT')) && c8.includes('TAX')) {
        return 'remise_sur_salaire';
    }
    // IFT format: Matricule col 3, Fonct./Grade col 4, Montant Brut col 5
    if ((c4.includes('FONCT') || c4.includes('FONC')) && (c5.includes('MONTANT') || c5.includes('BRUT'))) {
        return 'ift';
    }
    return 'default';
}

async function readRows(filePath, { expectParts, layout } = {}) {
    const workbook = new Excel.Workbook();
    await workbook.xlsx.readFile(path.resolve(filePath));
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('No worksheet found in Excel file');

    const headerRowNumber = findHeaderRow(sheet);
    const effectiveLayout = layout || detectLayout(sheet, headerRowNumber);

    const rows = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        // Skip rows before detected header row (and header row itself)
        if (rowNumber <= headerRowNumber) return;

        const rawIdVal = getCellValue(row.getCell(3));
        const rawId = rawIdVal ? String(rawIdVal).trim() : '';
        const identifier = rawId.replace(/[^A-Za-z0-9]/g, ''); // keep only alphanumerics
        const idUpper = identifier.toUpperCase();

        const grossCellIndex =
            effectiveLayout === 'remise_sur_salaire' ? 7 :
            effectiveLayout === 'ift' ? 5 :
            6;
        const grossAmount = parseNumber(getCellValue(row.getCell(grossCellIndex)));

        // Skip rows without matricule, with sentinel "ECI", or with gross missing
        if (!identifier || idUpper === 'ECI' || !Number.isFinite(grossAmount)) {
            return;
        }

        const parts = expectParts ? parseNumber(getCellValue(row.getCell(5))) : null;
        if (expectParts && !Number.isFinite(parts)) {
            return;
        }

        const functionGradeCellIndex =
            effectiveLayout === 'remise_sur_salaire' ? 5 :
            4;
        const observationsCellIndex =
            effectiveLayout === 'remise_sur_salaire' ? 12 :
            10;
        const taxCellIndex =
            effectiveLayout === 'remise_sur_salaire' ? 8 :
            7;
        const netCellIndex =
            effectiveLayout === 'remise_sur_salaire' ? 9 :
            8;

        const theRow = {
            rowIndex: rowNumber,
            name: getCellValue(row.getCell(2)) || '',
            identifier,
            indiceCategory: effectiveLayout === 'remise_sur_salaire' ? (getCellValue(row.getCell(4)) || '') : null,
            rate: effectiveLayout === 'remise_sur_salaire' ? parseNumber(getCellValue(row.getCell(6))) : null,
            functionGrade: getCellValue(row.getCell(functionGradeCellIndex)) || '',
            parts: expectParts ? parts : null,
            gross: grossAmount,
            tax: effectiveLayout === 'ift' ? null : parseNumber(getCellValue(row.getCell(taxCellIndex))),
            net: effectiveLayout === 'ift' ? null : parseNumber(getCellValue(row.getCell(netCellIndex))),
            observations: getCellValue(row.getCell(observationsCellIndex)) || ''
        };
        rows.push(theRow);
    });
    return rows;
}

module.exports = {
    readRows
};
