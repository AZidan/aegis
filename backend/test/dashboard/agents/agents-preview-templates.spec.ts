import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AgentsService } from '../../../src/dashboard/agents/agents.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/audit/audit.service';
import { ChannelRoutingService } from '../../../src/channels/channel-routing.service';
import { ContainerConfigSyncService } from '../../../src/provisioning/container-config-sync.service';
import { ContainerConfigSyncService as TenantConfigSyncService } from '../../../src/container/container-config-sync.service';
import { ContainerConfigGeneratorService } from '../../../src/provisioning/container-config-generator.service';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

const createMockRoleConfig = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'role-config-uuid-1',
  name: 'support',
  label: 'Customer Support',
  description: 'Support agents',
  color: '#3b82f6',
  defaultToolCategories: ['web_search', 'knowledge_base'],
  sortOrder: 1,
  isSystem: true,
  soulTemplate: '# {{agentName}} Soul\nRole: {{agentRole}} for {{tenantName}}',
  agentsTemplate: '# {{agentName}} Agents\nModel: {{modelName}}',
  heartbeatTemplate: '# {{agentName}} Heartbeat',
  userTemplate: null,
  identityEmoji: 'headphones',
  openclawConfigTemplate: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  agent: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
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
    findMany: jest.fn().mockResolvedValue([]),
    groupBy: jest.fn().mockResolvedValue([]),
    aggregate: jest.fn().mockResolvedValue({ _sum: { messageCount: 0 } }),
  },
  agentActivity: {
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  channelRouting: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  channelConnection: {
    findFirst: jest.fn(),
  },
};

const mockAuditService = { logAction: jest.fn() };

const mockChannelRoutingService = {
  createRoute: jest.fn(),
  deleteRoute: jest.fn(),
};

const mockConfigSyncService = {
  syncAgentConfig: jest.fn(),
};

// Use the real generator for integration-like preview tests
const realGenerator = new ContainerConfigGeneratorService();

// ---------------------------------------------------------------------------
// Test Suite: AgentsService - previewTemplates
// ---------------------------------------------------------------------------
describe('AgentsService - previewTemplates', () => {
  let service: AgentsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: ChannelRoutingService, useValue: mockChannelRoutingService },
        { provide: ContainerConfigSyncService, useValue: mockConfigSyncService },
        { provide: ContainerConfigGeneratorService, useValue: realGenerator },
        { provide: TenantConfigSyncService, useValue: { syncTenantConfig: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<AgentsService>(AgentsService);
  });

  // =========================================================================
  // previewTemplates
  // =========================================================================
  describe('previewTemplates', () => {
    it('should return rendered templates for valid role', async () => {
      mockPrisma.agentRoleConfig.findUnique.mockResolvedValue(
        createMockRoleConfig(),
      );

      const result = await service.previewTemplates('support');

      expect(result).toHaveProperty('soulMd');
      expect(result).toHaveProperty('agentsMd');
      expect(result).toHaveProperty('heartbeatMd');
      expect(result).toHaveProperty('identityEmoji', 'headphones');
      // Should hydrate with mock agent name "My Agent"
      expect(result.soulMd).toContain('My Agent');
      expect(result.soulMd).toContain('Customer Support');
      expect(result.soulMd).toContain('Your Company');
    });

    it('should apply custom template overrides', async () => {
      mockPrisma.agentRoleConfig.findUnique.mockResolvedValue(
        createMockRoleConfig(),
      );

      const customTemplates = {
        soulTemplate: 'Custom soul for {{agentName}} at {{tenantName}}',
      };

      const result = await service.previewTemplates(
        'support',
        customTemplates,
      );

      expect(result.soulMd).toBe('Custom soul for My Agent at Your Company');
      // agentsMd should still use the role config default
      expect(result.agentsMd).toContain('My Agent Agents');
    });

    it('should throw BadRequestException for invalid role', async () => {
      mockPrisma.agentRoleConfig.findUnique.mockResolvedValue(null);

      await expect(
        service.previewTemplates('nonexistent_role'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use custom agentName in hydration', async () => {
      mockPrisma.agentRoleConfig.findUnique.mockResolvedValue(
        createMockRoleConfig(),
      );

      const result = await service.previewTemplates(
        'support',
        undefined,
        'Enterprise Bot',
      );

      expect(result.soulMd).toContain('Enterprise Bot');
      expect(result.agentsMd).toContain('Enterprise Bot');
    });
  });
});
