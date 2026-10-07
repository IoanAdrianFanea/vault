/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import {
  AuthService,
  ACCOUNT_NOT_ACTIVE_MESSAGE,
} from './auth.service';

interface StoredRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let mockPrisma: any;
  let mockUsersService: any;
  let mockEmailService: any;
  let mockConfig: any;
  let tokens: StoredRefreshToken[];

  const accessSecret = 'access-secret-at-least-32-chars-long-123456789';
  const refreshSecret = 'refresh-secret-at-least-32-chars-long-987654321';

  beforeEach(() => {
    tokens = [];
    jwtService = new JwtService({});

    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') return accessSecret;
        if (key === 'JWT_REFRESH_SECRET') return refreshSecret;
        if (key === 'JWT_ACCESS_TOKEN_EXPIRATION') return '15m';
        if (key === 'JWT_REFRESH_TOKEN_EXPIRATION') return '7d';
        return undefined;
      }),
    };

    mockPrisma = {
      refreshToken: {
        create: jest.fn(async ({ data }) => {
          const row: StoredRefreshToken = {
            id: data.id,
            userId: data.userId,
            tokenHash: data.tokenHash,
            expiresAt: data.expiresAt,
            revokedAt: null,
            createdAt: new Date(),
          };
          tokens.push(row);
          return row;
        }),
        findFirst: jest.fn(async ({ where }) => {
          return (
            tokens.find((t) => {
              if (where.id && t.id !== where.id) return false;
              if (where.userId && t.userId !== where.userId) return false;
              if (where.revokedAt === null && t.revokedAt !== null) return false;
              if (where.expiresAt?.gt && t.expiresAt <= where.expiresAt.gt)
                return false;
              return true;
            }) ?? null
          );
        }),
        updateMany: jest.fn(async ({ where, data }) => {
          let count = 0;
          for (const t of tokens) {
            if (where.id && t.id !== where.id) continue;
            if (where.userId && t.userId !== where.userId) continue;
            if (where.revokedAt === null && t.revokedAt !== null) continue;
            t.revokedAt = data.revokedAt;
            count++;
          }
          return { count };
        }),
      },
      user: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    mockUsersService = {
      findByEmailInsensitive: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };

    mockEmailService = {
      sendVerificationEmail: jest.fn(),
      sendAdminApprovalNotification: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true),
    };

    service = new AuthService(
      mockPrisma,
      mockUsersService,
      jwtService,
      mockConfig,
      mockEmailService,
    );
  });

  describe('validateUser', () => {
    it('rejects a REJECTED user with 401 ACCOUNT_NOT_ACTIVE_MESSAGE', async () => {
      mockUsersService.findById.mockResolvedValue({
        id: 'u-1',
        email: 'user@test.local',
        accountStatus: 'REJECTED',
      });

      await expect(service.validateUser('u-1')).rejects.toThrow(
        new UnauthorizedException(ACCOUNT_NOT_ACTIVE_MESSAGE),
      );
    });
  });

  describe('refresh', () => {
    it('rejects a valid token whose user is now PENDING with 401', async () => {
      const passwordHash = await argon2.hash('Password123!');
      const user = {
        id: 'u-1',
        email: 'u1@test.local',
        passwordHash,
        emailVerifiedAt: new Date(),
        accountStatus: 'ACTIVE',
        mustChangePassword: false,
      };
      mockUsersService.findByEmailInsensitive.mockResolvedValue(user);

      const loginRes = await service.login({
        email: 'u1@test.local',
        password: 'Password123!',
      });

      mockUsersService.findById.mockResolvedValue({
        ...user,
        accountStatus: 'PENDING',
      });

      await expect(service.refresh(loginRes.refreshToken)).rejects.toThrow(
        new UnauthorizedException(ACCOUNT_NOT_ACTIVE_MESSAGE),
      );
    });

    it('handles two concurrent sessions: T1 and T2 both refresh successfully, second refresh(T1) fails', async () => {
      const passwordHash = await argon2.hash('Password123!');
      const user = {
        id: 'u-1',
        email: 'u1@test.local',
        passwordHash,
        emailVerifiedAt: new Date(),
        accountStatus: 'ACTIVE',
        mustChangePassword: false,
      };
      mockUsersService.findByEmailInsensitive.mockResolvedValue(user);
      mockUsersService.findById.mockResolvedValue(user);

      const session1 = await service.login({
        email: 'u1@test.local',
        password: 'Password123!',
      });
      const session2 = await service.login({
        email: 'u1@test.local',
        password: 'Password123!',
      });

      const refresh1 = await service.refresh(session1.refreshToken);
      expect(refresh1.accessToken).toBeDefined();

      const refresh2 = await service.refresh(session2.refreshToken);
      expect(refresh2.accessToken).toBeDefined();

      // Second refresh of the already-rotated session1 token fails
      await expect(service.refresh(session1.refreshToken)).rejects.toThrow(
        new UnauthorizedException('Refresh token not found or expired'),
      );
    });

    it('fails with 401 Invalid refresh token when token has no jti', async () => {
      const tokenWithoutJti = jwtService.sign(
        { sub: 'u-1', email: 'u1@test.local' },
        { secret: refreshSecret, expiresIn: '7d' },
      );

      await expect(service.refresh(tokenWithoutJti)).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });
  });

  describe('changePassword', () => {
    it('throws BadRequestException with wrong current password', async () => {
      const passwordHash = await argon2.hash('OldPassword123!');
      mockUsersService.findById.mockResolvedValue({
        id: 'u-1',
        email: 'u1@test.local',
        passwordHash,
        accountStatus: 'ACTIVE',
      });

      await expect(
        service.changePassword('u-1', {
          currentPassword: 'WrongPassword!',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(
        new BadRequestException('Current password is incorrect'),
      );
    });

    it('returns a new refreshToken and revokes earlier rows on success', async () => {
      const passwordHash = await argon2.hash('OldPassword123!');
      const user = {
        id: 'u-1',
        email: 'u1@test.local',
        passwordHash,
        emailVerifiedAt: new Date(),
        accountStatus: 'ACTIVE',
        mustChangePassword: false,
      };
      mockUsersService.findByEmailInsensitive.mockResolvedValue(user);
      mockUsersService.findById.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);

      // Log in to create initial refresh token
      await service.login({
        email: 'u1@test.local',
        password: 'OldPassword123!',
      });
      expect(tokens.filter((t) => t.revokedAt === null).length).toBe(1);

      const result = await service.changePassword('u-1', {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      });

      expect(result.refreshToken).toBeDefined();
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
