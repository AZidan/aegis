import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { DashboardController } from '../dashboard.controller';
import { DashboardService } from '../dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: {
    getStats: jest.Mock;
    getRecentActivity: jest.Mock;
  };

  const adminUser = { role: 'platform_admin' };
  const regularUser = { role: 'tenant_admin' };

  const mockStats = {
    tenants: { total: 5, active: 3, suspended: 1, provisioning: 1 },
    agents: { total: 10, activeToday: 4 },
    health: { healthy: 3, degraded: 1, down: 0 },
    platform: { uptime: 3600, version: '1.0.0' },
  };

  const mockActivity = [
    {
      id: 'log-1',
      action: 'agent_created',
      targetType: 'agent',
      targetId: 'a-1',
      actorId: 'u-1',
      actorName: 'Admin',
      tenantId: 't-1',
      timestamp: '2026-02-20T10:00:00.000Z',
      details: null,
    },
  ];

  beforeEach(async () => {
    service = {
      getStats: jest.fn().mockResolvedValue(mockStats),
      getRecentActivity: jest.fn().mockResolvedValue(mockActivity),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: service }],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  // ---------------------------------------------------------------------------
  // GET /admin/dashboard/stats
  // ---------------------------------------------------------------------------
  describe('GET stats', () => {
    it('should return stats for platform admin', async () => {
      const result = await controller.getStats(adminUser);
      expect(result).toEqual(mockStats);
      expect(service.getStats).toHaveBeenCalledTimes(1);
    });

    it('should reject non-admin users', async () => {
      await expect(controller.getStats(regularUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // GET /admin/dashboard/recent-activity
  // ---------------------------------------------------------------------------
  describe('GET recent-activity', () => {
    it('should return recent activity with default limit', async () => {
      const result = await controller.getRecentActivity(adminUser);
      expect(result).toEqual(mockActivity);
      expect(service.getRecentActivity).toHaveBeenCalledWith(10);
    });

    it('should pass parsed limit parameter', async () => {
      await controller.getRecentActivity(adminUser, '5');
      expect(service.getRecentActivity).toHaveBeenCalledWith(5);
    });

    it('should fall back to default when limit is NaN', async () => {
      await controller.getRecentActivity(adminUser, 'abc');
      expect(service.getRecentActivity).toHaveBeenCalledWith(10);
    });

    it('should reject non-admin users', async () => {
      await expect(
        controller.getRecentActivity(regularUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
