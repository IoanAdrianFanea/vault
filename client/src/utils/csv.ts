/*
Builds CSV text from rows and column definitions, quoting cells and neutralising
spreadsheet formulas, and saves it as a file. Used by the documents CSV export.
*/


import { saveFile, type SaveResult, type SaveTarget } from './saveFile';

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  if (str.includes('"') || str.includes(',') || str.includes('\r') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const headerLine = columns.map((col) => escapeCsvCell(col.header)).join(',');
  const rowLines = rows.map((row) =>
    columns.map((col) => escapeCsvCell(col.value(row))).join(','),
  );
  const content = [headerLine, ...rowLines].join('\r\n') + '\r\n';
  return '\uFEFF' + content;
}

export function downloadCsv(
  fileName: string,
  content: string,
  options: { projectName?: string; target?: Promise<SaveTarget> } = {},
): Promise<SaveResult> {
  return saveFile(new Blob([content], { type: 'text/csv;charset=utf-8' }), fileName, options);
}
