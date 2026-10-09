/*
Request body for changing a user's role.
*/


import { UserRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SetUserDto {
  @IsEnum(UserRole)
  role: UserRole;
}
