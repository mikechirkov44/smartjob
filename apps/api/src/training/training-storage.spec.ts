import { TrainingDiskStorage } from './training-storage';
import { mkdtemp, readdir, rm } from 'fs/promises';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable, Writable } from 'stream';
it('cleans a partial upload and reports disk-full at the stream boundary', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'training-full-'));
  const storage = new TrainingDiskStorage(
    () => dir,
    (path: string) => {
      writeFileSync(path, 'partial');
      return new Writable({
        write(_b, _e, cb) {
          cb(Object.assign(new Error('disk full'), { code: 'ENOSPC' }));
        },
      }) as any;
    },
  );
  try {
    const error = await new Promise<Error>((resolve) =>
      storage._handleFile(
        {} as any,
        { stream: Readable.from(Buffer.from('abc')) } as any,
        (error: any) => resolve(error),
      ),
    );
    expect(error.message).toContain('места');
    expect(await readdir(dir)).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
