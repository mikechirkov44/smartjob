import {
  IsObject,
  IsString,
  IsBoolean,
  MaxLength,
  IsOptional,
} from 'class-validator';
export class SaveCourseDto {
  @IsObject() content!: Record<string, unknown>;
}
export class CreateCourseDto {
  @IsOptional() @IsString() template?: string;
}
export class StartTrainingDto {
  @IsString() @MaxLength(160) participantName!: string;
}
export class TrainingAnswerDto {
  @IsString() @MaxLength(100) questionId!: string;
  @IsBoolean() choice!: boolean;
}

export class PublishTrainingDto {
  @IsString() draftVersion!: string;
}
