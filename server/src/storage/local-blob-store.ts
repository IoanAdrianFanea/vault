// Direct fs usage allowed: local blob storage provider (RQ7).
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  promises as fs,
  createReadStream as fsCreateReadStream,
  createWriteStream as fsCreateWriteStream,
} from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';
import * as stream from 'stream';
import { Readable } from 'stream';
import type { BlobStore, SavedBlob } from './blob-store.interface';
import {
  activeDocumentKey,
  assertSafeStorageKey,
  documentFileName,
  extensionForMimeType,
  isCompressedKey,
} from './storage-keys';

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

@Injectable()
export class LocalBlobStore implements BlobStore {
  private readonly rootDir: string;
  private readonly compressionThresholdBytes: number;
  private readonly compressionMinSavingsRatio: number;
  private readonly logger = new Logger(LocalBlobStore.name);

  constructor(config: ConfigService) {
    this.rootDir = path.resolve(config.get<string>('STORAGE_ROOT') ?? './data');

    const thresholdRaw = config.get<string | number>(
      'COMPRESSION_THRESHOLD_BYTES',
    );
    const parsedThreshold =
      thresholdRaw !== undefined ? Number(thresholdRaw) : NaN;
    if (Number.isFinite(parsedThreshold) && parsedThreshold >= 0) {
      this.compressionThresholdBytes = Math.floor(parsedThreshold);
    } else {
      if (thresholdRaw !== undefined) {
        this.logger.warn(
          `Invalid COMPRESSION_THRESHOLD_BYTES "${thresholdRaw}", falling back to default 5242880`,
        );
      }
      this.compressionThresholdBytes = 5 * 1024 * 1024;
    }

    const minSavingsRaw = config.get<string | number>(
      'COMPRESSION_MIN_SAVINGS_RATIO',
    );
    const parsedMinSavings =
      minSavingsRaw !== undefined ? Number(minSavingsRaw) : NaN;
    if (
      Number.isFinite(parsedMinSavings) &&
      parsedMinSavings >= 0 &&
      parsedMinSavings < 1
    ) {
      this.compressionMinSavingsRatio = parsedMinSavings;
    } else {
      if (minSavingsRaw !== undefined) {
        this.logger.warn(
          `Invalid COMPRESSION_MIN_SAVINGS_RATIO "${minSavingsRaw}", falling back to default 0.1`,
        );
      }
      this.compressionMinSavingsRatio = 0.1;
    }
  }

  private resolvePath(storageKey: string): string {
    assertSafeStorageKey(storageKey);
    const full = path.resolve(this.rootDir, storageKey);
    if (!full.startsWith(this.rootDir + path.sep)) {
      throw new Error('Unsafe storage key');
    }
    return full;
  }

  async saveFile(
    projectId: string,
    documentId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<SavedBlob> {
    const extension = extensionForMimeType(mimeType);
    const fileName = documentFileName(documentId, extension);
    const baseKey = activeDocumentKey(projectId, fileName);

    let storageKey = baseKey;
    let storedBuffer = buffer;
    let compressed = false;

    if (buffer.length > this.compressionThresholdBytes) {
      const gz = await gzipAsync(buffer);
      if (gz.length <= buffer.length * (1 - this.compressionMinSavingsRatio)) {
        storageKey = `${baseKey}.gz`;
        storedBuffer = gz;
        compressed = true;
        const savingPercent = ((1 - gz.length / buffer.length) * 100).toFixed(
          1,
        );
        this.logger.debug(
          `Compressed ${baseKey}: ${buffer.length} -> ${gz.length} bytes (${savingPercent}% saved)`,
        );
      }
    }

    const fullPath = this.resolvePath(storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, storedBuffer);

    return {
      storageKey,
      storedSizeBytes: storedBuffer.length,
      compressed,
    };
  }

  async readFile(storageKey: string): Promise<Buffer> {
    const fullPath = this.resolvePath(storageKey);
    const rawBuffer = await fs.readFile(fullPath);

    if (isCompressedKey(storageKey)) {
      return gunzipAsync(rawBuffer);
    }
    return rawBuffer;
  }

  createReadStream(storageKey: string): Readable {
    const fullPath = this.resolvePath(storageKey);
    const src = fsCreateReadStream(fullPath);

    if (!isCompressedKey(storageKey)) {
      return src;
    }

    const gunzip = zlib.createGunzip();
    stream.pipeline(src, gunzip, (err) => {
      if (err) {
        gunzip.destroy(err);
      }
    });

    return gunzip;
  }

  async writeStream(storageKey: string, source: Readable): Promise<number> {
    const fullPath = this.resolvePath(storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    const dest = fsCreateWriteStream(fullPath);
    await pipeline(source, dest);
    const stat = await fs.stat(fullPath);
    return stat.size;
  }

  async withLocalFile<T>(
    storageKey: string,
    fn: (localPath: string) => Promise<T>,
  ): Promise<T> {
    const fullPath = this.resolvePath(storageKey);
    return fn(fullPath);
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(storageKey);
      await fs.access(fullPath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async getSize(storageKey: string): Promise<number> {
    const fullPath = this.resolvePath(storageKey);
    const stat = await fs.stat(fullPath);
    return stat.size;
  }

  async moveFile(fromKey: string, toKey: string): Promise<void> {
    if (fromKey === toKey) {
      return;
    }

    const fromPath = this.resolvePath(fromKey);
    const toPath = this.resolvePath(toKey);

    await fs.mkdir(path.dirname(toPath), { recursive: true });

    try {
      await fs.rename(fromPath, toPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
        await fs.copyFile(fromPath, toPath);
        await fs.unlink(fromPath);
        return;
      }
      throw error;
    }
  }

  async deleteFile(storageKey: string): Promise<void> {
    try {
      const fullPath = this.resolvePath(storageKey);
      await fs.unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
