import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AlertController } from '../../src/alert/alert.controller';
import { AlertService } from '../../src/alert/alert.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------
const mockPlatformAdmin = { id: 'admin-1', role: 'platform_admin' };
const mockTenantAdmin = { id: 'tadmin-1', role: 'tenant_admin' };

const mockAlertResponse = {
  data: [
    {
      id: 'alert-uuid-1',
      severity: 'warning',
      title: 'Failed Login Spike',
      message: 'Rule: Failed Login Spike',
      tenantId: null,
      resolved: false,
      resolvedAt: null,
      resolvedBy: null,
      createdAt: '2026-02-09T12:00:00.000Z',
    },
  ],
};

const mockResolvedAlert = {
  id: 'alert-uuid-1',
  severity: 'warning',
  title: 'Failed Login Spike',
  message: 'Rule: Failed Login Spike',
  tenantId: null,
  resolved: true,
  resolvedAt: '2026-02-09T13:00:00.000Z',
  resolvedBy: 'admin-1',
  createdAt: '2026-02-09T12:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Test Suite: AlertController
// ---------------------------------------------------------------------------
describe('AlertController', () => {
  let controller: AlertController;
  let alertService: {
    queryAlerts: jest.Mock;
    resolveAlert: jest.Mock;
  };

  beforeEach(async () => {
    alertService = {
      queryAlerts: jest.fn(),
      resolveAlert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertController],
      providers: [{ provide: AlertService, useValue: alertService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AlertController>(AlertController);
  });

  // =========================================================================
  // GET /api/admin/dashboard/alerts
  // =========================================================================
  describe('GET /admin/dashboard/alerts (getAlerts)', () => {
    it('should return alerts with filters for platform_admin', async () => {
      alertService.queryAlerts.mockResolvedValue(mockAlertResponse);
      const query = { limit: 50 } as any;

      const result = await controller.getAlerts(query, mockPlatformAdmin);

      expect(alertService.queryAlerts).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockAlertResponse);
    });

    it('should throw ForbiddenException for non-admin user', async () => {
      await expect(
        controller.getAlerts({ limit: 50 } as any, mockTenantAdmin),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // PUT /api/admin/dashboard/alerts/:id
  // =========================================================================
  describe('PUT /admin/dashboard/alerts/:id (resolveAlert)', () => {
    it('should resolve alert and return updated data', async () => {
      alertService.resolveAlert.mockResolvedValue(mockResolvedAlert);

      const result = await controller.resolveAlert(
        'alert-uuid-1',
        mockPlatformAdmin,
      );

      expect(alertService.resolveAlert).toHaveBeenCalledWith(
        'alert-uuid-1',
        'admin-1',
      );
      expect(result).toEqual(mockResolvedAlert);
    });

    it('should throw ForbiddenException for non-admin user', async () => {
      await expect(
        controller.resolveAlert('alert-uuid-1', mockTenantAdmin as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should propagate NotFoundException for missing alert', async () => {
      alertService.resolveAlert.mockRejectedValue(
        new NotFoundException('Alert not found'),
      );

      await expect(
        controller.resolveAlert('nonexistent-id', mockPlatformAdmin),
      ).rejects.toThrow(NotFoundException);
    });

    it('should pass the correct userId from the CurrentUser', async () => {
      alertService.resolveAlert.mockResolvedValue(mockResolvedAlert);
      const user = { id: 'specific-admin-id', role: 'platform_admin' };

      await controller.resolveAlert('alert-uuid-1', user);

      expect(alertService.resolveAlert).toHaveBeenCalledWith(
        'alert-uuid-1',
        'specific-admin-id',
      );
    });
  });
});
