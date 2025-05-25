// services/exportService.js
const excel = require('exceljs');
const { BonusInstance } = require('../models/bonus/instance');
const { BonusAllocation } = require('../models/bonus/allocation');
const {ApiError} = require('../utils/ApiError');
const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');
const pdf = require('pdf-creator-node');
const archiver = require('archiver');
const httpStatus = require('http-status');

/**
 * Export bonus instance data to Excel
 * @param {Object} instance - BonusInstance document
 * @returns {Promise<Object>} - Workbook and file information
 */
exports.exportToExcel = async (instance) => {
    try {
        // Get full instance data with allocations
        const bonusInstance = await BonusInstance.findById(instance._id)
            .populate('templateId', 'name code')
            .populate('createdBy', 'firstname lastname');

        if (!bonusInstance) {
            throw new ApiError('Bonus instance not found', httpStatus.NOT_FOUND);
        }

        // Get all allocations for this instance
        const allocations = await BonusAllocation.find({ instanceId: instance._id })
            .populate('personnelId', 'identifier name')
            .populate('personnelSnapshotId');

        // Create workbook
        const workbook = new excel.Workbook();
        workbook.creator = 'HR System';
        workbook.created = new Date();
        workbook.modified = new Date();

        // Add summary worksheet
        const summarySheet = workbook.addWorksheet('Summary');
        summarySheet.columns = [
            { header: 'Reference Period', key: 'period', width: 20 },
            { header: 'Bonus Template', key: 'template', width: 30 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Generated At', key: 'generatedAt', width: 20 },
            { header: 'Approved At', key: 'approvedAt', width: 20 },
            { header: 'Total Amount', key: 'totalAmount', width: 15, style: { numFmt: '#,##0.00' } },
            { header: 'Allocations Count', key: 'count', width: 15 }
        ];

        const totalAmount = allocations.reduce((sum, alloc) => sum + (alloc.finalAmount || 0), 0);

        summarySheet.addRow({
            period: bonusInstance.referencePeriod,
            template: bonusInstance.templateId.name,
            status: bonusInstance.status,
            generatedAt: bonusInstance.generationDate ? format(bonusInstance.generationDate, 'yyyy-MM-dd HH:mm') : 'N/A',
            approvedAt: bonusInstance.approvalDate ? format(bonusInstance.approvalDate, 'yyyy-MM-dd HH:mm') : 'N/A',
            totalAmount,
            count: allocations.length
        });

        // Style summary header
        summarySheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD3D3D3' }
            };
        });

        // Add allocations worksheet
        const allocationsSheet = workbook.addWorksheet('Allocations');
        allocationsSheet.columns = [
            { header: 'Personnel ID', key: 'personnelId', width: 15 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Grade', key: 'grade', width: 10 },
            { header: 'Category', key: 'category', width: 10 },
            { header: 'Rank', key: 'rank', width: 15 },
            { header: 'Base Salary', key: 'baseSalary', width: 15, style: { numFmt: '#,##0.00' } },
            { header: 'Parts', key: 'parts', width: 10 },
            { header: 'Calculated Amount', key: 'calculatedAmount', width: 20, style: { numFmt: '#,##0.00' } },
            { header: 'Final Amount', key: 'finalAmount', width: 20, style: { numFmt: '#,##0.00' } },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Adjustment Reason', key: 'adjustmentReason', width: 30 }
        ];

        allocations.forEach(allocation => {
            allocationsSheet.addRow({
                personnelId: allocation.personnelId.identifier,
                name: allocation.personnelId.name.text,
                grade: allocation.personnelSnapshotId?.data?.grade || 'N/A',
                category: allocation.personnelSnapshotId?.data?.category || 'N/A',
                rank: allocation.personnelSnapshotId?.data?.rank || 'N/A',
                baseSalary: allocation.calculationInputs?.baseSalary || 0,
                parts: allocation.calculationInputs?.parts || 1,
                calculatedAmount: allocation.calculatedAmount || 0,
                finalAmount: allocation.finalAmount || 0,
                status: allocation.status,
                adjustmentReason: allocation.calculationInputs?.adjustmentFactors?.reason || 'N/A'
            });
        });

        // Style allocations header
        allocationsSheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD3D3D3' }
            };
        });

        // Auto-filter
        allocationsSheet.autoFilter = 'A1:K1';

        // Add calculation details worksheet
        const calcSheet = workbook.addWorksheet('Calculation Rules');
        calcSheet.columns = [
            { header: 'Field', key: 'field', width: 25 },
            { header: 'Value', key: 'value', width: 40 }
        ];

        calcSheet.addRow({ field: 'Template Name', value: bonusInstance.templateId.name });
        calcSheet.addRow({ field: 'Template Code', value: bonusInstance.templateId.code });
        calcSheet.addRow({ field: 'Calculation Type', value: bonusInstance.templateId.calculationConfig.formulaType });

        if (bonusInstance.templateId.calculationConfig.formulaType === 'parts_based') {
            calcSheet.addRow({ field: 'Base Field', value: bonusInstance.templateId.calculationConfig.baseField });
            calcSheet.addRow({ field: 'Formula', value: bonusInstance.templateId.calculationConfig.formula });

            bonusInstance.templateId.calculationConfig.partRules.forEach((rule, index) => {
                calcSheet.addRow({
                    field: `Part Rule ${index + 1}`,
                    value: `IF ${rule.condition} THEN parts = ${rule.parts}`
                });
            });
        }

        // Create directory if not exists
        const dirPath = path.join(__dirname, '../../exports');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // Generate filename
        const filename = `bonus_export_${bonusInstance.templateId.code}_${bonusInstance.referencePeriod}_${format(new Date(), 'yyyyMMddHHmmss')}.xlsx`;
        const filePath = path.join(dirPath, filename);

        // Write file
        await workbook.xlsx.writeFile(filePath);

        return {
            filename,
            filePath,
            workbook, // Return workbook in case you want to modify it further
            instance: bonusInstance,
            allocationCount: allocations.length,
            totalAmount
        };

    } catch (error) {
        throw new ApiError(
            error.message || 'Failed to export bonus data',
            error.statusCode || httpStatus.INTERNAL_SERVER_ERROR

        );
    }
};

/**
 * Export bonus instance to PDF
 * @param {Object} instance - BonusInstance document
 * @returns {Promise<Object>} - PDF file information
 */
exports.exportToPDF = async (instance) => {
    try {
        // Get full instance data with allocations
        const bonusInstance = await BonusInstance.findById(instance._id)
            .populate('templateId', 'name code')
            .populate('createdBy', 'firstname lastname');

        if (!bonusInstance) {
            throw new ApiError('Bonus instance not found', httpStatus.NOT_FOUND);
        }

        // Get all allocations for this instance
        const allocations = await BonusAllocation.find({ instanceId: instance._id })
            .populate('personnelId', 'identifier name')
            .populate('personnelSnapshotId');

        // Prepare HTML template
        const templatePath = path.join(__dirname, '../templates/pdf/bonus-export.ejs');
        const html = fs.readFileSync(templatePath, 'utf-8');

        // Prepare data
        const totalAmount = allocations.reduce((sum, alloc) => sum + (alloc.finalAmount || 0), 0);
        const options = {
            format: 'A4',
            orientation: 'portrait',
            border: '10mm'
        };

        const document = {
            html,
            data: {
                instance: bonusInstance,
                allocations,
                totalAmount,
                generatedAt: format(new Date(), 'yyyy-MM-dd HH:mm'),
                logo: path.join(__dirname, '../public/images/logo.png')
            },
            path: '', // We'll set this after creating the directory
            type: ''
        };

        // Create directory if not exists
        const dirPath = path.join(__dirname, '../../exports');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // Generate filename
        const filename = `bonus_export_${bonusInstance.templateId.code}_${bonusInstance.referencePeriod}_${format(new Date(), 'yyyyMMddHHmmss')}.pdf`;
        document.path = path.join(dirPath, filename);

        // Generate PDF
        await pdf.create(document, options);

        return {
            filename,
            filePath: document.path,
            instance: bonusInstance,
            allocationCount: allocations.length,
            totalAmount
        };

    } catch (error) {
        throw new ApiError(
            error.message || 'Failed to export bonus data to PDF',
            error.statusCode || httpStatus.INTERNAL_SERVER_ERROR

        );
    }
};

/**
 * Export bonus data to ZIP archive containing multiple formats
 * @param {Object} instance - BonusInstance document
 * @param {Array<String>} formats - Array of formats to include ('excel', 'pdf')
 * @returns {Promise<Object>} - ZIP file information
 */
exports.exportToZip = async (instance, formats = ['excel', 'pdf']) => {
    try {
        // Create directory if not exists
        const dirPath = path.join(__dirname, '../../exports');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // Generate filename
        const zipFilename = `bonus_export_${instance.referencePeriod}_${format(new Date(), 'yyyyMMddHHmmss')}.zip`;
        const zipFilePath = path.join(dirPath, zipFilename);

        // Create archive
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        return new Promise((resolve, reject) => {
            output.on('close', () => {
                resolve({
                    filename: zipFilename,
                    filePath: zipFilePath,
                    size: archive.pointer()
                });
            });

            archive.on('error', (err) => {
                reject(new ApiError('Failed to create ZIP archive',httpStatus.INTERNAL_SERVER_ERROR));
            });

            archive.pipe(output);

            // Add files to archive based on requested formats
            const addFile = async (format, exporter) => {
                try {
                    const result = await exporter(instance);
                    archive.file(result.filePath, { name: `${result.filename}` });
                } catch (error) {
                    console.error(`Failed to add ${format} to archive:`, error);
                }
            };

            const formatExporters = {
                excel: this.exportToExcel,
                pdf: this.exportToPDF
            };

            const exportPromises = formats
                .filter(format => formatExporters[format])
                .map(format => addFile(format, formatExporters[format]));

            Promise.all(exportPromises)
                .then(() => archive.finalize())
                .catch(reject);
        });

    } catch (error) {
        throw new ApiError(
            error.message || 'Failed to export bonus data to ZIP',
            error.statusCode || httpStatus.INTERNAL_SERVER_ERROR
        );
    }
};

/**
 * Export bonus allocation history to Excel
 * @param {String} personnelId - Personnel ID
 * @returns {Promise<Object>} - Workbook and file information
 */
exports.exportAllocationHistory = async (personnelId) => {
    try {
        // Get all allocations for this personnel
        const allocations = await BonusAllocation.find({ personnelId })
            .populate('instanceId', 'referencePeriod status')
            .populate('templateId', 'name code')
            .sort({ createdAt: -1 });

        if (!allocations || allocations.length === 0) {
            throw new ApiError('No bonus allocations found', httpStatus.NOT_FOUND);
        }

        // Create workbook
        const workbook = new excel.Workbook();
        workbook.creator = 'HR System';
        workbook.created = new Date();
        workbook.modified = new Date();

        // Add allocations worksheet
        const sheet = workbook.addWorksheet('Bonus History');
        sheet.columns = [
            { header: 'Reference Period', key: 'period', width: 20 },
            { header: 'Bonus Type', key: 'type', width: 30 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Base Salary', key: 'baseSalary', width: 15, style: { numFmt: '#,##0.00' } },
            { header: 'Parts', key: 'parts', width: 10 },
            { header: 'Calculated Amount', key: 'calculatedAmount', width: 20, style: { numFmt: '#,##0.00' } },
            { header: 'Final Amount', key: 'finalAmount', width: 20, style: { numFmt: '#,##0.00' } },
            { header: 'Payment Date', key: 'paymentDate', width: 20 },
            { header: 'Version', key: 'version', width: 10 }
        ];

        allocations.forEach(allocation => {
            sheet.addRow({
                period: allocation.instanceId.referencePeriod,
                type: allocation.templateId.name,
                status: allocation.status,
                baseSalary: allocation.calculationInputs?.baseSalary || 0,
                parts: allocation.calculationInputs?.parts || 1,
                calculatedAmount: allocation.calculatedAmount || 0,
                finalAmount: allocation.finalAmount || 0,
                paymentDate: allocation.paymentDate ? format(allocation.paymentDate, 'yyyy-MM-dd') : 'N/A',
                version: allocation.version
            });
        });

        // Style header
        sheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD3D3D3' }
            };
        });

        // Auto-filter
        sheet.autoFilter = 'A1:I1';

        // Create directory if not exists
        const dirPath = path.join(__dirname, '../../exports');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // Generate filename
        const filename = `bonus_history_${allocations[0].personnelId}_${format(new Date(), 'yyyyMMddHHmmss')}.xlsx`;
        const filePath = path.join(dirPath, filename);

        // Write file
        await workbook.xlsx.writeFile(filePath);

        return {
            filename,
            filePath,
            allocationCount: allocations.length
        };

    } catch (error) {
        throw new ApiError(
            error.message || 'Failed to export allocation history',
            error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
        );
    }
};