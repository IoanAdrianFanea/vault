/*
Extracts searchable text from uploads: pdf-parse for PDFs and English
tesseract.js OCR for JPEG and PNG images. Used by DocumentsService during
upload.
*/


import { Injectable } from '@nestjs/common';
import { recognize } from 'tesseract.js';

// PDF text extraction and image OCR service
@Injectable()
export class ExtractionService {
  /**
   * Extract text from a PDF file
   */
  async extractTextFromPdfBuffer(
    buffer: Buffer,
  ): Promise<{ text: string; pageCount: number }> {
    // Parse PDF and extract text
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);

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
  async extractTextFromImageBuffer(buffer: Buffer): Promise<{ text: string }> {
    const {
      data: { text },
    } = await recognize(buffer, 'eng', { errorHandler: () => {} });

    return { text: text.replace(/\s+/g, ' ').trim() };
  }
}
