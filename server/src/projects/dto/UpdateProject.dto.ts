/*
Request body for renaming a project.
*/


import { IsString } from 'class-validator';

export class UpdateProjectDto {
  @IsString()
  name: string;
}
