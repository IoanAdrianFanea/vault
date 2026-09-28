import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { FilterType } from '@prisma/client';

export class UpdateFilterDefinitionDto {
  @IsOptional()
  @IsString()
  @Length(1, 60)
  name?: string;

  @IsOptional()
  @IsEnum(FilterType)
  type?: FilterType;
}
