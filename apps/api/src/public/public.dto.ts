import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AnswerDto {
  @IsString()
  questionId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  valueInt?: number;

  @IsOptional()
  @IsString()
  valueText?: string;

  /** GRID: map rowId -> columnId */
  @IsOptional()
  @IsObject()
  valueJson?: Record<string, string>;
}

export class SubmitSurveyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  enps?: number;
}
