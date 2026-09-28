import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { recognize } from 'tesseract.js';

// PDF text extraction and image OCR service
@Injectable()
export class ExtractionService {
  /**
   * Extract text from a PDF file
   */
  async extractTextFromPdfPath(
    pdfPath: string,
  ): Promise<{ text: string; pageCount: number }> {
    // Read PDF file into buffer
    const dataBuffer = await fs.readFile(pdfPath);

    // Parse PDF and extract text
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(dataBuffer);

    // Normalize whitespace in extracted text
    const normalizedText = data.text.replace(/\s+/g, ' ').trim();

    return {
      text: normalizedText,
      pageCount: data.numpages,
    };
  }

  /**
   * OCR a JPEG/PNG image so its text content becomes searchable (Phase 3).
   * Uses tesseract.js's English model; each call spins up and tears down its own
   * worker, which is simple and safe for the current per-upload volume.
   *
   * `errorHandler` is required here, not optional: without it, tesseract.js
   * rethrows worker-side failures (e.g. an unreadable/corrupt image) as an
   * uncaught exception on the worker's message port instead of only rejecting
   * the returned promise, which would crash the whole Node process. Providing
   * a handler (even a no-op) keeps that failure inside the awaited promise so
   * the caller's try/catch can handle it.
   */
  async extractTextFromImagePath(
    imagePath: string,
  ): Promise<{ text: string }> {
    const {
      data: { text },
    } = await recognize(imagePath, 'eng', { errorHandler: () => {} });

    return { text: text.replace(/\s+/g, ' ').trim() };
  }
}
