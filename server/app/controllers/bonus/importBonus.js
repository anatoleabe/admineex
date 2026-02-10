const formidable = require('formidable');
const path = require('path');
const fs = require('fs');
const { importBonusData } = require('../../services/bonusImportService');

exports.api = {};

/**
 * POST /api/bonus/import
 *
 * Accepts a multipart form with:
 *   - file:            Excel file (.xlsx)
 *   - templateCode:    Unique template code
 *   - templateName:    Human-readable name
 *   - category:        'with_parts' | 'without_parts' | 'ift'
 *   - periodicity:     'quarterly' | 'monthly' | 'yearly' | etc.
 *   - referencePeriod: 'YYYY-Qn' or 'YYYY-MM'
 *   - status:          'validated' | 'approved' | 'paid'
 */
exports.api.importBonusData = function (req, res) {
    if (!req.actor) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const form = new formidable.IncomingForm();
    form.maxFileSize = 50 * 1024 * 1024; // 50 MB

    form.parse(req, async function (err, fields, files) {
        let uploadedFilePath = null;

        try {
            if (err) {
                console.error('[BonusImport] Form parse error:', err);
                return res.status(400).json({ error: 'Failed to parse uploaded file: ' + err.message });
            }

            // --- Validate file ---
            const file = files.file;
            if (!file) {
                return res.status(400).json({ error: 'No file uploaded. Please attach an Excel (.xlsx) file.' });
            }

            const fileName = file.name || file.originalFilename || '';
            const ext = path.extname(fileName).toLowerCase();
            if (ext !== '.xlsx' && ext !== '.xls') {
                return res.status(400).json({ error: 'Invalid file format. Only .xlsx and .xls files are accepted.' });
            }

            uploadedFilePath = file.path || file.filepath;

            // --- Extract fields ---
            const templateCode = (fields.templateCode || '').toString().trim();
            const templateName = (fields.templateName || '').toString().trim();
            const category = (fields.category || '').toString().trim();
            const periodicity = (fields.periodicity || 'quarterly').toString().trim();
            const referencePeriod = (fields.referencePeriod || '').toString().trim();
            const status = (fields.status || 'validated').toString().trim();

            // --- Validate required fields ---
            const missingFields = [];
            if (!templateCode) missingFields.push('templateCode');
            if (!templateName) missingFields.push('templateName');
            if (!category) missingFields.push('category');
            if (!referencePeriod) missingFields.push('referencePeriod');

            if (missingFields.length > 0) {
                return res.status(400).json({
                    error: 'Missing required fields: ' + missingFields.join(', ')
                });
            }

            // --- Validate category ---
            if (!['with_parts', 'without_parts', 'ift'].includes(category)) {
                return res.status(400).json({
                    error: 'Invalid category. Must be one of: with_parts, without_parts, ift'
                });
            }

            // --- Validate reference period format ---
            const periodRegex = /^\d{4}-Q[1-4]$|^\d{4}-(0[1-9]|1[0-2])$/;
            if (!periodRegex.test(referencePeriod)) {
                return res.status(400).json({
                    error: 'Invalid reference period format. Use YYYY-Qn (e.g. 2024-Q1) or YYYY-MM (e.g. 2024-01).'
                });
            }

            // --- Run import ---
            console.log(`[BonusImport] User ${req.actor.id} importing bonus data: templateCode=${templateCode}, period=${referencePeriod}, category=${category}`);

            const summary = await importBonusData({
                filePath: uploadedFilePath,
                templateCode,
                templateName,
                category,
                periodicity,
                referencePeriod,
                status
            });

            return res.status(200).json({
                success: true,
                message: `Import completed successfully. ${summary.created} allocations created.`,
                summary
            });

        } catch (importErr) {
            console.error('[BonusImport] Import error:', importErr);
            return res.status(500).json({
                error: 'Import failed: ' + (importErr.message || 'Unknown error'),
                details: importErr.message
            });
        } finally {
            // Cleanup uploaded temp file
            if (uploadedFilePath) {
                try {
                    if (fs.existsSync(uploadedFilePath)) {
                        fs.unlinkSync(uploadedFilePath);
                    }
                } catch (cleanupErr) {
                    console.warn('[BonusImport] Failed to cleanup temp file:', cleanupErr);
                }
            }
        }
    });
};
