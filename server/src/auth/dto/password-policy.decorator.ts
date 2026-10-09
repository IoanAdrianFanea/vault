/*
The single definition of the strong-password policy, applied as one decorator
to every self-chosen password field. Each rule has its own user-facing error
message.
*/


import { applyDecorators } from '@nestjs/common';
import { IsString, MinLength, Matches } from 'class-validator';

/**
 * Reusable strong-password decorator.
 *
 * Rules:
 *  - At least 10 characters
 *  - At least one uppercase letter (A-Z)
 *  - At least one lowercase letter (a-z)
 *  - At least one number (0-9)
 *  - At least one special character
 */
export function IsStrongPassword() {
  return applyDecorators(
    IsString(),
    MinLength(10, { message: 'Password must be at least 10 characters long' }),
    Matches(/[A-Z]/, {
      message: 'Password must contain at least one uppercase letter',
    }),
    Matches(/[a-z]/, {
      message: 'Password must contain at least one lowercase letter',
    }),
    Matches(/[0-9]/, {
      message: 'Password must contain at least one number',
    }),
    Matches(/[!@#$%^&*()\-_=+\[\]{};':",.<>?/\\|`~]/, {
      message: 'Password must contain at least one special character',
    }),
  );
}
