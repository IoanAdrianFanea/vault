import { IsEnum, IsString, Length } from 'class-validator';
import { FilterType } from '@prisma/client';

export class CreateFilterDefinitionDto {
  @IsString()
  @Length(1, 60)
  name!: string;

  @IsEnum(FilterType)
  type!: FilterType;
}
