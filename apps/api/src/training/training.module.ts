import { Module } from '@nestjs/common';
import { TrainingService } from './training.service';
import {
  TrainingAccessGuard,
  TrainingController,
  PublicTrainingController,
} from './training.controller';
import {
  TrainingMediaController,
  TrainingMediaUploadController,
} from './training-media.controller';
@Module({
  controllers: [
    TrainingController,
    PublicTrainingController,
    TrainingMediaController,
    TrainingMediaUploadController,
  ],
  providers: [TrainingService, TrainingAccessGuard],
})
export class TrainingModule {}
