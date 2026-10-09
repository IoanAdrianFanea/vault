/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { ConflictException } from '@nestjs/common';
import {
  UsersService,
  SELF_DELETE_MESSAGE,
  SELF_ROLE_MESSAGE,
  SELF_STATUS_MESSAGE,
  LAST_ADMIN_MESSAGE,
} from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      document: {
        count: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
    };
    service = new UsersService(mockPrisma);
  });

  describe('deleteUser', () => {
    it('throws 409 SELF_DELETE_MESSAGE when actorId === id and makes no Prisma calls', async () => {
      await expect(service.deleteUser('user-1', 'user-1')).rejects.toThrow(
        new ConflictException(SELF_DELETE_MESSAGE),
      );
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws 409 LAST_ADMIN_MESSAGE when deleting the only ACTIVE ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@vault.local',
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
      });
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(service.deleteUser('actor-1', 'admin-1')).rejects.toThrow(
        new ConflictException(LAST_ADMIN_MESSAGE),
      );
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    it('calls user.delete and never calls document delete when active admin count is 2', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@vault.local',
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
      });
      mockPrisma.user.count.mockResolvedValue(2);
      mockPrisma.document.count.mockResolvedValue(3);
      mockPrisma.user.delete.mockResolvedValue({ id: 'admin-1' });

      await service.deleteUser('actor-1', 'admin-1');

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'admin-1' },
      });
      expect(mockPrisma.document.delete).not.toHaveBeenCalled();
      expect(mockPrisma.document.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('setUserRole', () => {
    it('throws 409 on self role change', async () => {
      await expect(
        service.setUserRole('user-1', 'user-1', { role: 'ADMIN' }),
      ).rejects.toThrow(new ConflictException(SELF_ROLE_MESSAGE));
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws 409 when demoting the last active admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'target-1',
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
      });
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(
        service.setUserRole('actor-1', 'target-1', { role: 'USER' }),
      ).rejects.toThrow(new ConflictException(LAST_ADMIN_MESSAGE));
    });

    it('does not count admins when promoting a USER', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'target-1',
        role: 'USER',
        accountStatus: 'ACTIVE',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'target-1',
        role: 'ADMIN',
      });

      await service.setUserRole('actor-1', 'target-1', { role: 'ADMIN' });

      expect(mockPrisma.user.count).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });
  });

  describe('updateAccountStatus', () => {
    it('throws 409 on self account status change', async () => {
      await expect(
        service.updateAccountStatus('user-1', 'user-1', 'REJECTED'),
      ).rejects.toThrow(new ConflictException(SELF_STATUS_MESSAGE));
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws 409 when setting the last active admin to REJECTED', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'target-1',
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
      });
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(
        service.updateAccountStatus('actor-1', 'target-1', 'REJECTED'),
      ).rejects.toThrow(new ConflictException(LAST_ADMIN_MESSAGE));
    });

    it('revokes refresh tokens when changing from ACTIVE to REJECTED', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'target-1',
        role: 'USER',
        accountStatus: 'ACTIVE',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'target-1',
        accountStatus: 'REJECTED',
      });

      await service.updateAccountStatus('actor-1', 'target-1', 'REJECTED');

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'target-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('does not revoke refresh tokens when changing from PENDING to ACTIVE', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'target-1',
        role: 'USER',
        accountStatus: 'PENDING',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'target-1',
        accountStatus: 'ACTIVE',
      });

      await service.updateAccountStatus('actor-1', 'target-1', 'ACTIVE');

      expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('createUser', () => {
    it('sets emailVerifiedAt on creation', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve(data),
      );

      await service.createUser({
        email: 'test@example.com',
        password: 'Password123!',
        fullName: 'Test User',
        role: 'USER',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            emailVerifiedAt: expect.any(Date),
            accountStatus: 'ACTIVE',
          }),
        }),
      );
    });

    it('throws 409 on a case-insensitive duplicate', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', email: 'Test@example.com' },
      ]);

      await expect(
        service.createUser({
          email: 'TEST@EXAMPLE.COM',
          password: 'Password123!',
          fullName: 'Test User',
          role: 'USER',
        }),
      ).rejects.toThrow(
        new ConflictException('User with this email already exists'),
      );
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });
});
