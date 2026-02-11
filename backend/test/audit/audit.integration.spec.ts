/**
 * Audit Integration Tests
 *
 * Verifies that AuditService.logAction() is called correctly by the services
 * wired up in Stories 2-3 (AgentsService, SkillsService, TenantsService).
 *
 * Strategy: Use real service classes with mocked dependencies (PrismaService,
 * ProvisioningService, AuditService). Assert that logAction() is called with
 * the correct action, targetType, targetId, details, severity, and tenantId.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../src/audit/audit.service';
import { AgentsService } from '../../src/dashboard/agents/agents.service';
import { SkillsService } from '../../src/dashboard/skills/skills.service';
import { PermissionService } from '../../src/dashboard/skills/permission.service';
import { TenantsService } from '../../src/admin/tenants/tenants.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ProvisioningService } from '../../src/provisioning/provisioning.service';
import { CONTAINER_ORCHESTRATOR } from '../../src/container/container.constants';

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------
const NOW = new Date('2026-01-15T12:00:00.000Z');

const MOCK_AGENT = {
  id: 'agent-1',
  name: 'Test Agent',
  role: 'pm',
  status: 'active',
  modelTier: 'sonnet',
  thinkingMode: 'standard',
  temperature: 0.3,
  avatarColor: '#6366f1',
  personality: null,
  description: 'Test',
  toolPolicy: { allow: [] },
  assistedUser: null,
  lastActive: NOW,
  createdAt: NOW,
  updatedAt: NOW,
  tenantId: 'tenant-1',
  channels: [],
  installedSkills: [],
};

const MOCK_TENANT = {
  id: 'tenant-1',
  companyName: 'Acme',
  adminEmail: 'admin@acme.com',
  status: 'provisioning',
  plan: 'growth',
  industry: 'Tech',
  expectedAgentCount: 5,
  containerUrl: null,
  resourceLimits: {},
  modelDefaults: {},
  billingCycle: 'monthly',
  companySize: null,
  deploymentRegion: null,
  notes: null,
  provisioningStep: null,
  provisioningProgress: null,
  provisioningMessage: null,
  provisioningAttempt: null,
  provisioningStartedAt: null,
  provisioningFailedReason: null,
  createdAt: NOW,
  updatedAt: NOW,
};

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------
function createMockAuditService() {
  return {
    logAction: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockProvisioningService() {
  return {
    startProvisioning: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockContainerOrchestrator() {
  return {
    create: jest.fn(),
    delete: jest.fn(),
    restart: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    getStatus: jest.fn().mockResolvedValue({
      state: 'running',
      health: 'healthy',
      uptimeSeconds: 0,
    }),
    getLogs: jest.fn(),
    updateConfig: jest.fn(),
  };
}

// ============================================================================
// AgentsService - Audit Integration
// ============================================================================
describe('AgentsService audit integration', () => {
  let service: AgentsService;
  let auditService: { logAction: jest.Mock };
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(async () => {
    auditService = createMockAuditService();

    prisma = {
      agent: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
      },
      agentRoleConfig: {
        findUnique: jest.fn(),
      },
      agentMetrics: {
        findMany: jest.fn(),
      },
      agentActivity: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<AgentsService>(AgentsService);
  });

  it('createAgent should call auditService.logAction with agent_created', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      plan: 'growth',
      _count: { agents: 0 },
    });
    prisma.agentRoleConfig.findUnique.mockResolvedValue({
      name: 'pm',
      defaultToolCategories: ['analytics'],
    });
    prisma.agent.create.mockResolvedValue({ ...MOCK_AGENT, status: 'provisioning' });

    await service.createAgent('tenant-1', {
      name: 'Test Agent',
      role: 'pm',
      modelTier: 'sonnet',
      thinkingMode: 'standard',
      temperature: 0.3,
      avatarColor: '#6366f1',
      toolPolicy: { allow: [] },
    });

    expect(auditService.logAction).toHaveBeenCalledTimes(1);
    expect(auditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'agent_created',
        targetType: 'agent',
        targetId: 'agent-1',
        severity: 'info',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
      }),
    );
  });

  it('updateAgent should call auditService.logAction with agent_updated', async () => {
    prisma.agent.findFirst.mockResolvedValue(MOCK_AGENT);
    prisma.agent.update.mockResolvedValue({ ...MOCK_AGENT, name: 'Renamed' });

    await service.updateAgent('tenant-1', 'agent-1', { name: 'Renamed' });

    expect(auditService.logAction).toHaveBeenCalledTimes(1);
    expect(auditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'agent_updated',
        targetType: 'agent',
        targetId: 'agent-1',
        severity: 'info',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
      }),
    );
  });

  it('deleteAgent should call auditService.logAction with agent_deleted and severity warning', async () => {
    prisma.agent.findFirst.mockResolvedValue(MOCK_AGENT);
    prisma.agent.delete.mockResolvedValue(MOCK_AGENT);

    await service.deleteAgent('tenant-1', 'agent-1');

    expect(auditService.logAction).toHaveBeenCalledTimes(1);
    expect(auditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'agent_deleted',
        targetType: 'agent',
        targetId: 'agent-1',
        severity: 'warning',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
      }),
    );
  });

  it('restartAgent should call auditService.logAction with agent_status_changed', async () => {
    prisma.agent.findFirst.mockResolvedValue(MOCK_AGENT);
    prisma.agent.update.mockResolvedValue({ ...MOCK_AGENT, status: 'provisioning' });

    await service.restartAgent('tenant-1', 'agent-1');

    expect(auditService.logAction).toHaveBeenCalledTimes(1);
    expect(auditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'agent_status_changed',
        targetType: 'agent',
        targetId: 'agent-1',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
      }),
    );
  });

  it('pauseAgent should call auditService.logAction with agent_status_changed', async () => {
    prisma.agent.findFirst.mockResolvedValue({ ...MOCK_AGENT, status: 'active' });
    prisma.agent.update.mockResolvedValue({ ...MOCK_AGENT, status: 'paused' });

    await service.pauseAgent('tenant-1', 'agent-1');

    expect(auditService.logAction).toHaveBeenCalledTimes(1);
    expect(auditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'agent_status_changed',
        targetType: 'agent',
        targetId: 'agent-1',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
      }),
    );
  });

  it('resumeAgent should call auditService.logAction with agent_status_changed', async () => {
    prisma.agent.findFirst.mockResolvedValue({ ...MOCK_AGENT, status: 'paused' });
    prisma.agent.update.mockResolvedValue({ ...MOCK_AGENT, status: 'active' });

    await service.resumeAgent('tenant-1', 'agent-1');

    expect(auditService.logAction).toHaveBeenCalledTimes(1);
    expect(auditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'agent_status_changed',
        targetType: 'agent',
        targetId: 'agent-1',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
      }),
    );
  });
});

// ============================================================================
// SkillsService - Audit Integration
// ============================================================================
describe('SkillsService audit integration', () => {
  let service: SkillsService;
  let auditService: { logAction: jest.Mock };
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(async () => {
    auditService = createMockAuditService();

    prisma = {
      skill: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      agent: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      skillInstallation: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: PermissionService, useValue: { normalizePermissions: jest.fn((p: any) => p), checkPolicyCompatibility: jest.fn().mockReturnValue({ compatible: true, violations: [] }) } },
      ],
    }).compile();

    service = module.get<SkillsService>(SkillsService);
  });

  it('installSkill should call auditService.logAction with skill_installed', async () => {
    prisma.skill.findFirst.mockResolvedValue({
      id: 'skill-1',
      name: 'Web Search',
      version: '1.0.0',
      status: 'approved',
      isCore: false,
      installCount: 0,
    });
    prisma.agent.findFirst.mockResolvedValue(MOCK_AGENT);
    prisma.skillInstallation.findUnique.mockResolvedValue(null);
    prisma.skillInstallation.create.mockResolvedValue({
      id: 'inst-1',
      agentId: 'agent-1',
      skillId: 'skill-1',
    });
    prisma.skill.update.mockResolvedValue({
      id: 'skill-1',
      installCount: 1,
    });

    await service.installSkill('tenant-1', 'skill-1', { agentId: 'agent-1' });

    expect(auditService.logAction).toHaveBeenCalledTimes(1);
    expect(auditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'skill_installed',
        targetType: 'skill',
        targetId: 'skill-1',
        severity: 'info',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
      }),
    );
  });

  it('uninstallSkill should call auditService.logAction with skill_uninstalled', async () => {
    prisma.agent.findFirst.mockResolvedValue(MOCK_AGENT);
    prisma.skillInstallation.findUnique.mockResolvedValue({
      id: 'inst-1',
      agentId: 'agent-1',
      skillId: 'skill-1',
    });
    prisma.skill.findUnique.mockResolvedValue({
      isCore: false,
      name: 'Web Search',
      version: '1.0.0',
    });
    prisma.skillInstallation.delete.mockResolvedValue({
      id: 'inst-1',
      agentId: 'agent-1',
      skillId: 'skill-1',
    });
    prisma.skill.update.mockResolvedValue({});

    await service.uninstallSkill('tenant-1', 'skill-1', 'agent-1');

    expect(auditService.logAction).toHaveBeenCalledTimes(1);
    expect(auditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'skill_uninstalled',
        targetType: 'skill',
        targetId: 'skill-1',
        severity: 'info',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
      }),
    );
  });
});

// ============================================================================
// TenantsService - Audit Integration
// ============================================================================
describe('TenantsService audit integration', () => {
  let service: TenantsService;
  let auditService: { logAction: jest.Mock };
  let provisioningService: { startProvisioning: jest.Mock };
  let containerOrchestrator: ReturnType<typeof createMockContainerOrchestrator>;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(async () => {
    auditService = createMockAuditService();
    provisioningService = createMockProvisioningService();
    containerOrchestrator = createMockContainerOrchestrator();

    prisma = {
      tenant: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      tenantConfigHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProvisioningService, useValue: provisioningService },
        { provide: AuditService, useValue: auditService },
        { provide: CONTAINER_ORCHESTRATOR, useValue: containerOrchestrator },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  it('createTenant should call auditService.logAction with tenant_created', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);
    prisma.tenant.create.mockResolvedValue({ ...MOCK_TENANT });

    await service.createTenant({
      companyName: 'Acme',
      adminEmail: 'admin@acme.com',
      plan: 'growth',
    });

    expect(auditService.logAction).toHaveBeenCalledTimes(1);
    expect(auditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tenant_created',
        targetType: 'tenant',
        targetId: 'tenant-1',
        severity: 'info',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('updateTenantConfig should call auditService.logAction with tenant_config_updated', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ ...MOCK_TENANT, status: 'active' });
    prisma.tenantConfigHistory.create.mockResolvedValue({ id: 'history-1' });
    prisma.tenant.update.mockResolvedValue({
      ...MOCK_TENANT,
      plan: 'enterprise',
      status: 'active',
    });

    await service.updateTenantConfig('tenant-1', { plan: 'enterprise' });

    expect(auditService.logAction).toHaveBeenCalledTimes(1);
    expect(auditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tenant_config_updated',
        targetType: 'tenant',
        targetId: 'tenant-1',
        severity: 'info',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('deleteTenant should call auditService.logAction with tenant_deleted and severity warning', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ ...MOCK_TENANT, status: 'active' });
    prisma.tenant.update.mockResolvedValue({
      ...MOCK_TENANT,
      status: 'suspended',
    });

    await service.deleteTenant('tenant-1');

    expect(auditService.logAction).toHaveBeenCalledTimes(1);
    expect(auditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tenant_deleted',
        targetType: 'tenant',
        targetId: 'tenant-1',
        severity: 'warning',
        tenantId: 'tenant-1',
      }),
    );
  });
});

// ============================================================================
// Cross-cutting audit integration tests
// ============================================================================
describe('Cross-cutting audit integration', () => {
  let agentsService: AgentsService;
  let agentsAudit: { logAction: jest.Mock };
  let agentsPrisma: Record<string, Record<string, jest.Mock>>;

  let skillsService: SkillsService;
  let skillsAudit: { logAction: jest.Mock };
  let skillsPrisma: Record<string, Record<string, jest.Mock>>;

  let tenantsService: TenantsService;
  let tenantsAudit: { logAction: jest.Mock };
  let tenantsPrisma: Record<string, Record<string, jest.Mock>>;
  let provisioningService: { startProvisioning: jest.Mock };
  let tenantsContainerOrchestrator: ReturnType<
    typeof createMockContainerOrchestrator
  >;

  beforeEach(async () => {
    agentsAudit = createMockAuditService();
    agentsPrisma = {
      agent: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      tenant: { findUnique: jest.fn() },
      agentRoleConfig: { findUnique: jest.fn() },
      agentMetrics: { findMany: jest.fn() },
      agentActivity: { findFirst: jest.fn() },
    };

    const agentsModule = await Test.createTestingModule({
      providers: [
        AgentsService,
        { provide: PrismaService, useValue: agentsPrisma },
        { provide: AuditService, useValue: agentsAudit },
      ],
    }).compile();
    agentsService = agentsModule.get<AgentsService>(AgentsService);

    skillsAudit = createMockAuditService();
    skillsPrisma = {
      skill: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      agent: { findMany: jest.fn(), findFirst: jest.fn() },
      skillInstallation: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    const skillsModule = await Test.createTestingModule({
      providers: [
        SkillsService,
        { provide: PrismaService, useValue: skillsPrisma },
        { provide: AuditService, useValue: skillsAudit },
        { provide: PermissionService, useValue: { normalizePermissions: jest.fn((p: any) => p), checkPolicyCompatibility: jest.fn().mockReturnValue({ compatible: true, violations: [] }) } },
      ],
    }).compile();
    skillsService = skillsModule.get<SkillsService>(SkillsService);

    tenantsAudit = createMockAuditService();
    provisioningService = createMockProvisioningService();
    tenantsContainerOrchestrator = createMockContainerOrchestrator();
    tenantsPrisma = {
      tenant: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      tenantConfigHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
    };

    const tenantsModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: tenantsPrisma },
        { provide: ProvisioningService, useValue: provisioningService },
        { provide: AuditService, useValue: tenantsAudit },
        {
          provide: CONTAINER_ORCHESTRATOR,
          useValue: tenantsContainerOrchestrator,
        },
      ],
    }).compile();
    tenantsService = tenantsModule.get<TenantsService>(TenantsService);
  });

  it('audit events should never block the calling service (logAction is fire-and-forget)', async () => {
    // logAction returns a slow promise, but the service does NOT await it
    // so deleteAgent should resolve immediately without waiting for logAction
    let resolveAudit: () => void;
    const slowAuditPromise = new Promise<void>((resolve) => {
      resolveAudit = resolve;
    });
    agentsAudit.logAction.mockReturnValue(slowAuditPromise);

    agentsPrisma.agent.findFirst.mockResolvedValue(MOCK_AGENT);
    agentsPrisma.agent.delete.mockResolvedValue(MOCK_AGENT);

    // deleteAgent should resolve even though logAction has not resolved yet
    await expect(
      agentsService.deleteAgent('tenant-1', 'agent-1'),
    ).resolves.toBeUndefined();

    expect(agentsAudit.logAction).toHaveBeenCalledTimes(1);

    // Clean up: resolve the pending promise to avoid open handles
    resolveAudit!();
    await slowAuditPromise;
  });

  it('audit events should include tenantId when available', async () => {
    agentsPrisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      plan: 'growth',
      _count: { agents: 0 },
    });
    agentsPrisma.agentRoleConfig.findUnique.mockResolvedValue({
      name: 'pm',
      defaultToolCategories: ['analytics'],
    });
    agentsPrisma.agent.create.mockResolvedValue({ ...MOCK_AGENT, status: 'provisioning' });

    await agentsService.createAgent('tenant-1', {
      name: 'Test Agent',
      role: 'pm',
      modelTier: 'sonnet',
      thinkingMode: 'standard',
      temperature: 0.3,
      avatarColor: '#6366f1',
      toolPolicy: { allow: [] },
    });

    const call = agentsAudit.logAction.mock.calls[0][0];
    expect(call.tenantId).toBe('tenant-1');
  });

  it('createAgent audit should include details with agent name, role, modelTier', async () => {
    agentsPrisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      plan: 'growth',
      _count: { agents: 0 },
    });
    agentsPrisma.agentRoleConfig.findUnique.mockResolvedValue({
      name: 'pm',
      defaultToolCategories: ['analytics'],
    });
    agentsPrisma.agent.create.mockResolvedValue({ ...MOCK_AGENT, status: 'provisioning' });

    await agentsService.createAgent('tenant-1', {
      name: 'Test Agent',
      role: 'pm',
      modelTier: 'sonnet',
      thinkingMode: 'standard',
      temperature: 0.3,
      avatarColor: '#6366f1',
      toolPolicy: { allow: [] },
    });

    const call = agentsAudit.logAction.mock.calls[0][0];
    expect(call.details).toEqual(
      expect.objectContaining({
        name: 'Test Agent',
        role: 'pm',
        modelTier: 'sonnet',
      }),
    );
  });

  it('deleteAgent audit should have severity warning', async () => {
    agentsPrisma.agent.findFirst.mockResolvedValue(MOCK_AGENT);
    agentsPrisma.agent.delete.mockResolvedValue(MOCK_AGENT);

    await agentsService.deleteAgent('tenant-1', 'agent-1');

    const call = agentsAudit.logAction.mock.calls[0][0];
    expect(call.severity).toBe('warning');
  });

  it('updateTenantConfig audit should include before/after config diff', async () => {
    const existingTenant = {
      ...MOCK_TENANT,
      status: 'active',
      plan: 'growth',
      resourceLimits: { cpuCores: 4 },
      modelDefaults: { tier: 'sonnet' },
    };
    tenantsPrisma.tenant.findUnique.mockResolvedValue(existingTenant);
    tenantsPrisma.tenantConfigHistory.create.mockResolvedValue({ id: 'h-1' });
    tenantsPrisma.tenant.update.mockResolvedValue({
      ...existingTenant,
      plan: 'enterprise',
      resourceLimits: { cpuCores: 8 },
      modelDefaults: { tier: 'opus' },
    });

    await tenantsService.updateTenantConfig('tenant-1', {
      plan: 'enterprise',
      resourceLimits: { cpuCores: 8 },
      modelDefaults: { tier: 'opus', thinkingMode: 'high' },
    });

    const call = tenantsAudit.logAction.mock.calls[0][0];
    expect(call.details).toEqual(
      expect.objectContaining({
        before: expect.objectContaining({
          plan: 'growth',
        }),
        after: expect.objectContaining({
          plan: 'enterprise',
        }),
      }),
    );
  });

  it('installSkill audit should include skillName and skillVersion', async () => {
    skillsPrisma.skill.findFirst.mockResolvedValue({
      id: 'skill-1',
      name: 'Web Search',
      version: '1.0.0',
      status: 'approved',
      isCore: false,
      installCount: 0,
    });
    skillsPrisma.agent.findFirst.mockResolvedValue(MOCK_AGENT);
    skillsPrisma.skillInstallation.findUnique.mockResolvedValue(null);
    skillsPrisma.skillInstallation.create.mockResolvedValue({
      id: 'inst-1',
      agentId: 'agent-1',
      skillId: 'skill-1',
    });
    skillsPrisma.skill.update.mockResolvedValue({ id: 'skill-1', installCount: 1 });

    await skillsService.installSkill('tenant-1', 'skill-1', { agentId: 'agent-1' });

    const call = skillsAudit.logAction.mock.calls[0][0];
    expect(call.details).toEqual(
      expect.objectContaining({
        skillName: 'Web Search',
        skillVersion: '1.0.0',
      }),
    );
  });

  it('uninstallSkill audit should include skillName and skillVersion', async () => {
    skillsPrisma.agent.findFirst.mockResolvedValue(MOCK_AGENT);
    skillsPrisma.skillInstallation.findUnique.mockResolvedValue({
      id: 'inst-1',
      agentId: 'agent-1',
      skillId: 'skill-1',
    });
    skillsPrisma.skill.findUnique.mockResolvedValue({
      isCore: false,
      name: 'Web Search',
      version: '1.0.0',
    });
    skillsPrisma.skillInstallation.delete.mockResolvedValue({
      id: 'inst-1',
      agentId: 'agent-1',
      skillId: 'skill-1',
    });
    skillsPrisma.skill.update.mockResolvedValue({});

    await skillsService.uninstallSkill('tenant-1', 'skill-1', 'agent-1');

    const call = skillsAudit.logAction.mock.calls[0][0];
    expect(call.details).toEqual(
      expect.objectContaining({
        skillName: 'Web Search',
        skillVersion: '1.0.0',
      }),
    );
  });

  it('pauseAgent audit should include trigger: pause in details', async () => {
    agentsPrisma.agent.findFirst.mockResolvedValue({ ...MOCK_AGENT, status: 'active' });
    agentsPrisma.agent.update.mockResolvedValue({ ...MOCK_AGENT, status: 'paused' });

    await agentsService.pauseAgent('tenant-1', 'agent-1');

    const call = agentsAudit.logAction.mock.calls[0][0];
    expect(call.details).toEqual(
      expect.objectContaining({
        trigger: 'pause',
      }),
    );
  });

  it('resumeAgent audit should include trigger: resume in details', async () => {
    agentsPrisma.agent.findFirst.mockResolvedValue({ ...MOCK_AGENT, status: 'paused' });
    agentsPrisma.agent.update.mockResolvedValue({ ...MOCK_AGENT, status: 'active' });

    await agentsService.resumeAgent('tenant-1', 'agent-1');

    const call = agentsAudit.logAction.mock.calls[0][0];
    expect(call.details).toEqual(
      expect.objectContaining({
        trigger: 'resume',
      }),
    );
  });
});
