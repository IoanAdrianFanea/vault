import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { Readable } from 'stream';
import { LocalBlobStore } from './local-blob-store';

describe('LocalBlobStore', () => {
  let tempDir: string;
  let blobStore: LocalBlobStore;

  const createConfig = (overrides: Record<string, unknown> = {}) =>
    ({
      get: (key: string) => {
        if (key in overrides) return overrides[key];
        if (key === 'STORAGE_ROOT') return tempDir;
        if (key === 'COMPRESSION_THRESHOLD_BYTES') return 1024;
        if (key === 'COMPRESSION_MIN_SAVINGS_RATIO') return 0.1;
        return undefined;
      },
    }) as unknown as ConfigService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-test-blobstore-'));
    blobStore = new LocalBlobStore(createConfig());
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      /* empty */
    }
  });

  it('saves small buffer raw without compression', async () => {
    const data = Buffer.from('small text content');
    const result = await blobStore.saveFile(
      'p1',
      'd1',
      data,
      'application/pdf',
    );

    expect(result.storageKey).toBe('active/p1/d1.pdf');
    expect(result.compressed).toBe(false);
    expect(result.storedSizeBytes).toBe(data.length);

    const read = await blobStore.readFile(result.storageKey);
    expect(read.equals(data)).toBe(true);
  });

  it('compresses highly repetitive data above threshold and reads back original', async () => {
    const data = Buffer.alloc(64 * 1024, 'a');
    const result = await blobStore.saveFile(
      'p1',
      'd2',
      data,
      'application/pdf',
    );

    expect(result.storageKey).toBe('active/p1/d2.pdf.gz');
    expect(result.compressed).toBe(true);
    expect(result.storedSizeBytes).toBeLessThan(data.length);

    const read = await blobStore.readFile(result.storageKey);
    expect(read.equals(data)).toBe(true);
  });

  it('skips compression when savings ratio is not met (random data)', async () => {
    const data = crypto.randomBytes(64 * 1024);
    const result = await blobStore.saveFile(
      'p1',
      'd3',
      data,
      'application/pdf',
    );

    expect(result.storageKey).toBe('active/p1/d3.pdf');
    expect(result.compressed).toBe(false);

    const read = await blobStore.readFile(result.storageKey);
    expect(read.equals(data)).toBe(true);
  });

  it('createReadStream on a .gz key yields original decompressed bytes', async () => {
    const data = Buffer.alloc(64 * 1024, 'z');
    const result = await blobStore.saveFile(
      'p1',
      'd4',
      data,
      'application/pdf',
    );
    expect(result.compressed).toBe(true);

    const stream = blobStore.createReadStream(result.storageKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const combined = Buffer.concat(chunks);
    expect(combined.equals(data)).toBe(true);
  });

  it('writeStream writes raw content and returns byte count', async () => {
    const content = Buffer.from('streamed raw content');
    const source = Readable.from(content);
    const size = await blobStore.writeStream('archived/p1.zip', source);

    expect(size).toBe(content.length);
    expect(await blobStore.getSize('archived/p1.zip')).toBe(content.length);
  });

  it('moveFile, exists, deleteFile and getSize behave correctly', async () => {
    const data = Buffer.from('move test data');
    await blobStore.saveFile('p1', 'd5', data, 'application/pdf');

    expect(await blobStore.exists('active/p1/d5.pdf')).toBe(true);
    expect(await blobStore.getSize('active/p1/d5.pdf')).toBe(data.length);

    await blobStore.moveFile('active/p1/d5.pdf', 'deleted/p1/d5.pdf');
    expect(await blobStore.exists('active/p1/d5.pdf')).toBe(false);
    expect(await blobStore.exists('deleted/p1/d5.pdf')).toBe(true);

    await blobStore.deleteFile('deleted/p1/d5.pdf');
    expect(await blobStore.exists('deleted/p1/d5.pdf')).toBe(false);

    // Deleting missing file should not throw
    await expect(
      blobStore.deleteFile('deleted/p1/d5.pdf'),
    ).resolves.not.toThrow();
  });

  it('rejects path traversal attempts', async () => {
    await expect(blobStore.readFile('../escape')).rejects.toThrow(
      'Unsafe storage key',
    );
  });

  it('falls back to default config when invalid values are given', () => {
    const invalidConfig = createConfig({
      COMPRESSION_THRESHOLD_BYTES: 'invalid',
      COMPRESSION_MIN_SAVINGS_RATIO: -1,
    });
    const store = new LocalBlobStore(invalidConfig);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect((store as any).compressionThresholdBytes).toBe(5 * 1024 * 1024);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect((store as any).compressionMinSavingsRatio).toBe(0.1);
  });
});
