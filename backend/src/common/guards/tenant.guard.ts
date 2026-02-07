import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Tenant Guard - Ensures the authenticated user belongs to a tenant.
 *
 * Extracts tenantId from the JWT payload (req.user.tenantId).
 * Returns 403 Forbidden if tenantId is missing (platform admins do not have one).
 *
 * Use alongside JwtAuthGuard on all /dashboard/* routes:
 *   @UseGuards(JwtAuthGuard, TenantGuard)
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.tenantId) {
      throw new ForbiddenException(
        'Access denied. This endpoint requires a tenant context.',
      );
    }

    // Attach tenantId directly on the request for downstream convenience
    request.tenantId = user.tenantId;

    return true;
  }
}
