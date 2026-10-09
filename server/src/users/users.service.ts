/*
User database operations for authentication and admin user management. Stops
admins changing or deleting their own account or removing the last active
admin, and revokes sessions when an account is deactivated.
*/


import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User, UserRole, AccountStatus } from '@prisma/client';
import { CreateUserDto } from './dto/CreateUser.dto';
import { SetUserDto } from './dto/SetUser.dto';
import { AdminEditUserDto } from './dto/AdminEditUser.dto';
import * as argon2 from 'argon2';

export const SELF_DELETE_MESSAGE = "You can't delete your own account.";
export const SELF_ROLE_MESSAGE = "You can't change your own role.";
export const SELF_STATUS_MESSAGE = "You can't change your own account status.";
export const LAST_ADMIN_MESSAGE = 'At least one active admin is required.';

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  accountStatus: true,
  createdAt: true,
};

const userSelectWithStatus = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  accountStatus: true,
  createdAt: true,
};

// Service for user database operations
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Find user by email address (case-insensitive)
  async findByEmailInsensitive(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    const direct = await this.prisma.user.findUnique({
      where: { email: normalized },
    });
    if (direct) return direct;

    // SQLite LIKE (used by contains) is case-insensitive for ASCII
    const candidates = await this.prisma.user.findMany({
      where: { email: { contains: normalized } },
      take: 20,
    });
    return candidates.find((u) => u.email.toLowerCase() === normalized) ?? null;
  }

  // For auth internal use - returns full user including passwordHash
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  // For controller responses - returns safe user without sensitive fields
  async findByIdSafe(id: string): Promise<Partial<User> | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
  }

  // Create new user with hashed password - REGISTERING
  async create(
    email: string,
    passwordHash: string,
    emailVerificationToken: string,
    fullName?: string,
  ): Promise<User> {
    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: fullName?.trim() || '',
        role: 'USER',
        emailVerificationToken,
      },
    });
  }

  // Create new user with hashed password - ADMIN ONLY
  async createUser(createUserDto: CreateUserDto): Promise<Partial<User>> {
    if (await this.findByEmailInsensitive(createUserDto.email)) {
      throw new ConflictException('User with this email already exists');
    }
    const passwordHash = await argon2.hash(createUserDto.password);
    return this.prisma.user.create({
      data: {
        email: createUserDto.email,
        passwordHash,
        fullName: createUserDto.fullName,
        role: createUserDto.role,
        // Admin-created accounts are immediately active; no approval needed.
        accountStatus: 'ACTIVE',
        // Force the user to change this temporary password on first login.
        mustChangePassword: true,
        emailVerifiedAt: new Date(),
      },
      select: userSelect,
    });
  }

  // Edit a user's profile (admin) — name, email, or set a new temporary password
  async adminEditUser(
    id: string,
    dto: AdminEditUserDto,
  ): Promise<Partial<User>> {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!current) throw new NotFoundException('User not found');

    const data: Record<string, unknown> = {};

    if (dto.fullName !== undefined) {
      data.fullName = dto.fullName.trim() || null;
    }

    if (
      dto.email !== undefined &&
      dto.email.toLowerCase() !== current.email.toLowerCase()
    ) {
      const existing = await this.findByEmailInsensitive(dto.email);
      if (existing && existing.id !== id) {
        throw new ConflictException('Email is already in use');
      }
      data.email = dto.email;
      data.emailVerifiedAt = new Date();
      data.emailVerificationToken = null;
    }

    if (dto.password !== undefined) {
      data.passwordHash = await argon2.hash(dto.password);
      // Force user to change this temporary password on next login
      data.mustChangePassword = true;
    }

    if (Object.keys(data).length === 0) {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: userSelect,
      });
      return user!;
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });
  }

  // Find all users
  async findAll(): Promise<Partial<User>[]> {
    return this.prisma.user.findMany({
      select: userSelect,
    });
  }

  // Search users by name or email (case-insensitive) - ADMIN ONLY
  async searchUsers(query: string): Promise<Partial<User>[]> {
    return this.prisma.user.findMany({
      where: query
        ? {
            OR: [
              { fullName: { contains: query } },
              { email: { contains: query } },
            ],
          }
        : undefined,
      select: userSelect,
      orderBy: { fullName: 'asc' },
      take: 50,
    });
  }

  // Update user role
  async setUserRole(
    actorId: string,
    id: string,
    setUserDto: SetUserDto,
  ): Promise<Partial<User>> {
    if (actorId === id) throw new ConflictException(SELF_ROLE_MESSAGE);
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id },
        select: { role: true, accountStatus: true },
      });
      if (!target) throw new NotFoundException('User not found');
      if (target.role === 'ADMIN' && setUserDto.role !== 'ADMIN') {
        await this.assertNotLastActiveAdmin(tx, target);
      }
      return tx.user.update({
        where: { id },
        data: { role: setUserDto.role },
        select: userSelect,
      });
    });
  }

  // Delete user by id - ADMIN ONLY
  async deleteUser(actorId: string, id: string): Promise<void> {
    if (actorId === id) throw new ConflictException(SELF_DELETE_MESSAGE);
    const result = await this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id },
        select: { id: true, email: true, role: true, accountStatus: true },
      });
      if (!target) throw new NotFoundException('User not found');
      await this.assertNotLastActiveAdmin(tx, target);
      const keptDocuments = await tx.document.count({
        where: { uploadedById: id },
      });
      await tx.user.delete({ where: { id } });
      return { email: target.email, keptDocuments };
    });
    this.logger.log(
      `User ${result.email} deleted by admin ${actorId}; ${result.keptDocuments} uploaded document(s) kept`,
    );
  }

  // Find users by account status - ADMIN ONLY
  async findByAccountStatus(status: AccountStatus): Promise<Partial<User>[]> {
    return this.prisma.user.findMany({
      where: { accountStatus: status },
      select: userSelectWithStatus,
      orderBy: { createdAt: 'asc' },
    });
  }

  // Update a user's account status - ADMIN ONLY
  async updateAccountStatus(
    actorId: string,
    id: string,
    status: AccountStatus,
  ): Promise<Partial<User>> {
    if (actorId === id) throw new ConflictException(SELF_STATUS_MESSAGE);
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id },
        select: { role: true, accountStatus: true },
      });
      if (!target) throw new NotFoundException('User not found');
      if (status !== 'ACTIVE') {
        await this.assertNotLastActiveAdmin(tx, target);
      }
      const updated = await tx.user.update({
        where: { id },
        data: { accountStatus: status },
        select: userSelectWithStatus,
      });
      if (target.accountStatus === 'ACTIVE' && status !== 'ACTIVE') {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return updated;
    });
  }

  private async assertNotLastActiveAdmin(
    tx: Prisma.TransactionClient,
    target: { role: UserRole; accountStatus: AccountStatus },
  ): Promise<void> {
    if (!(target.role === 'ADMIN' && target.accountStatus === 'ACTIVE')) {
      return;
    }
    const count = await tx.user.count({
      where: { role: 'ADMIN', accountStatus: 'ACTIVE' },
    });
    if (count <= 1) {
      throw new ConflictException(LAST_ADMIN_MESSAGE);
    }
  }
}
