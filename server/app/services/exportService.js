const excel = require('exceljs');
const { BonusInstance } = require('../models/bonus/instance');
const { BonusAllocation } = require('../models/bonus/allocation');
const { ApiError } = require('../utils/ApiError');
const httpStatus = require('http-status');
const dictionary = require('../utils/dictionary');
const _ = require('lodash');

exports.exportBonusToExcel = async (instance) => {
    try {
        // 1. Get instance data
        const bonusInstance = await BonusInstance.findById(instance._id)
            .populate('templateId', 'name code')
            .populate('createdBy', 'firstname lastname');

        if (!bonusInstance) {
            throw new ApiError('Bonus instance not found', httpStatus.NOT_FOUND);
        }

        // 2. Get allocations with structure info from snapshots
        const allocations = await BonusAllocation.find({ instanceId: instance._id })
            .populate('personnelId', 'identifier name')
            .populate('personnelSnapshotId');

        // 3. Create workbook
        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet('Bonus Allocations');

        // 4. Add title and section headers (MERGED CELLS)
        worksheet.mergeCells('A1:K1');
        worksheet.getCell('A1').value = `ETAT DE REPARTITION D'${bonusInstance.templateId.name} ${bonusInstance.referencePeriod}`;
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        // Empty row
        worksheet.addRow([]);

        // Section headers
        worksheet.mergeCells('B3:J3');
        worksheet.getCell('B3').value = 'I: PAIEMENTS PAR VIREMENT';
        worksheet.getCell('B3').font = { bold: true, size: 12 };

        worksheet.mergeCells('B4:J4');
        worksheet.getCell('B4').value = 'a: Services centraux, agences comptables et autres services';
        worksheet.getCell('B4').font = { italic: true };

        // 5. Define column headers
        worksheet.addRow([]); // Empty row before headers

        // 6. Set column widths
        worksheet.columns = [
            { key: 'index', width: 10 },
            { key: 'name', width: 25 },
            { key: 'matricule', width: 15 },
            { key: 'grade', width: 15 },
            { key: 'parts', width: 15 },
            { key: 'brut', width: 15 },
            { key: 'tax', width: 15 },
            { key: 'net', width: 15 },
            { key: 'cni', width: 15 },
            { key: 'obs', width: 15 },
            { key: 'signature', width: 15 }
        ];

        // 7. Group allocations by structure
        // Extract structure info for each allocation
        allocations.forEach(allocation => {
            if (allocation.personnelSnapshotId?.data?.position?.structure) {
                allocation.structureInfo = allocation.personnelSnapshotId.data.position.structure;
            } else {
                allocation.structureInfo = { id: 'undefined', code: '000', name: 'STRUCTURE INCONNUE' };
            }
        });

        // Group by structure
        const groupedAllocations = _.groupBy(allocations, allocation => allocation.structureInfo.id);

        // Sort structures by code for consistent output
        const structureIds = Object.keys(groupedAllocations).sort((a, b) => {
            const codeA = groupedAllocations[a][0]?.structureInfo?.code || '999';
            const codeB = groupedAllocations[b][0]?.structureInfo?.code || '999';
            return codeA.localeCompare(codeB);
        });

        // Track the current row for iterating through the worksheet
        let currentRowNum = 6; // Start after headers
        let globalIndex = 1;

        // 8. Add headers once at the top
        const headerRow = worksheet.getRow(currentRowNum);
        headerRow.values = [
            "N° d'ordre",
            'NOMS ET PRENOMS',
            'MATRICULE',
            'Fonction/Grade',
            'Nombre de parts',
            'MONTANT BRUT',
            '{5,28%}',
            'Net à Percevoir',
            'CNI',
            'Observations',
            'Emargement'
        ];

        // Style header row
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center' };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD3D3D3' }
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
        currentRowNum++;

        // 9. Add data rows grouped by structure
        let grandTotalParts = 0;
        let grandTotalBrut = 0;
        let grandTotalTax = 0;
        let grandTotalNet = 0;

        for (const structureId of structureIds) {
            const structureAllocations = groupedAllocations[structureId];
            if (!structureAllocations || structureAllocations.length === 0) continue;

            // Get structure info from the first allocation in the group
            const structureInfo = structureAllocations[0].structureInfo;

            // Add structure header row
            const structureHeaderRow = worksheet.addRow([]);
            currentRowNum++;

            // Merge cells for structure header
            worksheet.mergeCells(`A${currentRowNum}:K${currentRowNum}`);
            const structureCell = worksheet.getCell(`A${currentRowNum}`);
            structureCell.value = `${structureInfo.name} - ${structureInfo.code}`;
            structureCell.font = { color: { argb: 'FFFFFF' }, size: 16, bold: true };
            structureCell.alignment = { vertical: 'middle', horizontal: 'center' };
            structureCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE06B21' } };
            structureCell.border = {
                top: { style: 'thick', color: { argb: 'FF964714' } },
                left: { style: 'thick', color: { argb: 'FF964714' } },
                bottom: { style: 'thick', color: { argb: 'FF964714' } },
                right: { style: 'thick', color: { argb: 'FF964714' } }
            };
            currentRowNum++;

            // Add data rows for this structure
            let structureTotalParts = 0;
            let structureTotalBrut = 0;
            let structureTotalTax = 0;
            let structureTotalNet = 0;

            structureAllocations.forEach((allocation) => {
                if (allocation.personnelId && allocation.personnelId.name) {
                    const name = allocation.personnelId.name;
                    allocation.personnelId.formattedName = `${name.family?.join(' ')} ${name.given?.join(' ')}`.trim();
                }

                // Beautify grade based on status
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

                const parts = allocation.calculationInputs?.parts || 0;
                const brutAmount = allocation.finalAmount || 0;
                const taxAmount = brutAmount * 0.0528;
                const netAmount = brutAmount * 0.9472;

                structureTotalParts += parts;
                structureTotalBrut += brutAmount;
                structureTotalTax += taxAmount;
                structureTotalNet += netAmount;

                // Get the comment from calculationInputs
                const observations = allocation.calculationInputs?.comment || '';

                const rowData = [
                    globalIndex++,
                    allocation.personnelId.formattedName || 'N/A',
                    allocation.personnelId?.identifier || 'N/A',
                    gradeValue,
                    parts,
                    brutAmount,
                    taxAmount,
                    netAmount,
                    '',
                    observations,
                    ''
                ];

                const dataRow = worksheet.addRow(rowData);
                currentRowNum++;

                // Format number columns
                ['F', 'G', 'H'].forEach(col => {
                    worksheet.getCell(`${col}${dataRow.number}`).numFmt = '#,##0';
                });

                // Add light borders to data cells
                dataRow.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };

                    // Set font color to red for excluded status or when parts are 0
                    if (allocation.status === 'excluded' || parts === 0) {
                        cell.font = { color: { argb: 'FFFF0000' } };
                    }
                });
            });

            // Add structure subtotal row
            const subtotalRow = worksheet.addRow([
                '',
                '',
                '',
                'SOUS-TOTAL',
                structureTotalParts,
                structureTotalBrut,
                structureTotalTax,
                structureTotalNet,
                '',
                '',
                ''
            ]);
            currentRowNum++;

            // Style subtotal row
            subtotalRow.eachCell((cell) => {
                cell.font = { bold: true };
                cell.border = {
                    top: { style: 'thin' },
                    bottom: { style: 'double' }
                };
            });

            // Format number columns for subtotal
            ['E', 'F', 'G', 'H'].forEach(col => {
                worksheet.getCell(`${col}${subtotalRow.number}`).numFmt = '#,##0';
            });

            // Add empty row after each structure
            worksheet.addRow([]);
            currentRowNum++;

            // Add to grand totals
            grandTotalParts += structureTotalParts;
            grandTotalBrut += structureTotalBrut;
            grandTotalTax += structureTotalTax;
            grandTotalNet += structureTotalNet;
        }

        // 10. Add grand total row
        const grandTotalRow = worksheet.addRow([
            '',
            '',
            '',
            'TOTAL GENERAL',
            grandTotalParts,
            grandTotalBrut,
            grandTotalTax,
            grandTotalNet,
            '',
            '',
            ''
        ]);

        // Style grand total row
        grandTotalRow.eachCell((cell) => {
            cell.font = { bold: true, size: 12 };
            cell.border = {
                top: { style: 'thin' },
                bottom: { style: 'double' }
            };
        });

        // Format number columns for grand total
        ['E', 'F', 'G', 'H'].forEach(col => {
            worksheet.getCell(`${col}${grandTotalRow.number}`).numFmt = '#,##0';
            worksheet.getCell(`${col}${grandTotalRow.number}`).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFEBEBEB' }
            };
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
                    '{5,28%}',
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
                        align: 'center', // Changed from conditional alignment to center for all headers
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
                                align: 'center', // Changed from conditional alignment to center for all headers
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
                                    align: 'center', // Changed from conditional alignment to center for all headers
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

                        // Calculate amounts (same as Excel)
                        const parts = allocation.calculationInputs?.parts || 0;
                        const brutAmount = allocation.finalAmount || 0;
                        const taxAmount = brutAmount * 0.0528;
                        const netAmount = brutAmount * 0.9472;

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
