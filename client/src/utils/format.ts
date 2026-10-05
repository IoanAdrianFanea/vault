// Built from date parts: en-GB Intl output uses "Sept" and a comma before the time.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parseDate(value: Date | string): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: Date | string): string {
  const d = parseDate(value);
  if (!d) return '—';
  const day = pad2(d.getDate());
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatDateTime(value: Date | string): string {
  const d = parseDate(value);
  if (!d) return '—';
  const day = pad2(d.getDate());
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hours = pad2(d.getHours());
  const minutes = pad2(d.getMinutes());
  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

export function formatTime(value: Date | string): string {
  const d = parseDate(value);
  if (!d) return '—';
  const hours = pad2(d.getHours());
  const minutes = pad2(d.getMinutes());
  return `${hours}:${minutes}`;
}

export function formatIsoDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const year = parseInt(match[1], 10);
  const monthIdx = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  if (monthIdx < 0 || monthIdx > 11 || isNaN(day) || isNaN(year)) return value;
  return `${pad2(day)} ${MONTHS[monthIdx]} ${year}`;
}

export function formatSortableDate(value: Date): string {
  const year = value.getFullYear();
  const month = pad2(value.getMonth() + 1);
  const day = pad2(value.getDate());
  return `${year}-${month}-${day}`;
}

export function formatSortableDateTime(value: Date | string): string {
  const d = parseDate(value);
  if (!d) return '';
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hours = pad2(d.getHours());
  const minutes = pad2(d.getMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatCount(count: number): string {
  return count.toLocaleString('en-GB');
}

export function formatCountLabel(count: number, singular: string, plural: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}
