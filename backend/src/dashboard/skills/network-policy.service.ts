import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionService } from './permission.service';
import { AuditService } from '../../audit/audit.service';
import { ALERT_QUEUE_NAME } from '../../alert/alert.constants';
import {
  NetworkPolicy,
  PolicyRule,
  PolicyViolationEvent,
} from './interfaces/network-policy.interface';

const POLICY_CACHE_PREFIX = 'network-policy:';
const POLICY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class NetworkPolicyService {
  private readonly logger = new Logger(NetworkPolicyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectQueue(ALERT_QUEUE_NAME) private readonly alertQueue: Queue,
  ) {}

  /**
   * Generate the aggregated network policy for a tenant.
   * Collects all installed skills' allowedDomains.
   */
  async generatePolicy(tenantId: string): Promise<NetworkPolicy> {
    const cacheKey = `${POLICY_CACHE_PREFIX}${tenantId}`;
    const cached = await this.cache.get<NetworkPolicy>(cacheKey);
    if (cached) return cached;

    // Get all agents in tenant
    const agents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const agentIds = agents.map((a) => a.id);

    if (agentIds.length === 0) {
      const emptyPolicy: NetworkPolicy = {
        tenantId,
        rules: [],
        allowedDomains: [],
        generatedAt: new Date(),
      };
      await this.cache.set(cacheKey, emptyPolicy, POLICY_CACHE_TTL);
      return emptyPolicy;
    }

    // Get all installed skills with their permissions
    const installations = await this.prisma.skillInstallation.findMany({
      where: { agentId: { in: agentIds } },
      include: {
        skill: {
          select: {
            id: true,
            name: true,
            permissions: true,
          },
        },
      },
    });

    // Aggregate rules from all skills
    const rules: PolicyRule[] = [];
    const domainSet = new Set<string>();

    for (const installation of installations) {
      const manifest = this.permissionService.normalizePermissions(
        installation.skill.permissions,
      );
      for (const domain of manifest.network.allowedDomains) {
        rules.push({
          domain,
          skillId: installation.skill.id,
          skillName: installation.skill.name,
        });
        domainSet.add(domain);
      }
    }

    const policy: NetworkPolicy = {
      tenantId,
      rules,
      allowedDomains: Array.from(domainSet).sort(),
      generatedAt: new Date(),
    };

    await this.cache.set(cacheKey, policy, POLICY_CACHE_TTL);
    return policy;
  }

  /**
   * Validate whether a domain is allowed by the tenant's network policy.
   * Supports exact match and wildcard matching (*.example.com).
   */
  async validateDomain(
    tenantId: string,
    domain: string,
    agentId?: string,
  ): Promise<PolicyViolationEvent> {
    const policy = await this.generatePolicy(tenantId);

    let matchedRule: PolicyRule | null = null;

    for (const rule of policy.rules) {
      if (this.domainMatches(domain, rule.domain)) {
        matchedRule = rule;
        break;
      }
    }

    const event: PolicyViolationEvent = {
      tenantId,
      agentId: agentId || 'unknown',
      requestedDomain: domain,
      allowed: matchedRule !== null,
      matchedRule,
      timestamp: new Date(),
    };

    // If domain is blocked, log violation and trigger alert
    if (!event.allowed) {
      this.auditService.logAction({
        actorType: 'agent',
        actorId: event.agentId,
        actorName: event.agentId,
        action: 'network_policy_violation',
        targetType: 'skill',
        targetId: domain,
        details: {
          requestedDomain: domain,
          tenantId,
        },
        severity: 'warning',
        tenantId,
        agentId: event.agentId,
      });

      // Fire-and-forget alert evaluation
      await this.alertQueue
        .add('evaluate-event', {
          action: 'network_policy_violation',
          actorId: event.agentId,
          tenantId,
          details: { requestedDomain: domain },
          timestamp: event.timestamp.toISOString(),
        })
        .catch((err) => {
          this.logger.warn(
            `Failed to enqueue alert evaluation: ${err.message}`,
          );
        });
    }

    return event;
  }

  /**
   * Get aggregated network policies for all tenants (admin view).
   */
  async getAllPolicies(): Promise<NetworkPolicy[]> {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    const policies: NetworkPolicy[] = [];
    for (const tenant of tenants) {
      const policy = await this.generatePolicy(tenant.id);
      policies.push(policy);
    }

    return policies;
  }

  /**
   * Match a domain against a pattern (supports wildcards).
   * Examples:
   *   domainMatches('api.example.com', 'api.example.com') -> true
   *   domainMatches('api.example.com', '*.example.com') -> true
   *   domainMatches('deep.api.example.com', '*.example.com') -> true
   *   domainMatches('other.com', '*.example.com') -> false
   */
  domainMatches(domain: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === domain) return true;

    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1); // '.example.com'
      return domain.endsWith(suffix) || domain === pattern.slice(2);
    }

    return false;
  }
}
