const excel = require('exceljs');
const { addDgtcfmBonusHeader } = require('../utils/excelHeader');
const { BonusInstance } = require('../models/bonus/instance');
const { Personnel } = require('../models/personnel');
const { BonusAllocation } = require('../models/bonus/allocation');
const { ApiError } = require('../utils/ApiError');
const httpStatus = require('http-status');
const dictionary = require('../utils/dictionary');
const _ = require('lodash');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const mongoose = require('mongoose');
const qr = require('qr-image');
const fs = require('fs');
const path = require('path');

exports.exportBonusToExcel = async (instance) => {
    try {
        // 1. Get instance data
        const bonusInstance = await BonusInstance.findById(instance._id)
            .populate('templateId', 'name code category')
            .populate('createdBy', 'firstname lastname');

        if (!bonusInstance) {
            throw new ApiError('Bonus instance not found', httpStatus.NOT_FOUND);
        }

        const isWithoutParts = bonusInstance.templateId?.category === 'without_parts';

        // 2. Get allocations with structure info from snapshots
        const allocations = await BonusAllocation.find({ instanceId: instance._id })
            .populate('personnelId', 'identifier name')
            .populate('personnelSnapshotId');

        // Helper to convert column index (1-based) to Excel letter
        function colLetter(n) {
            let s = '';
            while (n > 0) {
                const m = (n - 1) % 26;
                s = String.fromCharCode(65 + m) + s;
                n = Math.floor((n - m) / 26);
            }
            return s;
        }

        // Helper to load ranks.json
        function loadRanks() {
            try {
                const p = path.resolve(__dirname, '../../resources/dictionary/personnel/ranks.json');
                return JSON.parse(fs.readFileSync(p, 'utf8'));
            } catch (e) {
                return null;
            }
        }

    // 3. Create workbook
        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet('Bonus Allocations');

        // Define headers now so we know how many columns to merge
        const headersSansPart = [
            { header: "N° d'ordre", key: 'index', width: 8 },
            { header: 'NOMS ET PRENOMS', key: 'name', width: 28 },
            { header: 'MATRICULE', key: 'matricule', width: 16 },
            { header: 'Indice/Cat', key: 'indiceCat', width: 14 },
            { header: 'Grade', key: 'grade', width: 18 },
            { header: 'Fonction', key: 'fonction', width: 22 },
            { header: 'TAUX (%)', key: 'taux', width: 10 },
            { header: 'Montant Brut (F CFA)', key: 'brut', width: 18 },
            { header: `{${bonusInstance.taxPercentage || 5.28}%}`, key: 'tax', width: 14 },
            { header: 'Net à Percevoir', key: 'net', width: 16 },
            { header: 'Emargement', key: 'signature', width: 16 },
            { header: 'Observations', key: 'obs', width: 24 }
        ];

        const headersWithParts = [
            { header: "N° d'ordre", key: 'index', width: 8 },
            { header: 'NOMS ET PRENOMS', key: 'name', width: 28 },
            { header: 'MATRICULE', key: 'matricule', width: 16 },
            { header: 'Fonction/Grade', key: 'grade', width: 26 },
            { header: 'Nombre de parts', key: 'parts', width: 16 },
            { header: 'MONTANT BRUT', key: 'brut', width: 16 },
            { header: `{${bonusInstance.taxPercentage || 5.28}%}`, key: 'tax', width: 14 },
            { header: 'Net à Percevoir', key: 'net', width: 16 },
            { header: 'CNI', key: 'cni', width: 14 },
            { header: 'Observations', key: 'obs', width: 24 },
            { header: 'Emargement', key: 'signature', width: 16 }
        ];

        const chosenHeaders = isWithoutParts ? headersSansPart : headersWithParts;
        const lastCol = colLetter(chosenHeaders.length);

        // 4. Insert official DGTCFM header (will push data down)
        // Try to load a coat of arms image if available
        function tryLoadLogoBuffer() {
            const candidates = [
                path.resolve(__dirname, '../../public/img/coat_of_arms.jpeg'),
                path.resolve(__dirname, '../../public/img/coat-of-arms.png'),
                path.resolve(__dirname, '../../resources/img/coat_of_arms.png'),
                path.resolve(__dirname, '../../resources/img/armoiries.png'),
                path.resolve(__dirname, '../../resources/img/armoiries_cm.png')
            ];
            for (const p of candidates) {
                try {
                    if (fs.existsSync(p)) return fs.readFileSync(p);
                } catch (e) { /* ignore */ }
            }
            return null;
        }

    const logoBuffer = tryLoadLogoBuffer();
    addDgtcfmBonusHeader(worksheet, logoBuffer || undefined);

        // After header insertion, base row offset is 33 rows
        const baseRow = 33;

    // Define columns after inserting header so our widths override header defaults,
    // but DO NOT set 'header' here to avoid ExcelJS auto-creating row 1 headers.
    worksheet.columns = chosenHeaders.map(h => ({ key: h.key, width: h.width }));

        // Add title and section headers (MERGED CELLS), shifted by baseRow
        worksheet.mergeCells(`A${1 + baseRow}:${lastCol}${1 + baseRow}`);
        worksheet.getCell(`A${1 + baseRow}`).value = `ETAT DE REPARTITION D'${bonusInstance.templateId.name} ${bonusInstance.referencePeriod}`;
        worksheet.getCell(`A${1 + baseRow}`).font = { bold: true, size: 14 };
        worksheet.getCell(`A${1 + baseRow}`).alignment = { horizontal: 'center' };

        // Empty row
        worksheet.addRow([]);

        // Section headers (shifted)
        worksheet.mergeCells(`B${3 + baseRow}:${lastCol}${3 + baseRow}`);
        worksheet.getCell(`B${3 + baseRow}`).value = 'I: PAIEMENTS PAR VIREMENT';
        worksheet.getCell(`B${3 + baseRow}`).font = { bold: true, size: 12 };

        worksheet.mergeCells(`B${4 + baseRow}:${lastCol}${4 + baseRow}`);
        worksheet.getCell(`B${4 + baseRow}`).value = 'a: Services centraux, agences comptables et autres services';
        worksheet.getCell(`B${4 + baseRow}`).font = { italic: true };

        worksheet.addRow([]); // Empty row before headers

        // 7. Group allocations by structure and number them by structure code
        allocations.forEach(allocation => {
            const structure = allocation.personnelSnapshotId?.data?.position?.structure;
            allocation.structureInfo = structure ? structure : { id: 'undefined', code: '000', name: 'STRUCTURE INCONNUE' };
        });
        const groupedAllocations = _.groupBy(allocations, a => a.structureInfo.id);
        const structureIds = Object.keys(groupedAllocations).sort((a, b) => {
            const codeA = groupedAllocations[a][0]?.structureInfo?.code || '999';
            const codeB = groupedAllocations[b][0]?.structureInfo?.code || '999';
            return codeA.localeCompare(codeB);
        });

        // Header row styling
        const headerRow = worksheet.getRow(6 + baseRow);
        headerRow.values = chosenHeaders.map(h => h.header);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        let currentRowNum = 7 + baseRow;
        let globalIndex = 1;

        let grandTotals = { parts: 0, brut: 0, tax: 0, net: 0 };
        let groupCount = 0;

        const ranksJson = loadRanks();
        function computeTxPercentFromSnapshot(snapshot) {
            const rank = snapshot?.data?.rank;
            if (!rank || !Array.isArray(ranksJson)) return null;
            const row = ranksJson.find(r => String(r.id) === String(rank));
            if (!row || typeof row.bonusRate !== 'number') return null;
            return Math.round(row.bonusRate * 100); // integer percent
        }

        for (const structureId of structureIds) {
            groupCount++;
            const list = groupedAllocations[structureId] || [];
            if (!list.length) continue;
            const info = list[0].structureInfo;

            // Structure header row
            worksheet.mergeCells(`A${currentRowNum}:${lastCol}${currentRowNum}`);
            const structureCell = worksheet.getCell(`A${currentRowNum}`);
            structureCell.value = `${groupCount}. ${info.name}${info.code ? ' - ' + info.code : ''}`;
            structureCell.font = { color: { argb: 'FFFFFFFF' }, size: 14, bold: true };
            structureCell.alignment = { vertical: 'middle', horizontal: 'center' };
            structureCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE06B21' } };
            structureCell.border = { top: { style: 'thick', color: { argb: 'FF964714' } }, left: { style: 'thick', color: { argb: 'FF964714' } }, bottom: { style: 'thick', color: { argb: 'FF964714' } }, right: { style: 'thick', color: { argb: 'FF964714' } } };
            currentRowNum++;

            // Totals per structure
            let subtotals = { parts: 0, brut: 0, tax: 0, net: 0 };

            for (const allocation of list) {
                // Format personnel name
                if (allocation.personnelId?.name) {
                    const name = allocation.personnelId.name;
                    allocation.personnelId.formattedName = `${name.family?.join(' ')} ${name.given?.join(' ')}`.trim();
                }

                // Compute grade code using dictionary and extract position name
                let gradeCode = '';
                let indiceCat = allocation.calculationInputs?.indiceCatDisplay || '';
                let fonctionLabel = allocation.personnelSnapshotId?.data?.position?.name || '';
                const status = allocation.personnelSnapshotId?.data?.status || '';
                const grade = allocation.personnelSnapshotId?.data?.grade || '';
                if (status && grade) {
                    const gradeTxt = dictionary.getValueFromJSON(
                        `../../resources/dictionary/personnel/status/${status}/grades.json`,
                        parseInt(grade, 10),
                        'code'
                    );
                    gradeCode = gradeTxt || String(grade);
                }

                // Build Indice/Cat display (prefer stored value from calculationInputs)

                if (!indiceCat) {
                    if (String(status) === '1') {
                        indiceCat = allocation.personnelSnapshotId?.data?.index || '';
                    } else if (String(status) === '2') {
                        const cat = allocation.personnelSnapshotId?.data?.category || '';
                        const ech = allocation.personnelSnapshotId?.data?.index || '';
                        // Map category ID to code using dictionary for consistency (e.g., CAT 1..12)
                        const catId = parseInt(cat, 10);
                        const catCode = Number.isFinite(catId)
                            ? (dictionary.getValueFromJSON(`../../resources/dictionary/personnel/status/2/categories.json`, catId, 'code') || String(cat))
                            : String(cat || '');
                        indiceCat = `${catCode}${ech ? ' / ' + ech : ''}`;
                    }
                }

                // TAUX (%) for without parts
                let tauxPercent = null;
                if (isWithoutParts) {
                    const fromInputs = allocation.calculationInputs?.txPercent;
                    tauxPercent = Number.isFinite(fromInputs) ? Math.round(fromInputs) : computeTxPercentFromSnapshot(allocation.personnelSnapshotId);
                }

                // Use stored and already rounded values
                const brut = Math.round(allocation.grossAmount || allocation.finalAmount || 0);
                const tax = Math.round(allocation.taxAmount || ((allocation.grossAmount || 0) - (allocation.netAmount || 0)));
                const net = Math.round(allocation.netAmount || ((allocation.grossAmount || 0) - (tax)));

                // Subtotals
                subtotals.parts += allocation.calculationInputs?.parts || 0;
                subtotals.brut += brut;
                subtotals.tax += tax;
                subtotals.net += net;

                // Row values
                const rowValuesSansPart = [
                    globalIndex++,
                    allocation.personnelId?.formattedName || 'N/A',
                    allocation.personnelId?.identifier || 'N/A',
                    indiceCat,
                    gradeCode,
                    fonctionLabel,
                    isFinite(tauxPercent) ? tauxPercent : '',
                    brut,
                    tax,
                    net,
                    '', // Emargement
                    allocation.calculationInputs?.comment || ''
                ];

                const rowValuesWithParts = [
                    globalIndex++,
                    allocation.personnelId?.formattedName || 'N/A',
                    allocation.personnelId?.identifier || 'N/A',
                    `${gradeCode}${fonctionLabel ? ' / ' + fonctionLabel : ''}`,
                    allocation.calculationInputs?.parts || 0,
                    brut,
                    tax,
                    net,
                    '',
                    allocation.calculationInputs?.comment || '',
                    ''
                ];

                const dataRow = worksheet.addRow(isWithoutParts ? rowValuesSansPart : rowValuesWithParts);
                // Number formats
                const colsForNumbers = isWithoutParts ? ['H','I','J'] : ['F','G','H'];
                colsForNumbers.forEach(col => worksheet.getCell(`${col}${dataRow.number}`).numFmt = '#,##0');

                // Style row border and excluded coloring
                dataRow.eachCell((cell) => {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    if (allocation.status === 'excluded' || (allocation.calculationInputs?.parts || 0) === 0) {
                        cell.font = { color: { argb: 'FFFF0000' } };
                    }
                });

                currentRowNum++;
            }

            // Subtotal row
            const subtotalValues = isWithoutParts
                ? ['', '', '', '', '', 'SOUS-TOTAL', '', subtotals.brut, subtotals.tax, subtotals.net, '', '']
                : ['', '', '', 'SOUS-TOTAL', subtotals.parts, subtotals.brut, subtotals.tax, subtotals.net, '', '', ''];
            const subtotalRow = worksheet.addRow(subtotalValues);
            subtotalRow.eachCell((cell) => {
                cell.font = { bold: true };
                cell.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
            });
            const subtotalCols = isWithoutParts ? ['H','I','J'] : ['E','F','G','H'];
            subtotalCols.forEach(col => worksheet.getCell(`${col}${subtotalRow.number}`).numFmt = '#,##0');
            currentRowNum++;

            grandTotals.parts += subtotals.parts;
            grandTotals.brut += subtotals.brut;
            grandTotals.tax += subtotals.tax;
            grandTotals.net += subtotals.net;

            worksheet.addRow([]);
            currentRowNum++;
        }

        // Grand total
        const grandRowValues = isWithoutParts
            ? ['', '', '', '', '', 'TOTAL GENERAL', '', grandTotals.brut, grandTotals.tax, grandTotals.net, '', '']
            : ['', '', '', 'TOTAL GENERAL', grandTotals.parts, grandTotals.brut, grandTotals.tax, grandTotals.net, '', '', ''];
        const grandTotalRow = worksheet.addRow(grandRowValues);
        grandTotalRow.eachCell((cell) => {
            cell.font = { bold: true, size: 12 };
            cell.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
        });
        const grandCols = isWithoutParts ? ['H','I','J'] : ['E','F','G','H'];
        grandCols.forEach(col => {
            worksheet.getCell(`${col}${grandTotalRow.number}`).numFmt = '#,##0';
            worksheet.getCell(`${col}${grandTotalRow.number}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBEBEB' } };
        });

        return workbook;

    } catch (error) {
        console.error('Export error:', error);
        throw new ApiError(
            error.message || 'Failed to export bonus data',
            httpStatus.INTERNAL_SERVER_ERROR
        );
    }
};

/**
 * Export bonus instance data to PDF
 * @param {Object} instance - The bonus instance to export
 * @returns {Promise<Buffer>} - A buffer containing the PDF data
 */
exports.exportBonusToPdf = async (instance) => {
    try {
        // 1. Get instance data with populated references
        const bonusInstance = await BonusInstance.findById(instance._id)
            .populate('templateId', 'name code')
            .populate('createdBy', 'firstname lastname');

        if (!bonusInstance) {
            throw new ApiError('Bonus instance not found', httpStatus.NOT_FOUND);
        }

        // 2. Get allocations with structure info from snapshots (same logic as Excel)
        const allocations = await BonusAllocation.find({ instanceId: instance._id })
            .populate('personnelId', 'identifier name')
            .populate('personnelSnapshotId');

        // 3. Use PDF generation library (PDFKit) with landscape orientation
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({
            margins: { top: 50, bottom: 50, left: 40, right: 40 },
            size: 'A4',
            layout: 'landscape', // Use landscape orientation
            bufferPages: true    // Enable page buffering to handle page numbers
        });

        // Collect PDF data into a buffer
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));

        // Return Promise that resolves with buffer when PDF generation is complete
        return new Promise((resolve, reject) => {
            doc.on('end', () => {
                const result = Buffer.concat(chunks);
                resolve(result);
            });

            doc.on('error', (err) => reject(err));

            try {
                // 4. Extract structure info for each allocation (same as Excel)
                allocations.forEach(allocation => {
                    if (allocation.personnelSnapshotId?.data?.position?.structure) {
                        allocation.structureInfo = allocation.personnelSnapshotId.data.position.structure;
                    } else {
                        allocation.structureInfo = { id: 'undefined', code: '000', name: 'STRUCTURE INCONNUE' };
                    }

                    // Format personnel name (same as Excel)
                    if (allocation.personnelId && allocation.personnelId.name) {
                        const name = allocation.personnelId.name;
                        allocation.personnelId.formattedName = `${name.family?.join(' ')} ${name.given?.join(' ')}`.trim();
                    }
                });

                // 5. Group allocations by structure (same as Excel)
                const groupedAllocations = _.groupBy(allocations, allocation => allocation.structureInfo.id);

                // 6. Sort structures by code for consistent output (same as Excel)
                const structureIds = Object.keys(groupedAllocations).sort((a, b) => {
                    const codeA = groupedAllocations[a][0]?.structureInfo?.code || '999';
                    const codeB = groupedAllocations[b][0]?.structureInfo?.code || '999';
                    return codeA.localeCompare(codeB);
                });

                // Track grand totals (same as Excel)
                let grandTotalParts = 0;
                let grandTotalBrut = 0;
                let grandTotalTax = 0;
                let grandTotalNet = 0;

                // 7. Add title and header
                doc.fontSize(14) // Reduced from 16
                   .font('Helvetica-Bold')
                   .text(`ETAT DE REPARTITION D'${bonusInstance.templateId.name} ${bonusInstance.referencePeriod}`, { align: 'center' })
                   .moveDown(0.5); // Reduced from 1

                doc.fontSize(10) // Reduced from 12
                   .text('I: PAIEMENTS PAR VIREMENT', { align: 'left' })
                   .font('Helvetica-Oblique')
                   .text('a: Services centraux, agences comptables et autres services', { align: 'left' })
                   .moveDown(0.5); // Reduced from 1

                // 8. Define table dimensions - Adjusted column widths for better fit
                const startX = 40;
                let startY = doc.y;
                const colWidths = [25, 140, 60, 120, 35, 70, 65, 70, 60, 95]; // Adjusted widths after removing Emargement
                const colNames = [
                    "N° d'ordre",
                    'NOMS ET PRENOMS',
                    'MATRICULE',
                    'Fonction/Grade',
                    'Nb parts',
                    'MONTANT BRUT',
                    `{${bonusInstance.taxPercentage || 5.28}%}`,
                    'Net à Percevoir',
                    'CNI',
                    'Observations'
                    // Emargement column removed
                ];

                // 9. Draw table header
                doc.font('Helvetica-Bold')
                   .fontSize(8); // Reduced from default size

                // Draw header background
                doc.fillColor('#D3D3D3')
                   .rect(startX, startY,
                         colWidths.reduce((sum, w) => sum + w, 0), 25) // Increased from 20 to 25
                   .fill();

                // Draw header text
                doc.fillColor('black');
                let currentX = startX;
                colNames.forEach((name, i) => {
                    doc.text(name, currentX + 2, startY + 8, { // Adjusted vertical position for centering
                        width: colWidths[i] - 4,
                        align: 'center' // Changed from conditional alignment to center for all headers
                    });
                    currentX += colWidths[i];
                });

                startY += 25; // Increased from 20 to 25

                // 10. Process each structure group
                for (const structureId of structureIds) {
                    const structureAllocations = groupedAllocations[structureId];
                    if (!structureAllocations || structureAllocations.length === 0) continue;

                    // Get structure info from the first allocation in the group
                    const structureInfo = structureAllocations[0].structureInfo;

                    // Check if we need a new page
                    if (startY > doc.page.height - 100) {
                        doc.addPage();
                        startY = 50;

                        // Add table header on new page
                        doc.font('Helvetica-Bold')
                           .fontSize(8); // Reduced font size for header
                        doc.fillColor('#D3D3D3')
                           .rect(startX, startY,
                                colWidths.reduce((sum, w) => sum + w, 0), 25) // Increased from 20 to 25
                           .fill();

                        doc.fillColor('black');
                        currentX = startX;
                        colNames.forEach((name, i) => {
                            doc.text(name, currentX + 2, startY + 8, { // Adjusted from +5 to +8 for vertical centering
                                width: colWidths[i] - 4,
                                align: 'center' // Changed from conditional alignment to center for all headers
                            });
                            currentX += colWidths[i];
                        });

                        startY += 25; // Increased from 20 to 25
                    }

                    // Add structure header row
                    const headerHeight = 20; // Reduced from 25
                    doc.fillColor('#E06B21')
                       .rect(startX, startY,
                            colWidths.reduce((sum, w) => sum + w, 0), headerHeight)
                       .fill();

                    doc.fillColor('white')
                       .fontSize(11) // Reduced from 14
                       .font('Helvetica-Bold')
                       .text(`${structureInfo.name} - ${structureInfo.code}`,
                             startX, startY + 4,
                             { width: colWidths.reduce((sum, w) => sum + w, 0), align: 'center' });

                    startY += headerHeight;

                    // Track structure totals
                    let structureTotalParts = 0;
                    let structureTotalBrut = 0;
                    let structureTotalTax = 0;
                    let structureTotalNet = 0;

                    // Add data rows for this structure
                    let rowIndex = 1; // For tracking rows

                    for (const allocation of structureAllocations) {
                        // Check if we need a new page
                        if (startY > doc.page.height - 60) {
                            doc.addPage();
                            startY = 50;

                            // Add table header on new page
                            doc.font('Helvetica-Bold')
                               .fontSize(8); // Reduced font size for header
                            doc.fillColor('#D3D3D3')
                               .rect(startX, startY,
                                    colWidths.reduce((sum, w) => sum + w, 0), 25) // Increased from 20 to 25
                               .fill();

                            doc.fillColor('black');
                            currentX = startX;
                            colNames.forEach((name, i) => {
                                doc.text(name, currentX + 2, startY + 8, { // Adjusted from +5 to +8 for vertical centering
                                    width: colWidths[i] - 4,
                                    align: 'center' // Changed from conditional alignment to center for all headers
                                });
                                currentX += colWidths[i];
                            });

                            startY += 25; // Increased from 20 to 25
                        }

                        // Add light background to alternating rows for better readability
                        if (rowIndex % 2 === 0) {
                            doc.fillColor('#F9F9F9')
                               .rect(startX, startY,
                                    colWidths.reduce((sum, w) => sum + w, 0), 20)
                               .fill();
                        }

                        // Beautify grade based on status (same as Excel)
                        let gradeValue = 'N/A';
                        if (allocation.personnelSnapshotId?.data) {
                            const status = allocation.personnelSnapshotId.data.status || '';
                            const grade = allocation.personnelSnapshotId.data.grade || '';

                            if (status && grade) {
                                // Default language to French if not available
                                const language = 'fr';
                                gradeValue = dictionary.getValueFromJSON(
                                    '../../resources/dictionary/personnel/status/' + status + '/grades.json',
                                    parseInt(grade, 10),
                                    "code"
                                ) || grade;
                            } else {
                                gradeValue = grade || 'N/A';
                            }

                            // Add position name if available
                            if (allocation.personnelSnapshotId.data.position && allocation.personnelSnapshotId.data.position.name) {
                                gradeValue = gradeValue + " / " + allocation.personnelSnapshotId.data.position.name;
                            }
                        }

                        // Use stored values instead of calculating
                        const parts = allocation.calculationInputs?.parts || 0;
                        const brutAmount = allocation.grossAmount || 0;
                        const netAmount = allocation.netAmount || 0;
                        const taxAmount = brutAmount - netAmount;

                        // Add to structure totals
                        structureTotalParts += parts;
                        structureTotalBrut += brutAmount;
                        structureTotalTax += taxAmount;
                        structureTotalNet += netAmount;

                        // Get comments
                        const observations = allocation.calculationInputs?.comment || '';

                        // Format the name to prevent it from being too long
                        const formattedName = allocation.personnelId.formattedName || 'N/A';
                        // Format the grade to ensure it fits
                        const formattedGrade = gradeValue.length > 30 ? gradeValue.substring(0, 30) + '...' : gradeValue;
                        // Format observations to ensure they fit
                        const formattedObservations = observations.length > 20 ? observations.substring(0, 20) + '...' : observations;

                        // Draw the data row
                        doc.font('Helvetica')
                           .fontSize(7); // Smaller font size for data

                        // Set text color to red for excluded employees
                        if (allocation.status === 'excluded' || parts === 0) {
                            doc.fillColor('red');
                        } else {
                            doc.fillColor('black');
                        }

                        // Add cell values
                        const rowData = [
                            rowIndex++,
                            formattedName,
                            allocation.personnelId?.identifier || 'N/A',
                            formattedGrade,
                            parts,
                            Math.round(brutAmount).toLocaleString(),
                            Math.round(taxAmount).toLocaleString(),
                            Math.round(netAmount).toLocaleString(),
                            '', // CNI
                            formattedObservations
                            // Emargement column removed
                        ];

                        // Draw cell values with height for wrapping text
                        const rowHeight = 24; // Increased from 16 to 24 for better text visibility
                        currentX = startX;
                        rowData.forEach((value, i) => {
                            // Calculate vertical middle position for text
                            const verticalPosition = startY + (rowHeight / 2) - 4; // Center text vertically

                            doc.text(
                                value.toString(),
                                currentX + 2,
                                verticalPosition, // Centered vertically in the row
                                {
                                    width: colWidths[i] - 4,
                                    height: rowHeight,
                                    align: i <= 3 ? 'left' : (i === 9 ? 'left' : 'center'), // Center numeric values, left align text
                                    ellipsis: true,
                                    lineBreak: true // Enable text wrapping
                                }
                            );
                            currentX += colWidths[i];
                        });

                        // Draw cell borders
                        doc.strokeColor('#cccccc');
                        currentX = startX;
                        colWidths.forEach(width => {
                            doc.rect(currentX, startY, width, rowHeight).stroke();
                            currentX += width;
                        });

                        startY += rowHeight;
                    }

                    // Check if we need a new page for subtotal
                    if (startY > doc.page.height - 60) {
                        doc.addPage();
                        startY = 50;
                    }

                    // Add structure subtotal row
                    doc.font('Helvetica-Bold')
                       .fontSize(8) // Reduced font size
                       .fillColor('black');

                    // Draw subtotal background
                    doc.fillColor('#EBEBEB')
                       .rect(startX, startY,
                            colWidths.reduce((sum, w) => sum + w, 0), 20) // Reduced from 25
                       .fill();

                    // Draw subtotal text
                    doc.fillColor('black');

                    // Add subtotal label
                    doc.text('SOUS-TOTAL',
                          startX + colWidths[0] + colWidths[1] + colWidths[2],
                          startY + 6, // Adjusted for smaller height
                          { width: colWidths[3] });

                    // Add subtotal values
                    doc.text(structureTotalParts.toString(),
                          startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
                          startY + 6, // Adjusted for smaller height
                          { width: colWidths[4], align: 'right' });

                    doc.text(Math.round(structureTotalBrut).toLocaleString(),
                          startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4],
                          startY + 6, // Adjusted for smaller height
                          { width: colWidths[5], align: 'right' });

                    doc.text(Math.round(structureTotalTax).toLocaleString(),
                          startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5],
                          startY + 6, // Adjusted for smaller height
                          { width: colWidths[6], align: 'right' });

                    doc.text(Math.round(structureTotalNet).toLocaleString(),
                          startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6],
                          startY + 6, // Adjusted for smaller height
                          { width: colWidths[7], align: 'right' });

                    // Draw subtotal border
                    doc.rect(startX, startY, colWidths.reduce((sum, w) => sum + w, 0), 25)
                       .lineWidth(1)
                       .stroke();

                    startY += 25; // Reduced from 35 to save space
                }

                // Check if we need a new page for grand total
                if (startY > doc.page.height - 60) {
                    doc.addPage();
                    startY = 50;
                }

                // Add grand total row - with stronger styling
                doc.font('Helvetica-Bold')
                   .fontSize(10) // Reduced from 13
                   .fillColor('black');

                // Draw grand total background
                doc.fillColor('#D3D3D3')
                   .rect(startX, startY,
                        colWidths.reduce((sum, w) => sum + w, 0), 22) // Reduced from 30
                   .fill();

                // Draw grand total text
                doc.fillColor('black');

                // Add grand total label
                doc.text('TOTAL GENERAL',
                      startX + colWidths[0] + colWidths[1] + colWidths[2],
                      startY + 7, // Adjusted for smaller height
                      { width: colWidths[3] });

                // Add grand total values
                doc.text(grandTotalParts.toString(),
                      startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
                      startY + 7, // Adjusted for smaller height
                      { width: colWidths[4], align: 'right' });

                doc.text(Math.round(grandTotalBrut).toLocaleString(),
                      startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4],
                      startY + 7, // Adjusted for smaller height
                      { width: colWidths[5], align: 'right' });

                doc.text(Math.round(grandTotalTax).toLocaleString(),
                      startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5],
                      startY + 7, // Adjusted for smaller height
                      { width: colWidths[6], align: 'right' });

                doc.text(Math.round(grandTotalNet).toLocaleString(),
                      startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6],
                      startY + 7, // Adjusted for smaller height
                      { width: colWidths[7], align: 'right' });

                // Draw grand total border
                doc.rect(startX, startY, colWidths.reduce((sum, w) => sum + w, 0), 22) // Reduced from 30
                   .lineWidth(2)
                   .stroke();

                // Add signature area
                startY += 80; // Reduced from 100 to save space
                if (startY > doc.page.height - 100) {
                    doc.addPage();
                    startY = 80;
                }

                doc.fontSize(10) // Reduced from 12
                   .font('Helvetica-Bold')
                   .text('Signature Responsable', doc.page.width - 200, startY, { align: 'center' });

                // Add footer with date and page numbers
                const totalPages = doc.bufferedPageRange().count;
                for (let i = 0; i < totalPages; i++) {
                    doc.switchToPage(i);

                    const footer = `Document généré le ${new Date().toLocaleDateString('fr-FR')} | Page ${i + 1}/${totalPages}`;
                    doc.fontSize(7) // Reduced from 8
                       .font('Helvetica')
                       .text(footer, 40, doc.page.height - 25, { align: 'center', width: doc.page.width - 80 });
                }

                // Finalize the PDF
                doc.end();

            } catch (error) {
                console.error('PDF generation error:', error);
                reject(error);
            }
        });
    } catch (error) {
        console.error('Error generating PDF export:', error);
        throw error;
    }
};

/**
 * Export personnel bonus history to PDF
 * @param {string} personnelId - ID of the personnel
 * @param {Date} fromDate - Start date for filtering bonuses
 * @param {Date} toDate - End date for filtering bonuses
 * @returns {Promise<Buffer>} - A buffer containing the PDF data
 */
exports.exportPersonnelBonusToPdf = async (personnelId, fromDate, toDate) => {
    try {
        // --- Data Fetching ---
        if (!mongoose.Types.ObjectId.isValid(personnelId)) {
            throw new ApiError('Invalid personnel ID', httpStatus.BAD_REQUEST);
        }

        const personnel = await Personnel.findById(personnelId);
        if (!personnel) {
            throw new ApiError('Personnel not found', httpStatus.NOT_FOUND);
        }

        const startDate = fromDate ? new Date(fromDate) : new Date(new Date().getFullYear() - 3, 0, 1);
        const endDate = toDate ? new Date(toDate) : new Date();

        const bonusAllocations = await BonusAllocation.find({
            personnelId: personnelId,
            status: { $ne: 'excluded' },
            createdAt: { $gte: startDate, $lte: endDate }
        })
            .populate('instanceId', 'name referencePeriod taxPercentage')
            .populate('templateId', 'name category') // Ensure category is populated
            .populate('personnelSnapshotId') // Populate snapshot
            .sort({ createdAt: -1 });

        if (!bonusAllocations || bonusAllocations.length === 0) {
            throw new ApiError('No bonus data found for the selected period', httpStatus.NOT_FOUND);
        }

        // --- PDF Generation Setup ---
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 180, bottom: 40, left: 50, right: 50 }, // Increased top margin to accommodate header
            bufferPages: true
        });

        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));

        // --- Styling and Helpers ---
        const FONT_REGULAR = 'Helvetica';
        const FONT_BOLD = 'Helvetica-Bold';
        const COLOR_PRIMARY = '#1A237E';
        const COLOR_SECONDARY = '#5C6BC0';
        const COLOR_TEXT = '#333333';
        const COLOR_LIGHT_TEXT = '#666666';
        const COLOR_HEADER_BG = '#F5F5F5';
        const COLOR_TABLE_HEADER_BG = '#E8EAF6';
        const COLOR_ROW_ALT = '#FAFAFA';

        const categoryLabels = {
            with_parts: 'Primes basées sur les parts',
            without_parts: 'Primes sans parts',
            fixed_amount: 'Primes à montant fixe',
            calculated: 'Primes calculées',
            uncategorized: 'Primes manuelles / Non catégorisées'
        };

        // --- Generate Official Header ---
        const generateOfficialHeader = () => {
            // Layout based on the provided example image
            const pageWidth = doc.page.width;
            const logoSize = 80;
            const logoY = doc.page.margins.top - 180;
            const logoX = (pageWidth - logoSize) / 2;
            const colWidth = 400;
            const leftColX = -60;
            const rightColX = pageWidth - colWidth + 80;
            const headerTextY = logoY + 20;
            const lineHeight = 10;
            const fontSize = 8;

            // French column (left)
            doc.font('Helvetica-Bold').fontSize(fontSize).fillColor('black');
            doc.text('REPUBLIQUE DU CAMEROUN', leftColX, headerTextY, { width: colWidth, align: 'center' });
            doc.text('Paix- Travail- Patrie', leftColX, headerTextY + lineHeight, { width: colWidth, align: 'center' });
            doc.text('---   ----------', leftColX, headerTextY + 2 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('MINISTERE DES FINANCES', leftColX, headerTextY + 3 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('---------------', leftColX, headerTextY + 4 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('SECRETARIAT GENERAL', leftColX, headerTextY + 5 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('---------------', leftColX, headerTextY + 6 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('DIRECTION GENERALE DU TRESOR, DE LA COOPERATION', leftColX, headerTextY + 7 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('FINANCIERE ET MONETAIRE', leftColX, headerTextY + 8 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('---------------', leftColX, headerTextY + 9 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('DIRECTION DES AFFAIRES GENERALES', leftColX, headerTextY + 10 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('---------------', leftColX, headerTextY + 11 * lineHeight, { width: colWidth, align: 'center' });

            // English column (right)
            doc.font('Helvetica-Bold').fontSize(fontSize).fillColor('black');
            doc.text('REPUBLIC OF CAMEROON', rightColX, headerTextY, { width: colWidth, align: 'center' });
            doc.text('Peace- Work- Fatherland', rightColX, headerTextY + lineHeight, { width: colWidth, align: 'center' });
            doc.text('--------------', rightColX, headerTextY + 2 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('MINISTRY OF FINANCE', rightColX, headerTextY + 3 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('----------------', rightColX, headerTextY + 4 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('GENERAL SECRETARIAT', rightColX, headerTextY + 5 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('----------------', rightColX, headerTextY + 6 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('DIRECTORATE GENERAL OF TREASURY,', rightColX, headerTextY + 7 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('FINANCIAL AND MONETARY COOPERATION', rightColX, headerTextY + 8 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('----------------', rightColX, headerTextY + 9 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('DEPARTMENT OF GENERAL AFFAIRS', rightColX, headerTextY + 10 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('----------------', rightColX, headerTextY + 11 * lineHeight, { width: colWidth, align: 'center' });

            // Coat of arms in the center
            try {
                const imgPath = __dirname + '/../../public/img/amoiriecmr.jpg';
                doc.image(imgPath, (pageWidth - logoSize) / 2, headerTextY + 3 * lineHeight, { width: logoSize });
            } catch (error) {
                doc.rect((pageWidth - logoSize) / 2, headerTextY + 3 * lineHeight, logoSize, logoSize).stroke();
            }
        };

        const generateHeader = () => {
            // Only add the official header on the first page
            if (doc.bufferedPageRange().count === 1) {
                generateOfficialHeader();
                doc.moveDown(4);
            }

            doc.fillColor(COLOR_PRIMARY)
                .fontSize(16).font(FONT_BOLD)
                .text('HISTORIQUE DES PRIMES ET GRATIFICATIONS', doc.page.margins.left, doc.y, {
                    align: 'center',
                    width: doc.page.width - doc.page.margins.left - doc.page.margins.right
                });
            const formattedName = `${personnel.name?.family?.join(' ') || ''} ${personnel.name?.given?.join(' ') || ''}`.trim();
            doc.fontSize(10).font(FONT_REGULAR).fillColor(COLOR_LIGHT_TEXT)
                .text(formattedName, doc.page.margins.left, doc.y, {
                    align: 'center',
                    width: doc.page.width - doc.page.margins.left - doc.page.margins.right
                });
            doc.moveDown(2);

        };

        // Adjust the footer generation to ensure no blank spaces are added unexpectedly
        const generateFooter = (qrImage) => {
            const pageCount = doc.bufferedPageRange().count;

            // Store current page to restore it later
            const currentPage = doc._pageNumber || 0;

            for (let i = 0; i < pageCount; i++) {
                doc.switchToPage(i);

                // Ensure footer does not trigger a new page
                const footerY = doc.page.height - doc.page.margins.bottom - 20; // Adjusted position
                if (footerY > doc.page.height - 30) {
                    continue; // Skip adding footer if it exceeds the page height
                }

                // Add footer text
                const footerText = `Page ${i + 1} sur ${pageCount} | Généré par Admineex le ${moment().format('DD/MM/YYYY à HH:mm')}`;
                doc.fontSize(8).fillColor(COLOR_LIGHT_TEXT)
                    .text(footerText,
                        doc.page.margins.left,
                        footerY,
                        {
                            align: 'center',
                            width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
                            lineBreak: false
                        });

                // Add QR code if provided
                if (qrImage) {
                    const qrSize = 50;
                    const qrX = doc.page.width - doc.page.margins.right - qrSize;
                    const qrY = footerY - qrSize - 10; // Adjusted position
                    if (qrY > doc.page.margins.top) {
                        doc.image(qrImage, qrX, qrY, { width: qrSize, height: qrSize });
                    }
                }
            }

            // Restore the page we were on
            doc.switchToPage(currentPage);
        };

        // Ensure no blank spaces are added in the document content
        const removeBlankSpaces = (doc) => {
            const pageCount = doc.bufferedPageRange().count;

            for (let i = 0; i < pageCount; i++) {
                doc.switchToPage(i);

                // Adjust content to remove unnecessary blank spaces
                const contentY = doc.page.margins.top;
                if (contentY > doc.page.height - doc.page.margins.bottom) {
                    continue; // Skip if content exceeds page height
                }

                // Ensure content is properly aligned
                doc.text('', doc.page.margins.left, contentY, {
                    align: 'left',
                    width: doc.page.width - doc.page.margins.left - doc.page.margins.right
                });
            }
        };

        // --- PDF Content ---
        generateHeader(doc);

        // --- Info Section ---
        const latestAllocation = bonusAllocations[0];
        const position = latestAllocation.personnelSnapshotId?.data?.position;

        doc.fontSize(10).font(FONT_BOLD).fillColor(COLOR_TEXT);
        const infoTop = doc.y;
        doc.text('Matricule:', 50, infoTop).text('Poste:', 50, infoTop + 15).text('Structure:', 50, infoTop + 30);
        doc.font(FONT_REGULAR);
        doc.text(personnel.identifier || 'N/A', 150, infoTop);
        doc.text(position?.name || 'N/A', 150, infoTop + 15);
        doc.text(position?.structure?.name || 'N/A', 150, infoTop + 30);
        doc.font(FONT_BOLD).text('Période du rapport:', 300, infoTop);
        doc.font(FONT_REGULAR).text(`${moment(startDate).format('DD/MM/YYYY')} au ${moment(endDate).format('DD/MM/YYYY')}`, 420, infoTop);
        doc.moveDown(4);

        // --- Data Processing and Grouping ---
        let totalGross = 0, totalTax = 0, totalNet = 0;
        bonusAllocations.forEach(bonus => {
            const grossAmount = bonus.calculatedAmount || 0;
            const netAmount = bonus.finalAmount || 0;
            totalGross += grossAmount;
            totalTax += (grossAmount - netAmount);
            totalNet += netAmount;
            bonus.displayGross = grossAmount;
            bonus.displayTax = grossAmount - netAmount;
            bonus.displayNet = netAmount;
        });

        const groupedBonuses = _.groupBy(bonusAllocations, bonus => bonus.templateId?.category || 'uncategorized');

        // --- Summary Section ---
        const summaryY = doc.y;
        const summaryBoxWidth = 150, summaryBoxHeight = 50, summarySpacing = 20;
        const drawSummaryBox = (x, y, title, value) => {
            doc.rect(x, y, summaryBoxWidth, summaryBoxHeight).fill(COLOR_HEADER_BG);
            doc.fillColor(COLOR_SECONDARY).font(FONT_BOLD).fontSize(10).text(title, x + 10, y + 10);
            doc.fillColor(COLOR_TEXT).font(FONT_REGULAR).fontSize(12).text(`${Math.round(value).toLocaleString()} FCFA`, x + 10, y + 28);
        };
        drawSummaryBox(50, summaryY, 'MONTANT BRUT TOTAL', totalGross);
        drawSummaryBox(50 + summaryBoxWidth + summarySpacing, summaryY, 'TOTAL RETENUES', totalTax);
        drawSummaryBox(50 + 2 * (summaryBoxWidth + summarySpacing), summaryY, 'MONTANT NET TOTAL', totalNet);
        doc.moveDown(3);

        // --- Tables Section ---
        const tableHeaders = ['Période', 'Type de Prime', 'Montant Brut', 'Retenue', 'Montant Net'];
        const tableWidths = [100, 170, 80, 80, 80];
        const tableStartX = 50;
        const tableWidth = tableWidths.reduce((a, b) => a + b);

        const drawTableHeader = (y) => {
            doc.rect(tableStartX, y, tableWidth, 25).fill(COLOR_TABLE_HEADER_BG);
            doc.font(FONT_BOLD).fontSize(9).fillColor(COLOR_PRIMARY);
            let currentX = tableStartX;
            tableHeaders.forEach((header, i) => {
                doc.text(header, currentX + 5, y + 8, { width: tableWidths[i] - 10, align: 'center' });
                currentX += tableWidths[i];
            });
            return y + 25;
        };

        const checkNewPage = (y, requiredHeight) => {
            if (y + requiredHeight > doc.page.height - doc.page.margins.bottom) {
                doc.addPage();
                generateHeader(doc);
                return drawTableHeader(doc.y);
            }
            return y;
        };

        let currentY = doc.y;

        const categoriesToProcess = Object.keys(categoryLabels).filter(
            category => groupedBonuses[category] && groupedBonuses[category].length > 0
        );

        categoriesToProcess.forEach((category, index) => {
            const isLastCategory = index === categoriesToProcess.length - 1;

            // Check space for category header and table header
            currentY = checkNewPage(currentY, 50);
            doc.fontSize(12).font(FONT_BOLD).fillColor(COLOR_PRIMARY)
                .text(categoryLabels[category], tableStartX, currentY, { underline: true });
            currentY += 25;

            currentY = drawTableHeader(currentY);

            let categoryGross = 0, categoryTax = 0, categoryNet = 0;

            groupedBonuses[category].forEach((bonus, i) => {
                // Check space for one row
                currentY = checkNewPage(currentY, 25);
                const rowColor = i % 2 === 0 ? '#FFFFFF' : COLOR_ROW_ALT;
                doc.rect(tableStartX, currentY, tableWidth, 25).fill(rowColor);
                doc.font(FONT_REGULAR).fontSize(8).fillColor(COLOR_TEXT);

                const rowData = [
                    { text: bonus.instanceId?.referencePeriod || moment(bonus.createdAt).format('MMMM YYYY'), align: 'left' },
                    { text: bonus.templateId?.name || 'Bonus Manuel', align: 'left' },
                    { text: Math.round(bonus.displayGross).toLocaleString(), align: 'right' },
                    { text: Math.round(bonus.displayTax).toLocaleString(), align: 'right' },
                    { text: Math.round(bonus.displayNet).toLocaleString(), align: 'right' }
                ];

                let currentX = tableStartX;
                rowData.forEach((cell, j) => {
                    doc.text(cell.text, currentX + 5, currentY + 8, { width: tableWidths[j] - 10, align: cell.align });
                    currentX += tableWidths[j];
                });
                currentY += 25;

                categoryGross += bonus.displayGross;
                categoryTax += bonus.displayTax;
                categoryNet += bonus.displayNet;
            });

            // Check space for subtotal row
            currentY = checkNewPage(currentY, 20);
            doc.rect(tableStartX, currentY, tableWidth, 20).fill(COLOR_HEADER_BG);
            doc.font(FONT_BOLD).fontSize(8).fillColor(COLOR_TEXT);
            const subtotalData = [
                { text: 'SOUS-TOTAL', align: 'right', width: tableWidths.slice(0, 2).reduce((a, b) => a + b) },
                { text: Math.round(categoryGross).toLocaleString(), align: 'right', width: tableWidths[2] },
                { text: Math.round(categoryTax).toLocaleString(), align: 'right', width: tableWidths[3] },
                { text: Math.round(categoryNet).toLocaleString(), align: 'right', width: tableWidths[4] }
            ];
            let subtotalX = tableStartX;
            subtotalData.forEach(cell => {
                doc.text(cell.text, subtotalX + 5, currentY + 6, { width: cell.width - 10, align: cell.align });
                subtotalX += cell.width;
            });
            currentY += 20;

            // Add space only if it's not the last category
            if (!isLastCategory) {
                currentY += 10;
            }
        });

        // --- QR Code Generation ---
        const verificationUrl = `https://your-verification-url.com/verify?personnel=${encodeURIComponent(personnel.name?.text)}&date=${Date.now()}`;
        const qrImage = qr.imageSync(verificationUrl, { type: 'png' });


        // --- Finalization ---
        generateFooter(qrImage);
        doc.end();

        return new Promise((resolve, reject) => {
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);
        });

    } catch (error) {
        console.error('Export error:', error);
        throw new ApiError(
            error.message || 'Failed to export personnel bonus history',
            error.statusCode || httpStatus.INTERNAL_SERVER_ERROR
        );
    }
};
