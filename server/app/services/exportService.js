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