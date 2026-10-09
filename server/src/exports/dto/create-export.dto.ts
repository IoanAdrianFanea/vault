/*
Request body for a zip export: a non-empty list of document IDs.
*/


import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class CreateExportDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  documentIds: string[];
}
