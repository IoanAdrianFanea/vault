/*
Route guard that requires a valid access token via the Passport JWT strategy.
Applied to every protected controller.
*/


import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Guard to protect routes with JWT authentication
// Use with @UseGuards(JwtAuthGuard) decorator on controllers/routes
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
