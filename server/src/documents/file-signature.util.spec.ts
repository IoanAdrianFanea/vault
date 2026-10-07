import { detectFileType } from './file-signature.util';

describe('detectFileType', () => {
  it('detects valid PNG signature', () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ]);
    expect(detectFileType(png)).toBe('image/png');
  });

  it('detects valid JPEG signature', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectFileType(jpeg)).toBe('image/jpeg');
  });

  it('detects valid PDF signature', () => {
    const pdf = Buffer.from('%PDF-1.4 header');
    expect(detectFileType(pdf)).toBe('application/pdf');
  });

  it('detects a PDF with a 10-byte preamble', () => {
    const preamble = Buffer.from('1234567890');
    const pdfBody = Buffer.from('%PDF-1.7 header');
    const pdf = Buffer.concat([preamble, pdfBody]);
    expect(detectFileType(pdf)).toBe('application/pdf');
  });

  it('returns null for a text file', () => {
    const text = Buffer.from('Hello world! Just plain text.');
    expect(detectFileType(text)).toBeNull();
  });

  it('returns null for an empty buffer', () => {
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
  });

  it('does not match when PNG buffer is checked against image/jpeg', () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ]);
    const detected = detectFileType(png);
    expect(detected).toBe('image/png');
    expect(detected).not.toBe('image/jpeg');
  });
});
