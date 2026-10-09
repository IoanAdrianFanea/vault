/*
Request body for changing your own password: the current password plus a new
one that meets the strong-password policy.
*/


import { IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from './password-policy.decorator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Current password is required' })
  currentPassword: string;

  @IsStrongPassword()
  newPassword: string;
}
