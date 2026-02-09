import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PermissionService } from '../../../src/dashboard/skills/permission.service';
import { AuditService } from '../../../src/audit/audit.service';
import {
  PermissionManifest,
  LegacyPermissions,
} from '../../../src/dashboard/skills/interfaces/permission-manifest.interface';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const validManifest: PermissionManifest = {
  network: { allowedDomains: ['api.example.com', '*.openai.com'] },
  files: { readPaths: ['/data/input'], writePaths: ['/data/output'] },
  env: { required: ['API_KEY'], optional: ['DEBUG'] },
};

const legacyPermissions: LegacyPermissions = {
  network: ['https://*'],
  files: ['/tmp/data'],
  env: ['SECRET_TOKEN'],
};

// ---------------------------------------------------------------------------
// Test Suite: PermissionService
// ---------------------------------------------------------------------------
describe('PermissionService', () => {
  let service: PermissionService;
  let auditService: { logAction: jest.Mock };

  beforeEach(async () => {
    auditService = { logAction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // validateManifest
  // =========================================================================
  describe('validateManifest', () => {
    it('should return validated object for a valid manifest', () => {
      const result = service.validateManifest(validManifest);

      expect(result).toEqual(validManifest);
    });

    it('should throw BadRequestException for an invalid manifest', () => {
      const invalid = { network: 'not-an-object', files: {}, env: {} };

      expect(() => service.validateManifest(invalid)).toThrow(
        BadRequestException,
      );
    });

    it('should apply defaults for missing nested fields', () => {
      const partial = {
        network: {},
        files: {},
        env: {},
      };

      const result = service.validateManifest(partial);

      expect(result).toEqual({
        network: { allowedDomains: [] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      });
    });
  });

  // =========================================================================
  // isLegacyFormat
  // =========================================================================
  describe('isLegacyFormat', () => {
    it('should return true for legacy format', () => {
      expect(service.isLegacyFormat(legacyPermissions)).toBe(true);
    });

    it('should return false for new format', () => {
      expect(service.isLegacyFormat(validManifest)).toBe(false);
    });
  });

  // =========================================================================
  // migrateOldFormat
  // =========================================================================
  describe('migrateOldFormat', () => {
    it('should map legacy arrays to new structure correctly', () => {
      const result = service.migrateOldFormat(legacyPermissions);

      expect(result).toEqual({
        network: { allowedDomains: ['https://*'] },
        files: { readPaths: ['/tmp/data'], writePaths: [] },
        env: { required: ['SECRET_TOKEN'], optional: [] },
      });
    });

    it('should handle empty/missing arrays gracefully', () => {
      const empty: LegacyPermissions = {
        network: [],
        files: [],
        env: [],
      };

      const result = service.migrateOldFormat(empty);

      expect(result).toEqual({
        network: { allowedDomains: [] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      });
    });
  });

  // =========================================================================
  // normalizePermissions
  // =========================================================================
  describe('normalizePermissions', () => {
    it('should migrate legacy format transparently', () => {
      const result = service.normalizePermissions(legacyPermissions);

      expect(result.network.allowedDomains).toEqual(['https://*']);
      expect(result.files.readPaths).toEqual(['/tmp/data']);
      expect(result.files.writePaths).toEqual([]);
      expect(result.env.required).toEqual(['SECRET_TOKEN']);
      expect(result.env.optional).toEqual([]);
    });

    it('should validate and return new format as-is', () => {
      const result = service.normalizePermissions(validManifest);

      expect(result).toEqual(validManifest);
    });

    it('should return empty defaults for null input', () => {
      const result = service.normalizePermissions(null);

      expect(result).toEqual({
        network: { allowedDomains: [] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      });
    });

    it('should return empty defaults for undefined input', () => {
      const result = service.normalizePermissions(undefined);

      expect(result).toEqual({
        network: { allowedDomains: [] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      });
    });
  });

  // =========================================================================
  // computeDiff
  // =========================================================================
  describe('computeDiff', () => {
    it('should compute additions, removals, and unchanged values', () => {
      const existing: PermissionManifest = {
        network: { allowedDomains: ['a.com', 'b.com'] },
        files: { readPaths: ['/old'], writePaths: ['/shared'] },
        env: { required: ['KEY1'], optional: ['OPT1'] },
      };
      const incoming: PermissionManifest = {
        network: { allowedDomains: ['b.com', 'c.com'] },
        files: { readPaths: ['/new'], writePaths: ['/shared'] },
        env: { required: ['KEY2'], optional: ['OPT1', 'OPT2'] },
      };

      const diff = service.computeDiff(existing, incoming);

      expect(diff.added.network).toEqual({ allowedDomains: ['c.com'] });
      expect(diff.removed.network).toEqual({ allowedDomains: ['a.com'] });
      expect(diff.unchanged.network).toEqual({ allowedDomains: ['b.com'] });

      expect(diff.added.files?.readPaths).toEqual(['/new']);
      expect(diff.removed.files?.readPaths).toEqual(['/old']);
      expect(diff.unchanged.files?.writePaths).toEqual(['/shared']);

      expect(diff.added.env?.required).toEqual(['KEY2']);
      expect(diff.removed.env?.required).toEqual(['KEY1']);
      expect(diff.added.env?.optional).toEqual(['OPT2']);
      expect(diff.unchanged.env?.optional).toEqual(['OPT1']);
    });
  });

  // =========================================================================
  // checkPolicyCompatibility
  // =========================================================================
  describe('checkPolicyCompatibility', () => {
    it('should return compatible true when policy allows all required permissions', () => {
      const result = service.checkPolicyCompatibility(validManifest, {
        allow: ['network', 'filesystem'],
      });

      expect(result.compatible).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it('should return violations when network access is needed but not allowed', () => {
      const result = service.checkPolicyCompatibility(validManifest, {
        allow: ['filesystem'],
      });

      expect(result.compatible).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toContain('network access');
    });

    it('should return violations when filesystem access is needed but not allowed', () => {
      const result = service.checkPolicyCompatibility(validManifest, {
        allow: ['network'],
      });

      expect(result.compatible).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toContain('filesystem access');
    });

    it('should return compatible true when manifest requires no permissions', () => {
      const emptyManifest: PermissionManifest = {
        network: { allowedDomains: [] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      };

      const result = service.checkPolicyCompatibility(emptyManifest, {
        allow: [],
      });

      expect(result.compatible).toBe(true);
      expect(result.violations).toEqual([]);
    });
  });

  // =========================================================================
  // logPermissionViolation
  // =========================================================================
  describe('logPermissionViolation', () => {
    it('should call auditService.logAction with correct parameters', () => {
      const violation = {
        skillId: 'skill-1',
        agentId: 'agent-1',
        violationType: 'network' as const,
        detail: 'Attempted access to blocked.com',
        timestamp: new Date('2026-02-09T10:00:00Z'),
      };

      service.logPermissionViolation(violation, 'tenant-1');

      expect(auditService.logAction).toHaveBeenCalledWith({
        actorType: 'agent',
        actorId: 'agent-1',
        actorName: 'agent-1',
        action: 'permission_violation',
        targetType: 'skill',
        targetId: 'skill-1',
        details: {
          violationType: 'network',
          detail: 'Attempted access to blocked.com',
        },
        severity: 'warning',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
      });
    });
  });
});
