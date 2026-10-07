import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { normalizeEmail } from '../../common/email.util';
import { IsStrongPassword } from './password-policy.decorator';

// DTO for registration request validation
export class RegisterDto {
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  email: string;

  @IsStrongPassword()
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;
}
