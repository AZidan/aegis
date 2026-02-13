import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AgentsService } from '../../../src/dashboard/agents/agents.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/audit/audit.service';
import { ChannelRoutingService } from '../../../src/channels/channel-routing.service';
import { ContainerConfigSyncService } from '../../../src/provisioning/container-config-sync.service';
import { ContainerConfigSyncService as TenantConfigSyncService } from '../../../src/container/container-config-sync.service';
import { ContainerConfigGeneratorService } from '../../../src/provisioning/container-config-generator.service';
import { DockerOrchestratorService } from '../../../src/container/docker-orchestrator.service';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-1';
const OTHER_TENANT_ID = 'tenant-uuid-2';
const AGENT_ID = 'agent-uuid-1';
const CONNECTION_ID = 'conn-uuid-1';
const ROUTE_ID = 'route-uuid-1';
const USER_ID = 'user-uuid-1';

const createMockAgent = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: AGENT_ID,
  name: 'Support Bot',
  role: 'support',
  tenantId: TENANT_ID,
  ...overrides,
});

const createMockConnection = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: CONNECTION_ID,
  platform: 'SLACK',
  workspaceName: 'Acme Workspace',
  status: 'active',
  tenantId: TENANT_ID,
  ...overrides,
});

const createMockRoute = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: ROUTE_ID,
  routeType: 'channel_mapping',
  sourceIdentifier: '#general',
  priority: 10,
  isActive: true,
  agentId: AGENT_ID,
  connectionId: CONNECTION_ID,
  createdAt: new Date('2026-02-01T00:00:00.000Z'),
  updatedAt: new Date('2026-02-01T00:00:00.000Z'),
  connection: {
    id: CONNECTION_ID,
    platform: 'SLACK',
    workspaceName: 'Acme Workspace',
    status: 'active',
    tenantId: TENANT_ID,
  },
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
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  channelConnection: {
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
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

const mockConfigGeneratorService = {
  generateWorkspace: jest.fn(),
};

// ---------------------------------------------------------------------------
// Test Suite: AgentsService - Channel Endpoints
// ---------------------------------------------------------------------------
describe('AgentsService - Channel Endpoints', () => {
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
        { provide: TenantConfigSyncService, useValue: { syncTenantConfig: jest.fn().mockResolvedValue(undefined) } },
        { provide: ContainerConfigGeneratorService, useValue: mockConfigGeneratorService },
        { provide: DockerOrchestratorService, useValue: { removeAgentWorkspace: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<AgentsService>(AgentsService);
  });

  // =========================================================================
  // getAgentChannels
  // =========================================================================
  describe('getAgentChannels', () => {
    it('should return empty connections for agent with no routes', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(createMockAgent());
      mockPrisma.channelRouting.findMany.mockResolvedValue([]);

      const result = await service.getAgentChannels(TENANT_ID, AGENT_ID);

      expect(result).toEqual({ connections: [] });
      expect(mockPrisma.agent.findFirst).toHaveBeenCalledWith({
        where: { id: AGENT_ID, tenantId: TENANT_ID },
      });
    });

    it('should return connections grouped by connection', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(createMockAgent());
      mockPrisma.channelConnection.findMany.mockResolvedValue([createMockConnection()]);

      const routes = [
        createMockRoute(),
        createMockRoute({
          id: 'route-uuid-2',
          sourceIdentifier: '#support',
          priority: 20,
        }),
      ];
      mockPrisma.channelRouting.findMany.mockResolvedValue(routes);

      const result = await service.getAgentChannels(TENANT_ID, AGENT_ID);

      expect(result.connections).toHaveLength(1);
      expect(result.connections[0].id).toBe(CONNECTION_ID);
      expect(result.connections[0].platform).toBe('SLACK');
      expect(result.connections[0].routes).toHaveLength(2);
      expect(result.connections[0].routes[0]).toHaveProperty('routeType', 'channel_mapping');
      expect(result.connections[0].routes[0]).toHaveProperty('sourceIdentifier', '#general');
    });

    it('should throw 404 for non-existent agent', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.getAgentChannels(TENANT_ID, 'nonexistent-agent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should filter out routes from other tenants (tenant isolation)', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(createMockAgent());
      // Only the tenant's own connection is returned by findMany (query is scoped to tenantId)
      mockPrisma.channelConnection.findMany.mockResolvedValue([createMockConnection()]);

      // Route with connection belonging to a different tenant
      const routes = [
        createMockRoute(),
        createMockRoute({
          id: 'route-uuid-other',
          connectionId: 'conn-other',
          connection: {
            id: 'conn-other',
            platform: 'TEAMS',
            workspaceName: 'Other Workspace',
            status: 'active',
            tenantId: OTHER_TENANT_ID,
          },
        }),
      ];
      mockPrisma.channelRouting.findMany.mockResolvedValue(routes);

      const result = await service.getAgentChannels(TENANT_ID, AGENT_ID);

      // Only the connection belonging to TENANT_ID should appear
      // (conn-other's route references a connection not in the tenant's connection set)
      expect(result.connections).toHaveLength(1);
      expect(result.connections[0].id).toBe(CONNECTION_ID);
    });
  });

  // =========================================================================
  // createAgentChannelRoute
  // =========================================================================
  describe('createAgentChannelRoute', () => {
    const createDto = {
      routeType: 'channel_mapping' as const,
      sourceIdentifier: '#general',
      priority: 10,
    };

    it('should create route via ChannelRoutingService', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(createMockAgent());
      mockPrisma.channelConnection.findFirst.mockResolvedValue(
        createMockConnection(),
      );
      mockChannelRoutingService.createRoute.mockResolvedValue({
        id: ROUTE_ID,
        ...createDto,
      });

      const result = await service.createAgentChannelRoute(
        TENANT_ID,
        AGENT_ID,
        CONNECTION_ID,
        createDto,
        USER_ID,
      );

      expect(mockChannelRoutingService.createRoute).toHaveBeenCalledWith(
        CONNECTION_ID,
        expect.objectContaining({
          routeType: 'channel_mapping',
          sourceIdentifier: '#general',
          agentId: AGENT_ID,
          priority: 10,
        }),
        TENANT_ID,
        USER_ID,
      );
      expect(result).toHaveProperty('id', ROUTE_ID);
    });

    it('should throw 404 for non-existent agent', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.createAgentChannelRoute(
          TENANT_ID,
          'nonexistent-agent',
          CONNECTION_ID,
          createDto,
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw 404 for non-existent connection', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(createMockAgent());
      mockPrisma.channelConnection.findFirst.mockResolvedValue(null);

      await expect(
        service.createAgentChannelRoute(
          TENANT_ID,
          AGENT_ID,
          'nonexistent-conn',
          createDto,
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // deleteAgentChannelRoute
  // =========================================================================
  describe('deleteAgentChannelRoute', () => {
    it('should delete route successfully', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(createMockAgent());
      mockPrisma.channelRouting.findFirst.mockResolvedValue(
        createMockRoute(),
      );
      mockChannelRoutingService.deleteRoute.mockResolvedValue({
        success: true,
      });

      const result = await service.deleteAgentChannelRoute(
        TENANT_ID,
        AGENT_ID,
        CONNECTION_ID,
        ROUTE_ID,
        USER_ID,
      );

      expect(mockChannelRoutingService.deleteRoute).toHaveBeenCalledWith(
        CONNECTION_ID,
        ROUTE_ID,
        TENANT_ID,
        USER_ID,
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw 404 for non-existent agent', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteAgentChannelRoute(
          TENANT_ID,
          'nonexistent-agent',
          CONNECTION_ID,
          ROUTE_ID,
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw 404 for non-existent route', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(createMockAgent());
      mockPrisma.channelRouting.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteAgentChannelRoute(
          TENANT_ID,
          AGENT_ID,
          CONNECTION_ID,
          'nonexistent-route',
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
