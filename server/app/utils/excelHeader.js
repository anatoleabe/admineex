"use strict";

/**
 * Excel header utilities for DGTCFM bonus decision sheets.
 *
 * Add the official MINFI / DGTCFM decision header to the top of the worksheet.
 * This inserts the header rows at the top (pushing existing data down), creates all merges,
 * applies fonts and alignment, and optionally places the Cameroon coat of arms image in the center block.
 *
 * Layout summary (rows after insertion):
 * - Left block: merge A1:F10 (multi-line, centered, uppercase, bold)
 * - Center block: merge G1:G10 (image if provided)
 * - Right block: merge I1:M10 (multi-line, centered, uppercase, bold)
 * - Decision title: merge A14:M18 (multi-line, centered, bold size ~14)
 * - VU section: merge A19:M30 (multi-line, left/top aligned, wrapped)
 * - DECIDE + Article 1: merge A31:M31 for "DECIDE" and A32:M33 for article text
 *
 * @param {import('exceljs').Worksheet} worksheet
 * @param {Buffer} [logoBuffer] - Optional PNG/JPEG image buffer for the Cameroon coat of arms
 */
function addDgtcfmBonusHeader(worksheet, logoBuffer) {
  if (!worksheet || typeof worksheet !== "object") return;

  // Insert 33 rows at the very top to push any existing data down
  // ExcelJS spliceRows: start index, delete count, ...rows
  const rowsToInsert = 30;
  const emptyRows = new Array(rowsToInsert).fill([]);
  worksheet.spliceRows(1, 0, ...emptyRows);

  // Set uniform column widths for A..M (~13)
  for (let c = 1; c <= 13; c += 1) {
    const col = worksheet.getColumn(c);
    if (col) col.width = 13;
  }

  // Reasonable row heights for readability across the header region
  const setHeight = (from, to, h) => {
    for (let r = from; r <= to; r += 1) {
      const row = worksheet.getRow(r);
      if (row) row.height = h;
    }
  };
  setHeight(1, 12, 18);
  // keep 11-13 as default (spacing)
  setHeight(14, 18, 20);
  setHeight(19, 30, 20);
  setHeight(31, 33, 20);

  // Helper to style a merged range with alignment and font
  const mergeAndStyle = (range, options) => {
    worksheet.mergeCells(range);
    const cell = worksheet.getCell(range.split(":")[0]); // top-left cell
    if (options && options.value != null) cell.value = options.value;
    if (options && options.alignment) cell.alignment = options.alignment;
    if (options && options.font) cell.font = options.font;
    if (options && options.border) cell.border = options.border;
  };

  const addSeparatorRow = (startCol, endCol, rowIndex) => {
    const range = `${startCol}${rowIndex}:${endCol}${rowIndex}`;
    mergeAndStyle(range, {
      value: "------------",
      alignment: { horizontal: "center", vertical: "middle" },
      font: { size: 8, italic: true },
    });
    const row = worksheet.getRow(rowIndex);
    if (row) row.height = 11;
  };

  const renderTextBlockWithSeparators = (startCol, endCol, lines, startRow, options = {}) => {
    let currentRow = startRow;
    lines.forEach((text, index) => {
      const range = `${startCol}${currentRow}:${endCol}${currentRow}`;
      mergeAndStyle(range, {
        value: text,
        alignment: options.alignment || { horizontal: "center", vertical: "middle", wrapText: true },
        font: options.font || { bold: true },
      });

      const row = worksheet.getRow(currentRow);
      if (row) row.height = 11;

      if (index < lines.length - 1) {
        addSeparatorRow(startCol, endCol, currentRow + 1);
        currentRow += 2;
      }
    });
  };

  // LEFT BLOCK (A1:F10) — per-line row merges for cleaner layout
  const leftLines = [
    "REPUBLIQUE DU CAMEROUN",
    "PAIX- TRAVAIL - PATRIE",
    "MINISTERE DES FINANCES",
    "SECRETARIAT GENERAL",
    "DIRECTION GENERALE DU TRESOR, DE LA \n COOPERATION FINANCIERE ET MONETAIRE"
  ];
  renderTextBlockWithSeparators("A", "E", leftLines, 1, {
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    font: { bold: false },
  });

  // CENTER BLOCK (F1:H10) - coat of arms image if provided
  mergeAndStyle("F1:H12", {
    value: "",
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
  });

// image-size v2 CommonJS export exposes { imageSize }
const { imageSize } = require("image-size");

if (logoBuffer && Buffer.isBuffer(logoBuffer)) {
  const isJpeg = logoBuffer[0] === 0xff && logoBuffer[1] === 0xd8;
  const extension = isJpeg ? "jpeg" : "png";

  try {
    const { width: origW, height: origH } = imageSize(logoBuffer);
    if (!origW || !origH) throw new Error("Invalid image buffer");

    const imageId = worksheet.workbook.addImage({ buffer: logoBuffer, extension });

    // === Compute a bounding box in column 6 (F) that matches the image ratio ===
    const colF = worksheet.getColumn(6); // Column F (index 6)
    const excelWidthUnits = colF.width || 13; // set earlier
    const colPx = Math.round(excelWidthUnits * 7); // ~7 px per width unit

    // Limit height to avoid crowding; rows 1..12 are 18pt each
    // Place from visual row 0 to row 5 => Excel rows 1..6
    const startRow = 1;
    const endRow = 9;

    // Use range string anchor in column 6 (F), rows 1..8
    worksheet.addImage(imageId, `F${startRow}:F${endRow}`);
  } catch (e) {
    console.warn("Failed to add coat of arms image to Excel header:", e.message);
  }
}


  // RIGHT BLOCK (I1:M10) — per-line row merges for cleaner layout
  const rightLines = [
    "REPUBLIC OF CAMEROON",
    "PEACE - WORK - FATHERLAND",
    "MINISTRY OF FINANCE",
    "GENERAL SECRETARIAT",
    "DIRECTORATE GENERAL OF THE TREASURY, FINANCIAL \n AND MONETARY COOPERATION"
  ];
  renderTextBlockWithSeparators("I", "M", rightLines, 1, {
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    font: { bold: false },
  });

  // DECISION TITLE (A14:M18) - bold, centered, size ~14
  const decisionTitleLines = [
    "DECISION N° _______/D/MINFV/SG/DGTCFM/DAG/SDP DU _______",
    "ALLOUANT LES REMISES DU PREMIER TRIMESTRE DE L'EXERCICE",
    "BUDGETAIRE 2024 AUX PERSONNELS DE LA DIRECTION GENERALE DU TRESOR,",
    "DE LA COOPERATION FINANCIERE ET MONETAIRE",
    "LE MINISTRE DES FINANCES,",
  ];
  mergeAndStyle("A14:M18", {
    value: decisionTitleLines.join("\n"),
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    font: { bold: true, size: 14 },
  });

  // “VU” SECTION (A19:M30) - exact lines, wrapped, left/top
  const vuLines = [
    "VU la Constitution ;",
    "Vu la loi N° 2018/011 du 11 juillet 2018 portant code de transparence et de bonne gouvernance dans la gestion des Finances publiques au Cameroun;",
    "VU la loi n° 2018/012 du 11 juillet 2018 portant régime financier de l'Etat et autres entités Publiques;",
    "VU la loi N° 2023/019 du 19 décembre 2023 portant Loi des Finances de la Republique du Cameroun pour l'exercice 2024;",
    "VU le Décret 2011/408 du 09 décembre 2011 portant organisation du Gouvernement modifié et complété par le décret n° 2018/190 du 02 mars 2018;",
    "VU le Décret 2011/410 du 09 décembre 2011 portant formation du Gouvernement modifié et complété par le décret n° 2018/191 du mars 2018;",
    "VU le Décret 2013/066 du 28 février 2013 portant organisation du Ministère des Finances;",
    "Vu le décret 2019/002 du 04 janvier 2019 portant réaménagement du gouvernement;",
    "VU l'instruction n° 07/MINEFI/DT de Juillet 1982 fixant les modalités pratiques de répartition des Remises Trimestrielles servies aux personnels de la Direction du Trésor ;",
    "VU la Circulaire n°0000006/C/MINFI du 29 decembre 2023 portant instructions relatives à l'exécution des lois de finances , au suivi et au contrôle de l'exécution",
    " du Budget de l'Etat, des autres Entités Publiques pour l'exercice 2024;",
    "VU les états produits par les Services Centraux et Déconcentrés de la Direction Générale du Trésor, de la Coopération Financière et Monétaire ;",
  ];
  mergeAndStyle("A19:M26", {
    value: vuLines.join("\n"),
    alignment: { horizontal: "left", vertical: "top", wrapText: true },
    font: { bold: false },
  });

  // DECIDE + ARTICLE 1
  // Row 31: DECIDE (A31:M31) - centered, bold
  mergeAndStyle("A27:M27", {
    value: "DECIDE",
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    font: { bold: true },
  });
  // Rows 32-33: Article 1 (A32:M33) - left aligned, wrapped, normal font
  const articleLines = [
    "Article 1er : Il est alloué aux personnels ci-après de la Direction Générale du Trésor, de la Coopération Financière et Monétaire, des",
    "Services centraux et déconcentrés, des remises sur les crédits de l'exercice budgétaire 2024",
  ];
  mergeAndStyle("A29:M30", {
    value: articleLines.join("\n"),
    alignment: { horizontal: "left", vertical: "top", wrapText: true },
    font: { bold: false },
  });
}

module.exports = { addDgtcfmBonusHeader };
