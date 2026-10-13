import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

export const CSRF_HEADER = 'x-csrf-protection';

/**
 * Protects the endpoints that authenticate with the refresh-token cookie (refresh, logout).
 *
 * A custom request header cannot be set by a cross-site form post, and a cross-origin fetch
 * that sets it triggers a CORS preflight that our CORS policy rejects. Combined with
 * SameSite=Strict cookies this blocks CSRF against cookie-authenticated routes. All other
 * routes use bearer tokens, which browsers never attach automatically.
 */
@Injectable()
export class CsrfHeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers[CSRF_HEADER] !== '1') {
      throw new ForbiddenException('Missing CSRF protection header');
    }
    return true;
  }
}
