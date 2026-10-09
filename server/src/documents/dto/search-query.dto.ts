/*
Query parameters for full-text document search, which needs a search term of
at least 2 characters.
*/


import { IsString, MinLength } from 'class-validator';

// DTO for search query validation
export class SearchQueryDto {
  @IsString()
  @MinLength(2, { message: 'Search query must be at least 2 characters long' })
  q: string;
}
