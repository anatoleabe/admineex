#!/usr/bin/env node
const path = require('path');
const Excel = require('exceljs');
const { parseArgs, connectMongo } = require('./helpers/utils');
const { Personnel } = require('../../app/models/personnel');

function getCellValue(cell) {
    if (!cell) return null;
    const { value } = cell;
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'result')) {
        return value.result;
    }
    return value;
}

function normalizeValue(val) {
    if (val === null || val === undefined) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'string') return val.trim();
    return val;
}

async function readPersonnelRows(filePath) {
    const workbook = new Excel.Workbook();
    await workbook.xlsx.readFile(path.resolve(filePath));
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('No worksheet found in Excel file');

    const headerMap = {};
    sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const header = (getCellValue(cell) || '').toString().trim();
        if (header) {
            headerMap[colNumber] = header;
        }
    });
    if (!Object.keys(headerMap).length) {
        throw new Error('No headers found on the first row of the Excel file');
    }

    const rows = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const entry = { rowNumber };
        Object.entries(headerMap).forEach(([col, header]) => {
            const raw = getCellValue(row.getCell(Number(col)));
            if (raw !== undefined && raw !== null && raw !== '') {
                entry[header] = normalizeValue(raw);
            }
        });
        // Keep rows that contain at least one field besides the rowNumber
        if (Object.keys(entry).length > 1) {
            rows.push(entry);
        }
    });
    return rows;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const file = args.file || args.f;
    const dryRun = !!args.dryRun;

    if (!file) {
        throw new Error('Missing required arg: --file');
    }

    await connectMongo();
    console.log(`[PersonnelImport] Reading file ${file}`);
    const rows = await readPersonnelRows(file);
    console.log(`[PersonnelImport] Loaded ${rows.length} data rows`);

    let processed = 0;
    let updated = 0;
    let missing = 0;
    let skipped = 0;
    let errors = 0;
    let wouldUpdate = 0;

    for (const row of rows) {
        processed += 1;
        const personnelIdRaw = row._id || row.id;
        const personnelId = personnelIdRaw ? personnelIdRaw.toString().trim() : '';
        if (!personnelId) {
            errors += 1;
            console.warn(`[PersonnelImport][row ${row.rowNumber}] Missing _id column, skipping`);
            continue;
        }

        const updatePayload = {};
        Object.entries(row).forEach(([key, value]) => {
            if (key === '_id' || key === 'id' || key === 'rowNumber') return;
            if (value === null || value === undefined || value === '') return;
            updatePayload[key] = value;
        });

        if (!Object.keys(updatePayload).length) {
            skipped += 1;
            continue;
        }

        if (dryRun) {
            wouldUpdate += 1;
            console.log(`[PersonnelImport][row ${row.rowNumber}] Would update ${personnelId} with`, updatePayload);
            continue;
        }

        try {
            const res = await Personnel.updateOne({ _id: personnelId }, { $set: updatePayload });
            const matched = (res && (res.matchedCount != null ? res.matchedCount : (res.n != null ? res.n : 0))) || 0;
            const modified = (res && (res.modifiedCount != null ? res.modifiedCount : (res.nModified != null ? res.nModified : 0))) || 0;
            console.log(updatePayload)

            if (!matched) {
                missing += 1;
                console.warn(`[PersonnelImport][row ${row.rowNumber}] No personnel found for _id=${personnelId}`);
                continue;
            }
            if (!modified) {
                skipped += 1;
                console.log(`[PersonnelImport][row ${row.rowNumber}] No changes applied for _id=${personnelId}`);
                continue;
            }

            updated += 1;
        } catch (err) {
            errors += 1;
            console.error(`[PersonnelImport][row ${row.rowNumber}] Failed to update _id=${personnelId}:`, err.message);
        }
    }

    console.log(`[PersonnelImport] Done. processed=${processed} updated=${updated} missing=${missing} skipped=${skipped} errors=${errors} dryRun=${dryRun} wouldUpdate=${wouldUpdate}`);
    if (dryRun) {
        console.log('[PersonnelImport] Dry-run mode: no data was persisted');
    }
    process.exit(0);
}

main().catch(err => {
    console.error('[PersonnelImport] Failed:', err);
    process.exit(1);
});
