import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
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
  @MaxLength(120)
  metric?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([5, 10])
  scaleMax?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  scaleMinLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  scaleMaxLabel?: string;

  @IsOptional()
  @Type(() => Number)
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
  @ValidateIf((_, value) => value !== null)
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
