import { Test, TestingModule } from '@nestjs/testing';
import { SecurityPostureService } from '../../../src/admin/dashboard/security-posture.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('SecurityPostureService', () => {
  let service: SecurityPostureService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      alert: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        count: jest.fn().mockResolvedValue(0),
      },
      tenant: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      agent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      skillInstallation: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityPostureService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(SecurityPostureService);
  });

  it('should return a complete security posture report', async () => {
    const result = await service.getSecurityPosture();

    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('alertsByRule');
    expect(result).toHaveProperty('permissionViolations');
    expect(result).toHaveProperty('policyCompliance');
    expect(result).toHaveProperty('generatedAt');
  });

  it('should compute alert summary from counts', async () => {
    prisma.alert.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(3) // unresolved (active)
      .mockResolvedValueOnce(1) // critical
      .mockResolvedValueOnce(5) // warning
      .mockResolvedValueOnce(4); // info

    const result = await service.getSecurityPosture();

    expect(result.summary.totalAlerts).toBe(10);
    expect(result.summary.unresolvedAlerts).toBe(3);
    expect(result.summary.criticalAlerts).toBe(1);
  });

  it('should group alerts by rule', async () => {
    prisma.alert.groupBy.mockResolvedValue([
      {
        title: 'Failed Login Spike',
        _count: { id: 5 },
        _max: { createdAt: new Date() },
      },
    ]);

    const result = await service.getSecurityPosture();

    expect(result.alertsByRule).toHaveLength(1);
    expect(result.alertsByRule[0].ruleId).toBe('failed-login-spike');
    expect(result.alertsByRule[0].ruleName).toBe('Failed Login Spike');
    expect(result.alertsByRule[0].count).toBe(5);
  });

  it('should determine violation trend as increasing when current > previous', async () => {
    prisma.auditLog.count
      .mockResolvedValueOnce(5) // last24h
      .mockResolvedValueOnce(20) // last7d
      .mockResolvedValueOnce(50) // last30d
      .mockResolvedValueOnce(20); // prev30d (50 > 20*1.2=24 -> increasing)

    const result = await service.getSecurityPosture();

    expect(result.permissionViolations.trend).toBe('increasing');
  });

  it('should determine violation trend as stable when roughly equal', async () => {
    prisma.auditLog.count
      .mockResolvedValueOnce(2) // last24h
      .mockResolvedValueOnce(10) // last7d
      .mockResolvedValueOnce(20) // last30d
      .mockResolvedValueOnce(18); // prev30d (20 is between 14.4 and 21.6 -> stable)

    const result = await service.getSecurityPosture();

    expect(result.permissionViolations.trend).toBe('stable');
  });

  it('should compute policy compliance score', async () => {
    prisma.tenant.findMany.mockResolvedValue([
      { id: 't1' },
      { id: 't2' },
      { id: 't3' },
      { id: 't4' },
      { id: 't5' },
    ]);
    prisma.agent.findMany
      .mockResolvedValueOnce([{ id: 'a1' }]) // t1 has agents
      .mockResolvedValueOnce([{ id: 'a2' }]) // t2 has agents
      .mockResolvedValueOnce([{ id: 'a3' }]) // t3 has agents
      .mockResolvedValueOnce([{ id: 'a4' }]) // t4 has agents
      .mockResolvedValueOnce([]); // t5 has no agents

    prisma.skillInstallation.count
      .mockResolvedValueOnce(3) // t1 has installations
      .mockResolvedValueOnce(2) // t2 has installations
      .mockResolvedValueOnce(0) // t3 no installations
      .mockResolvedValueOnce(1); // t4 has installations

    const result = await service.getSecurityPosture();

    // t1, t2, t4 have policy (3), t3 and t5 don't (2)
    expect(result.policyCompliance.tenantsWithPolicy).toBe(3);
    expect(result.policyCompliance.tenantsWithoutPolicy).toBe(2);
    expect(result.policyCompliance.complianceScore).toBe(60);
  });

  it('should return 100% compliance when no active tenants', async () => {
    prisma.tenant.findMany.mockResolvedValue([]);

    const result = await service.getSecurityPosture();

    expect(result.policyCompliance.complianceScore).toBe(100);
  });
});
