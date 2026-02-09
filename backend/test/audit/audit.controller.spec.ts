import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { AuditController } from '../../src/audit/audit.controller';
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
const mockRequest = (tenantId = 'tenant-1') => ({ tenantId } as any);

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
  actorName: 'John Doe',
  action: 'tenant.update',
  targetType: 'tenant',
  targetId: 'tenant-uuid-1',
  severity: 'info',
  tenantId: 'tenant-1',
  userId: 'user-uuid-1',
  agentId: null,
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0',
  details: { key: 'value' },
  ...overrides,
});

const mockQueryLogsResponse = {
  data: [mockAuditRow()],
  meta: { count: 1, hasNextPage: false, nextCursor: null },
};

// ---------------------------------------------------------------------------
// Test Suite: AuditController (Tenant Dashboard)
// ---------------------------------------------------------------------------
describe('AuditController', () => {
  let controller: AuditController;
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
      controllers: [AuditController],
      providers: [{ provide: AuditService, useValue: auditService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuditController>(AuditController);
  });

  // =========================================================================
  // GET /api/dashboard/audit - Query Audit Logs
  // =========================================================================
  describe('GET /dashboard/audit (getAuditLogs)', () => {
    it('should force tenantId from request and pass to queryLogs', async () => {
      // Arrange
      auditService.queryLogs.mockResolvedValue(mockQueryLogsResponse);
      const query = {} as any;
      const req = mockRequest('tenant-abc');

      // Act
      const result = await controller.getAuditLogs(query, req);

      // Assert
      expect(auditService.queryLogs).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-abc' }),
      );
      expect(result).toEqual(mockQueryLogsResponse);
    });

    it('should pass query filters through to queryLogs alongside forced tenantId', async () => {
      // Arrange
      auditService.queryLogs.mockResolvedValue(mockQueryLogsResponse);
      const query = {
        action: 'tenant.update',
        severity: 'warning',
        dateFrom: new Date('2026-01-01'),
        dateTo: new Date('2026-02-01'),
        limit: 25,
        cursor: 'cursor-abc',
      } as any;
      const req = mockRequest('tenant-xyz');

      // Act
      await controller.getAuditLogs(query, req);

      // Assert
      expect(auditService.queryLogs).toHaveBeenCalledWith({
        action: 'tenant.update',
        severity: 'warning',
        dateFrom: new Date('2026-01-01'),
        dateTo: new Date('2026-02-01'),
        limit: 25,
        cursor: 'cursor-abc',
        tenantId: 'tenant-xyz',
      });
    });
  });

  // =========================================================================
  // GET /api/dashboard/audit/export - Export Audit Logs
  // =========================================================================
  describe('GET /dashboard/audit/export (exportAuditLogs)', () => {
    it('should set correct Content-Type and Content-Disposition for CSV format', async () => {
      // Arrange
      auditService.exportLogs.mockResolvedValue([]);
      const query = { format: 'csv' } as any;
      const req = mockRequest('tenant-1');
      const res = createMockResponse();

      // Act
      await controller.exportAuditLogs(query, req, res);

      // Assert
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv; charset=utf-8',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringMatching(/^attachment; filename="audit-log-\d{4}-\d{2}-\d{2}\.csv"$/),
      );
    });

    it('should set correct Content-Type and Content-Disposition for JSON format', async () => {
      // Arrange
      auditService.exportLogs.mockResolvedValue([]);
      const query = { format: 'json' } as any;
      const req = mockRequest('tenant-1');
      const res = createMockResponse();

      // Act
      await controller.exportAuditLogs(query, req, res);

      // Assert
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringMatching(/^attachment; filename="audit-log-\d{4}-\d{2}-\d{2}\.json"$/),
      );
    });

    it('should force tenantId from JWT for tenant isolation', async () => {
      // Arrange
      auditService.exportLogs.mockResolvedValue([]);
      const query = { format: 'csv' } as any;
      const req = mockRequest('tenant-isolated');
      const res = createMockResponse();

      // Act
      await controller.exportAuditLogs(query, req, res);

      // Assert
      expect(auditService.exportLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-isolated',
          maxRows: AUDIT_EXPORT_MAX_ROWS,
        }),
      );
    });

    it('should stream CSV with header row and data rows, escaping commas/quotes/newlines', async () => {
      // Arrange - row with values requiring CSV escaping
      const rows = [
        mockAuditRow({
          actorName: 'Doe, Jane',         // contains comma
          action: 'said "hello"',         // contains quotes
          userAgent: 'line1\nline2',      // contains newline
        }),
      ];
      auditService.exportLogs.mockResolvedValue(rows);
      const query = { format: 'csv' } as any;
      const req = mockRequest('tenant-1');
      const res = createMockResponse();

      // Act
      await controller.exportAuditLogs(query, req, res);

      // Assert - first chunk is the CSV header
      const headerLine = res._chunks[0];
      expect(headerLine).toBe(AUDIT_CSV_HEADERS.join(',') + '\n');

      // The data row should exist and include escaped values
      const dataLine = res._chunks[1];
      expect(dataLine).toBeDefined();
      // Comma in actorName should be quoted
      expect(dataLine).toContain('"Doe, Jane"');
      // Quotes in action should be doubled
      expect(dataLine).toContain('"said ""hello"""');
      // Newline in userAgent should be quoted
      expect(dataLine).toContain('"line1\nline2"');

      expect(res.end).toHaveBeenCalled();
    });

    it('should stream valid JSON array with proper comma separation', async () => {
      // Arrange
      const row1 = mockAuditRow({ id: 'log-1' });
      const row2 = mockAuditRow({ id: 'log-2' });
      auditService.exportLogs.mockResolvedValue([row1, row2]);
      const query = { format: 'json' } as any;
      const req = mockRequest('tenant-1');
      const res = createMockResponse();

      // Act
      await controller.exportAuditLogs(query, req, res);

      // Assert - reconstruct the full streamed output
      const fullOutput = res._chunks.join('');
      // Should be valid JSON
      const parsed = JSON.parse(fullOutput);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('log-1');
      expect(parsed[1].id).toBe('log-2');

      expect(res.end).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Guard Configuration Verification
  // =========================================================================
  describe('Guard Configuration', () => {
    it('should have JwtAuthGuard and TenantGuard applied at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', AuditController);

      expect(guards).toBeDefined();
      expect(guards.length).toBe(2);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(TenantGuard);
    });
  });
});
