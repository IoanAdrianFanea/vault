import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Query,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotImplementedException,
  BadRequestException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { parseDurationMs } from './duration.util';
import { FIFTEEN_MINUTES_MS } from '../common/throttle';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ProfileDto } from './dto/UpdateMe.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { User } from '@prisma/client';

// Extend Request type to include authenticated user (added by JWT guard)
interface RequestWithUser extends Request {
  user: User;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // POST /auth/register - Create new user account (returns pending message, no tokens)
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES_MS } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // GET /auth/verify-email?token=xxx - Verify email address from link in email
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES_MS } })
  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Query('token') token: string) {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }
    return this.authService.verifyEmail(token);
  }

  // POST /auth/login - Authenticate existing user
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES_MS } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, mustChangePassword } =
      await this.authService.login(dto);

    // Set refresh token in HttpOnly cookie
    this.setRefreshTokenCookie(res, refreshToken);

    // Return access token in response body (+ flag for forced password change)
    return { accessToken, mustChangePassword };
  }

  // POST /auth/refresh - Get new access token using refresh token from cookie
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['refreshToken'];

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refresh(refreshToken);

    // Set new refresh token in HttpOnly cookie (token rotation)
    this.setRefreshTokenCookie(res, newRefreshToken);

    // Return new access token in response body
    return { accessToken };
  }

  // POST /auth/logout - Revoke refresh tokens and clear cookie (requires authentication)
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.user.id);

    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return;
  }

  // GET /auth/me - Get current authenticated user profile
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: RequestWithUser) {
    // Return user without sensitive data
    const { passwordHash, ...userWithoutPassword } = req.user;
    return userWithoutPassword;
  }

  // PATCH /auth/me - Update current authenticated user profile
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Req() req: RequestWithUser, @Body() dto: ProfileDto) {
    return this.authService.updateMe(req.user.id, dto);
  }

  // PATCH /auth/me/password - Change own password (requires current password)
  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Req() req: RequestWithUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken } = await this.authService.changePassword(
      req.user.id,
      dto,
    );
    this.setRefreshTokenCookie(res, refreshToken);
  }

  // Set refresh token in HttpOnly cookie (secure, not accessible via JavaScript)
  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: parseDurationMs(
        this.config.get<string>('JWT_REFRESH_TOKEN_EXPIRATION') ?? '7d',
      ),
      path: '/',
    });
  }
}
