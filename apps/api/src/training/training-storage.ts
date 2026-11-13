import { BadRequestException } from '@nestjs/common';
import { createWriteStream, type WriteStream } from 'fs';
import { mkdir, unlink, stat, open } from 'fs/promises';
import { join } from 'path';
import { pipeline } from 'stream';
import { randomUUID } from 'crypto';
import type { StorageEngine } from 'multer';
import type { Request } from 'express';
export const trainingDir = () =>
  join(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'), 'training');
export class TrainingDiskStorage implements StorageEngine {
  constructor(
    private directory = trainingDir,
    private createStream: (path: string) => WriteStream = (path) =>
      createWriteStream(path, { flags: 'wx' }),
  ) {}
  _handleFile(
    _req: Request,
    file: Express.Multer.File,
    cb: (error?: any, info?: Partial<Express.Multer.File>) => void,
  ) {
    const directory = this.directory();
    const filename = randomUUID() + '.upload';
    const path = join(directory, filename);
    file.path = path;
    file.filename = filename;
    file.destination = directory;
    const fail = async (error: NodeJS.ErrnoException) => {
      await unlink(path).catch(() => {});
      cb(
        error.code === 'ENOSPC'
          ? new BadRequestException('Недостаточно места на сервере')
          : error,
      );
    };
    void mkdir(directory, { recursive: true })
      .then(() => {
        let stream: WriteStream;
        try {
          stream = this.createStream(path);
        } catch (e) {
          void fail(e as NodeJS.ErrnoException);
          return;
        }
        pipeline(file.stream, stream, (error) => {
          if (error) {
            void fail(error);
            return;
          }
          cb(null, {
            destination: directory,
            filename,
            path,
            size: stream.bytesWritten,
          });
        });
      })
      .catch((error) => void fail(error));
  }
  _removeFile(
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null) => void,
  ) {
    void unlink(file.path)
      .then(() => cb(null))
      .catch((e) => cb(e.code === 'ENOENT' ? null : e));
  }
}
/** Basic complete-container checks supplement MIME sniffing without buffering videos. */
export async function validateMediaFile(path: string, ext: string) {
  const file = await open(path, 'r');
  try {
    const size = (await file.stat()).size;
    const head = Buffer.alloc(Math.min(size, 65536));
    await file.read(head, 0, head.length, 0);
    const tail = Buffer.alloc(Math.min(size, 12));
    await file.read(tail, 0, tail.length, size - tail.length);
    let ok = false;
    if (ext === '.png')
      ok =
        size >= 45 &&
        head.toString('ascii', 12, 16) === 'IHDR' &&
        head.readUInt32BE(16) > 0 &&
        head.readUInt32BE(20) > 0 &&
        tail.toString('ascii', 4, 8) === 'IEND';
    if (ext === '.jpg')
      ok =
        size >= 32 &&
        tail[tail.length - 2] === 255 &&
        tail[tail.length - 1] === 217;
    if (ext === '.webp')
      ok =
        size >= 30 &&
        head.readUInt32LE(4) + 8 === size &&
        ['VP8 ', 'VP8L', 'VP8X'].includes(head.toString('ascii', 12, 16));
    if (ext === '.webm')
      ok =
        size > 64 &&
        head.includes(Buffer.from([24, 83, 128, 103])) &&
        head.includes(Buffer.from([22, 84, 174, 107]));
    if (ext === '.mp4') {
      const boxes = new Set<string>();
      let pos = 0;
      while (pos + 8 <= size) {
        const h = Buffer.alloc(16);
        await file.read(h, 0, Math.min(16, size - pos), pos);
        let length = h.readUInt32BE(0);
        if (length === 1) {
          const big = h.readBigUInt64BE(8);
          if (big > BigInt(Number.MAX_SAFE_INTEGER)) break;
          length = Number(big);
        }
        if (length === 0) length = size - pos;
        if (length < 8 || pos + length > size) break;
        boxes.add(h.toString('ascii', 4, 8));
        pos += length;
      }
      ok =
        pos === size &&
        boxes.has('ftyp') &&
        boxes.has('moov') &&
        boxes.has('mdat');
    }
    if (!ok)
      throw new BadRequestException(
        'Файл повреждён или загружен не полностью. Выберите другой файл.',
      );
  } finally {
    await file.close();
  }
}
