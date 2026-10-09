/*
Builds the CSV export of the documents list: the column set, the file contents
and a dated file name. Used by the documents page bulk and toolbar exports.
*/


import type { Document } from '../../types';
import type { CsvColumn } from '../../utils/csv';
import { toCsv } from '../../utils/csv';
import { documentStatusStyles } from '../ui';
import { formatSortableDate, formatSortableDateTime } from '../../utils/format';

const DOCUMENT_CSV_COLUMNS: CsvColumn<Document>[] = [
  { header: 'File name', value: (doc) => doc.fileName },
  { header: 'Project', value: (doc) => doc.projectName ?? '' },
  { header: 'Status', value: (doc) => documentStatusStyles[doc.status].label },
  { header: 'Uploaded by', value: (doc) => doc.uploadedBy ?? '' },
  {
    header: 'Date uploaded',
    value: (doc) => (doc.uploadedAt ? formatSortableDateTime(doc.uploadedAt) : ''),
  },
  {
    header: 'Size (KB)',
    value: (doc) =>
      doc.sizeBytes === undefined ? '' : Math.round((doc.sizeBytes / 1024) * 10) / 10,
  },
];

export function buildDocumentsCsv(documents: Document[]): string {
  return toCsv(documents, DOCUMENT_CSV_COLUMNS);
}

export function documentsCsvFileName(now: Date): string {
  return `documents-${formatSortableDate(now)}.csv`;
}
