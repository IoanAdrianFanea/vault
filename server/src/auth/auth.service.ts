import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { parseDurationMs } from './duration.util';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User } from '@prisma/client';
import { ProfileDto } from './dto/UpdateMe.dto';

export const ACCOUNT_NOT_ACTIVE_MESSAGE =
  'Your account is no longer active. Contact an administrator.';
export const EMAIL_CHANGE_NEEDS_SMTP_MESSAGE =
  "Your email can't be changed here right now. Ask an admin to change it for you.";

// JWT token payload structure
interface JwtPayload {
  sub: string; // User ID
  email: string;
}

interface RefreshJwtPayload extends JwtPayload {
  jti?: string;
}

// Return type for auth endpoints (access token + refresh token)
interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

// Return type for registration (no tokens — user starts as PENDING)
export interface RegisterResult {
  message: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  // Create new user account — returns pending message, no tokens issued
  async register(dto: RegisterDto): Promise<RegisterResult> {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmailInsensitive(
      dto.email,
    );
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await argon2.hash(dto.password);

    // Generate email verification token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    // Create user (accountStatus defaults to PENDING via schema)
    await this.usersService.create(
      dto.email,
      passwordHash,
      tokenHash,
      dto.fullName,
    );

    // Send verification email to the user (fire-and-forget — never fails the request)
    void this.emailService.sendVerificationEmail(dto.email, rawToken);

    // Notify all admins
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true },
    });
    void this.emailService.sendAdminApprovalNotification(
      dto.email,
      admins.map((a) => a.email),
    );

    return {
      message:
        'Registration submitted. Please check your email to verify your address. An admin will then review your request.',
    };
  }

  // Authenticate existing user
  async login(dto: LoginDto): Promise<AuthTokens> {
    // Find user
    const user = await this.usersService.findByEmailInsensitive(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check email verification — must verify before login is allowed
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Please verify your email address before signing in. Check your inbox for the verification link.',
      );
    }

    // Check account status — block access before issuing tokens
    if (user.accountStatus === 'PENDING') {
      throw new ForbiddenException(
        'Your account is pending admin approval. You will be notified once access is granted.',
      );
    }
    if (user.accountStatus === 'REJECTED') {
      throw new ForbiddenException(
        'Your access request has been rejected. Please contact an administrator.',
      );
    }

    // Generate tokens
    return this.generateTokens(user);
  }

  // Exchange refresh token for new access token (token rotation)
  async refresh(refreshToken: string | undefined): Promise<AuthTokens> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided');
    }

    // Verify and decode refresh token
    let payload: RefreshJwtPayload;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Find the non-revoked, non-expired refresh token by session ID
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        id: payload.jti,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token not found or expired');
    }

    // Timing-safe comparison of SHA-256 hash
    const incomingBuffer = Buffer.from(this.sha256Hex(refreshToken), 'hex');
    const storedBuffer = Buffer.from(storedToken.tokenHash, 'hex');
    if (
      incomingBuffer.length !== storedBuffer.length ||
      !crypto.timingSafeEqual(incomingBuffer, storedBuffer)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Get user
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.accountStatus !== 'ACTIVE') {
      throw new UnauthorizedException(ACCOUNT_NOT_ACTIVE_MESSAGE);
    }

    // Claim the row
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: storedToken.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new UnauthorizedException('Refresh token not found or expired');
    }

    // Generate new tokens (token rotation)
    return this.generateTokens(user);
  }

  // Revoke all refresh tokens for user (logout from all devices)
  async logout(userId: string): Promise<void> {
    // Revoke all active refresh tokens for the user
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  // Verify user exists (called by JWT strategy)
  async validateUser(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.accountStatus !== 'ACTIVE') {
      throw new UnauthorizedException(ACCOUNT_NOT_ACTIVE_MESSAGE);
    }
    return user;
  }

  // Generate access token (short-lived) and refresh token (long-lived)
  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    // Generate access token
    const accessToken = this.jwtService.sign(
      { sub: payload.sub, email: payload.email },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn:
          this.config.get<string>('JWT_ACCESS_TOKEN_EXPIRATION') || '15m',
      } as any,
    );

    const sessionId = crypto.randomUUID();
    const refreshExpiration =
      this.config.get<string>('JWT_REFRESH_TOKEN_EXPIRATION') || '7d';

    // jwtid sets the jti claim
    const refreshToken = this.jwtService.sign(
      { sub: payload.sub, email: payload.email },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiration as any,
        jwtid: sessionId,
      },
    );

    const tokenHash = this.sha256Hex(refreshToken);
    const expiresAt = new Date(Date.now() + parseDurationMs(refreshExpiration));

    // Store hashed refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      mustChangePassword: user.mustChangePassword,
    };
  }

  private sha256Hex(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  // Verify email address using the raw token from the email link
  async verifyEmail(rawToken: string): Promise<{ message: string }> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const user = await this.prisma.user.findFirst({
      where: { emailVerificationToken: tokenHash },
    });

    if (!user) {
      throw new NotFoundException('Invalid or expired verification link.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null, // clear — single-use
      },
    });

    return {
      message:
        'Email verified successfully. You can now sign in once your account is approved.',
    };
  }

  // Change own password (requires current password)
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ refreshToken: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isCurrentValid = await argon2.verify(
      user.passwordHash,
      dto.currentPassword,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const newHash = await argon2.hash(dto.newPassword);
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, mustChangePassword: false },
    });

    // Revoke all refresh tokens so the user re-authenticates cleanly
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const { refreshToken } = await this.generateTokens(updatedUser);
    return { refreshToken };
  }

  async updateMe(
    userId: string,
    dto: ProfileDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    const existingUser = await this.usersService.findById(userId);
    if (!existingUser) {
      throw new UnauthorizedException('User not found');
    }

    const data: {
      fullName?: string | null;
      email?: string;
      emailVerifiedAt?: Date | null;
      emailVerificationToken?: string | null;
      language?: string;
      timezone?: string;
    } = {};

    if (dto.fullName !== undefined) {
      const trimmed = dto.fullName.trim();
      data.fullName = trimmed.length > 0 ? trimmed : null;
    }

    // Changing your own email resets verification and sends a fresh link.
    let verificationToken: string | null = null;
    if (dto.email !== undefined) {
      const newEmail = dto.email;

      if (newEmail.toLowerCase() !== existingUser.email.toLowerCase()) {
        if (!this.emailService.isConfigured()) {
          throw new BadRequestException(EMAIL_CHANGE_NEEDS_SMTP_MESSAGE);
        }

        const emailOwner =
          await this.usersService.findByEmailInsensitive(newEmail);
        if (emailOwner && emailOwner.id !== userId) {
          throw new ConflictException('Email is already in use');
        }

        verificationToken = crypto.randomBytes(32).toString('hex');
        data.email = newEmail;
        data.emailVerifiedAt = null;
        data.emailVerificationToken = crypto
          .createHash('sha256')
          .update(verificationToken)
          .digest('hex');
      }
    }

    if (dto.language !== undefined) {
      data.language = dto.language.trim();
    }

    if (dto.timezone !== undefined) {
      data.timezone = dto.timezone.trim();
    }

    // If PATCH body is empty, return current profile safely.
    if (Object.keys(data).length === 0) {
      const { passwordHash, ...safeUser } = existingUser;
      return safeUser;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    if (verificationToken) {
      // Fire-and-forget — a mail failure must not fail the profile update
      void this.emailService.sendVerificationEmail(
        updatedUser.email,
        verificationToken,
      );
    }

    const { passwordHash, ...safeUser } = updatedUser;
    return safeUser;
  }
}
