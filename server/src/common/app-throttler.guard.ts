/*
Global rate-limit guard that counts login attempts per IP address and email,
and every other request per IP address. Registered as APP_GUARD in AppModule.
*/


import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { loginThrottleTracker } from './throttle';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const isPost = req.method === 'POST';
    const pathWithoutQuery = req.path ?? req.originalUrl?.split('?')[0] ?? '';
    if (isPost && pathWithoutQuery.endsWith('/auth/login')) {
      return loginThrottleTracker(req);
    }
    return req.ip ?? 'unknown';
  }
}
