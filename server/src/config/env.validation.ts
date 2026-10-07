import 'reflect-metadata';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as path from 'path';

function hasAnySmtpValue(env: EnvironmentVariables): boolean {
  return Boolean(
    env.SMTP_HOST || env.SMTP_USER || env.SMTP_PASS || env.SMTP_FROM,
  );
}

export class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  STORAGE_ROOT: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET: string;

  @IsOptional()
  @Matches(/^\d+[smhd]$/)
  JWT_ACCESS_TOKEN_EXPIRATION: string = '15m';

  @IsOptional()
  @Matches(/^\d+[smhd]$/)
  JWT_REFRESH_TOKEN_EXPIRATION: string = '7d';

  @ValidateIf(
    (e: EnvironmentVariables) =>
      e.NODE_ENV === 'production' || e.FRONTEND_URL !== undefined,
  )
  @IsUrl({
    require_tld: false,
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  FRONTEND_URL?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @ValidateIf(hasAnySmtpValue)
  @IsString()
  @IsNotEmpty()
  SMTP_HOST?: string;

  @ValidateIf(hasAnySmtpValue)
  @IsString()
  @IsNotEmpty()
  SMTP_USER?: string;

  @ValidateIf(hasAnySmtpValue)
  @IsString()
  @IsNotEmpty()
  SMTP_PASS?: string;

  @ValidateIf(hasAnySmtpValue)
  @IsString()
  @IsNotEmpty()
  SMTP_FROM?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT: number = 587;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1024)
  MAX_UPLOAD_MB: number = 50;

  @IsOptional()
  @IsString()
  BACKUP_DIR?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  BACKUP_KEEP: number = 14;

  @IsOptional()
  @IsInt()
  @Min(0)
  COMPRESSION_THRESHOLD_BYTES?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  COMPRESSION_MIN_SAVINGS_RATIO?: number;
}

export function validateEnv(
  raw: Record<string, unknown>,
): EnvironmentVariables {
  // 1. Copy raw, dropping every key whose value is a string that's empty after trimming
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.trim() === '') {
      continue;
    }
    cleaned[key] = value;
  }

  // 2. Transform to EnvironmentVariables instance
  const env = plainToInstance(EnvironmentVariables, cleaned, {
    enableImplicitConversion: true,
  });

  // 3. Validate
  const problems = validateSync(env).flatMap((e) =>
    Object.values(e.constraints ?? {}),
  );

  // 4. Equal secrets check
  if (
    env.JWT_ACCESS_SECRET &&
    env.JWT_REFRESH_SECRET &&
    env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET
  ) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  }

  // 5. Throw on problems
  if (problems.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
  }

  // 6. Normalise
  env.FRONTEND_URL = env.FRONTEND_URL?.replace(/\/+$/, '');
  env.BACKUP_DIR = path.resolve(
    env.BACKUP_DIR ?? path.join(env.STORAGE_ROOT, 'backups'),
  );

  // 7. Return env
  return env;
}
