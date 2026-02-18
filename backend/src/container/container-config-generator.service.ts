import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenClawConfig } from './interfaces/openclaw-config.interface';
import { SecretsManagerService } from './secrets-manager.service';

@Injectable()
export class ContainerConfigGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secretsManager: SecretsManagerService,
  ) {}

  async generateForTenant(tenantId: string): Promise<OpenClawConfig> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        modelDefaults: true,
      },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const [agents, connections, allowlistRows, installations] = await Promise.all([
      this.prisma.agent.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          role: true,
          modelTier: true,
          thinkingMode: true,
          temperature: true,
          toolPolicy: true,
        },
      }),
      this.prisma.channelConnection.findMany({
        where: { tenantId, status: 'active' },
        select: {
          id: true,
          platform: true,
          workspaceId: true,
          workspaceName: true,
          routingRules: {
            where: { isActive: true },
            select: {
              agentId: true,
              routeType: true,
              sourceIdentifier: true,
            },
          },
        },
      }),
      this.prisma.agentAllowlist.findMany({
        where: { agent: { tenantId } },
        select: {
          agentId: true,
          allowedAgentId: true,
          direction: true,
        },
      }),
      this.prisma.skillInstallation.findMany({
        where: { agent: { tenantId } },
        select: {
          agentId: true,
          skill: {
            select: {
              id: true,
              name: true,
              version: true,
              category: true,
            },
          },
        },
      }),
    ]);

    const defaultModel = this.readModelDefaults(tenant.modelDefaults);
    const agentList: OpenClawConfig['agents']['list'] = [];
    for (const agent of agents) {
      const policy = this.readToolPolicy(agent.toolPolicy);

      // Build allowlist from inter-agent allowlist for this agent
      const agentAllowlist = allowlistRows
        .filter((r) => r.agentId === agent.id && (r.direction === 'both' || r.direction === 'send_only'))
        .map((r) => r.allowedAgentId);

      agentList.push({
        id: agent.id,
        workspace: `/home/node/.openclaw/workspace-${agent.id}`,
        identity: {
          name: agent.name,
        },
        tools: {
          profile: 'full',
          allow: policy.allow.length > 0 ? policy.allow : undefined,
          deny: policy.deny.length > 0 ? [...policy.deny, 'elevated'] : ['elevated'],
        },
        subagents: agentAllowlist.length > 0
          ? { allowAgents: agentAllowlist }
          : undefined,
      });
    }

    const bindings: OpenClawConfig['bindings'] = [];
    const channels: OpenClawConfig['channels'] = {};
    for (const connection of connections) {
      const key = connection.platform.toLowerCase();
      // Only include OpenClaw-recognized fields in channels config.
      // Aegis-specific metadata (connectionId, workspaceName, dmPolicy) is
      // managed by Aegis's own routing service, not OpenClaw.
      channels[key] = {};
      for (const rule of connection.routingRules) {
        bindings.push({
          agentId: rule.agentId,
          match: {
            channel: key,
            accountId: connection.workspaceId,
          },
        });
      }
    }

    const allowlist: Record<string, string[]> = {};
    for (const row of allowlistRows) {
      const current = allowlist[row.agentId] ?? [];
      if (row.direction === 'both' || row.direction === 'send_only') {
        current.push(row.allowedAgentId);
      }
      allowlist[row.agentId] = Array.from(new Set(current));
    }

    const skills: OpenClawConfig['skills'] = {};
    for (const item of installations) {
      const list = skills[item.agentId] ?? [];
      list.push({
        skillId: item.skill.id,
        name: item.skill.name,
        version: item.skill.version,
        category: item.skill.category.toString(),
      });
      skills[item.agentId] = list;
    }

    return {
      gateway: {
        mode: 'local',
        bind: 'lan',
        port: 18789,
        auth: {
          mode: 'token',
          token: this.secretsManager.getGatewayTokenForTenant(tenantId),
        },
        controlUi: {
          enabled: false,
        },
        http: {
          endpoints: {
            responses: { enabled: true },
          },
        },
      },
      hooks: {
        enabled: true,
        token: this.secretsManager.getHookTokenForTenant(tenantId),
      },
      agents: {
        defaults: {
          workspace: '/home/node/.openclaw/workspace',
          maxConcurrent: 4,
          model: {
            primary: this.resolveModelId(defaultModel.tier),
          },
          compaction: {
            mode: 'safeguard',
          },
        },
        list: agentList,
      },
      bindings,
      channels,
      skills,
      logging: {
        redactSensitive: 'tools',
        redactPatterns: [
          '\\bsk-[A-Za-z0-9_-]{20,}\\b',
          '\\bxoxb-[A-Za-z0-9-]+\\b',
          '\\b[0-9]+:[A-Za-z0-9_-]{35}\\b',
        ],
      },
      tools: {
        deny: ['elevated'],
        sandbox: {
          tools: {
            deny: ['exec', 'process'],
          },
        },
      },
    };
  }

  private readToolPolicy(value: unknown): { allow: string[]; deny: string[] } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { allow: [], deny: [] };
    }
    const record = value as Record<string, unknown>;
    const allow = Array.isArray(record.allow)
      ? record.allow.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const deny = Array.isArray(record.deny)
      ? record.deny.filter((entry): entry is string => typeof entry === 'string')
      : [];
    return { allow, deny };
  }

  private static readonly MODEL_MAP: Record<string, string> = {
    sonnet: 'anthropic/claude-sonnet-4-5',
    opus: 'anthropic/claude-opus-4-5',
    haiku: 'anthropic/claude-haiku-4-5',
  };

  private resolveModelId(tier: string): string {
    return (
      ContainerConfigGeneratorService.MODEL_MAP[tier] ??
      (tier.includes('/') ? tier : `anthropic/claude-${tier}`)
    );
  }

  private readModelDefaults(value: unknown): { tier: string; thinkingMode: string } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { tier: 'sonnet', thinkingMode: 'standard' };
    }
    const record = value as Record<string, unknown>;
    return {
      tier: typeof record.tier === 'string' ? record.tier : 'sonnet',
      thinkingMode:
        typeof record.thinkingMode === 'string'
          ? record.thinkingMode
          : 'standard',
    };
  }
}
