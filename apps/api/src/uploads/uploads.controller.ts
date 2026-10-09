import {
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrgRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import { Public, Roles } from '../auth/decorators';
import { UploadsService } from './uploads.service';

@Controller()
export class UploadsController {
  constructor(private readonly service: UploadsService) {}

  @Public()
  @Get('uploads/:filename')
  getFile(@Param('filename') filename: string) {
    const stream = this.service.openFile(filename);
    return new StreamableFile(stream, {
      type: this.service.contentType(filename),
      disposition: `inline; filename="${filename}"`,
    });
  }

  @Roles(OrgRole.HR)
  @Post('organizations/:organizationId/uploads/cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadCover(@UploadedFile() file: Express.Multer.File) {
    return this.service.saveCover(file);
  }
}
