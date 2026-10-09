/*
Request body for creating a project.
*/


import { IsString } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  name: string;
}
