import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantGuard } from '../../../src/common/guards/tenant.guard';

/**
 * TenantGuard Unit Tests
 *
 * Tests the TenantGuard which ensures authenticated users have a tenant context.
 * Used on all /dashboard/* routes alongside JwtAuthGuard.
 */
describe('TenantGuard', () => {
  let guard: TenantGuard;

  beforeEach(() => {
    guard = new TenantGuard();
  });

  /**
   * Helper to create a mock ExecutionContext.
   */
  function createMockContext(
    user: Record<string, unknown> | null | undefined,
  ): ExecutionContext {
    const request: Record<string, unknown> = {};
    if (user !== undefined) {
      request.user = user;
    }

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  // =========================================================================
  // Allows request with valid tenantId
  // =========================================================================
  describe('valid tenant context', () => {
    it('should allow request with valid tenantId', () => {
      const context = createMockContext({
        sub: 'user-uuid-1',
        email: 'admin@acme.com',
        role: 'tenant_admin',
        tenantId: 'tenant-uuid-1',
        permissions: ['agent:read'],
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should attach tenantId to request object', () => {
      const request: Record<string, unknown> = {
        user: {
          sub: 'user-uuid-1',
          email: 'admin@acme.com',
          role: 'tenant_admin',
          tenantId: 'tenant-uuid-1',
          permissions: [],
        },
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as unknown as ExecutionContext;

      guard.canActivate(context);

      expect(request.tenantId).toBe('tenant-uuid-1');
    });

    it('should return true for tenant_user role with tenantId', () => {
      const context = createMockContext({
        sub: 'user-uuid-2',
        email: 'user@acme.com',
        role: 'tenant_user',
        tenantId: 'tenant-uuid-1',
        permissions: ['agent:read'],
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // Rejects request without tenantId
  // =========================================================================
  describe('missing tenant context', () => {
    it('should throw ForbiddenException when tenantId is missing', () => {
      const context = createMockContext({
        sub: 'admin-uuid',
        email: 'admin@aegis.ai',
        role: 'platform_admin',
        permissions: ['*'],
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException with correct message', () => {
      const context = createMockContext({
        sub: 'admin-uuid',
        email: 'admin@aegis.ai',
        role: 'platform_admin',
        permissions: ['*'],
      });

      expect(() => guard.canActivate(context)).toThrow(
        'Access denied. This endpoint requires a tenant context.',
      );
    });

    it('should throw ForbiddenException when tenantId is null', () => {
      const context = createMockContext({
        sub: 'admin-uuid',
        email: 'admin@aegis.ai',
        role: 'platform_admin',
        tenantId: null,
        permissions: ['*'],
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when tenantId is undefined', () => {
      const context = createMockContext({
        sub: 'admin-uuid',
        email: 'admin@aegis.ai',
        role: 'platform_admin',
        tenantId: undefined,
        permissions: ['*'],
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when tenantId is empty string', () => {
      const context = createMockContext({
        sub: 'admin-uuid',
        email: 'admin@aegis.ai',
        role: 'platform_admin',
        tenantId: '',
        permissions: ['*'],
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user is null', () => {
      const context = createMockContext(null);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user is undefined', () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({}),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
