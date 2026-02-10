import { Test, TestingModule } from '@nestjs/testing';
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
});
