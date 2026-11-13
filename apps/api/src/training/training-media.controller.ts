import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Res,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TrainingDiskStorage, validateMediaFile } from './training-storage';
import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { open, rename, unlink, stat } from 'fs/promises';
import { join } from 'path';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators';
import { TrainingAccessGuard } from './training.controller';
import { mediaKind } from './training.content';
const dir = () =>
  join(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'), 'training');
@Controller('organizations/:organizationId/training/media')
@UseGuards(TrainingAccessGuard)
export class TrainingMediaUploadController {
  constructor(private readonly db: PrismaService) {}
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: new TrainingDiskStorage(),
      limits: { fileSize: 50 * 1024 * 1024 + 1, files: 1 },
    }),
  )
  async upload(
    @Param('organizationId') org: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Файл не получен');
    let target = file.path;
    try {
      const f = await open(file.path, 'r');
      const header = Buffer.alloc(32);
      try {
        await f.read(header, 0, 32, 0);
      } finally {
        await f.close();
      }
      const kind = mediaKind(header, file.mimetype);
      if (!kind)
        throw new BadRequestException('Допустимы JPG, PNG, WEBP, MP4 и WebM');
      if (kind.kind === 'image' && file.size > 5 * 1024 * 1024)
        throw new BadRequestException('Изображение больше 5 МБ');
      if (file.size > 50 * 1024 * 1024)
        throw new BadRequestException('Видео больше 50 МБ');
      await validateMediaFile(file.path, kind.ext);
      const filename = randomUUID() + kind.ext;
      const finalPath = join(dir(), filename);
      await rename(file.path, finalPath);
      target = finalPath;
      const media = await this.db.trainingMedia.create({
        data: {
          organizationId: org,
          filename,
          mime: file.mimetype,
          size: file.size,
        },
      });
      return {
        mediaId: media.id,
        kind: kind.kind,
        url: '/api/training-media/' + filename,
      };
    } catch (e) {
      await unlink(target).catch(() => {});
      if ((e as NodeJS.ErrnoException).code === 'ENOSPC')
        throw new BadRequestException('Недостаточно места на сервере');
      throw e;
    }
  }
}
@Public()
@Controller('training-media')
export class TrainingMediaController {
  constructor(private readonly db: PrismaService) {}
  @Get(':filename')
  async read(
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!/^[a-f0-9-]{36}\.(jpg|png|webp|mp4|webm)$/.test(filename))
      throw new NotFoundException();
    const media = await this.db.trainingMedia.findUnique({
      where: { filename },
    });
    if (!media) throw new NotFoundException();
    const path = join(dir(), filename);
    const info = await stat(path).catch(() => null);
    if (!info) throw new NotFoundException();
    res.set({
      'Content-Type': media.mime,
      'Accept-Ranges': 'bytes',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=86400',
    });
    let start = 0,
      end = info.size - 1;
    let partial = false;
    if (req.headers.range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!m || (!m[1] && !m[2])) {
        res.status(416).set('Content-Range', `bytes */${info.size}`).end();
        return;
      }
      if (!m[1]) {
        start = Math.max(0, info.size - Number(m[2]));
      } else {
        start = Number(m[1]);
        if (m[2]) end = Math.min(end, Number(m[2]));
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= info.size
      ) {
        res.status(416).set('Content-Range', `bytes */${info.size}`).end();
        return;
      }
      partial = true;
    }
    res.status(partial ? 206 : 200);
    if (partial) res.set('Content-Range', `bytes ${start}-${end}/${info.size}`);
    res.set('Content-Length', String(end - start + 1));
    const stream = createReadStream(path, { start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }
}
