/*
Form fields sent alongside an uploaded file: the target project and optional
custom filter values.
*/


import { IsOptional, IsString, MinLength } from 'class-validator';

export class UploadDocumentDto {
  @IsString()
  @MinLength(1)
  projectId!: string;

  /**
   * JSON-encoded map of `{ [filterDefinitionId]: "raw string value" }` for the
   * custom filter fields (Phase 3). Sent as a form field alongside the file since
   * uploads are multipart/form-data.
   */
  @IsOptional()
  @IsString()
  filterValues?: string;
}
