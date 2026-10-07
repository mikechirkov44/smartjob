import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType, SurveyStatus, SurveyTemplate } from '@prisma/client';

export class CustomQuestionDto {
  @IsString()
  @MinLength(3)
  text!: string;

  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateSurveyDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsEnum(SurveyTemplate)
  template!: SurveyTemplate;

  @IsOptional()
  @IsBoolean()
  includeEnps?: boolean;

  @IsOptional()
  @IsBoolean()
  adminCanIdentifyRespondents?: boolean;

  @IsOptional()
  @IsDateString()
  closesAt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomQuestionDto)
  questions?: CustomQuestionDto[];
}

export class UpdateSurveyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsEnum(SurveyStatus)
  status?: SurveyStatus;

  @IsOptional()
  @IsBoolean()
  includeEnps?: boolean;

  @IsOptional()
  @IsBoolean()
  adminCanIdentifyRespondents?: boolean;

  @IsOptional()
  @IsDateString()
  closesAt?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomQuestionDto)
  questions?: CustomQuestionDto[];
}

export class CreatePersonalLinksDto {
  @IsArray()
  @IsString({ each: true })
  employeeIds!: string[];
}
