#!/usr/bin/env node
const path = require('path');
const { parseArgs, connectMongo, parseReferencePeriod } = require('./helpers/utils');
const { readRows } = require('./helpers/excel');
const { findOrCreateHistoricalTemplate } = require('./helpers/template');
const { findOrCreateInstance } = require('./helpers/instance');
const { importAllocations } = require('./helpers/allocation');
const fs = require('fs');

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const file = args.file || args.f;
    const referencePeriod = args.referencePeriod || args.period;
    const templateCode = args.templateCode || args.code;
    const templateName = args.templateName || args.name;
    const status = args.status || 'validated';
    const dryRun = !!args.dryRun;
    const periodicity = args.periodicity || 'quarterly';

    if (!file || !referencePeriod || !templateCode || !templateName) {
        throw new Error('Missing required args: --file, --referencePeriod, --templateCode, --templateName are required');
    }

    console.log(referencePeriod, templateCode, templateName)

    await connectMongo();
    console.log(`[PrimeAvecPart] Reading file ${file}`, );
    const rows = await readRows(file, { expectParts: true });

    const template = await findOrCreateHistoricalTemplate({
        code: templateCode,
        name: templateName,
        category: 'with_parts',
        periodicity,
        taxConfig: { taxName: 'IRPP', taxPercentage: 5.28 },
        calculationOverrides: { partsConfig: { defaultParts: 1 } }
    });

    const instance = await findOrCreateInstance({
        template,
        referencePeriod,
        status,
        filePath: path.resolve(file)
    });

    const summary = await importAllocations(rows, {
        template,
        instance,
        referencePeriod,
        filePath: path.resolve(file),
        isIFT: false,
        isWithParts: true,
        dryRun
    });

    console.log(`[PrimeAvecPart] Done. created=${summary.created} skippedExisting=${summary.skippedExisting} missingPersonnel=${summary.missingPersonnel} invalidRows=${summary.invalidRows} dryRun=${dryRun}`);
    if (summary.missingDetails && summary.missingDetails.length) {
        const safeCode = (templateCode || 'template').replace(/[^A-Za-z0-9_-]/g, '_');
        const safeRef = (referencePeriod || 'ref').replace(/[^A-Za-z0-9_-]/g, '_');
        const outPath = path.resolve(process.cwd(), `missing-personnel-${safeCode}-${safeRef}.csv`);
        const header = 'identifier,name,rowIndex';
        const lines = summary.missingDetails.map(d => {
            const ident = `"${(d.identifier || '').replace(/"/g, '""')}"`;
            const name = `"${(d.name || '').replace(/"/g, '""')}"`;
            const rowIdx = d.rowIndex != null ? d.rowIndex : '';
            return [ident, name, rowIdx].join(',');
        });
        fs.writeFileSync(outPath, [header, ...lines].join('\n'), 'utf8');
        console.log(`[PrimeAvecPart] Missing personnel list written to ${outPath}`);
    }
    if (dryRun) {
        console.log('[PrimeAvecPart] Dry-run mode: no data was persisted');
    }
    process.exit(0);
}

main().catch(err => {
    console.error('[PrimeAvecPart] Migration failed:', err);
    process.exit(1);
});
