import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import {
  SkillDeploymentService,
  SKILL_DEPLOYMENT_QUEUE,
} from '../skill-deployment.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';

describe('SkillDeploymentService', () => {
  let service: SkillDeploymentService;
  let prisma: any;
  let auditService: any;
  let queue: any;

  beforeEach(async () => {
    prisma = {
      agent: { findFirst: jest.fn() },
      skill: { findUnique: jest.fn() },
      agentSkillInstallation: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    auditService = { logAction: jest.fn() };
    queue = { add: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillDeploymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: getQueueToken(SKILL_DEPLOYMENT_QUEUE), useValue: queue },
      ],
    }).compile();

    service = module.get<SkillDeploymentService>(SkillDeploymentService);
  });

  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const agentId = 'agent-1';
  const skillId = 'skill-1';

  const mockAgent = { id: agentId, tenantId, name: 'Test Agent' };
  const mockSkill = {
    id: skillId,
    name: 'ticket-triage',
    version: '1.0.0',
    status: 'approved',
    sourceCode: 'some code',
    documentation: 'docs',
    packagePath: '/data/skill-packages/tenant-1/ticket-triage/1.0.0/package.zip',
    permissions: { network: { allowedDomains: [] } },
  };

  describe('installSkill', () => {
    it('should create installation and enqueue deploy job', async () => {
      prisma.agent.findFirst.mockResolvedValue(mockAgent);
      prisma.skill.findUnique.mockResolvedValue(mockSkill);
      prisma.agentSkillInstallation.findUnique.mockResolvedValue(null);
      prisma.agentSkillInstallation.create.mockResolvedValue({
        id: 'install-1',
        agentId,
        skillName: 'ticket-triage',
        skillVersion: '1.0.0',
        status: 'pending',
      });

      const result = await service.installSkill(
        agentId,
        skillId,
        tenantId,
        userId,
      );

      expect(result.status).toBe('deploying');
      expect(result.installationId).toBe('install-1');
      expect(result.skillName).toBe('ticket-triage');
      expect(queue.add).toHaveBeenCalledWith(
        'deploy-skill',
        expect.objectContaining({ skillName: 'ticket-triage' }),
        expect.objectContaining({ attempts: 3 }),
      );
      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'skill_install_initiated' }),
      );
    });

    it('should throw if agent not found', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.installSkill(agentId, skillId, tenantId, userId),
      ).rejects.toThrow('not found');
    });

    it('should throw if skill not approved', async () => {
      prisma.agent.findFirst.mockResolvedValue(mockAgent);
      prisma.skill.findUnique.mockResolvedValue({
        ...mockSkill,
        status: 'pending',
      });

      await expect(
        service.installSkill(agentId, skillId, tenantId, userId),
      ).rejects.toThrow('not approved');
    });

    it('should throw if skill already installed', async () => {
      prisma.agent.findFirst.mockResolvedValue(mockAgent);
      prisma.skill.findUnique.mockResolvedValue(mockSkill);
      prisma.agentSkillInstallation.findUnique.mockResolvedValue({
        id: 'existing',
        status: 'deployed',
      });

      await expect(
        service.installSkill(agentId, skillId, tenantId, userId),
      ).rejects.toThrow('already installed');
    });

    it('should re-install if previous installation was uninstalled', async () => {
      prisma.agent.findFirst.mockResolvedValue(mockAgent);
      prisma.skill.findUnique.mockResolvedValue(mockSkill);
      prisma.agentSkillInstallation.findUnique.mockResolvedValue({
        id: 'old-install',
        status: 'uninstalled',
      });
      prisma.agentSkillInstallation.update.mockResolvedValue({
        id: 'old-install',
        agentId,
        skillName: 'ticket-triage',
        skillVersion: '1.0.0',
        status: 'pending',
      });

      const result = await service.installSkill(
        agentId,
        skillId,
        tenantId,
        userId,
      );

      expect(result.status).toBe('deploying');
      expect(prisma.agentSkillInstallation.update).toHaveBeenCalled();
    });

    it('should pass envConfig when provided', async () => {
      prisma.agent.findFirst.mockResolvedValue(mockAgent);
      prisma.skill.findUnique.mockResolvedValue(mockSkill);
      prisma.agentSkillInstallation.findUnique.mockResolvedValue(null);
      prisma.agentSkillInstallation.create.mockResolvedValue({
        id: 'install-2',
        agentId,
        skillName: 'ticket-triage',
        skillVersion: '1.0.0',
        status: 'pending',
      });

      const envConfig = { LINEAR_API_KEY: 'lin_xxx' };
      await service.installSkill(
        agentId,
        skillId,
        tenantId,
        userId,
        envConfig,
      );

      expect(prisma.agentSkillInstallation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ envConfig }),
        }),
      );
      expect(queue.add).toHaveBeenCalledWith(
        'deploy-skill',
        expect.objectContaining({ envConfig }),
        expect.any(Object),
      );
    });
  });

  describe('uninstallSkill', () => {
    it('should update status and enqueue undeploy job', async () => {
      prisma.agentSkillInstallation.findFirst.mockResolvedValue({
        id: 'install-1',
        agentId,
        skillName: 'ticket-triage',
        skillVersion: '1.0.0',
      });
      prisma.agentSkillInstallation.update.mockResolvedValue({});

      const result = await service.uninstallSkill(
        agentId,
        skillId,
        tenantId,
        userId,
      );

      expect(result.status).toBe('uninstalled');
      expect(queue.add).toHaveBeenCalledWith(
        'undeploy-skill',
        expect.objectContaining({ skillName: 'ticket-triage' }),
        expect.any(Object),
      );
    });

    it('should throw if installation not found', async () => {
      prisma.agentSkillInstallation.findFirst.mockResolvedValue(null);

      await expect(
        service.uninstallSkill(agentId, skillId, tenantId, userId),
      ).rejects.toThrow('not found');
    });
  });

  describe('listInstallations', () => {
    it('should return non-uninstalled installations', async () => {
      prisma.agentSkillInstallation.findMany.mockResolvedValue([
        { id: '1', skillName: 'a', status: 'deployed' },
      ]);

      const result = await service.listInstallations(agentId, tenantId);

      expect(result).toHaveLength(1);
      expect(prisma.agentSkillInstallation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: 'uninstalled' },
          }),
        }),
      );
    });
  });
});
