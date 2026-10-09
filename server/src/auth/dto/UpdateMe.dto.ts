/*
Request body for PATCH /auth/me, where signed-in users update their own name,
email, language or timezone. Every field is optional.
*/


import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { normalizeEmail } from '../../common/email.util';

export class ProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  // Changing this re-triggers email verification (see AuthService.updateMe)
  @IsOptional()
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
