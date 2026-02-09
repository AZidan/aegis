import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AlertService } from '../../src/alert/alert.service';
import { PrismaService } from '../../src/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------
const mockAlert = (overrides: Record<string, unknown> = {}) => ({
  id: 'alert-uuid-1',
  severity: 'warning',
  title: 'Failed Login Spike',
  message: 'Rule: Failed Login Spike | Action: auth_login_failed | Actor: user-1',
  tenantId: null,
  resolved: false,
  resolvedAt: null,
  resolvedBy: null,
  createdAt: new Date('2026-02-09T12:00:00.000Z'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test Suite: AlertService
// ---------------------------------------------------------------------------
describe('AlertService', () => {
  let service: AlertService;
  let prisma: {
    alert: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let cache: {
    get: jest.Mock;
    set: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      alert: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    cache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get<AlertService>(AlertService);
  });

  // =========================================================================
  // createAlert
  // =========================================================================
  describe('createAlert', () => {
    it('should create an alert in DB when not suppressed', async () => {
      cache.get.mockResolvedValue(undefined);
      const alert = mockAlert();
      prisma.alert.create.mockResolvedValue(alert);

      const result = await service.createAlert({
        severity: 'warning',
        title: 'Failed Login Spike',
        message: 'Test message',
        ruleId: 'failed-login-spike',
      });

      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: {
          severity: 'warning',
          title: 'Failed Login Spike',
          message: 'Test message',
          tenantId: undefined,
        },
      });
      expect(result).toEqual(alert);
    });

    it('should return null when the alert is suppressed', async () => {
      cache.get.mockResolvedValue('1');

      const result = await service.createAlert({
        severity: 'warning',
        title: 'Failed Login Spike',
        message: 'Test message',
        ruleId: 'failed-login-spike',
      });

      expect(result).toBeNull();
      expect(prisma.alert.create).not.toHaveBeenCalled();
    });

    it('should set suppression after successful creation', async () => {
      cache.get.mockResolvedValue(undefined);
      prisma.alert.create.mockResolvedValue(mockAlert());

      await service.createAlert({
        severity: 'warning',
        title: 'Test',
        message: 'Test',
        ruleId: 'failed-login-spike',
        tenantId: 'tenant-1',
      });

      expect(cache.set).toHaveBeenCalledWith(
        'alert-suppress:failed-login-spike:tenant-1',
        '1',
        15 * 60 * 1000,
      );
    });

    it('should use "global" suppression key when no tenantId provided', async () => {
      cache.get.mockResolvedValue(undefined);
      prisma.alert.create.mockResolvedValue(mockAlert());

      await service.createAlert({
        severity: 'warning',
        title: 'Test',
        message: 'Test',
        ruleId: 'failed-login-spike',
      });

      expect(cache.set).toHaveBeenCalledWith(
        'alert-suppress:failed-login-spike:global',
        '1',
        15 * 60 * 1000,
      );
    });
  });

  // =========================================================================
  // queryAlerts
  // =========================================================================
  describe('queryAlerts', () => {
    it('should return all alerts when no filters are provided', async () => {
      const alerts = [mockAlert(), mockAlert({ id: 'alert-uuid-2' })];
      prisma.alert.findMany.mockResolvedValue(alerts);

      const result = await service.queryAlerts({ limit: 50 });

      expect(prisma.alert.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      expect(result.data).toHaveLength(2);
    });

    it('should filter by severity', async () => {
      prisma.alert.findMany.mockResolvedValue([mockAlert({ severity: 'critical' })]);

      await service.queryAlerts({ severity: 'critical', limit: 50 });

      expect(prisma.alert.findMany).toHaveBeenCalledWith({
        where: { severity: 'critical' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('should filter by resolved status', async () => {
      prisma.alert.findMany.mockResolvedValue([]);

      await service.queryAlerts({ resolved: false, limit: 50 });

      expect(prisma.alert.findMany).toHaveBeenCalledWith({
        where: { resolved: false },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  // =========================================================================
  // resolveAlert
  // =========================================================================
  describe('resolveAlert', () => {
    it('should mark alert as resolved with timestamp and user', async () => {
      const alert = mockAlert();
      const resolvedDate = new Date('2026-02-09T13:00:00.000Z');
      prisma.alert.findUnique.mockResolvedValue(alert);
      prisma.alert.update.mockResolvedValue({
        ...alert,
        resolved: true,
        resolvedAt: resolvedDate,
        resolvedBy: 'admin-user-1',
      });

      const result = await service.resolveAlert('alert-uuid-1', 'admin-user-1');

      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'alert-uuid-1' },
        data: {
          resolved: true,
          resolvedAt: expect.any(Date),
          resolvedBy: 'admin-user-1',
        },
      });
      expect(result.resolved).toBe(true);
      expect(result.resolvedBy).toBe('admin-user-1');
    });

    it('should throw NotFoundException for missing alert', async () => {
      prisma.alert.findUnique.mockResolvedValue(null);

      await expect(
        service.resolveAlert('nonexistent-id', 'admin-user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
