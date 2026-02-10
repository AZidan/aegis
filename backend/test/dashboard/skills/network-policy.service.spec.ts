import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getQueueToken } from '@nestjs/bullmq';
import { NetworkPolicyService } from '../../../src/dashboard/skills/network-policy.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { PermissionService } from '../../../src/dashboard/skills/permission.service';
import { AuditService } from '../../../src/audit/audit.service';
import { ALERT_QUEUE_NAME } from '../../../src/alert/alert.constants';

const TENANT_ID = 'tenant-uuid-1';
const AGENT_ID = 'agent-uuid-1';

describe('NetworkPolicyService', () => {
  let service: NetworkPolicyService;
  let prisma: any;
  let cache: { get: jest.Mock; set: jest.Mock };
  let alertQueue: { add: jest.Mock };
  let permissionService: { normalizePermissions: jest.Mock };
  let auditService: { logAction: jest.Mock };

  beforeEach(async () => {
    prisma = {
      agent: { findMany: jest.fn() },
      tenant: { findMany: jest.fn() },
      skillInstallation: { findMany: jest.fn() },
    };
    cache = { get: jest.fn(), set: jest.fn() };
    alertQueue = { add: jest.fn().mockResolvedValue(undefined) };
    permissionService = { normalizePermissions: jest.fn() };
    auditService = { logAction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NetworkPolicyService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: getQueueToken(ALERT_QUEUE_NAME), useValue: alertQueue },
        { provide: PermissionService, useValue: permissionService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(NetworkPolicyService);
  });

  describe('generatePolicy', () => {
    it('should return cached policy if available', async () => {
      const cachedPolicy = {
        tenantId: TENANT_ID,
        rules: [],
        allowedDomains: [],
        generatedAt: new Date(),
      };
      cache.get.mockResolvedValue(cachedPolicy);

      const result = await service.generatePolicy(TENANT_ID);

      expect(result).toBe(cachedPolicy);
      expect(prisma.agent.findMany).not.toHaveBeenCalled();
    });

    it('should generate policy from installed skills', async () => {
      cache.get.mockResolvedValue(null);
      prisma.agent.findMany.mockResolvedValue([{ id: AGENT_ID }]);
      prisma.skillInstallation.findMany.mockResolvedValue([
        {
          skill: { id: 'skill-1', name: 'web-search', permissions: {} },
        },
      ]);
      permissionService.normalizePermissions.mockReturnValue({
        network: { allowedDomains: ['api.google.com', '*.openai.com'] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      });

      const result = await service.generatePolicy(TENANT_ID);

      expect(result.rules).toHaveLength(2);
      expect(result.allowedDomains).toContain('api.google.com');
      expect(result.allowedDomains).toContain('*.openai.com');
    });

    it('should return empty policy for tenant with no agents', async () => {
      cache.get.mockResolvedValue(null);
      prisma.agent.findMany.mockResolvedValue([]);

      const result = await service.generatePolicy(TENANT_ID);

      expect(result.rules).toHaveLength(0);
      expect(result.allowedDomains).toHaveLength(0);
    });

    it('should cache generated policy', async () => {
      cache.get.mockResolvedValue(null);
      prisma.agent.findMany.mockResolvedValue([{ id: AGENT_ID }]);
      prisma.skillInstallation.findMany.mockResolvedValue([]);

      await service.generatePolicy(TENANT_ID);

      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining(TENANT_ID),
        expect.any(Object),
        expect.any(Number),
      );
    });
  });

  describe('validateDomain', () => {
    beforeEach(() => {
      cache.get.mockResolvedValue(null);
      prisma.agent.findMany.mockResolvedValue([{ id: AGENT_ID }]);
    });

    it('should return allowed=true for matching domain', async () => {
      prisma.skillInstallation.findMany.mockResolvedValue([
        {
          skill: { id: 'skill-1', name: 'web-search', permissions: {} },
        },
      ]);
      permissionService.normalizePermissions.mockReturnValue({
        network: { allowedDomains: ['api.example.com'] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      });

      const result = await service.validateDomain(
        TENANT_ID,
        'api.example.com',
      );

      expect(result.allowed).toBe(true);
      expect(result.matchedRule).not.toBeNull();
    });

    it('should return allowed=false for non-matching domain', async () => {
      prisma.skillInstallation.findMany.mockResolvedValue([
        {
          skill: { id: 'skill-1', name: 'web-search', permissions: {} },
        },
      ]);
      permissionService.normalizePermissions.mockReturnValue({
        network: { allowedDomains: ['api.example.com'] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      });

      const result = await service.validateDomain(TENANT_ID, 'evil.com');

      expect(result.allowed).toBe(false);
      expect(result.matchedRule).toBeNull();
    });

    it('should trigger audit log and alert for violations', async () => {
      prisma.skillInstallation.findMany.mockResolvedValue([]);

      await service.validateDomain(TENANT_ID, 'blocked.com', AGENT_ID);

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'network_policy_violation' }),
      );
      expect(alertQueue.add).toHaveBeenCalledWith(
        'evaluate-event',
        expect.objectContaining({ action: 'network_policy_violation' }),
      );
    });
  });

  describe('domainMatches', () => {
    it('should match exact domain', () => {
      expect(
        service.domainMatches('api.example.com', 'api.example.com'),
      ).toBe(true);
    });

    it('should match wildcard domain', () => {
      expect(service.domainMatches('api.example.com', '*.example.com')).toBe(
        true,
      );
    });

    it('should match deep subdomain with wildcard', () => {
      expect(
        service.domainMatches('deep.api.example.com', '*.example.com'),
      ).toBe(true);
    });

    it('should not match unrelated domain with wildcard', () => {
      expect(service.domainMatches('other.com', '*.example.com')).toBe(false);
    });

    it('should match everything with *', () => {
      expect(service.domainMatches('anything.com', '*')).toBe(true);
    });

    it('should match base domain with wildcard', () => {
      expect(service.domainMatches('example.com', '*.example.com')).toBe(true);
    });

    it('should not match partial domain names', () => {
      expect(service.domainMatches('notexample.com', '*.example.com')).toBe(
        false,
      );
    });
  });

  describe('getAllPolicies', () => {
    it('should return policies for all active tenants', async () => {
      prisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-1' },
        { id: 'tenant-2' },
      ]);
      cache.get.mockResolvedValue(null);
      prisma.agent.findMany.mockResolvedValue([]);

      const result = await service.getAllPolicies();

      expect(result).toHaveLength(2);
    });
  });
});
