import { AuditInterceptor } from '../../src/audit/audit.interceptor';
import { AuditService } from '../../src/audit/audit.service';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError, lastValueFrom } from 'rxjs';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let mockAuditService: { logAction: jest.Mock };

  // Helper to build a mock ExecutionContext
  function createMockContext(overrides: {
    method?: string;
    url?: string;
    ip?: string;
    body?: any;
    user?: any;
    userAgent?: string;
  }): ExecutionContext {
    const request: any = {
      method: overrides.method || 'POST',
      url: overrides.url || '/api/admin/tenants',
      ip: overrides.ip || '127.0.0.1',
      body: overrides.body || {},
      user: overrides.user !== undefined ? overrides.user : undefined,
      get: (header: string) => {
        if (header === 'user-agent') return overrides.userAgent || 'test-agent';
        return undefined;
      },
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  // Helper to build a successful CallHandler
  function createSuccessHandler(response: any = { ok: true }): CallHandler {
    return { handle: () => of(response) };
  }

  // Helper to build a failing CallHandler
  function createErrorHandler(error: any): CallHandler {
    return { handle: () => throwError(() => error) };
  }

  beforeEach(() => {
    mockAuditService = { logAction: jest.fn() };
    interceptor = new AuditInterceptor(mockAuditService as unknown as AuditService);
  });

  // -------------------------------------------------------
  // 1. Basic instantiation
  // -------------------------------------------------------
  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  // -------------------------------------------------------
  // 2-4. Skip read-only methods
  // -------------------------------------------------------
  it('should skip GET requests (no audit logged)', async () => {
    const ctx = createMockContext({ method: 'GET', url: '/api/admin/tenants' });
    const handler = createSuccessHandler();

    const result$ = interceptor.intercept(ctx, handler);
    await lastValueFrom(result$);

    expect(mockAuditService.logAction).not.toHaveBeenCalled();
  });

  it('should skip HEAD requests (no audit logged)', async () => {
    const ctx = createMockContext({ method: 'HEAD', url: '/api/admin/tenants' });
    const handler = createSuccessHandler();

    const result$ = interceptor.intercept(ctx, handler);
    await lastValueFrom(result$);

    expect(mockAuditService.logAction).not.toHaveBeenCalled();
  });

  it('should skip OPTIONS requests (no audit logged)', async () => {
    const ctx = createMockContext({ method: 'OPTIONS', url: '/api/admin/tenants' });
    const handler = createSuccessHandler();

    const result$ = interceptor.intercept(ctx, handler);
    await lastValueFrom(result$);

    expect(mockAuditService.logAction).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------
  // 5-7. Audit mutating methods on success
  // -------------------------------------------------------
  it('should audit POST requests on success', async () => {
    const ctx = createMockContext({ method: 'POST', url: '/api/admin/tenants' });
    const handler = createSuccessHandler();

    const result$ = interceptor.intercept(ctx, handler);
    await lastValueFrom(result$);

    expect(mockAuditService.logAction).toHaveBeenCalledTimes(1);
    expect(mockAuditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'tenant_created', severity: 'info' }),
    );
  });

  it('should audit PATCH requests on success', async () => {
    const ctx = createMockContext({
      method: 'PATCH',
      url: '/api/dashboard/agents/abc-123',
    });
    const handler = createSuccessHandler();

    const result$ = interceptor.intercept(ctx, handler);
    await lastValueFrom(result$);

    expect(mockAuditService.logAction).toHaveBeenCalledTimes(1);
    expect(mockAuditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'agent_updated', severity: 'info' }),
    );
  });

  it('should audit DELETE requests on success', async () => {
    const ctx = createMockContext({
      method: 'DELETE',
      url: '/api/admin/tenants/abc-def-123',
    });
    const handler = createSuccessHandler();

    const result$ = interceptor.intercept(ctx, handler);
    await lastValueFrom(result$);

    expect(mockAuditService.logAction).toHaveBeenCalledTimes(1);
    expect(mockAuditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'tenant_deleted', severity: 'info' }),
    );
  });

  // -------------------------------------------------------
  // 8-10. Target extraction
  // -------------------------------------------------------
  it('should extract tenant target type and ID from /api/admin/tenants/:id', async () => {
    const tenantId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const ctx = createMockContext({
      method: 'PATCH',
      url: '/api/admin/tenants/' + tenantId,
    });
    const handler = createSuccessHandler();

    const result$ = interceptor.intercept(ctx, handler);
    await lastValueFrom(result$);

    expect(mockAuditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: 'tenant', targetId: tenantId }),
    );
  });

  it('should extract agent target type from /api/dashboard/agents/:id', async () => {
    const agentId = 'agt-00001';
    const ctx = createMockContext({
      method: 'PATCH',
      url: '/api/dashboard/agents/' + agentId,
    });
    const handler = createSuccessHandler();

    const result$ = interceptor.intercept(ctx, handler);
    await lastValueFrom(result$);

    expect(mockAuditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: 'agent', targetId: agentId }),
    );
  });

  it('should extract skill target type from /api/dashboard/skills/:id', async () => {
    const skillId = 'skl-00001';
    const ctx = createMockContext({
      method: 'DELETE',
      url: '/api/dashboard/skills/' + skillId,
    });
    const handler = createSuccessHandler();

    const result$ = interceptor.intercept(ctx, handler);
    await lastValueFrom(result$);

    expect(mockAuditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: 'skill', targetId: skillId }),
    );
  });

  // -------------------------------------------------------
  // 11-13. Action derivation
  // -------------------------------------------------------
  it("should derive 'tenant_created' action for POST /api/admin/tenants", async () => {
    const ctx = createMockContext({ method: 'POST', url: '/api/admin/tenants' });
    const handler = createSuccessHandler();

    const result$ = interceptor.intercept(ctx, handler);
    await lastValueFrom(result$);

    expect(mockAuditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'tenant_created' }),
    );
  });

  it("should derive 'agent_updated' action for PATCH /api/dashboard/agents/:id", async () => {
    const ctx = createMockContext({
      method: 'PATCH',
      url: '/api/dashboard/agents/abc-123',
    });
    const handler = createSuccessHandler();

    const result$ = interceptor.intercept(ctx, handler);
    await lastValueFrom(result$);

    expect(mockAuditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'agent_updated' }),
    );
  });

  it("should derive 'tenant_deleted' action for DELETE /api/admin/tenants/:id", async () => {
    const ctx = createMockContext({
      method: 'DELETE',
      url: '/api/admin/tenants/abc-def-123',
    });
    const handler = createSuccessHandler();

    const result$ = interceptor.intercept(ctx, handler);
    await lastValueFrom(result$);

    expect(mockAuditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'tenant_deleted' }),
    );
  });

  // -------------------------------------------------------
  // 14-15. Actor type derivation
  // -------------------------------------------------------
  it("should use 'system' actorType when no user on request", async () => {
    const ctx = createMockContext({
      method: 'POST',
      url: '/api/admin/tenants',
      user: undefined,
    });
    const handler = createSuccessHandler();

    const result$ = interceptor.intercept(ctx, handler);
    await lastValueFrom(result$);

    expect(mockAuditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'system',
        actorId: 'anonymous',
        actorName: 'system',
      }),
    );
  });

  it("should use 'user' actorType when user exists on request", async () => {
    const ctx = createMockContext({
      method: 'POST',
      url: '/api/admin/tenants',
      user: { userId: 'usr-001', email: 'admin@example.com', tenantId: 'ten-001' },
    });
    const handler = createSuccessHandler();

    const result$ = interceptor.intercept(ctx, handler);
    await lastValueFrom(result$);

    expect(mockAuditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'user',
        actorId: 'usr-001',
        actorName: 'admin@example.com',
        tenantId: 'ten-001',
        userId: 'usr-001',
      }),
    );
  });

  // -------------------------------------------------------
  // 16-17. Error handling
  // -------------------------------------------------------
  it('should audit failed requests with error severity', async () => {
    const error: any = new Error('Internal failure');
    error.status = 500;
    const ctx = createMockContext({ method: 'POST', url: '/api/admin/tenants' });
    const handler = createErrorHandler(error);

    const result$ = interceptor.intercept(ctx, handler);
    await expect(lastValueFrom(result$)).rejects.toThrow('Internal failure');

    expect(mockAuditService.logAction).toHaveBeenCalledTimes(1);
    expect(mockAuditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        details: expect.objectContaining({
          error: 'Internal failure',
          statusCode: 500,
        }),
      }),
    );
  });

  it('should re-throw error after logging (catchError)', async () => {
    const error = new Error('Something went wrong');
    const ctx = createMockContext({ method: 'DELETE', url: '/api/dashboard/agents/abc' });
    const handler = createErrorHandler(error);

    const result$ = interceptor.intercept(ctx, handler);
    await expect(lastValueFrom(result$)).rejects.toThrow('Something went wrong');

    // Audit was still logged
    expect(mockAuditService.logAction).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------
  // 18. Request body in audit details
  // -------------------------------------------------------
  it('should include request body in audit details on success', async () => {
    const body = { name: 'Acme Corp', plan: 'enterprise' };
    const ctx = createMockContext({
      method: 'POST',
      url: '/api/admin/tenants',
      body,
    });
    const handler = createSuccessHandler();

    const result$ = interceptor.intercept(ctx, handler);
    await lastValueFrom(result$);

    expect(mockAuditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        details: { requestBody: body },
      }),
    );
  });
});
