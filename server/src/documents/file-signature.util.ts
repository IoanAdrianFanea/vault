const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PDF_MAGIC = '%PDF-';

export function detectFileType(
  buffer: Buffer,
): 'application/pdf' | 'image/jpeg' | 'image/png' | null {
  if (!buffer || buffer.length < 3) {
    return null;
  }

  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC)) {
    return 'image/png';
  }

  if (buffer.subarray(0, 3).equals(JPEG_MAGIC)) {
    return 'image/jpeg';
  }

  const searchLength = Math.min(buffer.length, 1024);
  if (buffer.subarray(0, searchLength).indexOf(PDF_MAGIC) !== -1) {
    return 'application/pdf';
  }

  return null;
}
