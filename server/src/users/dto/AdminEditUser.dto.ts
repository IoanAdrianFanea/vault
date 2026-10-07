import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { normalizeEmail } from '../../common/email.util';

/**
 * DTO for admin editing any user's profile.
 * Password is a simple minimum-length temporary password — user is forced to change it on next login.
 */
export class AdminEditUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Temporary password must be at least 8 characters' })
  password?: string;
}
