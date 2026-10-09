/*
Request body for renaming a custom filter field or changing its type; both
fields are optional.
*/


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
