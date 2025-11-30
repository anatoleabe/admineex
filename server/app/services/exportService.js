const excel = require('exceljs');
const { addDgtcfmBonusHeader } = require('../utils/excelHeader');
const { BonusInstance } = require('../models/bonus/instance');
const { Structure } = require('../models/structure');
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

        // Load canonical structures once (same source as structures.js minimal list) to drive hierarchy.
        const rawStructures = await Structure.find({}).lean();
        const structureByCode = {};
        const structureById = {};
        rawStructures.forEach(s => {
            const id = (s._id || s.id || '').toString();
            const code = (s.code || '').toString().trim();
            structureById[id] = s;
            if (code) structureByCode[code] = s;
        });

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

        // === Structure hierarchy helpers (mirrors the structure/substructure loading used in BonusInstanceWizardCtrl.js) ===
        const mapStructureNode = (node) => {
            if (!node) return null;
            const id = (node._id || node.id || '').toString().trim();
            const code = (node.code || '').toString().trim();
            const name = node.name || node.en || node.fr || code || 'STRUCTURE INCONNUE';
            const rank = node.rank ? String(node.rank) : '';
            return { id: id || code || name, code: code || '000', name, rank, key: id || code || name, parentId: node.fatherId || node.parentId || null };
        };

        const resolveStructureByCode = (code) => {
            const official = structureByCode[(code || '').trim()];
            return official ? mapStructureNode(official) : null;
        };

        const resolveStructureById = (id) => {
            const official = structureById[id];
            return official ? mapStructureNode(official) : null;
        };

        const unknownStructure = { id: 'undefined', code: '000', name: 'STRUCTURE INCONNUE', rank: '', key: 'undefined' };

        // Derive main/sub structure using canonical list (rank 2/3) and code linkage (prefix before hyphen).
        const getMainAndSubStructure = (rawStructure) => {
            const rawCode = rawStructure?.code || '';
            const candidate = resolveStructureByCode(rawCode) || mapStructureNode(rawStructure) || unknownStructure;
            let sub = candidate;
            if (!sub.rank && rawStructure?.parent) {
                const parent = mapStructureNode(rawStructure.parent);
                if (parent) sub.parentId = parent.id;
            }

            let main = sub;
            if (sub.rank === '3') {
                main = (sub.parentId && resolveStructureById(sub.parentId)) || resolveStructureByCode(sub.code.split('-')[0]) || unknownStructure;
            } else if (sub.rank !== '2') {
                const prefix = sub.code && sub.code.includes('-') ? sub.code.split('-')[0] : sub.code;
                main = resolveStructureByCode(prefix) || sub;
            }

            // Enforce rank flags for clarity
            main = main || unknownStructure;
            sub = sub || unknownStructure;
            return { main: { ...main, key: main.key || main.code || main.id }, sub: { ...sub, key: sub.key || sub.code || sub.id } };
        };

        const taxRate = (bonusInstance.taxPercentage || 5.28) / 100;

        const codePriority = (code = '') => {
            if (code === '238-1') return -1000; // requested first
            if (code === '000') return 1000;    // unknown near the end
            if (code === '001-100-1') return 1001; // detaché last
            return 0;
        };

        // Build hierarchy main -> substructure -> allocations using canonical structures list
        const hierarchy = {};
        allocations.forEach(allocation => {
            const rawStructure = allocation.personnelSnapshotId?.data?.position?.structure;
            const { main, sub } = getMainAndSubStructure(rawStructure);
            allocation.structureInfo = sub; // keep leaf/sub info for traceability

            const mainKey = main.key;
            const subKey = sub.key;
            if (!hierarchy[mainKey]) hierarchy[mainKey] = { main, substructures: {} };
            if (!hierarchy[mainKey].substructures[subKey]) hierarchy[mainKey].substructures[subKey] = { sub, allocations: [] };
            hierarchy[mainKey].substructures[subKey].allocations.push(allocation);
        });

        const orderedMainKeys = Object.keys(hierarchy).sort((a, b) => {
            const codeA = hierarchy[a].main.code || '';
            const codeB = hierarchy[b].main.code || '';
            const priDiff = codePriority(codeA) - codePriority(codeB);
            if (priDiff !== 0) return priDiff;
            return codeA.localeCompare(codeB);
        });

        const ranksJson = loadRanks();
        function computeTxPercentFromSnapshot(snapshot) {
            const rank = snapshot?.data?.rank;
            if (!rank || !Array.isArray(ranksJson)) return null;
            const row = ranksJson.find(r => String(r.id) === String(rank));
            if (!row || typeof row.bonusRate !== 'number') return null;
            return Math.round(row.bonusRate * 100); // integer percent
        }

        // Compute totals upfront to build the summary table (main structures; same amounts as detailed section)
        const summaryRowsData = [];
        let summaryGrandTotals = { parts: 0, brut: 0, tax: 0, net: 0 };
        let mainDisplayIndex = 0;

        const computeFinancials = (allocation) => {
            const brut = Math.round(allocation.grossAmount || allocation.finalAmount || 0);
            const tax = Math.round(allocation.taxAmount || ((allocation.grossAmount || 0) - (allocation.netAmount || 0)));
            const net = Math.round(allocation.netAmount || ((allocation.grossAmount || 0) - tax));
            return {
                parts: allocation.calculationInputs?.parts || 0,
                brut,
                tax,
                net
            };
        };

        orderedMainKeys.forEach((mainKey) => {
            mainDisplayIndex++;
            const mainGroup = hierarchy[mainKey];
            const subKeys = Object.keys(mainGroup.substructures).sort((a, b) => (mainGroup.substructures[a].sub.code || '').localeCompare(mainGroup.substructures[b].sub.code || ''));
            let structureTotals = { parts: 0, brut: 0, tax: 0, net: 0 };
            let subIndex = 0;

            subKeys.forEach((subKey) => {
                subIndex++;
                const subGroup = mainGroup.substructures[subKey];
                const subTotals = { parts: 0, brut: 0, tax: 0, net: 0 };
                subGroup.allocations.forEach(allocation => {
                    const fin = computeFinancials(allocation);
                    subTotals.parts += fin.parts;
                    subTotals.brut += fin.brut;
                    subTotals.tax += fin.tax;
                    subTotals.net += fin.net;
                });
                subGroup.totals = subTotals;
                structureTotals.parts += subTotals.parts;
                structureTotals.brut += subTotals.brut;
                structureTotals.tax += subTotals.tax;
                structureTotals.net += subTotals.net;
            });

            mainGroup.totals = structureTotals;
            summaryRowsData.push({
                label: `${mainGroup.main.name}${mainGroup.main.code ? ' - ' + mainGroup.main.code : ''}`,
                brut: structureTotals.brut,
                tax: structureTotals.tax,
                net: structureTotals.net
            });
            summaryGrandTotals.parts += structureTotals.parts;
            summaryGrandTotals.brut += structureTotals.brut;
            summaryGrandTotals.tax += structureTotals.tax;
            summaryGrandTotals.net += structureTotals.net;
        });

        // === Summary table ("tableau synoptique") ===
        const summaryStartCol = 2; // Column B for readability
        const summaryCols = {
            label: colLetter(summaryStartCol),
            brut: colLetter(summaryStartCol + 1),
            tax: colLetter(summaryStartCol + 2),
            net: colLetter(summaryStartCol + 3),
        };
        const summaryEndCol = summaryCols.net;

        const summaryTitleRow = worksheet.addRow([]);
        worksheet.mergeCells(`${summaryCols.label}${summaryTitleRow.number}:${summaryEndCol}${summaryTitleRow.number}`);
        const summaryTitleCell = worksheet.getCell(`${summaryCols.label}${summaryTitleRow.number}`);
        summaryTitleCell.value = "ETAT DE REPARTITION DES REMISES DU PREMIER TRIMESTRE 2024";
        summaryTitleCell.font = { bold: true, size: 14 };
        summaryTitleCell.alignment = { horizontal: 'center' };

        const summarySubtitleRow = worksheet.addRow([]);
        worksheet.mergeCells(`${summaryCols.label}${summarySubtitleRow.number}:${summaryEndCol}${summarySubtitleRow.number}`);
        const summarySubtitleCell = worksheet.getCell(`${summaryCols.label}${summarySubtitleRow.number}`);
        summarySubtitleCell.value = "TABLEAU SYNOPTIQUE";
        summarySubtitleCell.font = { bold: true, size: 12 };
        summarySubtitleCell.alignment = { horizontal: 'center' };

        const summaryHeaderRow = worksheet.addRow([]);
        summaryHeaderRow.getCell(summaryStartCol).value = "Structure";
        summaryHeaderRow.getCell(summaryStartCol + 1).value = "MONTANT BRUT";
        summaryHeaderRow.getCell(summaryStartCol + 2).value = `TAXES (${bonusInstance.taxPercentage || 5.28}%)`;
        summaryHeaderRow.getCell(summaryStartCol + 3).value = "MONTANT NAP";
        summaryHeaderRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
        });

        const summaryDataStartRow = worksheet.lastRow.number + 1;
        summaryRowsData.forEach(entry => {
            const row = worksheet.addRow([]);
            worksheet.getCell(`${summaryCols.label}${row.number}`).value = entry.label;

            const brutCellRef = `${summaryCols.brut}${row.number}`;
            worksheet.getCell(brutCellRef).value = entry.brut;
            worksheet.getCell(brutCellRef).numFmt = '#,##0';

            const taxCellRef = `${summaryCols.tax}${row.number}`;
            worksheet.getCell(taxCellRef).value = { formula: `${brutCellRef}*${taxRate}`, result: entry.tax };
            worksheet.getCell(taxCellRef).numFmt = '#,##0';

            const netCellRef = `${summaryCols.net}${row.number}`;
            worksheet.getCell(netCellRef).value = { formula: `${brutCellRef}-${taxCellRef}`, result: entry.net };
            worksheet.getCell(netCellRef).numFmt = '#,##0';

            row.eachCell((cell) => {
                cell.alignment = { horizontal: (cell.address.startsWith(summaryCols.label) ? 'left' : 'right') };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
        });

        const summaryTotalRow = worksheet.addRow([]);
        worksheet.getCell(`${summaryCols.label}${summaryTotalRow.number}`).value = "TOTAL GENERAL";
        worksheet.getCell(`${summaryCols.label}${summaryTotalRow.number}`).font = { bold: true };
        worksheet.getCell(`${summaryCols.label}${summaryTotalRow.number}`).alignment = { horizontal: 'left' };
        worksheet.getCell(`${summaryCols.label}${summaryTotalRow.number}`).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'double' }, right: { style: 'thin' } };
        const brutSumRange = `${summaryCols.brut}${summaryDataStartRow}:${summaryCols.brut}${summaryTotalRow.number - 1}`;
        const taxSumRange = `${summaryCols.tax}${summaryDataStartRow}:${summaryCols.tax}${summaryTotalRow.number - 1}`;
        const netSumRange = `${summaryCols.net}${summaryDataStartRow}:${summaryCols.net}${summaryTotalRow.number - 1}`;
        worksheet.getCell(`${summaryCols.brut}${summaryTotalRow.number}`).value = { formula: `SUM(${brutSumRange})`, result: summaryGrandTotals.brut };
        worksheet.getCell(`${summaryCols.tax}${summaryTotalRow.number}`).value = { formula: `SUM(${taxSumRange})`, result: summaryGrandTotals.tax };
        worksheet.getCell(`${summaryCols.net}${summaryTotalRow.number}`).value = { formula: `SUM(${netSumRange})`, result: summaryGrandTotals.net };
        [summaryCols.brut, summaryCols.tax, summaryCols.net].forEach(col => {
            const cellRef = `${col}${summaryTotalRow.number}`;
            worksheet.getCell(cellRef).font = { bold: true };
            worksheet.getCell(cellRef).numFmt = '#,##0';
            worksheet.getCell(cellRef).alignment = { horizontal: 'right' };
            worksheet.getCell(cellRef).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'double' }, right: { style: 'thin' } };
        });
        worksheet.addRow([]); // spacing between summary and details

        // === Detailed section: structures -> substructures -> allocations ===
        const detailTitleRow = worksheet.addRow([]);
        worksheet.mergeCells(`A${detailTitleRow.number}:${lastCol}${detailTitleRow.number}`);
        const detailTitleCell = worksheet.getCell(`A${detailTitleRow.number}`);
        detailTitleCell.value = `DETAIL PAR STRUCTURE ET SOUS-STRUCTURE - ${bonusInstance.referencePeriod}`;
        detailTitleCell.font = { bold: true, size: 14 };
        detailTitleCell.alignment = { horizontal: 'center' };

        const sectionRow = worksheet.addRow([]);
        worksheet.mergeCells(`B${sectionRow.number}:${lastCol}${sectionRow.number}`);
        const sectionCell = worksheet.getCell(`B${sectionRow.number}`);
        sectionCell.value = 'I: PAIEMENTS PAR VIREMENT';
        sectionCell.font = { bold: true, size: 12 };

        const subsectionRow = worksheet.addRow([]);
        worksheet.mergeCells(`B${subsectionRow.number}:${lastCol}${subsectionRow.number}`);
        const subsectionCell = worksheet.getCell(`B${subsectionRow.number}`);
        subsectionCell.value = 'a: Services centraux, agences comptables et autres services';
        subsectionCell.font = { italic: true };

        worksheet.addRow([]); // Empty row before headers

        // Header row styling
        const headerRow = worksheet.addRow(chosenHeaders.map(h => h.header));
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        let globalIndex = 1;
        let grandTotals = { parts: 0, brut: 0, tax: 0, net: 0 };
        mainDisplayIndex = 0;

        for (const mainKey of orderedMainKeys) {
            mainDisplayIndex++;
            const mainGroup = hierarchy[mainKey];
            const subKeys = Object.keys(mainGroup.substructures).sort((a, b) => {
                const codeA = mainGroup.substructures[a].sub.code || '';
                const codeB = mainGroup.substructures[b].sub.code || '';
                const priDiff = codePriority(codeA) - codePriority(codeB);
                if (priDiff !== 0) return priDiff;
                return codeA.localeCompare(codeB);
            });

            // Main structure header row (orange, left aligned)
            const structureHeaderRow = worksheet.addRow([]);
            worksheet.mergeCells(`A${structureHeaderRow.number}:${lastCol}${structureHeaderRow.number}`);
            const structureCell = worksheet.getCell(`A${structureHeaderRow.number}`);
            structureCell.value = `${mainDisplayIndex}. ${mainGroup.main.name}${mainGroup.main.code ? ' - ' + mainGroup.main.code : ''}`;
            structureCell.font = { color: { argb: 'FFFFFFFF' }, size: 14, bold: true };
            structureCell.alignment = { vertical: 'middle', horizontal: 'left' };
            structureCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE06B21' } };
            structureCell.border = { top: { style: 'thick', color: { argb: 'FF964714' } }, left: { style: 'thick', color: { argb: 'FF964714' } }, bottom: { style: 'thick', color: { argb: 'FF964714' } }, right: { style: 'thick', color: { argb: 'FF964714' } } };

            let subDisplayIndex = 0;
            const structureRunningTotals = { parts: 0, brut: 0, tax: 0, net: 0 };

            for (const subKey of subKeys) {
                subDisplayIndex++;
                const subGroup = mainGroup.substructures[subKey];

                // Substructure header row (light gray)
                const subHeaderRow = worksheet.addRow([]);
                worksheet.mergeCells(`A${subHeaderRow.number}:${lastCol}${subHeaderRow.number}`);
                const subCell = worksheet.getCell(`A${subHeaderRow.number}`);
                subCell.value = `${mainDisplayIndex}.${subDisplayIndex} ${subGroup.sub.name}${subGroup.sub.code ? ' - ' + subGroup.sub.code : ''}`;
                subCell.font = { bold: true, size: 12 };
                subCell.alignment = { vertical: 'middle', horizontal: 'left' };
                subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
                subCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

                const subTotals = { parts: 0, brut: 0, tax: 0, net: 0 };

                for (const allocation of subGroup.allocations) {
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

                    if (!indiceCat) {
                        if (String(status) === '1') {
                            indiceCat = allocation.personnelSnapshotId?.data?.index || '';
                        } else if (String(status) === '2') {
                            const cat = allocation.personnelSnapshotId?.data?.category || '';
                            const ech = allocation.personnelSnapshotId?.data?.index || '';
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

                    const fin = computeFinancials(allocation);

                    // Row values
                    const rowValuesSansPart = [
                        globalIndex++,
                        allocation.personnelId?.formattedName || 'N/A',
                        allocation.personnelId?.identifier || 'N/A',
                        indiceCat,
                        gradeCode,
                        fonctionLabel,
                        isFinite(tauxPercent) ? tauxPercent : '',
                        fin.brut,
                        fin.tax,
                        fin.net,
                        '', // Emargement
                        allocation.calculationInputs?.comment || ''
                    ];

                    const rowValuesWithParts = [
                        globalIndex++,
                        allocation.personnelId?.formattedName || 'N/A',
                        allocation.personnelId?.identifier || 'N/A',
                        `${gradeCode}${fonctionLabel ? ' / ' + fonctionLabel : ''}`,
                        fin.parts,
                        fin.brut,
                        fin.tax,
                        fin.net,
                        '',
                        allocation.calculationInputs?.comment || '',
                        ''
                    ];

                    const dataRow = worksheet.addRow(isWithoutParts ? rowValuesSansPart : rowValuesWithParts);
                    const colsForNumbers = isWithoutParts ? ['H','I','J'] : ['F','G','H'];
                    colsForNumbers.forEach(col => worksheet.getCell(`${col}${dataRow.number}`).numFmt = '#,##0');

                    dataRow.eachCell((cell) => {
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                        if (allocation.status === 'excluded' || (allocation.calculationInputs?.parts || 0) === 0) {
                            cell.font = { color: { argb: 'FFFF0000' } };
                        }
                    });

                    subTotals.parts += fin.parts;
                    subTotals.brut += fin.brut;
                    subTotals.tax += fin.tax;
                    subTotals.net += fin.net;
                }

                // Substructure subtotal row
                const subtotalValues = isWithoutParts
                    ? ['', '', '', '', '', 'SOUS-TOTAL', '', subTotals.brut, subTotals.tax, subTotals.net, '', '']
                    : ['', '', '', 'SOUS-TOTAL', subTotals.parts, subTotals.brut, subTotals.tax, subTotals.net, '', '', ''];
                const subtotalRow = worksheet.addRow(subtotalValues);
                subtotalRow.eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
                });
                const subtotalCols = isWithoutParts ? ['H','I','J'] : ['E','F','G','H'];
                subtotalCols.forEach(col => worksheet.getCell(`${col}${subtotalRow.number}`).numFmt = '#,##0');

                structureRunningTotals.parts += subTotals.parts;
                structureRunningTotals.brut += subTotals.brut;
                structureRunningTotals.tax += subTotals.tax;
                structureRunningTotals.net += subTotals.net;
            }

            // Structure subtotal row
            const structureSubtotalLabel = `SOUS TOTAL ${mainGroup.main.name}`;
            const structureSubtotalValues = isWithoutParts
                ? ['', '', '', '', '', structureSubtotalLabel, '', structureRunningTotals.brut, structureRunningTotals.tax, structureRunningTotals.net, '', '']
                : ['', '', '', structureSubtotalLabel, structureRunningTotals.parts, structureRunningTotals.brut, structureRunningTotals.tax, structureRunningTotals.net, '', '', ''];
            const structureSubtotalRow = worksheet.addRow(structureSubtotalValues);
            structureSubtotalRow.eachCell((cell) => {
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
                cell.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
            });
            const structSubtotalCols = isWithoutParts ? ['H','I','J'] : ['E','F','G','H'];
            structSubtotalCols.forEach(col => worksheet.getCell(`${col}${structureSubtotalRow.number}`).numFmt = '#,##0');

            grandTotals.parts += structureRunningTotals.parts;
            grandTotals.brut += structureRunningTotals.brut;
            grandTotals.tax += structureRunningTotals.tax;
            grandTotals.net += structureRunningTotals.net;

            worksheet.addRow([]); // spacing between structures
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
        const COLOR_PRIMARY = '#1F2937';
        const COLOR_SECONDARY = '#4B5563';
        const COLOR_TEXT = '#111827';
        const COLOR_LIGHT_TEXT = '#6B7280';
        const COLOR_BORDER = '#E5E7EB';
        const COLOR_HEADER_BG = '#F7F7F8';
        const COLOR_TABLE_HEADER_BG = '#EFEFF2';
        const COLOR_ROW_ALT = '#F9FAFB';

        const categoryLabels = {
            with_parts: 'Primes basées sur les parts',
            without_parts: 'Primes sans parts',
            fixed_amount: 'Primes à montant fixe',
            calculated: 'Primes calculées',
            uncategorized: 'Primes manuelles / Non catégorisées'
        };

        const formatRate = (r) => (Number(r || 0) * 100).toFixed(2).replace(/\.00$/, '');
        const defaultTaxRate = bonusAllocations[0]?.taxRate ||
            (bonusAllocations[0]?.instanceId?.taxPercentage ? bonusAllocations[0].instanceId.taxPercentage / 100 : 0.0528);
        const taxHeaderLabel = `Retenue (${formatRate(defaultTaxRate)}%)`;
        const formattedName = `${personnel.name?.family?.join(' ') || ''} ${personnel.name?.given?.join(' ') || ''}`.trim();

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
            doc.text('DIRECTION GENERALE DU TRESOR, DE LA', leftColX, headerTextY + 7 * lineHeight, { width: colWidth, align: 'center' });
            doc.text('COOPERATION FINANCIERE ET MONETAIRE', leftColX, headerTextY + 8 * lineHeight, { width: colWidth, align: 'center' });
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
                const imgPath = __dirname + '/../../public/img/coat_of_arms.jpeg';
                doc.image(imgPath, (pageWidth - logoSize) / 2, headerTextY + 3 * lineHeight, { width: logoSize });
            } catch (error) {
                doc.rect((pageWidth - logoSize) / 2, headerTextY + 3 * lineHeight, logoSize, logoSize).stroke();
            }
        };

        const generateHeader = () => {
            // Only add the official header on the first page
            if (doc.bufferedPageRange().count === 1) {
                generateOfficialHeader();
                doc.moveDown(2);
            }

            doc.fillColor(COLOR_PRIMARY)
                .fontSize(16).font(FONT_BOLD)
                .text('HISTORIQUE DES PRIMES ET GRATIFICATIONS', doc.page.margins.left, doc.y, {
                    align: 'center',
                    width: doc.page.width - doc.page.margins.left - doc.page.margins.right
                });
            doc.fontSize(10).font(FONT_REGULAR).fillColor(COLOR_LIGHT_TEXT)
                .text(formattedName, doc.page.margins.left, doc.y, {
                    align: 'center',
                    width: doc.page.width - doc.page.margins.left - doc.page.margins.right
                });
            doc.moveDown(1);

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
        const infoLeftFields = [
            { label: 'Matricule', value: personnel.identifier || 'N/A' },
            { label: 'Poste', value: position?.name || 'N/A' },
            { label: 'Structure', value: position?.structure?.name || 'N/A' }
        ];
        const rankLabel = latestAllocation.personnelSnapshotId?.data?.rank?.name
            || latestAllocation.personnelSnapshotId?.data?.rank?.label
            || latestAllocation.personnelSnapshotId?.data?.rank
            || personnel.rank
            || 'N/A';
        const infoRightFields = [
            {
                label: 'Période du rapport',
                value: `${moment(startDate).format('DD/MM/YYYY')} au ${moment(endDate).format('DD/MM/YYYY')}`
            },
            { label: 'Grade', value: rankLabel }
        ];

        const infoBoxX = doc.page.margins.left;
        const infoBoxY = doc.y;
        const infoBoxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const infoRowHeight = 20;
        const infoBoxHeight = Math.max(infoLeftFields.length, infoRightFields.length) * infoRowHeight + 22;

        doc.save();
        doc.roundedRect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight, 6).fillAndStroke(COLOR_HEADER_BG, COLOR_BORDER);
        doc.moveTo(infoBoxX + infoBoxWidth / 2, infoBoxY + 10)
            .lineTo(infoBoxX + infoBoxWidth / 2, infoBoxY + infoBoxHeight - 10)
            .strokeColor(COLOR_BORDER)
            .lineWidth(0.5)
            .stroke();
        doc.restore();

        const drawInfoLines = (items, startX) => {
            items.forEach((item, idx) => {
                const labelY = infoBoxY + 11 + idx * infoRowHeight;
                doc.font(FONT_BOLD).fontSize(8).fillColor(COLOR_SECONDARY)
                    .text(`${item.label.toUpperCase()}: `, startX, labelY, {
                        width: infoBoxWidth / 2 - 20,
                        continued: true
                    });
                doc.font(FONT_REGULAR).fontSize(9).fillColor(COLOR_TEXT)
                    .text(item.value, { width: infoBoxWidth / 2 - 20 });
            });
        };

        drawInfoLines(infoLeftFields, infoBoxX + 12);
        drawInfoLines(infoRightFields, infoBoxX + infoBoxWidth / 2 + 12);

        doc.y = infoBoxY + infoBoxHeight + 14;

        // --- Data Processing and Grouping ---
        let totalGross = 0, totalTax = 0, totalNet = 0;
        bonusAllocations.forEach(bonus => {
            const rate = (bonus.taxRate !== undefined && bonus.taxRate !== null)
                ? Number(bonus.taxRate)
                : (bonus.instanceId?.taxPercentage ? Number(bonus.instanceId.taxPercentage) / 100 : 0.0528);

            const netAmount = Number(bonus.netAmount || bonus.finalAmount || 0);
            const storedTax = Number(bonus.taxAmount || 0);
            const storedGross = Number(bonus.grossAmount || bonus.calculatedAmount || 0);

            // Derive gross using the best available source
            let grossAmount = storedGross;
            if (!grossAmount) {
                if (storedTax) {
                    grossAmount = netAmount + storedTax;
                } else if (rate > 0 && rate < 1) {
                    grossAmount = Math.round(netAmount / (1 - rate));
                } else {
                    grossAmount = netAmount;
                }
            }

            // Derive tax similarly
            let taxAmount = storedTax;
            if (!taxAmount) {
                taxAmount = Math.max(0, grossAmount - netAmount);
            }

            totalGross += grossAmount;
            totalTax += taxAmount;
            totalNet += netAmount;
            bonus.displayGross = grossAmount;
            bonus.displayTax = taxAmount;
            bonus.displayNet = netAmount;
        });

        const groupedBonuses = _.groupBy(bonusAllocations, bonus => bonus.templateId?.category || 'uncategorized');
        const formatThousands = (value) => Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        const formatCurrency = (value) => `${formatThousands(value)} FCFA`;
        const formatNumber = (value) => formatThousands(value);

        // --- Summary Section ---
        doc.fontSize(10).font(FONT_BOLD).fillColor(COLOR_PRIMARY)
            .text('Synthèse des montants', doc.page.margins.left, doc.y);
        doc.moveDown(0.6);

        const summaryData = [
            { title: 'Montant brut total', value: formatCurrency(totalGross), hint: 'Avant retenues' },
            { title: 'Total retenues', value: formatCurrency(totalTax), hint: 'Taxes et contributions' },
            { title: 'Montant net total', value: formatCurrency(totalNet), hint: 'Après retenues' }
        ];
        const summarySpacing = 14;
        const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const summaryBoxWidth = (availableWidth - summarySpacing * (summaryData.length - 1)) / summaryData.length;
        const summaryBoxHeight = 68;
        const summaryY = doc.y;

        summaryData.forEach((item, index) => {
            const x = doc.page.margins.left + index * (summaryBoxWidth + summarySpacing);
            doc.save();
            doc.roundedRect(x, summaryY, summaryBoxWidth, summaryBoxHeight, 6)
                .fillAndStroke(COLOR_HEADER_BG, COLOR_BORDER);
            doc.rect(x, summaryY, summaryBoxWidth, 4).fill(COLOR_SECONDARY);
            doc.restore();

            doc.font(FONT_BOLD).fontSize(8.5).fillColor(COLOR_SECONDARY)
                .text(item.title.toUpperCase(), x + 10, summaryY + 10, { width: summaryBoxWidth - 20 });
            doc.font(FONT_BOLD).fontSize(12).fillColor(COLOR_PRIMARY)
                .text(item.value, x + 10, summaryY + 26, { width: summaryBoxWidth - 20 });
            doc.font(FONT_REGULAR).fontSize(7.5).fillColor(COLOR_LIGHT_TEXT)
                .text(item.hint, x + 10, summaryY + 46, { width: summaryBoxWidth - 20 });
        });

        doc.y = summaryY + summaryBoxHeight + 14;
        doc.save();
        doc.strokeColor(COLOR_BORDER).lineWidth(1)
            .moveTo(doc.page.margins.left, doc.y)
            .lineTo(doc.page.width - doc.page.margins.right, doc.y)
            .stroke();
        doc.restore();
        doc.moveDown(1);

        // --- Tables Section ---
        const tableHeaders = ['Période', 'Type de Prime', 'Montant Brut', taxHeaderLabel, 'Montant Net'];
        const tableWidths = [90, 160, 85, 80, 80];
        const tableStartX = doc.page.margins.left;
        const tableWidth = tableWidths.reduce((a, b) => a + b);
        const tableRowHeight = 24;

        const drawTableHeader = (y) => {
            doc.save();
            doc.rect(tableStartX, y, tableWidth, tableRowHeight).fillAndStroke(COLOR_TABLE_HEADER_BG, COLOR_BORDER);
            doc.restore();
            doc.font(FONT_BOLD).fontSize(8.5).fillColor(COLOR_PRIMARY);
            let currentX = tableStartX;
            tableHeaders.forEach((header, i) => {
                doc.text(header, currentX + 6, y + 9, { width: tableWidths[i] - 12, align: 'center' });
                currentX += tableWidths[i];
            });
            return y + tableRowHeight;
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
            currentY = checkNewPage(currentY, tableRowHeight + 30);
            doc.fontSize(10).font(FONT_BOLD).fillColor(COLOR_PRIMARY)
                .text(categoryLabels[category], tableStartX, currentY);
            doc.save();
            doc.strokeColor(COLOR_BORDER).lineWidth(1)
                .moveTo(tableStartX, currentY + 14)
                .lineTo(tableStartX + tableWidth, currentY + 14)
                .stroke();
            doc.restore();
            currentY += 22;

            currentY = drawTableHeader(currentY);

            let categoryGross = 0, categoryTax = 0, categoryNet = 0;

            groupedBonuses[category].forEach((bonus, i) => {
                // Check space for one row
                currentY = checkNewPage(currentY, tableRowHeight);
                const rowColor = i % 2 === 0 ? '#FFFFFF' : COLOR_ROW_ALT;
                doc.save();
                doc.rect(tableStartX, currentY, tableWidth, tableRowHeight).fill(rowColor);
                doc.strokeColor(COLOR_BORDER).lineWidth(0.4).rect(tableStartX, currentY, tableWidth, tableRowHeight).stroke();
                doc.restore();
                doc.font(FONT_REGULAR).fontSize(8).fillColor(COLOR_TEXT);

                const rowData = [
                    { text: bonus.instanceId?.referencePeriod || moment(bonus.createdAt).format('MMMM YYYY'), align: 'left' },
                    { text: bonus.templateId?.name || 'Bonus Manuel', align: 'left' },
                    { text: formatNumber(bonus.displayGross), align: 'right' },
                    { text: formatNumber(bonus.displayTax), align: 'right' },
                    { text: formatNumber(bonus.displayNet), align: 'right' }
                ];

                let currentX = tableStartX;
                rowData.forEach((cell, j) => {
                    doc.text(cell.text, currentX + 6, currentY + 8, { width: tableWidths[j] - 12, align: cell.align });
                    currentX += tableWidths[j];
                });
                currentY += tableRowHeight;

                categoryGross += bonus.displayGross;
                categoryTax += bonus.displayTax;
                categoryNet += bonus.displayNet;
            });

            // Check space for subtotal row
            currentY = checkNewPage(currentY, 22);
            doc.save();
            doc.rect(tableStartX, currentY, tableWidth, 22).fillAndStroke(COLOR_HEADER_BG, COLOR_BORDER);
            doc.restore();
            doc.font(FONT_BOLD).fontSize(8.5).fillColor(COLOR_PRIMARY);
            const subtotalData = [
                { text: 'SOUS-TOTAL', align: 'right', width: tableWidths.slice(0, 2).reduce((a, b) => a + b) },
                { text: formatNumber(categoryGross), align: 'right', width: tableWidths[2] },
                { text: formatNumber(categoryTax), align: 'right', width: tableWidths[3] },
                { text: formatNumber(categoryNet), align: 'right', width: tableWidths[4] }
            ];
            let subtotalX = tableStartX;
            subtotalData.forEach(cell => {
                doc.text(cell.text, subtotalX + 6, currentY + 6, { width: cell.width - 12, align: cell.align });
                subtotalX += cell.width;
            });
            currentY += 22;

            // Add space only if it's not the last category
            if (!isLastCategory) {
                currentY += 10;
            }
        });

        // --- Grand Total row at end ---
        currentY = checkNewPage(currentY, tableRowHeight);
        doc.save();
        doc.rect(tableStartX, currentY, tableWidth, tableRowHeight).fillAndStroke(COLOR_TABLE_HEADER_BG, COLOR_BORDER);
        doc.restore();
        doc.font(FONT_BOLD).fontSize(9).fillColor(COLOR_PRIMARY);
        const grandTotalData = [
            { text: 'TOTAL GENERAL', align: 'right', width: tableWidths.slice(0, 2).reduce((a, b) => a + b) },
            { text: formatNumber(totalGross), align: 'right', width: tableWidths[2] },
            { text: formatNumber(totalTax), align: 'right', width: tableWidths[3] },
            { text: formatNumber(totalNet), align: 'right', width: tableWidths[4] }
        ];
        let grandX = tableStartX;
        grandTotalData.forEach(cell => {
            doc.text(cell.text, grandX + 6, currentY + 8, { width: cell.width - 12, align: cell.align });
            grandX += cell.width;
        });
        currentY += tableRowHeight;

        // --- QR Code Generation ---
        const qrSummary = [
            `Personnel: ${formattedName || 'N/A'}`,
            `Matricule: ${personnel.identifier || 'N/A'}`,
            `Période: ${moment(startDate).format('DD/MM/YYYY')} au ${moment(endDate).format('DD/MM/YYYY')}`,
            `Primes: ${bonusAllocations.length}`,
            `Net total: ${formatCurrency(totalNet)}`,
            `Brut total: ${formatCurrency(totalGross)}`
        ].join(' | ');
        const qrImage = qr.imageSync(qrSummary, { type: 'png' });


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
