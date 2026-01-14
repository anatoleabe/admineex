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
    const referencePeriod = parseReferencePeriod(args.referencePeriod || args.period);
    const templateCode = args.templateCode || args.code;
    const templateName = args.templateName || args.name;
    const status = args.status || 'validated';
    const dryRun = !!args.dryRun;
    const periodicity = args.periodicity || 'monthly';
    const personnelCorrectionsFileArg =
        args.personnelCorrectionsFile ||
        args.correctionsFile ||
        args.missingPersonnelMapFile ||
        args.matchFile ||
        null;

    if (!file || !referencePeriod || !templateCode || !templateName) {
        throw new Error('Missing required args: --file, --referencePeriod, --templateCode, --templateName are required');
    }

    await connectMongo();
    console.log(`[IFT] Reading file ${file}`);
    const rows = await readRows(file, { expectParts: false, layout: 'ift' });

    const template = await findOrCreateHistoricalTemplate({
        code: templateCode,
        name: templateName,
        category: 'without_parts',
        periodicity,
        taxConfig: { taxName: 'Aucune taxe', taxPercentage: 0 }
    });

    const instance = await findOrCreateInstance({
        template,
        referencePeriod,
        status,
        filePath: path.resolve(file)
    });

    let personnelCorrectionsFile = personnelCorrectionsFileArg;
    if (!personnelCorrectionsFile) {
        const importFileDir = path.dirname(path.resolve(file));
        const candidates = [
            path.resolve(__dirname, 'missing-personnel-PRIME_ALL_BON.xlsx'),
            path.resolve(__dirname, 'missing-personnel-PRIME_ALL_BON.csv'),
            path.resolve(importFileDir, 'missing-personnel-PRIME_ALL_BON.xlsx'),
            path.resolve(importFileDir, 'missing-personnel-PRIME_ALL_BON.csv'),
            path.resolve(process.cwd(), 'scripts/migration/missing-personnel-PRIME_ALL_BON.xlsx'),
            path.resolve(process.cwd(), 'scripts/migration/missing-personnel-PRIME_ALL_BON.csv'),
            path.resolve(process.cwd(), 'missing-personnel-PRIME_ALL_BON.xlsx'),
            path.resolve(process.cwd(), 'missing-personnel-PRIME_ALL_BON.csv')
        ];
        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                personnelCorrectionsFile = candidate;
                break;
            }
        }
    }
    if (personnelCorrectionsFile) {
        console.log(`[IFT] Using personnel corrections file ${personnelCorrectionsFile}`);
    } else {
        console.log('[IFT] No personnel corrections file found (missing-personnel-PRIME_ALL_BON.*), proceeding without corrections');
    }

    const summary = await importAllocations(rows, {
        template,
        instance,
        referencePeriod,
        filePath: path.resolve(file),
        isIFT: true,
        isWithParts: false,
        personnelCorrectionsFile,
        dryRun
    });

    console.log(`[IFT] Done. created=${summary.created} skippedExisting=${summary.skippedExisting} correctedPersonnel=${summary.correctedPersonnel || 0} missingPersonnel=${summary.missingPersonnel} invalidRows=${summary.invalidRows} dryRun=${dryRun}`);
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
        console.log(`[IFT] Missing personnel list written to ${outPath}`);
    }
    if (dryRun) {
        console.log('[IFT] Dry-run mode: no data was persisted');
    }
    process.exit(0);
}

main().catch(err => {
    console.error('[IFT] Migration failed:', err);
    process.exit(1);
});
