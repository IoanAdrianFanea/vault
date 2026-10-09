import * as path from 'path';
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const validBase = {
    DATABASE_URL: 'file:./dev.db',
    STORAGE_ROOT: 'C:\\test\\storage',
    JWT_ACCESS_SECRET: 'access-secret-at-least-32-chars-long-123456789',
    JWT_REFRESH_SECRET: 'refresh-secret-at-least-32-chars-long-987654321',
  };

  it('rejects missing secrets and lists both problems in one error', () => {
    const raw = {
      DATABASE_URL: 'file:./dev.db',
      STORAGE_ROOT: 'C:\\test\\storage',
    };

    expect(() => validateEnv(raw)).toThrow(
      /Invalid environment configuration:[\s\S]*JWT_ACCESS_SECRET[\s\S]*JWT_REFRESH_SECRET/,
    );
  });

  it('rejects equal secrets', () => {
    const raw = {
      ...validBase,
      JWT_ACCESS_SECRET: 'same-secret-at-least-32-chars-long-1234567890',
      JWT_REFRESH_SECRET: 'same-secret-at-least-32-chars-long-1234567890',
    };

    expect(() => validateEnv(raw)).toThrow(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different',
    );
  });

  it('rejects production without FRONTEND_URL', () => {
    const raw = {
      ...validBase,
      NODE_ENV: 'production',
    };

    expect(() => validateEnv(raw)).toThrow(
      /FRONTEND_URL must be a.*URL address/,
    );
  });

  it('rejects SMTP_HOST set without SMTP_PASS', () => {
    const raw = {
      ...validBase,
      SMTP_HOST: 'smtp.example.com',
    };

    expect(() => validateEnv(raw)).toThrow(/SMTP_PASS/);
  });

  it('ignores blank strings as unset', () => {
    const raw = {
      ...validBase,
      SMTP_HOST: '   ',
      SMTP_USER: '',
      FRONTEND_URL: '   ',
    };

    const env = validateEnv(raw);
    expect(env.SMTP_HOST).toBeUndefined();
    expect(env.SMTP_USER).toBeUndefined();
    expect(env.FRONTEND_URL).toBeUndefined();
  });

  it('applies defaults for MAX_UPLOAD_MB, BACKUP_KEEP, and BACKUP_DIR under STORAGE_ROOT', () => {
    const raw = {
      ...validBase,
    };

    const env = validateEnv(raw);
    expect(env.MAX_UPLOAD_MB).toBe(50);
    expect(env.BACKUP_KEEP).toBe(14);
    expect(env.BACKUP_DIR).toBe(path.resolve('C:\\test\\storage', 'backups'));
  });

  it('removes trailing slashes from FRONTEND_URL', () => {
    const raw = {
      ...validBase,
      FRONTEND_URL: 'https://vault.example.com///',
    };

    const env = validateEnv(raw);
    expect(env.FRONTEND_URL).toBe('https://vault.example.com');
  });
});
