import ExcelJS from 'exceljs';

export type ReportRow = Record<string, string | number | boolean | null>;

function escapeCsvCell(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(rows: ReportRow[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) =>
      headers.map((h) => escapeCsvCell(row[h] ?? null)).join(','),
    ),
  ];
  return lines.join('\n');
}

export async function rowsToXlsxBuffer(
  rows: ReportRow[],
  sheetName = 'Report',
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  if (!rows.length) {
    sheet.addRow(['(no rows)']);
  } else {
    const headers = Object.keys(rows[0]);
    sheet.addRow(headers);
    for (const row of rows) {
      sheet.addRow(headers.map((h) => row[h] ?? null));
    }
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
