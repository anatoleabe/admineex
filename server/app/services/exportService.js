const excel = require('exceljs');
const { BonusInstance } = require('../models/bonus/instance');
const { BonusAllocation } = require('../models/bonus/allocation');
const { ApiError } = require('../utils/ApiError');
const httpStatus = require('http-status');
const dictionary = require('../utils/dictionary'); // Add dictionary import

exports.exportBonusToExcel = async (instance) => {
    try {
        // 1. Get instance data
        const bonusInstance = await BonusInstance.findById(instance._id)
            .populate('templateId', 'name code')
            .populate('createdBy', 'firstname lastname');

        if (!bonusInstance) {
            throw new ApiError('Bonus instance not found', httpStatus.NOT_FOUND);
        }

        // 2. Get allocations
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

        // 5. Define column headers (THIS IS THE KEY FIX)
        worksheet.addRow([]); // Empty row before headers

        const headerRow = worksheet.addRow([
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
        ]);

        // 6. Style header row
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

        // 7. Set column widths
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

        // 8. Add data rows
        allocations.forEach((allocation, index) => {
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
            }

            const rowData = {
                index: index + 1,
                name: allocation.personnelId.formattedName || 'N/A',
                matricule: allocation.personnelId?.identifier || 'N/A',
                grade: gradeValue,
                parts: allocation.calculationInputs?.parts || 1,
                brut: allocation.finalAmount || 0,
                tax: (allocation.finalAmount || 0) * 0.0528,
                net: (allocation.finalAmount || 0) * 0.9472,
                cni: '',
                obs: '',
                signature: ''
            };

            const row = worksheet.addRow(Object.values(rowData));

            // Format number columns
            ['F', 'G', 'H'].forEach(col => {
                worksheet.getCell(`${col}${row.number}`).numFmt = '#,##0';
            });
        });

        // 9. Add totals row
        const totalRow = worksheet.addRow([
            '',
            '',
            '',
            'TOTAL',
            allocations.reduce((sum, a) => sum + (a.calculationInputs?.parts || 1), 0),
            allocations.reduce((sum, a) => sum + (a.finalAmount || 0), 0),
            allocations.reduce((sum, a) => sum + (a.finalAmount || 0) * 0.0528, 0),
            allocations.reduce((sum, a) => sum + (a.finalAmount || 0) * 0.9472, 0),
            '',
            '',
            ''
        ]);

        // Style totals row
        totalRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.border = {
                top: { style: 'thin' },
                bottom: { style: 'double' }
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