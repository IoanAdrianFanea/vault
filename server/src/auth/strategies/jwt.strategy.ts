/*
Passport strategy that verifies the Bearer access token and loads its user
onto req.user. Rejects tokens for users that no longer exist or are no longer
active.
*/


import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { User } from '@prisma/client';

// JWT payload structure
interface JwtPayload {
  sub: string; // User ID
  email: string;
}

// Passport strategy to validate JWT tokens from Authorization header
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {
    // Configure strategy to extract JWT from Bearer token in Authorization header
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  // Called automatically by Passport after JWT is verified
  // Must return user object or throw UnauthorizedException
  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
