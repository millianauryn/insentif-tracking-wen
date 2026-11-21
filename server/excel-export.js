const ExcelJS = require('exceljs');

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const periodLabel = (value) => {
  const match = /^(\d{4})-(\d{2})$/.exec(value || '');
  if (!match) return value || '-';
  return `${MONTHS[Number(match[2]) - 1] || match[2]} ${match[1]}`;
};

const rangeLabel = (start, end) => {
  const a = periodLabel(start);
  const b = periodLabel(end || start);
  return a === b ? a : `${a} s/d ${b}`;
};

const employeeCode = (position, fallback) => {
  const raw = position?.sales_code || fallback || '';
  const match = /^([A-Za-z]+)[ -]?(\d+)$/.exec(raw.trim());
  if (!match) return raw || '-';
  return `${match[1].toUpperCase()}-${match[2].padStart(3, '0')}`;
};

const jabatan = (doc) => (doc.doc_kind === 'spv' ? 'Sales Supervisor (SPV)' : 'Sales Executive');

const normalizeLabel = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9 /%]/g, ' ').replace(/\s+/g, ' ').trim();

const findCriteria = (rows, names) => {
  for (const name of names) {
    const found = rows.find((r) => normalizeLabel(r.label).includes(normalizeLabel(name)));
    if (found) return found;
  }
  return null;
};

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const percentValue = (row) => {
  const raw = row?.percentage_value ?? row?.percentage;
  const n = Number(raw);
  return Number.isFinite(n) ? n / 100 : 0;
};

const THIN = { style: 'thin', color: { argb: 'FFB7C3CE' } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const FILL_HEADER = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF3' } };
const FILL_TOTAL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4F8' } };
const FILL_SECTION = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E2C7' } };

function writeMerged(ws, row, fromCol, toCol, value, styles = {}) {
  ws.mergeCells(row, fromCol, row, toCol);
  const cell = ws.getCell(row, fromCol);
  cell.value = value;
  Object.assign(cell, styles);
  return cell;
}

function styleRow(ws, row, fromCol, toCol, styles = {}) {
  for (let col = fromCol; col <= toCol; col += 1) {
    Object.assign(ws.getCell(row, col), { border: BORDER, ...styles });
  }
}

function buildDetailSheet(workbook, doc, sheetName, code, positionMaps) {
  const ws = workbook.addWorksheet(sheetName, {
    properties: { defaultRowHeight: 18 },
    pageSetup: { fitToPage: true, fitToWidth: 1 },
  });
  ws.columns = [
    { width: 3 }, { width: 6 }, { width: 24 }, { width: 22 },
    { width: 16 }, { width: 16 }, { width: 15 }, { width: 16 },
  ];
  ws.views = [{ showGridLines: true }];

  const isSpv = doc.doc_kind === 'spv';
  const title = writeMerged(ws, 2, 2, 8, `FORMAT LAPORAN INSENTIF PENJUALAN - ${isSpv ? 'SUPERVISOR (SPV)' : 'SALES'}`);
  title.font = { bold: true, size: 14 };
  title.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 30;

  const meta = [
    [4, 'Kode & Nama', `:  ${code} - ${doc.salesman || '-'}`],
    [5, 'Jabatan', `:  ${jabatan(doc)}`],
    [6, 'Produk Pegangan', `:  ${doc.divisi || doc.product || 'Multi-Principal & All Brand Team'}`],
    [7, 'Periode Bulan', `:  ${rangeLabel(doc.period, doc.period_end)}`],
  ];
  meta.forEach(([row, label, value]) => {
    const left = ws.getCell(row, 2);
    left.value = label;
    left.font = { bold: true };
    writeMerged(ws, row, 4, 8, value);
  });

  writeMerged(ws, 9, 2, 8, 'I. GOLONGAN (PENCAPAIAN BRAND & PRINCIPAL)').font = { bold: true };
  const header = ['No', 'Principal', 'Brand', 'Target (%)', 'Pencapaian (%)', 'Keterangan'];
  header.forEach((text, i) => { ws.getCell(10, i + 2).value = text; });
  writeMerged(ws, 10, 7, 8, 'Keterangan');
  styleRow(ws, 10, 2, 8, { font: { bold: true }, fill: FILL_HEADER, alignment: { horizontal: 'center' } });

  const brandRows = (doc.golongan_rows || []).filter((r) => {
    const label = String(r.label || '').toUpperCase();
    return !r.is_group && !label.startsWith('TOTAL') && !label.startsWith('DIVISI') && !label.startsWith('GROUP');
  });
  let principalName = '-';
  brandRows.forEach((row, index) => {
    const excelRow = 11 + index;
    const pid = row.principal_id ? String(row.principal_id) : '';
    if (pid && positionMaps.principals.has(pid)) principalName = positionMaps.principals.get(pid);
    const brandId = row.brand_id ? String(row.brand_id) : '';
    const brandName = (brandId && positionMaps.brands.get(brandId)) || row.label || '-';
    ws.getCell(excelRow, 2).value = index + 1;
    ws.getCell(excelRow, 3).value = principalName;
    ws.getCell(excelRow, 4).value = brandName;
    ws.getCell(excelRow, 5).value = 1;
    ws.getCell(excelRow, 6).value = num(row.achievement) / 100;
    ws.getCell(excelRow, 5).numFmt = '0.0%';
    ws.getCell(excelRow, 6).numFmt = '0.0%';
    ws.getCell(excelRow, 7).value = {
      formula: `IF(F${excelRow}>=E${excelRow},"TERCAPAI",IF(F${excelRow}<0.5,"GUGUR (<50%)","GUGUR"))`,
    };
    styleRow(ws, excelRow, 2, 8);
  });

  const brandCount = brandRows.length;
  const firstBrandRow = 11;
  const lastBrandRow = 10 + brandCount;
  const totalRow = 11 + brandCount;
  writeMerged(ws, totalRow, 2, 4, 'TOTAL GOLONGAN (RATA-RATA PENCAPAIAN)');
  ws.getCell(totalRow, 5).value = brandCount
    ? { formula: `AVERAGE(E${firstBrandRow}:E${lastBrandRow})` }
    : 0;
  ws.getCell(totalRow, 6).value = brandCount
    ? { formula: `AVERAGE(F${firstBrandRow}:F${lastBrandRow})` }
    : 0;
  ws.getCell(totalRow, 5).numFmt = '0.0%';
  ws.getCell(totalRow, 6).numFmt = '0.0%';
  writeMerged(ws, totalRow, 7, 8, {
    formula: `IF(F${totalRow}>=E${totalRow},"TERCAPAI","GUGUR")`,
  });
  styleRow(ws, totalRow, 2, 8, { font: { bold: true }, fill: FILL_TOTAL });

  const criteriaTitle = totalRow + 2;
  const criteriaHeader = criteriaTitle + 1;
  writeMerged(ws, criteriaTitle, 2, 8, 'II. KRITERIA PENILAIAN INSENTIF').font = { bold: true };
  ['No', 'Kriteria', '', 'Target', 'Pencapaian', '% Tercapai', 'Keterangan'].forEach((text, i) => {
    ws.getCell(criteriaHeader, i + 2).value = text;
  });
  writeMerged(ws, criteriaHeader, 3, 4, 'Kriteria');
  styleRow(ws, criteriaHeader, 2, 8, { font: { bold: true }, fill: FILL_HEADER, alignment: { horizontal: 'center' } });

  const criteria = doc.criteria_rows || [];
  const ec = findCriteria(criteria, ['EFFECTIVE CALLS']);
  const item = findCriteria(criteria, ['ITEM / FAKTOR', 'ITEM / FAKTUR']);
  const langganan = findCriteria(criteria, ['LANGGANAN TRANSAKSI']);
  const golProduk = findCriteria(criteria, ['GOLONGAN PRODUK']);
  const gugur = findCriteria(criteria, ['GUGUR KURANG DARI 50%', 'GOL YG GUGUR']);
  const call = findCriteria(criteria, ['CALL COMPLIANCE']);

  const criteriaSpecs = [
    { label: 'EFFECTIVE CALLS', target: num(ec?.target_value), achievement: num(ec?.achievement_value), kind: 'ratio' },
    { label: 'ITEM / FAKTUR', target: num(item?.target_value), achievement: num(item?.achievement_value), kind: 'ratio' },
    { label: 'LANGGANAN TRANSAKSI', target: num(langganan?.target_value), achievement: num(langganan?.achievement_value), kind: 'ratio' },
    { label: 'TOTAL OMZET', target: 1, achievement: '-', kind: 'omzet' },
    { label: 'GOLONGAN PRODUK', target: '-', achievement: '-', kind: 'golProduk' },
    { label: 'GOL YG GUGUR KURANG DARI 50%', target: 0, achievement: '-', kind: 'gugur' },
    { label: 'CALL COMPLIANCE', target: '-', achievement: '-', kind: 'call', value: percentValue(call) },
  ];

  criteriaSpecs.forEach((spec, index) => {
    const row = criteriaHeader + 1 + index;
    ws.getCell(row, 2).value = index + 1;
    writeMerged(ws, row, 3, 4, spec.label);
    ws.getCell(row, 5).value = spec.target;
    ws.getCell(row, 6).value = spec.achievement;

    if (spec.kind === 'ratio') {
      ws.getCell(row, 7).value = { formula: `IF(E${row}=0,0,F${row}/E${row})` };
    } else if (spec.kind === 'omzet') {
      ws.getCell(row, 7).value = { formula: `F${totalRow}` };
    } else if (spec.kind === 'golProduk') {
      ws.getCell(row, 5).value = brandCount ? { formula: `COUNTA(D${firstBrandRow}:D${lastBrandRow})` } : 0;
      ws.getCell(row, 6).value = brandCount ? { formula: `COUNTIF(F${firstBrandRow}:F${lastBrandRow},">=1")` } : 0;
      ws.getCell(row, 7).value = { formula: `IF(E${row}=0,0,F${row}/E${row})` };
    } else if (spec.kind === 'gugur') {
      ws.getCell(row, 6).value = brandCount ? { formula: `COUNTIF(F${firstBrandRow}:F${lastBrandRow},"<0.5")` } : 0;
      ws.getCell(row, 7).value = { formula: `IF(E${row}=0,IF(F${row}=0,1,0),F${row}/E${row})` };
    } else {
      ws.getCell(row, 7).value = spec.value;
    }

    ws.getCell(row, 7).numFmt = '0.0%';
    ws.getCell(row, 8).value = { formula: `IF(G${row}>=1,"TERCAPAI","GUGUR")` };
    styleRow(ws, row, 2, 8);
  });

  const noteRow = criteriaHeader + 9;
  writeMerged(ws, noteRow, 2, 8, 'Catatan: Pada Golongan, Target selalu 100% dan Pencapaian langsung dibandingkan ke Keterangan. Pada Kriteria, Total Omzet bertarget 100% dan persentasenya diisi langsung pada kolom % Tercapai.').font = { italic: true, size: 9 };

  return {
    sheetName,
    totalRow,
    criteriaStart: criteriaHeader + 1,
    criteriaEnd: criteriaHeader + 7,
  };
}

function buildExportWorkbook(db, documents) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Insetive Tracking';
  workbook.calcProperties.fullCalcOnLoad = true;

  const principals = new Map(db.prepare('SELECT id, name FROM principals').all().map((r) => [String(r.id), r.name]));
  const brands = new Map(db.prepare('SELECT id, name FROM brands').all().map((r) => [String(r.id), r.name]));
  const positionMaps = { principals, brands };

  const positionById = new Map(db.prepare('SELECT id, name, sales_code, position_type FROM positions').all().map((r) => [String(r.id), r]));
  const positionByName = new Map([...positionById.values()].map((p) => [String(p.name).toUpperCase(), p]));

  const meta = [];
  documents.forEach((doc, index) => {
    const position = positionById.get(String(doc.position_id || doc.salesman_position_id))
      || positionByName.get(String(doc.salesman || '').toUpperCase());
    const prefix = doc.doc_kind === 'spv' ? 'SPV' : 'Sales';
    const sheetName = `${prefix}_${index + 1}`.slice(0, 31);
    const code = employeeCode(position, `${prefix === 'SPV' ? 'SPV' : 'SLS'}${String(index + 1).padStart(3, '0')}`);
    meta.push({ doc, sheetName, code, position });
  });

  const ws = workbook.addWorksheet('Rekap_Insentif', { properties: { defaultRowHeight: 18 } });
  ws.columns = [
    { width: 3 }, { width: 6 }, { width: 12 }, { width: 24 }, { width: 24 },
    { width: 15 }, { width: 14 }, { width: 14 }, { width: 17 },
    { width: 16 }, { width: 15 }, { width: 17 }, { width: 18 },
  ];
  const title = writeMerged(ws, 2, 2, 13, 'REKAPITULASI PENCAPAIAN INSENTIF SALES & SUPERVISOR (SPV)');
  title.font = { bold: true, size: 15 };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 30;

  const start = documents.reduce((min, d) => (!min || d.period < min ? d.period : min), '');
  const end = documents.reduce((max, d) => {
    const value = d.period_end || d.period;
    return !max || value > max ? value : max;
  }, '');
  writeMerged(ws, 3, 2, 13, `Periode: ${rangeLabel(start, end)}  |  Otomatis terhubung dengan masing-masing sheet Sales & SPV`).font = { italic: true };

  const rekapHeader = ['No', 'Kode', 'Nama Sales / SPV', 'Jabatan', 'Total Golongan (%)', 'EC (%)', 'Item/Faktur (%)', 'Langganan Trx (%)', 'Total Omzet (%)', 'Gol. Produk (%)', 'Gol. Gugur <50% (%)', 'Call Compliance'];
  rekapHeader.forEach((text, i) => { ws.getCell(5, i + 2).value = text; });
  styleRow(ws, 5, 2, 13, { font: { bold: true }, fill: FILL_HEADER, alignment: { horizontal: 'center', wrapText: true } });
  ws.getRow(5).height = 32;

  const details = meta.map(({ doc, sheetName, code }) => buildDetailSheet(workbook, doc, sheetName, code, positionMaps));

  details.forEach((detail, index) => {
    const row = 6 + index;
    const { doc, code } = meta[index];
    ws.getCell(row, 2).value = index + 1;
    ws.getCell(row, 3).value = code;
    ws.getCell(row, 4).value = doc.salesman || '-';
    ws.getCell(row, 5).value = jabatan(doc);
    ws.getCell(row, 6).value = { formula: `'${detail.sheetName}'!F${detail.totalRow}` };
    for (let offset = 0; offset < 7; offset += 1) {
      ws.getCell(row, 7 + offset).value = { formula: `'${detail.sheetName}'!G${detail.criteriaStart + offset}` };
    }
    for (let col = 6; col <= 13; col += 1) ws.getCell(row, col).numFmt = '0.0%';
    styleRow(ws, row, 2, 13);
  });

  return workbook;
}

module.exports = { buildExportWorkbook, periodLabel, employeeCode };
