import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ContainerConfigGeneratorService } from '../../src/container/container-config-generator.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SecretsManagerService } from '../../src/container/secrets-manager.service';

const mockPrisma = {
  tenant: {
    findUnique: jest.fn(),
  },
  agent: {
    findMany: jest.fn(),
  },
  channelConnection: {
    findMany: jest.fn(),
  },
  agentAllowlist: {
    findMany: jest.fn(),
  },
  skillInstallation: {
    findMany: jest.fn(),
  },
};

const mockSecrets = {
  getGatewayTokenForTenant: jest.fn().mockReturnValue('tenant-token'),
};

describe('ContainerConfigGeneratorService', () => {
  let service: ContainerConfigGeneratorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      modelDefaults: { tier: 'sonnet', thinkingMode: 'standard' },
    });
    mockPrisma.agent.findMany.mockResolvedValue([
      {
        id: 'agent-a',
        name: 'Agent A',
        role: 'engineering',
        modelTier: 'sonnet',
        thinkingMode: 'standard',
        temperature: 0.2,
        toolPolicy: { allow: ['git', 'npm'], deny: ['exec'] },
      },
    ]);
    mockPrisma.channelConnection.findMany.mockResolvedValue([
      {
        id: 'conn-1',
        platform: 'SLACK',
        workspaceId: 'ws-1',
        workspaceName: 'Workspace',
        routingRules: [
          {
            agentId: 'agent-a',
            routeType: 'tenant_default',
            sourceIdentifier: 'default',
          },
        ],
      },
    ]);
    mockPrisma.agentAllowlist.findMany.mockResolvedValue([
      {
        agentId: 'agent-a',
        allowedAgentId: 'agent-b',
        direction: 'both',
      },
    ]);
    mockPrisma.skillInstallation.findMany.mockResolvedValue([
      {
        agentId: 'agent-a',
        skill: {
          id: 'skill-1',
          name: 'Search',
          version: '1.0.0',
          category: 'integration',
        },
      },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContainerConfigGeneratorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SecretsManagerService, useValue: mockSecrets },
      ],
    }).compile();

    service = module.get(ContainerConfigGeneratorService);
  });

  it('should generate tenant config with agents, bindings, channels, allowlist and skills', async () => {
    const config = await service.generateForTenant('tenant-1');

    expect(config.gateway.auth.token).toBe('tenant-token');
    expect(config.agents.list['agent-a']).toBeDefined();
    expect(config.bindings.length).toBe(1);
    expect(config.channels.slack.workspaceId).toBe('ws-1');
    expect(config.messaging.allowlist['agent-a']).toEqual(['agent-b']);
    expect(config.skills['agent-a'][0].name).toBe('Search');
  });

  it('should throw when tenant does not exist', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValueOnce(null);
    await expect(service.generateForTenant('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should return empty maps/lists when no agents or channels are present', async () => {
    mockPrisma.agent.findMany.mockResolvedValueOnce([]);
    mockPrisma.channelConnection.findMany.mockResolvedValueOnce([]);
    mockPrisma.agentAllowlist.findMany.mockResolvedValueOnce([]);
    mockPrisma.skillInstallation.findMany.mockResolvedValueOnce([]);

    const config = await service.generateForTenant('tenant-1');

    expect(config.agents.list).toEqual({});
    expect(config.bindings).toEqual([]);
    expect(config.channels).toEqual({});
    expect(config.messaging.allowlist).toEqual({});
    expect(config.skills).toEqual({});
  });

  it('should ignore receive_only entries in outgoing allowlist', async () => {
    mockPrisma.agentAllowlist.findMany.mockResolvedValueOnce([
      {
        agentId: 'agent-a',
        allowedAgentId: 'agent-b',
        direction: 'receive_only',
      },
      {
        agentId: 'agent-a',
        allowedAgentId: 'agent-c',
        direction: 'send_only',
      },
    ]);

    const config = await service.generateForTenant('tenant-1');
    expect(config.messaging.allowlist['agent-a']).toEqual(['agent-c']);
  });

  it('should fall back for malformed model/tool policy fields', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValueOnce({
      id: 'tenant-1',
      modelDefaults: { tier: 42, thinkingMode: null },
    });
    mockPrisma.agent.findMany.mockResolvedValueOnce([
      {
        id: 'agent-a',
        name: 'Agent A',
        role: 'engineering',
        modelTier: null,
        thinkingMode: null,
        temperature: 0.2,
        toolPolicy: 'invalid-json',
      },
    ]);

    const config = await service.generateForTenant('tenant-1');
    expect(config.agents.list['agent-a'].model.tier).toBe('sonnet');
    expect(config.agents.list['agent-a'].model.thinkingMode).toBe('standard');
    expect(config.agents.list['agent-a'].tools.allow).toEqual([]);
  });
});
