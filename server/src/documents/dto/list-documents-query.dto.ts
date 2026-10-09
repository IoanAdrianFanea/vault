/*
Query parameters for the document list and status counts: project, free-text
search, custom filters, status and sort order.
*/


import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { DocumentStatus } from '@prisma/client';

export type DocumentsSortBy =
  | 'upload-newest'
  | 'upload-oldest'
  | 'name-asc'
  | 'name-desc'
  | 'status';

export class ListDocumentsQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  /** Free-text search across filename and extracted document text. */
  @IsOptional()
  @IsString()
  mainFilter?: string;

  /**
   * JSON-encoded map of `{ [filterDefinitionId]: { value?, from?, to? } }` for the
   * admin-configurable custom filter fields (Phase 3). See filter-values.util.ts.
   */
  @IsOptional()
  @IsString()
  customFilters?: string;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @IsIn(['upload-newest', 'upload-oldest', 'name-asc', 'name-desc', 'status'])
  sortBy?: DocumentsSortBy;
}
