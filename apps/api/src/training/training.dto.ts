import {
  IsArray,
  ArrayMaxSize,
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
  @IsOptional() @IsBoolean() choice?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  selection?: string[];
}

export class PublishTrainingDto {
  @IsString() draftVersion!: string;
}
