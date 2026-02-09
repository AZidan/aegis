import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AuditAdminController } from '../../src/audit/audit-admin.controller';
import { AuditService } from '../../src/audit/audit.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../src/common/guards/tenant.guard';
import {
  AUDIT_CSV_HEADERS,
  AUDIT_EXPORT_MAX_ROWS,
} from '../../src/audit/audit.constants';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------
const mockPlatformAdmin = { role: 'platform_admin' };
const mockTenantAdmin = { role: 'tenant_admin' };
const mockRegularUser = { role: 'user' };

/**
 * Mock Response object that captures streamed output for assertion.
 */
const createMockResponse = () => {
  const chunks: string[] = [];
  return {
    setHeader: jest.fn(),
    write: jest.fn((chunk: string) => chunks.push(chunk)),
    end: jest.fn(),
    _chunks: chunks,
  } as any;
};

// ---------------------------------------------------------------------------
// Mock Audit Rows
// ---------------------------------------------------------------------------
const mockAuditRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'log-uuid-1',
  timestamp: '2026-02-05T12:00:00.000Z',
  actorType: 'user',
  actorId: 'user-uuid-1',
  actorName: 'Admin User',
  action: 'tenant.create',
  targetType: 'tenant',
  targetId: 'tenant-uuid-1',
  severity: 'info',
  tenantId: 'tenant-1',
  userId: 'user-uuid-1',
  agentId: null,
  ipAddress: '10.0.0.1',
  userAgent: 'AdminPanel/1.0',
  details: { companyName: 'Acme Corp' },
  ...overrides,
});

const mockQueryLogsResponse = {
  data: [mockAuditRow()],
  meta: { count: 1, hasNextPage: false, nextCursor: null },
};

// ---------------------------------------------------------------------------
// Test Suite: AuditAdminController (Platform Admin Cross-Tenant)
// ---------------------------------------------------------------------------
describe('AuditAdminController', () => {
  let controller: AuditAdminController;
  let auditService: {
    queryLogs: jest.Mock;
    exportLogs: jest.Mock;
  };

  beforeEach(async () => {
    auditService = {
      queryLogs: jest.fn(),
      exportLogs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditAdminController],
      providers: [{ provide: AuditService, useValue: auditService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuditAdminController>(AuditAdminController);
  });

  // =========================================================================
  // GET /api/admin/audit-logs - Query Audit Logs (Cross-Tenant)
  // =========================================================================
  describe('GET /admin/audit-logs (getAuditLogs)', () => {
    it('should call queryLogs without forced tenantId for platform_admin', async () => {
      // Arrange
      auditService.queryLogs.mockResolvedValue(mockQueryLogsResponse);
      const query = { limit: 50 } as any;

      // Act
      const result = await controller.getAuditLogs(query, mockPlatformAdmin);

      // Assert - query passed directly, no tenantId injection
      expect(auditService.queryLogs).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockQueryLogsResponse);
    });

    it('should throw ForbiddenException for tenant_admin role', async () => {
      // Arrange
      const query = {} as any;

      // Act & Assert
      await expect(
        controller.getAuditLogs(query, mockTenantAdmin),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.getAuditLogs(query, mockTenantAdmin),
      ).rejects.toThrow('Requires platform_admin role');
    });

    it('should pass optional tenantId filter from query params for admin cross-tenant filtering', async () => {
      // Arrange
      auditService.queryLogs.mockResolvedValue(mockQueryLogsResponse);
      const query = { tenantId: 'tenant-xyz', action: 'auth.login' } as any;

      // Act
      await controller.getAuditLogs(query, mockPlatformAdmin);

      // Assert - tenantId from query is passed through (not forced from JWT)
      expect(auditService.queryLogs).toHaveBeenCalledWith({
        tenantId: 'tenant-xyz',
        action: 'auth.login',
      });
    });
  });

  // =========================================================================
  // GET /api/admin/audit-logs/export - Export Audit Logs (Cross-Tenant)
  // =========================================================================
  describe('GET /admin/audit-logs/export (exportAuditLogs)', () => {
    it('should set correct CSV headers and stream data for platform_admin', async () => {
      // Arrange
      const rows = [mockAuditRow()];
      auditService.exportLogs.mockResolvedValue(rows);
      const query = { format: 'csv' } as any;
      const res = createMockResponse();

      // Act
      await controller.exportAuditLogs(query, mockPlatformAdmin, res);

      // Assert
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv; charset=utf-8',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringMatching(/^attachment; filename="audit-log-\d{4}-\d{2}-\d{2}\.csv"$/),
      );
      // First chunk should be the CSV header row
      expect(res._chunks[0]).toBe(AUDIT_CSV_HEADERS.join(',') + '\n');
      expect(res.end).toHaveBeenCalled();
    });

    it('should set correct JSON headers and stream data for platform_admin', async () => {
      // Arrange
      const rows = [mockAuditRow({ id: 'log-1' })];
      auditService.exportLogs.mockResolvedValue(rows);
      const query = { format: 'json' } as any;
      const res = createMockResponse();

      // Act
      await controller.exportAuditLogs(query, mockPlatformAdmin, res);

      // Assert
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringMatching(/^attachment; filename="audit-log-\d{4}-\d{2}-\d{2}\.json"$/),
      );
      // Should produce valid JSON
      const fullOutput = res._chunks.join('');
      const parsed = JSON.parse(fullOutput);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(res.end).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for non-admin user on export', async () => {
      // Arrange
      const query = { format: 'csv' } as any;
      const res = createMockResponse();

      // Act & Assert
      await expect(
        controller.exportAuditLogs(query, mockTenantAdmin, res),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.exportAuditLogs(query, mockTenantAdmin, res),
      ).rejects.toThrow('Requires platform_admin role');
    });
  });

  // =========================================================================
  // assertPlatformAdmin - tested implicitly through endpoints
  // =========================================================================
  describe('assertPlatformAdmin (implicit via endpoints)', () => {
    it('should throw ForbiddenException for tenant_admin role', async () => {
      const query = {} as any;

      await expect(
        controller.getAuditLogs(query, mockTenantAdmin),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.getAuditLogs(query, mockTenantAdmin),
      ).rejects.toThrow('Requires platform_admin role');
    });

    it('should throw ForbiddenException for regular user role', async () => {
      const query = {} as any;

      await expect(
        controller.getAuditLogs(query, mockRegularUser),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.getAuditLogs(query, mockRegularUser),
      ).rejects.toThrow('Requires platform_admin role');
    });

    it('should pass without error for platform_admin role', async () => {
      // Arrange
      auditService.queryLogs.mockResolvedValue(mockQueryLogsResponse);
      const query = {} as any;

      // Act & Assert - should not throw
      await expect(
        controller.getAuditLogs(query, mockPlatformAdmin),
      ).resolves.toBeDefined();
    });
  });

  // =========================================================================
  // Empty Rows Edge Case
  // =========================================================================
  describe('streamCsv / streamJson with empty rows', () => {
    it('should write only CSV header row when rows array is empty', async () => {
      // Arrange
      auditService.exportLogs.mockResolvedValue([]);
      const query = { format: 'csv' } as any;
      const res = createMockResponse();

      // Act
      await controller.exportAuditLogs(query, mockPlatformAdmin, res);

      // Assert - only the header row and then end
      expect(res._chunks).toHaveLength(1);
      expect(res._chunks[0]).toBe(AUDIT_CSV_HEADERS.join(',') + '\n');
      expect(res.end).toHaveBeenCalled();
    });

    it('should write empty JSON array when rows array is empty', async () => {
      // Arrange
      auditService.exportLogs.mockResolvedValue([]);
      const query = { format: 'json' } as any;
      const res = createMockResponse();

      // Act
      await controller.exportAuditLogs(query, mockPlatformAdmin, res);

      // Assert - should produce [\n]\n
      const fullOutput = res._chunks.join('');
      expect(fullOutput).toBe('[\n]\n');
      expect(res.end).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Guard Configuration Verification
  // =========================================================================
  describe('Guard Configuration', () => {
    it('should have JwtAuthGuard applied but NOT TenantGuard at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', AuditAdminController);

      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      // Admin controller should NOT have TenantGuard (cross-tenant access)
      expect(guards).not.toContain(TenantGuard);
    });
  });
});
