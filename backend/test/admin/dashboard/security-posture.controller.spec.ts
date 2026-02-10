import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { SecurityPostureController } from '../../../src/admin/dashboard/security-posture.controller';
import { SecurityPostureService } from '../../../src/admin/dashboard/security-posture.service';

describe('SecurityPostureController', () => {
  let controller: SecurityPostureController;
  let service: { getSecurityPosture: jest.Mock };

  beforeEach(async () => {
    service = {
      getSecurityPosture: jest.fn().mockResolvedValue({
        summary: {
          totalAlerts: 0,
          unresolvedAlerts: 0,
          criticalAlerts: 0,
          warningAlerts: 0,
          infoAlerts: 0,
        },
        alertsByRule: [],
        permissionViolations: {
          last24h: 0,
          last7d: 0,
          last30d: 0,
          trend: 'stable',
        },
        policyCompliance: {
          tenantsWithPolicy: 0,
          tenantsWithoutPolicy: 0,
          complianceScore: 100,
        },
        generatedAt: new Date(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SecurityPostureController],
      providers: [
        { provide: SecurityPostureService, useValue: service },
      ],
    }).compile();

    controller = module.get(SecurityPostureController);
  });

  it('should return security posture for platform admin', async () => {
    const result = await controller.getSecurityPosture({
      role: 'platform_admin',
    });

    expect(service.getSecurityPosture).toHaveBeenCalled();
    expect(result).toHaveProperty('summary');
  });

  it('should throw ForbiddenException for non-admin users', async () => {
    await expect(
      controller.getSecurityPosture({ role: 'tenant_user' }),
    ).rejects.toThrow(ForbiddenException);
  });
});
