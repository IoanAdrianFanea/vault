/*
Request body for creating a custom filter field: a name of up to 60
characters and its type.
*/


import { IsEnum, IsString, Length } from 'class-validator';
import { FilterType } from '@prisma/client';

export class CreateFilterDefinitionDto {
  @IsString()
  @Length(1, 60)
  name!: string;

  @IsEnum(FilterType)
  type!: FilterType;
}
