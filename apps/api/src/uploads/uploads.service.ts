import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { extname, join } from 'path';

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

const MAX_BYTES = 2 * 1024 * 1024;

@Injectable()
export class UploadsService implements OnModuleInit {
  private dir: string;

  constructor(private readonly config: ConfigService) {
    this.dir = this.config.get<string>('UPLOAD_DIR', join(process.cwd(), 'uploads'));
  }

  onModuleInit() {
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  async saveCover(file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Файл не получен');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Файл больше 2 МБ');
    }
    const ext = ALLOWED_MIME[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        'Допустимы только изображения: JPG, PNG, WEBP, GIF, SVG',
      );
    }
    const filename = `${randomUUID()}${ext}`;
    await writeFile(join(this.dir, filename), file.buffer);
    const coverImage = `uploads/${filename}`;
    return { coverImage, url: `/api/${coverImage}` };
  }

  openFile(filename: string) {
    if (!/^[a-f0-9-]{36}\.(jpg|png|webp|gif|svg)$/i.test(filename)) {
      throw new BadRequestException('Некорректное имя файла');
    }
    const path = join(this.dir, filename);
    if (!existsSync(path)) {
      throw new NotFoundException('Файл не найден');
    }
    return createReadStream(path);
  }

  contentType(filename: string) {
    const ext = extname(filename).toLowerCase();
    switch (ext) {
      case '.jpg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      case '.gif':
        return 'image/gif';
      case '.svg':
        return 'image/svg+xml';
      default:
        return 'application/octet-stream';
    }
  }
}
