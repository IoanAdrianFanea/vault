/*
Request body for signing in, with the email trimmed and lower-cased before
validation.
*/


import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';
import { normalizeEmail } from '../../common/email.util';

// DTO for login request validation
export class LoginDto {
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
