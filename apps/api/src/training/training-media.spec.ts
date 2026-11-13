import { mkdtemp, mkdir, writeFile, access, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { TrainingMediaUploadController } from './training-media.controller';
import { mediaKind } from './training.content';
describe('training media', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'training-'));
    process.env.UPLOAD_DIR = dir;
    await mkdir(join(dir, 'training'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    delete process.env.UPLOAD_DIR;
  });
  it('rejects a disguised executable and removes the uploaded file', async () => {
    const path = join(dir, 'training', 'test.upload');
    await writeFile(path, 'MZ executable');
    const c = new TrainingMediaUploadController({} as any);
    await expect(
      c.upload('org', { path, mimetype: 'image/png', size: 13 } as any),
    ).rejects.toThrow();
    await expect(access(path)).rejects.toThrow();
  });
  it('rejects oversized images before retaining a file', async () => {
    const path = join(dir, 'training', 'test.upload');
    await writeFile(path, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const c = new TrainingMediaUploadController({} as any);
    await expect(
      c.upload('org', {
        path,
        mimetype: 'image/png',
        size: 6 * 1024 * 1024,
      } as any),
    ).rejects.toThrow('5 МБ');
    await expect(access(path)).rejects.toThrow();
  });
  it('recognizes actual MP4 and WebM signatures, rejects MIME mismatch', () => {
    const mp4 = Buffer.from([
      0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109,
    ]);
    expect(mediaKind(mp4, 'video/mp4')?.ext).toBe('.mp4');
    expect(mediaKind(mp4, 'image/png')).toBeNull();
    expect(mediaKind(Buffer.from([26, 69, 223, 163]), 'video/webm')?.ext).toBe(
      '.webm',
    );
  });
});

describe('completed upload integrity', () => {
  it('rejects signature-only truncated PNG before saving metadata', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'training-truncated-'));
    process.env.UPLOAD_DIR = dir;
    await mkdir(join(dir, 'training'));
    const path = join(dir, 'partial.upload');
    await writeFile(path, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const db: any = {
      trainingMedia: { create: jest.fn().mockResolvedValue({ id: 'm' }) },
    };
    try {
      await expect(
        new TrainingMediaUploadController(db).upload('org', {
          path,
          mimetype: 'image/png',
          size: 8,
        } as any),
      ).rejects.toThrow();
      expect(db.trainingMedia.create).not.toHaveBeenCalled();
    } finally {
      await rm(dir, { recursive: true, force: true });
      delete process.env.UPLOAD_DIR;
    }
  });
});
